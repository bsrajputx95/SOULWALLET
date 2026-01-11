import crypto from 'crypto'
import prisma from '../prisma'
import { logger } from '../logger'

export type KmsProviderName = 'aws' | 'vault' | 'env'

export interface KeyManagementService {
  encryptDataKey(plaintext: Buffer): Promise<{ ciphertext: string; keyId: string }>
  decryptDataKey(ciphertext: string, keyId: string): Promise<Buffer>
  generateDataKey(): Promise<{ plaintext: Buffer; ciphertext: string; keyId: string }>
  rotateKey(oldKeyId: string): Promise<string>
  getCurrentKeyVersion(): Promise<number>
}

type AuditOperation = 'ENCRYPT' | 'DECRYPT' | 'ROTATE' | 'MIGRATE' | 'GENERATE_DATA_KEY'

async function auditKeyOperation(params: {
  operation: AuditOperation
  keyVersion: number
  userId?: string
  success: boolean
  errorMsg?: string
  metadata?: any
}) {
  if (process.env.ENABLE_KEY_AUDIT_LOGGING !== 'true') return
  try {
    const data: any = {
      operation: params.operation,
      keyVersion: params.keyVersion,
      success: params.success,
    }
    if (params.userId !== undefined) data.userId = params.userId
    if (params.errorMsg !== undefined) data.errorMsg = params.errorMsg
    if (params.metadata !== undefined) data.metadata = params.metadata
    await prisma.keyOperationLog.create({
      data,
    })
  } catch (error) {
    logger.warn('Failed to write key operation audit log', error)
  }
}

function getKmsProviderName(): KmsProviderName {
  const raw = (process.env.KMS_PROVIDER || 'env').toLowerCase()
  if (raw === 'aws' || raw === 'vault' || raw === 'env') return raw
  return 'env'
}

function ensureBufferWiped(buf: Buffer | null) {
  if (!buf) return
  try {
    buf.fill(0)
  } catch {
    void 0
  }
}

class EnvKeyManagementProvider implements KeyManagementService {
  private cachedWrappingKey: Buffer | null = null

  private getKeyVersionFallback(): number {
    const raw = process.env.KEY_VERSION
    const v = raw ? parseInt(raw, 10) : NaN
    return Number.isFinite(v) ? v : 1
  }

  async getCurrentKeyVersion(): Promise<number> {
    try {
      const v = await prisma.keyVersion.findFirst({
        where: { isActive: true },
        orderBy: { version: 'desc' },
        select: { version: true },
      })
      return v?.version ?? this.getKeyVersionFallback()
    } catch {
      return this.getKeyVersionFallback()
    }
  }

  private getWrappingKey(): Buffer {
    if (this.cachedWrappingKey) return this.cachedWrappingKey

    const masterSecret = process.env.CUSTODIAL_WALLET_MASTER_SECRET
    const salt = process.env.CUSTODIAL_WALLET_SALT

    if (!masterSecret || !salt) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('CUSTODIAL_WALLET_MASTER_SECRET and CUSTODIAL_WALLET_SALT are required for env KMS provider')
      }
      throw new Error('Missing CUSTODIAL_WALLET_MASTER_SECRET or CUSTODIAL_WALLET_SALT')
    }

    this.cachedWrappingKey = crypto.pbkdf2Sync(masterSecret, salt, 100000, 32, 'sha256')
    return this.cachedWrappingKey
  }

  async encryptDataKey(plaintext: Buffer): Promise<{ ciphertext: string; keyId: string }> {
    const iv = crypto.randomBytes(12)
    const wrappingKey = this.getWrappingKey()
    const cipher = crypto.createCipheriv('aes-256-gcm', wrappingKey, iv)
    const ct = Buffer.concat([cipher.update(plaintext), cipher.final()])
    const tag = cipher.getAuthTag()

    const payload = Buffer.concat([iv, tag, ct]).toString('base64')
    await auditKeyOperation({
      operation: 'ENCRYPT',
      keyVersion: await this.getCurrentKeyVersion(),
      success: true,
      metadata: { provider: 'env' },
    })
    return { ciphertext: payload, keyId: 'env' }
  }

  async decryptDataKey(ciphertext: string, _keyId: string): Promise<Buffer> {
    const raw = Buffer.from(ciphertext, 'base64')
    const iv = raw.subarray(0, 12)
    const tag = raw.subarray(12, 28)
    const ct = raw.subarray(28)

    const wrappingKey = this.getWrappingKey()
    const decipher = crypto.createDecipheriv('aes-256-gcm', wrappingKey, iv)
    decipher.setAuthTag(tag)
    const pt = Buffer.concat([decipher.update(ct), decipher.final()])

    await auditKeyOperation({
      operation: 'DECRYPT',
      keyVersion: await this.getCurrentKeyVersion(),
      success: true,
      metadata: { provider: 'env' },
    })
    return pt
  }

  async generateDataKey(): Promise<{ plaintext: Buffer; ciphertext: string; keyId: string }> {
    const pt = crypto.randomBytes(32)
    try {
      const { ciphertext, keyId } = await this.encryptDataKey(pt)
      await auditKeyOperation({
        operation: 'GENERATE_DATA_KEY',
        keyVersion: await this.getCurrentKeyVersion(),
        success: true,
        metadata: { provider: 'env' },
      })
      return { plaintext: pt, ciphertext, keyId }
    } catch (error: any) {
      ensureBufferWiped(pt)
      await auditKeyOperation({
        operation: 'GENERATE_DATA_KEY',
        keyVersion: await this.getCurrentKeyVersion(),
        success: false,
        errorMsg: error?.message || 'unknown',
        metadata: { provider: 'env' },
      })
      throw error
    }
  }

  async rotateKey(oldKeyId: string): Promise<string> {
    await auditKeyOperation({
      operation: 'ROTATE',
      keyVersion: await this.getCurrentKeyVersion(),
      success: true,
      metadata: { provider: 'env', oldKeyId },
    })
    return oldKeyId
  }
}

