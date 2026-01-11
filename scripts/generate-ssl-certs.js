#!/usr/bin/env node
/**
 * Generate SSL Certificates for PostgreSQL
 * 
 * This script generates self-signed SSL certificates for development.
 * For production, use proper CA-signed certificates.
 * 
 * Usage: node scripts/generate-ssl-certs.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

const SSL_DIR = path.join(__dirname, '..', 'ssl', 'postgres');
const ENCRYPTION_DIR = path.join(SSL_DIR, 'encryption');

// Ensure directories exist
function ensureDirectories() {
    [SSL_DIR, ENCRYPTION_DIR].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created directory: ${dir}`);
        }
    });
}

// Generate TDE encryption key
function generateEncryptionKey() {
    const keyPath = path.join(ENCRYPTION_DIR, 'data_encryption.key');

    if (fs.existsSync(keyPath)) {
        console.log('✓ Encryption key already exists');
        return;
    }

    const key = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(keyPath, key, { mode: 0o600 });
    console.log(`✓ Generated encryption key: ${keyPath}`);
}

// Generate pgcrypto application key
function generatePgcryptoKey() {
    const keyPath = path.join(ENCRYPTION_DIR, 'pgcrypto.key');

    if (fs.existsSync(keyPath)) {
        console.log('✓ pgcrypto key already exists');
        return;
    }

    const key = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(keyPath, key, { mode: 0o600 });
    console.log(`✓ Generated pgcrypto key: ${keyPath}`);
    console.log(`\n  Add to .env: PGCRYPTO_KEY=${key}\n`);
}

// Generate self-signed SSL certificates
function generateSSLCerts() {
    const certPath = path.join(SSL_DIR, 'server.crt');
    const keyPath = path.join(SSL_DIR, 'server.key');

    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        console.log('✓ SSL certificates already exist');
        return;
    }

    try {
        // Try using OpenSSL if available
        console.log('Generating SSL certificates with OpenSSL...');

        // Generate private key
        execSync(`openssl genrsa -out "${keyPath}" 2048`, { stdio: 'pipe' });

        // Generate self-signed certificate
        execSync(`openssl req -new -x509 -days 365 -key "${keyPath}" -out "${certPath}" -subj "/C=US/ST=CA/L=SF/O=SoulWallet/CN=soulwallet-postgres"`, { stdio: 'pipe' });

        console.log(`✓ Generated SSL certificate: ${certPath}`);
        console.log(`✓ Generated SSL key: ${keyPath}`);
    } catch (error) {
        console.log('OpenSSL not available. Creating placeholder files...');
        console.log('For production, generate proper certificates using OpenSSL or a CA.');

        // Create placeholder files with info
        fs.writeFileSync(certPath, '# Placeholder - Generate with OpenSSL for production\n');
        fs.writeFileSync(keyPath, '# Placeholder - Generate with OpenSSL for production\n');

        console.log(`✓ Created placeholder: ${certPath}`);
        console.log(`✓ Created placeholder: ${keyPath}`);
    }
}

// Main
console.log('=== SoulWallet PostgreSQL SSL & Encryption Setup ===\n');

ensureDirectories();
generateEncryptionKey();
generatePgcryptoKey();
generateSSLCerts();

console.log('\n=== Setup Complete ===');
console.log('\nNext steps:');
console.log('1. Add PGCRYPTO_KEY to your .env file');
console.log('2. Run: docker-compose -f docker-compose.prod.yml up -d postgres');
console.log('3. Run: npx prisma migrate dev --name add-encryption-hash-columns');
console.log('4. Run: npx ts-node scripts/backfill-hashes.ts');
