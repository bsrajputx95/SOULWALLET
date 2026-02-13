import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import prisma from '../db';
import { getConnection } from './rpcManager';

const getMasterKey = (): Buffer => {
    const secret = process.env.TRADING_WALLET_SECRET || process.env.COPY_WALLET_MASTER_KEY || process.env.JWT_SECRET || 'copy-wallet-dev-secret';
    return createHash('sha256').update(secret).digest();
};

const encryptSecretKey = (secretKey: Uint8Array): string => {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', getMasterKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(Buffer.from(secretKey)), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${iv.toString('base64')}.${authTag.toString('base64')}.${ciphertext.toString('base64')}`;
};

const decryptSecretKey = (payload: string): Uint8Array => {
    const parts = payload.split('.');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted copy wallet payload');
    }

    const [ivB64, tagB64, cipherB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');
    const ciphertext = Buffer.from(cipherB64, 'base64');

    const decipher = createDecipheriv('aes-256-gcm', getMasterKey(), iv);
    decipher.setAuthTag(authTag);
    const secret = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return new Uint8Array(secret);
};

export async function ensureCopyWallet(userId: string) {
    const existing = await prisma.copyWallet.findUnique({
        where: { userId }
    });

    if (existing) {
        return existing;
    }

    const keypair = Keypair.generate();
    const encryptedPrivateKey = encryptSecretKey(keypair.secretKey);
    const publicKey = keypair.publicKey.toBase58();

    const wallet = await prisma.copyWallet.create({
        data: {
            userId,
            publicKey,
            encryptedPrivateKey,
            status: 'active',
            allocatedAmount: 0,
            availableAmount: 0,
            reservedAmount: 0
        }
    });

    const secretKeyRef = keypair.secretKey;
    for (let i = 0; i < secretKeyRef.length; i++) {
        secretKeyRef[i] = 0;
    }

    return wallet;
}

export async function getCopyWallet(userId: string) {
    return prisma.copyWallet.findUnique({
        where: { userId }
    });
}

export async function getCopyWalletKeypair(userId: string): Promise<Keypair | null> {
    const wallet = await prisma.copyWallet.findUnique({
        where: { userId }
    });

    if (!wallet || wallet.status !== 'active') {
        return null;
    }

    try {
        const secretKey = decryptSecretKey(wallet.encryptedPrivateKey);
        return Keypair.fromSecretKey(secretKey);
    } catch {
        return null;
    }
}

export async function setCopyWalletAllocation(userId: string, totalAllocation: number) {
    const wallet = await ensureCopyWallet(userId);
    const normalizedAllocation = Math.max(0, totalAllocation);
    const delta = normalizedAllocation - wallet.allocatedAmount;
    const nextAvailable = Math.max(0, wallet.availableAmount + delta);

    return prisma.copyWallet.update({
        where: { userId },
        data: {
            allocatedAmount: normalizedAllocation,
            availableAmount: nextAvailable
        }
    });
}

export async function getCopyWalletSolBalance(publicKey: string): Promise<number> {
    try {
        const connection = getConnection();
        const lamports = await connection.getBalance(new PublicKey(publicKey), 'confirmed');
        return lamports / LAMPORTS_PER_SOL;
    } catch {
        return 0;
    }
}

