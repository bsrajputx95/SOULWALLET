#!/usr/bin/env node
/**
 * Backfill Hash Columns Script
 * 
 * Populates emailHash and walletAddressHash for existing users
 * after running the add-encryption-hash-columns migration.
 * 
 * Usage: npx ts-node scripts/backfill-hashes.ts
 * Or:    node -r ts-node/register scripts/backfill-hashes.ts
 */

import prisma from '../src/lib/prisma';
import { backfillHashes } from '../src/lib/prisma/encryption';
import { logger } from '../src/lib/logger';

async function main() {
    console.log('Starting hash backfill process...\n');

    try {
        // Check if PGCRYPTO_KEY is set
        if (!process.env.PGCRYPTO_KEY) {
            console.error('ERROR: PGCRYPTO_KEY environment variable is not set.');
            console.log('Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
            process.exit(1);
        }

        // Connect to database
        await prisma.$connect();
        console.log('✅ Connected to database\n');

        // Run backfill
        const result = await backfillHashes(prisma);

        if (result.success) {
            console.log('\n✅ Backfill completed successfully!');
            console.log(`   Processed: ${result.processed} users`);
            console.log(`   Failed: ${result.failed} users`);
        } else {
            console.log('\n❌ Backfill failed');
            process.exit(1);
        }
    } catch (error) {
        console.error('Error during backfill:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