class AWSKMSProvider implements KeyManagementService {
  private async getClient() {
    const region = process.env.AWS_REGION
    if (!region) throw new Error('AWS_REGION is required for aws KMS provider')
    const { KMSClient } = await import('@aws-sdk/client-kms')
    return new KMSClient({ region })
  }

  private getKmsKeyId(): string {
    const keyId = process.env.AWS_KMS_KEY_ID
    if (!keyId) throw new Error('AWS_KMS_KEY_ID is required for aws KMS provider')
    return keyId
  }

  async getCurrentKeyVersion(): Promise<number> {
    try {
      const v = await prisma.keyVersion.findFirst({
        where: { isActive: true },
        orderBy: { version: 'desc' },
        select: { version: true },
      })
      return v?.version ?? 1
    } catch {
      return 1
    }
  }

  async encryptDataKey(plaintext: Buffer): Promise<{ ciphertext: string; keyId: string }> {
    const client = await this.getClient()
    const keyId = this.getKmsKeyId()
    const { EncryptCommand } = await import('@aws-sdk/client-kms')

    const res: any = await client.send(
      new EncryptCommand({
        KeyId: keyId,
        Plaintext: plaintext,
      })
    )
    const blob = Buffer.from(res.CiphertextBlob || [])
    await auditKeyOperation({
      operation: 'ENCRYPT',
      keyVersion: await this.getCurrentKeyVersion(),
      success: true,
      metadata: { provider: 'aws', keyId },
    })
    return { ciphertext: blob.toString('base64'), keyId }
  }

  async decryptDataKey(ciphertext: string, keyId: string): Promise<Buffer> {
    const client = await this.getClient()
    const { DecryptCommand } = await import('@aws-sdk/client-kms')
    const res: any = await client.send(
      new DecryptCommand({
        CiphertextBlob: Buffer.from(ciphertext, 'base64'),
        KeyId: keyId,
      })
    )
    const pt = Buffer.from(res.Plaintext || [])
    await auditKeyOperation({
      operation: 'DECRYPT',
      keyVersion: await this.getCurrentKeyVersion(),
      success: true,
      metadata: { provider: 'aws', keyId },
    })
    return pt
  }

  async generateDataKey(): Promise<{ plaintext: Buffer; ciphertext: string; keyId: string }> {
    const client = await this.getClient()
    const keyId = this.getKmsKeyId()
    const { GenerateDataKeyCommand } = await import('@aws-sdk/client-kms')
    const res: any = await client.send(
      new GenerateDataKeyCommand({
        KeyId: keyId,
        KeySpec: 'AES_256',
      })
    )
    const pt = Buffer.from(res.Plaintext || [])
    const ct = Buffer.from(res.CiphertextBlob || [])
    await auditKeyOperation({
      operation: 'GENERATE_DATA_KEY',
      keyVersion: await this.getCurrentKeyVersion(),
      success: true,
      metadata: { provider: 'aws', keyId },
    })
    return { plaintext: pt, ciphertext: ct.toString('base64'), keyId }
  }

  async rotateKey(oldKeyId: string): Promise<string> {
    await auditKeyOperation({
      operation: 'ROTATE',
      keyVersion: await this.getCurrentKeyVersion(),
      success: true,
      metadata: { provider: 'aws', oldKeyId },
    })
    return oldKeyId
  }
}

