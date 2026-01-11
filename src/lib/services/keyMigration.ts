import { Keypair } from '@solana/web3.js'
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'crypto'
import prisma from '../prisma'
import { logger } from '../logger'
import { getKeyManagementService } from './keyManagement'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16

const PBKDF2_ITERATIONS = 100000
const PBKDF2_KEY_LENGTH = 32
const PBKDF2_DIGEST = 'sha256'
const SALT_LENGTH = 32

function wipe(buf: Buffer | Uint8Array | null | undefined) {
  if (!buf) return
  try {
    (buf as any).fill(0)
  } catch {
    void 0
  }
}

function deriveWalletKey(dataKey: Buffer, salt: Buffer): Buffer {
  return pbkdf2Sync(dataKey, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST)
}

function decryptLegacyWallet(params: {
  encryptedKey: string
  keyIv: string
  keyTag: string
  keySalt?: string | null
}): Uint8Array {
  const masterSecret = process.env.CUSTODIAL_WALLET_MASTER_SECRET
  if (!masterSecret) throw new Error('CUSTODIAL_WALLET_MASTER_SECRET is required to migrate legacy wallets')

  let key: Buffer
  if (params.keySalt) {
    const salt = Buffer.from(params.keySalt, 'base64')
    key = pbkdf2Sync(masterSecret, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST)
  } else {
    const salt = process.env.CUSTODIAL_WALLET_SALT
    if (!salt) throw new Error('CUSTODIAL_WALLET_SALT is required to migrate legacy wallets without keySalt')
    key = pbkdf2Sync(masterSecret, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, PBKDF2_DIGEST)
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(params.keyIv, 'base64'))
    decipher.setAuthTag(Buffer.from(params.keyTag, 'base64'))
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(params.encryptedKey, 'base64')),
      decipher.final(),
    ])
    return new Uint8Array(decrypted)
  } finally {
    wipe(key)
  }
}

async function encryptEnvelope(privateKey: Uint8Array) {
  const kms = getKeyManagementService()
  const salt = randomBytes(SALT_LENGTH)
  const { plaintext: dataKey, ciphertext: dataKeyCiphertext, keyId: dataKeyKeyId } = await kms.generateDataKey()
  const derivedKey = deriveWalletKey(dataKey, salt)

  try {
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, derivedKey, iv)
    const encrypted = Buffer.concat([cipher.update(Buffer.from(privateKey)), cipher.final()])
    const tag = cipher.getAuthTag()
    const keyVersion = await kms.getCurrentKeyVersion()
    return {
      encryptedKey: encrypted.toString('base64'),
      keyIv: iv.toString('base64'),
      keyTag: tag.toString('base64'),
      keySalt: salt.toString('base64'),
      keyVersion,
      dataKeyCiphertext,
      dataKeyKeyId,
    }
  } finally {
    wipe(derivedKey)
    wipe(dataKey)
    wipe(salt)
  }
}

export class KeyMigrationService {
  async migrateWallets(batchSize: number = 100) {
    const wallets = await prisma.custodialWallet.findMany({
      where: {
        OR: [{ dataKeyCiphertext: null }, { dataKeyKeyId: null }],
      },
      take: batchSize,
      orderBy: { createdAt: 'asc' },
    })

    let migrated = 0
    let skipped = 0
    const errors: Array<{ walletId: string; userId: string; error: string }> = []

    for (const wallet of wallets) {
      let secretKey: Uint8Array | null = null
      try {
        secretKey = decryptLegacyWallet(wallet)
        const kp = Keypair.fromSecretKey(secretKey)
        if (kp.publicKey.toBase58() !== wallet.publicKey) {
          skipped++
          continue
        }

        const enc = await encryptEnvelope(secretKey)

        await prisma.custodialWallet.update({
          where: { id: wallet.id },
          data: {
            encryptedKey: enc.encryptedKey,
            keyIv: enc.keyIv,
            keyTag: enc.keyTag,
            keySalt: enc.keySalt,
            keyVersion: enc.keyVersion,
            dataKeyCiphertext: enc.dataKeyCiphertext,
            dataKeyKeyId: enc.dataKeyKeyId,
          },
        })
        migrated++
      } catch (error: any) {
        errors.push({ walletId: wallet.id, userId: wallet.userId, error: error?.message || 'unknown' })
        logger.error('Wallet migration failed', { walletId: wallet.id, userId: wallet.userId, error })
      } finally {
        wipe(secretKey)
      }
    }

    return { scanned: wallets.length, migrated, skipped, errors }
  }
}
