#!/usr/bin/env npx tsx
/**
 * Emergency Key Rollback Script
 * 
 * This script rolls back to a previous key version in case of issues.
 * It should only be used in emergencies when a key rotation has caused problems.
 * 
 * WARNING: This will re-encrypt all wallets with the previous key.
 * 
 * Usage:
 *   npx tsx scripts/emergency-key-rollback.ts --target-version=N [--dry-run]
 */

import { PrismaClient } from '@prisma/client';
import { Keypair } from '@solana/web3.js';
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'crypto';

const prisma = new PrismaClient();

// Configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEY_LENGTH = 32;
const PBKDF2_DIGEST = 'sha256';
const SALT_LENGTH = 32;

function wipe(buf: Buffer | Uint8Array | null | undefined): void {
    if (!buf) return;
    try {
        (buf as Uint8Array).fill(0);
    } catch {
        // Ignore
    }
}

function deriveKey(masterSecret: string, salt: Buffer): Buffer {
    return pbkdf2Sync(masterSecret, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST);
}

function decryptWallet(params: {
    encryptedKey: string;
    keyIv: string;
    keyTag: string;
    keySalt: string;
    masterSecret: string;
}): Uint8Array {
    const { encryptedKey, keyIv, keyTag, keySalt, masterSecret } = params;
    const salt = Buffer.from(keySalt, 'base64');
    const key = deriveKey(masterSecret, salt);

    try {
        const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(keyIv, 'base64'));
        decipher.setAuthTag(Buffer.from(keyTag, 'base64'));
        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(encryptedKey, 'base64')),
            decipher.final(),
        ]);
        return new Uint8Array(decrypted);
    } finally {
        wipe(key);
    }
}

