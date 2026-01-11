/**
 * Blockchain Constants
 * Solana network configuration, RPC endpoints, and blockchain-specific values
 */
export const BLOCKCHAIN = {
    /** Solana network configurations */
    NETWORK: {
        MAINNET: 'mainnet-beta',
        DEVNET: 'devnet',
        TESTNET: 'testnet',
    },

    /** Standard token mints */
    MINTS: {
        SOL: 'So11111111111111111111111111111111111111112',
        USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    },

    /** Lamports per SOL */
    LAMPORTS_PER_SOL: 1_000_000_000,

    /** Transaction configuration */
    TRANSACTION: {
        /** Maximum compute units for a transaction */
        MAX_COMPUTE_UNITS: 1_400_000,
        /** Default compute units */
        DEFAULT_COMPUTE_UNITS: 200_000,
        /** Confirmation timeout in ms */
        CONFIRMATION_TIMEOUT_MS: 30_000,
        /** Block height validity buffer */
        BLOCK_HEIGHT_BUFFER: 150,
    },

    /** RPC configuration */
    RPC: {
        /** Max retries for RPC calls */
        MAX_RETRIES: 3,
        /** Retry delay in ms */
        RETRY_DELAY_MS: 1_000,
        /** Request timeout in ms */
        TIMEOUT_MS: 10_000,
    },
} as const;

/**
 * Cryptography Constants
 * Encryption, hashing, and key derivation configuration
 */
export const CRYPTO = {
    /** AES encryption configuration */
    AES: {
        ALGORITHM: 'aes-256-gcm',
        KEY_LENGTH: 32,
        IV_LENGTH: 16,
        TAG_LENGTH: 16,
    },

    /** PBKDF2 key derivation configuration */
    PBKDF2: {
        /** Number of iterations for key derivation (OWASP recommended minimum: 600,000 for SHA-256) */
        ITERATIONS: 600_000,
        /** Output key length in bytes */
        KEY_LENGTH: 32,
        /** Hash algorithm */
        DIGEST: 'sha256',
        /** Salt length in bytes */
        SALT_LENGTH: 32,
    },

    /** HMAC configuration */
    HMAC: {
        ALGORITHM: 'sha256',
        KEY_LENGTH: 32,
    },
} as const;