/**
 * HashiCorp Vault provider using Transit secrets engine
 * Requires: VAULT_ADDR, VAULT_TOKEN, VAULT_TRANSIT_KEY
 */
class HashiCorpVaultProvider implements KeyManagementService {
  private getVaultConfig() {
    const addr = process.env.VAULT_ADDR
    const token = process.env.VAULT_TOKEN
    const transitKey = process.env.VAULT_TRANSIT_KEY || 'soulwallet-key'

    if (!addr || !token) {
      throw new Error('VAULT_ADDR and VAULT_TOKEN are required for Vault KMS provider')
    }

    return { addr, token, transitKey }
  }

  private async vaultRequest(path: string, method: 'GET' | 'POST', body?: any): Promise<any> {
    const { addr, token } = this.getVaultConfig()

    const options: RequestInit = {
      method,
      headers: {
        'X-Vault-Token': token,
        'Content-Type': 'application/json',
      },
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(`${addr}/v1/${path}`, options)

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Vault request failed: ${response.status} - ${text}`)
    }

    return response.json()
  }

  async getCurrentKeyVersion(): Promise<number> {
    try {
      const v = await prisma.keyVersion.findFirst({
        where: { isActive: true },
        orderBy: { version: 'desc' },
        select: { version: true },
      })
      return v?.version ?? 1
    } catch {
      return 1
    }
  }

  async encryptDataKey(plaintext: Buffer): Promise<{ ciphertext: string; keyId: string }> {
    const { transitKey } = this.getVaultConfig()

    const result = await this.vaultRequest(`transit/encrypt/${transitKey}`, 'POST', {
      plaintext: plaintext.toString('base64'),
    })

    await auditKeyOperation({
      operation: 'ENCRYPT',
      keyVersion: await this.getCurrentKeyVersion(),
      success: true,
      metadata: { provider: 'vault', keyId: transitKey },
    })

    return {
      ciphertext: result.data.ciphertext,
      keyId: transitKey,
    }
  }

  async decryptDataKey(ciphertext: string, keyId: string): Promise<Buffer> {
    const result = await this.vaultRequest(`transit/decrypt/${keyId}`, 'POST', {
      ciphertext,
    })

    await auditKeyOperation({
      operation: 'DECRYPT',
      keyVersion: await this.getCurrentKeyVersion(),
      success: true,
      metadata: { provider: 'vault', keyId },
    })

    return Buffer.from(result.data.plaintext, 'base64')
  }

  async generateDataKey(): Promise<{ plaintext: Buffer; ciphertext: string; keyId: string }> {
    // Generate random 32-byte key locally
    const plaintext = crypto.randomBytes(32)

    // Encrypt it with Vault
    const { ciphertext, keyId } = await this.encryptDataKey(plaintext)

    await auditKeyOperation({
      operation: 'GENERATE_DATA_KEY',
      keyVersion: await this.getCurrentKeyVersion(),
      success: true,
      metadata: { provider: 'vault', keyId },
    })

    return { plaintext, ciphertext, keyId }
  }

  async rotateKey(oldKeyId: string): Promise<string> {
    const { transitKey } = this.getVaultConfig()

    // Rotate the key in Vault
    await this.vaultRequest(`transit/keys/${transitKey}/rotate`, 'POST', {})

    await auditKeyOperation({
      operation: 'ROTATE',
      keyVersion: await this.getCurrentKeyVersion(),
      success: true,
      metadata: { provider: 'vault', oldKeyId, newKeyId: transitKey },
    })

    return transitKey
  }
}

let cachedService: KeyManagementService | null = null

export function getKeyManagementService(): KeyManagementService {
  if (cachedService) return cachedService
  const provider = getKmsProviderName()

  // Comment 2 fix: Block startup if env provider is used in production
  if (provider === 'env' && process.env.NODE_ENV === 'production') {
    const errorMsg = `SECURITY ERROR: KMS_PROVIDER=env is not allowed in production. ` +
      `Set KMS_PROVIDER to 'aws' or 'vault' and configure the appropriate credentials. ` +
      `Using environment-based encryption in production is a critical security vulnerability.`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  if (provider === 'aws') {
    cachedService = new AWSKMSProvider()
  } else if (provider === 'vault') {
    // Check if Vault is actually implemented
    const vaultProvider = new HashiCorpVaultProvider();
    // The current Vault provider throws "not implemented" - this is a placeholder
    logger.warn('HashiCorp Vault provider selected but may not be fully implemented');
    cachedService = vaultProvider;
  } else {
    cachedService = new EnvKeyManagementProvider()
    logger.warn('Using env-based KMS provider (development only)')
  }

  return cachedService
}