function encryptWallet(privateKey: Uint8Array, masterSecret: string): {
    encryptedKey: string;
    keyIv: string;
    keyTag: string;
    keySalt: string;
} {
    const salt = randomBytes(SALT_LENGTH);
    const key = deriveKey(masterSecret, salt);
    const iv = randomBytes(IV_LENGTH);

    try {
        const cipher = createCipheriv(ALGORITHM, key, iv);
        const encrypted = Buffer.concat([
            cipher.update(Buffer.from(privateKey)),
            cipher.final(),
        ]);
        const tag = cipher.getAuthTag();

        return {
            encryptedKey: encrypted.toString('base64'),
            keyIv: iv.toString('base64'),
            keyTag: tag.toString('base64'),
            keySalt: salt.toString('base64'),
        };
    } finally {
        wipe(key);
        wipe(salt);
    }
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const targetVersionArg = args.find(a => a.startsWith('--target-version='));

    if (!targetVersionArg) {
        console.error('ERROR: --target-version=N is required');
        console.error('Usage: npx tsx scripts/emergency-key-rollback.ts --target-version=N [--dry-run]');
        process.exit(1);
    }

    const targetVersion = parseInt(targetVersionArg.split('=')[1] || '0');

    console.log('=== EMERGENCY KEY ROLLBACK ===');
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log(`Target Version: ${targetVersion}`);
    console.log('');

    // Get current and target key versions
    const currentKeyVersion = await prisma.keyVersion.findFirst({
        where: { isActive: true },
        orderBy: { version: 'desc' },
    });

    const targetKeyVersion = await prisma.keyVersion.findFirst({
        where: { version: targetVersion },
    });

    if (!currentKeyVersion) {
        console.error('ERROR: No active key version found');
        process.exit(1);
    }

    if (!targetKeyVersion) {
        console.error(`ERROR: Target key version ${targetVersion} not found`);
        process.exit(1);
    }

    if (targetVersion >= currentKeyVersion.version) {
        console.error('ERROR: Target version must be older than current version');
        process.exit(1);
    }

    console.log(`Current Version: ${currentKeyVersion.version}`);
    console.log(`Rolling back to: ${targetVersion}`);
    console.log('');

    const currentSecret = process.env.CUSTODIAL_WALLET_MASTER_SECRET;
    const rollbackSecret = process.env.CUSTODIAL_WALLET_ROLLBACK_SECRET;

    if (!currentSecret) {
        console.error('ERROR: CUSTODIAL_WALLET_MASTER_SECRET is required');
        process.exit(1);
    }

    if (!rollbackSecret) {
        console.error('ERROR: CUSTODIAL_WALLET_ROLLBACK_SECRET is required (the secret for target version)');
        process.exit(1);
    }

    // Find wallets that need rollback (those with version > target)
    const walletsToRollback = await prisma.custodialWallet.findMany({
        where: {
            isActive: true,
            keyVersion: { gt: targetVersion },
        },
    });

    console.log(`Wallets to rollback: ${walletsToRollback.length}`);

    if (!dryRun && walletsToRollback.length > 0) {
        console.log('');
        console.log('!!! WARNING !!!');
        console.log('This will re-encrypt all affected wallets.');
        console.log('Starting in 10 seconds... Press Ctrl+C to abort.');
        await new Promise(r => setTimeout(r, 10000));
    }

    let rolled = 0;
    let failed = 0;
    const errors: Array<{ walletId: string; error: string }> = [];

    for (const wallet of walletsToRollback) {
        let secretKey: Uint8Array | null = null;

        try {
            if (!wallet.keySalt) {
                throw new Error('Wallet has no keySalt');
            }

            // Decrypt with current key
            secretKey = decryptWallet({
                encryptedKey: wallet.encryptedKey,
                keyIv: wallet.keyIv,
                keyTag: wallet.keyTag,
                keySalt: wallet.keySalt,
                masterSecret: currentSecret,
            });

            // Validate
            const keypair = Keypair.fromSecretKey(secretKey);
            if (keypair.publicKey.toBase58() !== wallet.publicKey) {
                throw new Error('Public key mismatch');
            }

            // Re-encrypt with rollback key
            const newEncryption = encryptWallet(secretKey, rollbackSecret);

            if (!dryRun) {
                await prisma.custodialWallet.update({
                    where: { id: wallet.id },
                    data: {
                        ...newEncryption,
                        keyVersion: targetVersion,
                    },
                });
            }

            rolled++;
        } catch (error: any) {
            failed++;
            errors.push({ walletId: wallet.id, error: error?.message || 'Unknown' });
        } finally {
            wipe(secretKey);
        }
    }

    console.log('');
    console.log('=== Rollback Complete ===');
    console.log(`Rolled back: ${rolled}`);
    console.log(`Failed: ${failed}`);

    if (errors.length > 0) {
        console.log('');
        console.log('Errors:');
        errors.slice(0, 10).forEach(e => console.log(`  ${e.walletId}: ${e.error}`));
    }

    if (!dryRun && failed === 0 && rolled > 0) {
        // Update key versions
        await prisma.keyVersion.update({
            where: { id: currentKeyVersion.id },
            data: { isActive: false },
        });

        await prisma.keyVersion.update({
            where: { id: targetKeyVersion.id },
            data: { isActive: true },
        });

        // Log the rollback
        await prisma.keyOperationLog.create({
            data: {
                operation: 'EMERGENCY_ROLLBACK',
                keyVersion: targetVersion,
                userId: null,
                success: true,
                metadata: {
                    fromVersion: currentKeyVersion.version,
                    toVersion: targetVersion,
                    walletsAffected: rolled,
                },
            },
        });

        console.log('');
        console.log('=== IMPORTANT ===');
        console.log('1. Update CUSTODIAL_WALLET_MASTER_SECRET to the rollback secret');
        console.log('2. Remove CUSTODIAL_WALLET_ROLLBACK_SECRET');
        console.log('3. Investigate what went wrong with the newer key');
    }

    await prisma.$disconnect();
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
