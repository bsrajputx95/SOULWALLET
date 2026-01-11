#!/usr/bin/env npx tsx
/**
 * Rotate JWT Secrets Script
 * 
 * This script rotates JWT access and refresh token secrets.
 * It will:
 * 1. Generate new cryptographically secure secrets
 * 2. Register them in the database
 * 3. Output the secrets for secure storage
 * 
 * Usage:
 *   npx tsx scripts/rotate-jwt-secrets.ts [--access] [--refresh] [--both]
 */

import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configuration
const SECRET_LENGTH = 64; // 64 bytes = 512 bits
const ROTATION_PERIOD_DAYS = parseInt(process.env.JWT_ROTATION_PERIOD_DAYS || '90');
const OVERLAP_PERIOD_DAYS = parseInt(process.env.JWT_OVERLAP_PERIOD_DAYS || '7');

type SecretPurpose = 'access' | 'refresh';

function generateSecureSecret(): string {
    return crypto.randomBytes(SECRET_LENGTH).toString('base64url');
}

function hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
}

async function getCurrentVersion(purpose: SecretPurpose): Promise<number> {
    const current = await prisma.jWTSecretVersion.findFirst({
        where: {
            purpose,
            isActive: true,
        },
        orderBy: { version: 'desc' },
    });
    return current?.version ?? 0;
}

async function rotateSecret(purpose: SecretPurpose, rotatedBy: string): Promise<{
    success: boolean;
    newVersion: number;
    newSecret: string;
    message: string;
}> {
    const newSecret = generateSecureSecret();
    const secretHash = hashSecret(newSecret);

    const currentVersion = await getCurrentVersion(purpose);
    const newVersion = currentVersion + 1;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ROTATION_PERIOD_DAYS + OVERLAP_PERIOD_DAYS);

    try {
        await prisma.jWTSecretVersion.create({
            data: {
                secretHash,
                version: newVersion,
                purpose,
                expiresAt,
                isActive: true,
                rotatedBy,
            },
        });

        // Log the operation
        await prisma.keyOperationLog.create({
            data: {
                operation: 'JWT_ROTATE_SCRIPT',
                keyVersion: newVersion,
                userId: rotatedBy,
                success: true,
                metadata: { purpose },
            },
        });

        return {
            success: true,
            newVersion,
            newSecret,
            message: `Rotated ${purpose} secret to version ${newVersion}`,
        };
    } catch (error: any) {
        return {
            success: false,
            newVersion: 0,
            newSecret: '',
            message: `Failed to rotate ${purpose}: ${error?.message || 'Unknown error'}`,
        };
    }
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const rotateAccess = args.includes('--access') || args.includes('--both') || args.length === 0;
    const rotateRefresh = args.includes('--refresh') || args.includes('--both') || args.length === 0;

    console.log('=== JWT Secret Rotation Script ===');
    console.log(`Rotation Period: ${ROTATION_PERIOD_DAYS} days`);
    console.log(`Overlap Period: ${OVERLAP_PERIOD_DAYS} days`);
    console.log('');

    const results: { [key: string]: { success: boolean; version: number; secret: string } } = {};

    if (rotateAccess) {
        console.log('Rotating ACCESS token secret...');
        const result = await rotateSecret('access', 'rotation-script');
        console.log(`  ${result.message}`);
        if (result.success) {
            results.access = { success: true, version: result.newVersion, secret: result.newSecret };
        }
    }

    if (rotateRefresh) {
        console.log('Rotating REFRESH token secret...');
        const result = await rotateSecret('refresh', 'rotation-script');
        console.log(`  ${result.message}`);
        if (result.success) {
            results.refresh = { success: true, version: result.newVersion, secret: result.newSecret };
        }
    }

    console.log('');
    console.log('=== New Secrets (STORE SECURELY!) ===');
    console.log('');

    if (results.access) {
        console.log('ACCESS TOKEN SECRET (add to JWT_SECRET):');
        console.log(`  ${results.access.secret}`);
        console.log(`  Version: ${results.access.version}`);
        console.log('');
    }

    if (results.refresh) {
        console.log('REFRESH TOKEN SECRET (add to JWT_REFRESH_SECRET):');
        console.log(`  ${results.refresh.secret}`);
        console.log(`  Version: ${results.refresh.version}`);
        console.log('');
    }

    console.log('=== IMPORTANT NEXT STEPS ===');
    console.log('1. Store these secrets in your secrets manager (AWS Secrets Manager, etc.)');
    console.log('2. Add the new secrets to your environment variables:');
    console.log('   - Append new secrets with comma separator (e.g., JWT_SECRET="new_secret,old_secret")');
    console.log('   - The first secret is used for signing, all secrets are used for verification');
    console.log('3. Deploy the updated configuration');
    console.log(`4. After ${OVERLAP_PERIOD_DAYS} days, remove the old secrets from the environment`);
    console.log('');

    await prisma.$disconnect();
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
