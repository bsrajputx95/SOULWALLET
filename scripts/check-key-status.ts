#!/usr/bin/env npx tsx
/**
 * Check Key Status Script
 * 
 * This script shows the current status of all encryption keys and secrets.
 * Use it to monitor key health and identify upcoming rotations.
 * 
 * Usage:
 *   npx tsx scripts/check-key-status.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ROTATION_PERIOD_DAYS = parseInt(process.env.JWT_ROTATION_PERIOD_DAYS || '90');
const OVERLAP_PERIOD_DAYS = parseInt(process.env.JWT_OVERLAP_PERIOD_DAYS || '7');

function daysBetween(date1: Date, date2: Date): number {
    return Math.ceil((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(date: Date): string {
    return date.toISOString().split('T')[0]!;
}

async function checkMasterKeyStatus(): Promise<void> {
    console.log('=== Master Key Status ===');

    const keyVersions = await prisma.keyVersion.findMany({
        orderBy: { version: 'desc' },
        take: 5,
    });

    if (keyVersions.length === 0) {
        console.log('  No key versions registered');
        console.log('  Status: ⚠️  WARNING - Using environment-only keys');
        return;
    }

    for (const kv of keyVersions) {
        const status = kv.isActive ? '✅ ACTIVE' : '❌ INACTIVE';
        const expiryStatus = kv.expiresAt
            ? (kv.expiresAt < new Date() ? '⚠️  EXPIRED' : `Expires: ${formatDate(kv.expiresAt)}`)
            : 'No expiry';

        console.log(`  Version ${kv.version}: ${status}`);
        console.log(`    Algorithm: ${kv.algorithm}`);
        console.log(`    KMS Key ID: ${kv.kmsKeyId}`);
        console.log(`    Created: ${formatDate(kv.createdAt)}`);
        console.log(`    ${expiryStatus}`);
        console.log('');
    }

    // Check for wallets needing migration
    const walletsWithoutKms = await prisma.custodialWallet.count({
        where: {
            OR: [
                { dataKeyCiphertext: null },
                { dataKeyKeyId: null },
            ],
            isActive: true,
        },
    });

    if (walletsWithoutKms > 0) {
        console.log(`  ⚠️  ${walletsWithoutKms} wallets need KMS migration`);
        console.log('     Run: npx tsx scripts/migrate-to-kms.ts');
    }
}

async function checkJWTSecretStatus(): Promise<void> {
    console.log('=== JWT Secret Status ===');

    const now = new Date();

    // Check access tokens
    console.log('  ACCESS TOKENS:');
    const accessSecrets = await prisma.jWTSecretVersion.findMany({
        where: { purpose: 'access' },
        orderBy: { version: 'desc' },
        take: 3,
    });

    if (accessSecrets.length === 0) {
        console.log('    No versions registered');
        console.log('    Status: ⚠️  WARNING - Using environment-only secrets');
    } else {
        for (const secret of accessSecrets) {
            const daysUntilExpiry = daysBetween(now, secret.expiresAt);
            const status = !secret.isActive
                ? '❌ INACTIVE'
                : daysUntilExpiry <= 0
                    ? '🔴 EXPIRED'
                    : daysUntilExpiry <= OVERLAP_PERIOD_DAYS
                        ? '🟡 EXPIRING SOON'
                        : '✅ OK';

            console.log(`    Version ${secret.version}: ${status}`);
            console.log(`      Created: ${formatDate(secret.createdAt)}`);
            console.log(`      Expires: ${formatDate(secret.expiresAt)} (${daysUntilExpiry} days)`);
        }
    }

    console.log('');

    // Check refresh tokens
    console.log('  REFRESH TOKENS:');
    const refreshSecrets = await prisma.jWTSecretVersion.findMany({
        where: { purpose: 'refresh' },
        orderBy: { version: 'desc' },
        take: 3,
    });

    if (refreshSecrets.length === 0) {
        console.log('    No versions registered');
        console.log('    Status: ⚠️  WARNING - Using environment-only secrets');
    } else {
        for (const secret of refreshSecrets) {
            const daysUntilExpiry = daysBetween(now, secret.expiresAt);
            const status = !secret.isActive
                ? '❌ INACTIVE'
                : daysUntilExpiry <= 0
                    ? '🔴 EXPIRED'
                    : daysUntilExpiry <= OVERLAP_PERIOD_DAYS
                        ? '🟡 EXPIRING SOON'
                        : '✅ OK';

            console.log(`    Version ${secret.version}: ${status}`);
            console.log(`      Created: ${formatDate(secret.createdAt)}`);
            console.log(`      Expires: ${formatDate(secret.expiresAt)} (${daysUntilExpiry} days)`);
        }
    }
}

async function checkRecentOperations(): Promise<void> {
    console.log('');
    console.log('=== Recent Key Operations (Last 7 Days) ===');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const operations = await prisma.keyOperationLog.findMany({
        where: {
            createdAt: { gte: sevenDaysAgo },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
    });

    if (operations.length === 0) {
        console.log('  No key operations in the last 7 days');
    } else {
        for (const op of operations) {
            const status = op.success ? '✅' : '❌';
            console.log(`  ${status} ${op.operation} (v${op.keyVersion}) - ${formatDate(op.createdAt)}`);
            if (!op.success && op.errorMsg) {
                console.log(`     Error: ${op.errorMsg}`);
            }
        }
    }
}

async function checkEnvironmentSecrets(): Promise<void> {
    console.log('');
    console.log('=== Environment Configuration ===');

    const checks = [
        { name: 'CUSTODIAL_WALLET_MASTER_SECRET', value: process.env.CUSTODIAL_WALLET_MASTER_SECRET },
        { name: 'CUSTODIAL_WALLET_SALT', value: process.env.CUSTODIAL_WALLET_SALT },
        { name: 'JWT_SECRET', value: process.env.JWT_SECRET },
        { name: 'JWT_REFRESH_SECRET', value: process.env.JWT_REFRESH_SECRET },
        { name: 'TOTP_ENCRYPTION_KEY', value: process.env.TOTP_ENCRYPTION_KEY },
        { name: 'KMS_PROVIDER', value: process.env.KMS_PROVIDER },
    ];

    for (const check of checks) {
        if (!check.value) {
            console.log(`  ⚠️  ${check.name}: NOT SET`);
        } else if (check.value.length < 32 && check.name !== 'KMS_PROVIDER') {
            console.log(`  ⚠️  ${check.name}: SET (weak - less than 32 chars)`);
        } else {
            const multipleSecrets = check.value.includes(',');
            const suffix = multipleSecrets ? ` (${check.value.split(',').length} values)` : '';
            console.log(`  ✅ ${check.name}: SET${suffix}`);
        }
    }

    const kmsProvider = process.env.KMS_PROVIDER || 'env';
    console.log('');
    console.log(`  KMS Provider: ${kmsProvider}`);
    if (kmsProvider === 'aws') {
        console.log(`  AWS Region: ${process.env.AWS_REGION || 'NOT SET'}`);
        console.log(`  AWS KMS Key ID: ${process.env.AWS_KMS_KEY_ID ? '***SET***' : 'NOT SET'}`);
    }
}

async function main(): Promise<void> {
    console.log('='.repeat(50));
    console.log('       KEY MANAGEMENT STATUS REPORT');
    console.log('='.repeat(50));
    console.log(`  Generated: ${new Date().toISOString()}`);
    console.log(`  Rotation Period: ${ROTATION_PERIOD_DAYS} days`);
    console.log(`  Overlap Period: ${OVERLAP_PERIOD_DAYS} days`);
    console.log('='.repeat(50));
    console.log('');

    await checkEnvironmentSecrets();
    console.log('');
    await checkMasterKeyStatus();
    console.log('');
    await checkJWTSecretStatus();
    await checkRecentOperations();

    console.log('');
    console.log('='.repeat(50));

    await prisma.$disconnect();
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
