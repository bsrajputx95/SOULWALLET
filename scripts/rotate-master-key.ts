#!/usr/bin/env npx tsx
/**
 * Rotate Master Key Script
 * 
 * This script rotates the master encryption key used for custodial wallets.
 * It will:
 * 1. Generate a new master key via KMS
 * 2. Re-encrypt all custodial wallets with the new key
 * 3. Update key versions in the database
 * 4. Validate all wallets can still be decrypted
 * 
 * IMPORTANT: Run this during low-traffic periods and monitor closely.
 * 
 * Usage:
 *   npx tsx scripts/rotate-master-key.ts [--dry-run] [--batch-size=100]
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

interface RotationResult {
    totalWallets: number;
    rotated: number;
    failed: number;
    errors: Array<{ walletId: string; userId: string; error: string }>;
}

function wipe(buf: Buffer | Uint8Array | null | undefined): void {
    if (!buf) return;
    try {
        (buf as Uint8Array).fill(0);
    } catch {
        // Ignore errors
    }
}

function deriveKey(masterSecret: string, salt: Buffer): Buffer {
    return pbkdf2Sync(masterSecret, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST);
}

function decryptWallet(params: {
    encryptedKey: string;
    keyIv: string;
    keyTag: string;
    keySalt: string | null;
    masterSecret: string;
    legacySalt?: string;
}): Uint8Array {
    const { encryptedKey, keyIv, keyTag, keySalt, masterSecret, legacySalt } = params;

    let salt: Buffer;
    if (keySalt) {
        salt = Buffer.from(keySalt, 'base64');
    } else if (legacySalt) {
        salt = Buffer.from(legacySalt);
    } else {
        throw new Error('No salt available for decryption');
    }

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

async function rotateWallets(params: {
    oldSecret: string;
    newSecret: string;
    legacySalt?: string;
    batchSize: number;
    dryRun: boolean;
}): Promise<RotationResult> {
    const { oldSecret, newSecret, legacySalt, batchSize, dryRun } = params;

    const wallets = await prisma.custodialWallet.findMany({
        where: { isActive: true },
    });

    const result: RotationResult = {
        totalWallets: wallets.length,
        rotated: 0,
        failed: 0,
        errors: [],
    };

    console.log(`Found ${wallets.length} wallets to rotate`);

    for (let i = 0; i < wallets.length; i += batchSize) {
        const batch = wallets.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(wallets.length / batchSize)}`);

        for (const wallet of batch) {
            let secretKey: Uint8Array | null = null;

            try {
                // Decrypt with old key
                secretKey = decryptWallet({
                    encryptedKey: wallet.encryptedKey,
                    keyIv: wallet.keyIv,
                    keyTag: wallet.keyTag,
                    keySalt: wallet.keySalt,
                    masterSecret: oldSecret,
                    legacySalt,
                });

                // Validate keypair
                const keypair = Keypair.fromSecretKey(secretKey);
                if (keypair.publicKey.toBase58() !== wallet.publicKey) {
                    throw new Error('Public key mismatch after decryption');
                }

                // Re-encrypt with new key
                const newEncryption = encryptWallet(secretKey, newSecret);

                if (!dryRun) {
                    // Update in database
                    await prisma.custodialWallet.update({
                        where: { id: wallet.id },
                        data: {
                            encryptedKey: newEncryption.encryptedKey,
                            keyIv: newEncryption.keyIv,
                            keyTag: newEncryption.keyTag,
                            keySalt: newEncryption.keySalt,
                            keyVersion: (wallet.keyVersion || 0) + 1,
                        },
                    });

                    // Verify new encryption works
                    const verifyKey = decryptWallet({
                        ...newEncryption,
                        masterSecret: newSecret,
                    });
                    const verifyKeypair = Keypair.fromSecretKey(verifyKey);
                    wipe(verifyKey);

                    if (verifyKeypair.publicKey.toBase58() !== wallet.publicKey) {
                        throw new Error('Verification failed after re-encryption');
                    }
                }

                result.rotated++;

                if (result.rotated % 50 === 0) {
                    console.log(`  Rotated ${result.rotated}/${result.totalWallets} wallets`);
                }

            } catch (error: any) {
                result.failed++;
                result.errors.push({
                    walletId: wallet.id,
                    userId: wallet.userId,
                    error: error?.message || 'Unknown error',
                });
                console.error(`  Failed wallet ${wallet.id}: ${error?.message}`);
            } finally {
                wipe(secretKey);
            }
        }
    }

    return result;
}

async function createKeyVersionRecord(newVersion: number): Promise<void> {
    await prisma.keyVersion.create({
        data: {
            version: newVersion,
            algorithm: 'AES-256-GCM',
            kdfConfig: {
                iterations: PBKDF2_ITERATIONS,
                keyLength: PBKDF2_KEY_LENGTH,
                digest: PBKDF2_DIGEST,
            },
            kmsKeyId: 'env-master-secret',
            isActive: true,
        },
    });
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const batchSizeArg = args.find(a => a.startsWith('--batch-size='));
    const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1] || '100') : 100;

    console.log('=== Master Key Rotation Script ===');
    console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
    console.log(`Batch Size: ${batchSize}`);
    console.log('');

    const oldSecret = process.env.CUSTODIAL_WALLET_MASTER_SECRET;
    const newSecret = process.env.CUSTODIAL_WALLET_NEW_MASTER_SECRET;
    const legacySalt = process.env.CUSTODIAL_WALLET_SALT;

    if (!oldSecret) {
        console.error('ERROR: CUSTODIAL_WALLET_MASTER_SECRET is required');
        process.exit(1);
    }

    if (!newSecret) {
        console.error('ERROR: CUSTODIAL_WALLET_NEW_MASTER_SECRET is required');
        console.error('Generate a new secret and set it as CUSTODIAL_WALLET_NEW_MASTER_SECRET');
        process.exit(1);
    }

    if (oldSecret === newSecret) {
        console.error('ERROR: Old and new secrets must be different');
        process.exit(1);
    }

    // Get current key version
    const currentVersion = await prisma.keyVersion.findFirst({
        where: { isActive: true },
        orderBy: { version: 'desc' },
    });
    const newVersion = (currentVersion?.version || 0) + 1;

    console.log(`Current key version: ${currentVersion?.version || 0}`);
    console.log(`New key version: ${newVersion}`);
    console.log('');

    if (!dryRun) {
        console.log('Starting rotation in 5 seconds... Press Ctrl+C to abort.');
        await new Promise(r => setTimeout(r, 5000));
    }

    const startTime = Date.now();

    const result = await rotateWallets({
        oldSecret,
        newSecret,
        legacySalt,
        batchSize,
        dryRun,
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('');
    console.log('=== Rotation Complete ===');
    console.log(`Duration: ${duration}s`);
    console.log(`Total Wallets: ${result.totalWallets}`);
    console.log(`Rotated: ${result.rotated}`);
    console.log(`Failed: ${result.failed}`);

    if (result.errors.length > 0) {
        console.log('');
        console.log('=== Errors ===');
        for (const err of result.errors.slice(0, 10)) {
            console.log(`  Wallet ${err.walletId} (User ${err.userId}): ${err.error}`);
        }
        if (result.errors.length > 10) {
            console.log(`  ... and ${result.errors.length - 10} more errors`);
        }
    }

    if (!dryRun && result.failed === 0 && result.rotated > 0) {
        // Create key version record
        await createKeyVersionRecord(newVersion);

        // Mark old version as inactive
        if (currentVersion) {
            await prisma.keyVersion.update({
                where: { id: currentVersion.id },
                data: { isActive: false },
            });
        }

        console.log('');
        console.log('=== IMPORTANT ===');
        console.log('1. Update CUSTODIAL_WALLET_MASTER_SECRET to the new value');
        console.log('2. Remove CUSTODIAL_WALLET_NEW_MASTER_SECRET');
        console.log('3. Deploy the updated environment variables');
        console.log('4. Keep the old secret available for 24 hours for rollback');
    }

    await prisma.$disconnect();
    process.exit(result.failed > 0 ? 1 : 0);
}

main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
