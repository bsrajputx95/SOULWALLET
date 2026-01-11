import { logger } from '../lib/logger';
import { getCacheTtls, redisCache } from '../lib/redis'

interface TokenMetadata {
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string | undefined;
}

/**
 * Fetch token metadata from Jupiter Token List API V2
 */
export async function getTokenMetadata(tokenMint: string): Promise<TokenMetadata> {
    const ttls = getCacheTtls()
    const cacheKey: `tokenMetadata:${string}` = `tokenMetadata:${tokenMint}`
    const cached = await redisCache.get<TokenMetadata>(cacheKey)
    if (cached) return cached

    try {
        // Fetch from Jupiter Token List API V2
        // Using search endpoint to query by mint address
        const response = await fetch(`https://api.jup.ag/tokens/v2/search?query=${tokenMint}`);
        const tokens = await response.json() as Array<{
            symbol: string;
            name: string;
            decimals: number;
            icon?: string;
        }>;

        // Find token in response array
        const tokenData = tokens && tokens.length > 0 ? tokens[0] : null;

        if (tokenData) {
            const metadata: TokenMetadata = {
                symbol: tokenData.symbol,
                name: tokenData.name,
                decimals: tokenData.decimals,
                logoURI: tokenData.icon || undefined,
            };

            await redisCache.set(cacheKey, metadata, ttls.tokenMetadata)
            return metadata;
        }

        // Fallback to generic token info
        logger.warn(`Token metadata not found for ${tokenMint}, using fallback`);
        const fallback: TokenMetadata = {
            symbol: tokenMint.slice(0, 4).toUpperCase(),
            name: `Token ${tokenMint.slice(0, 8)}`,
            decimals: 9, // Default Solana decimals
        };

        await redisCache.set(cacheKey, fallback, ttls.tokenMetadata)
        return fallback;
    } catch (error) {
        logger.error('Error fetching token metadata:', error);

        // Fallback to generic token info
        const fallback: TokenMetadata = {
            symbol: 'TOKEN',
            name: 'Unknown Token',
            decimals: 9,
        };

        return fallback;
    }
}

/**
 * Batch fetch metadata for multiple tokens
 */
export async function getBatchTokenMetadata(tokenMints: string[]): Promise<Map<string, TokenMetadata>> {
    const results = new Map<string, TokenMetadata>();

    for (const mint of tokenMints) {
        try {
            const metadata = await getTokenMetadata(mint);
            results.set(mint, metadata);
        } catch (error) {
            logger.error(`Failed to get metadata for ${mint}:`, error);
            results.set(mint, {
                symbol: 'TOKEN',
                name: 'Unknown',
                decimals: 9,
            });
        }
    }

    return results;
}

/**
 * Clear cache (for testing or manual refresh)
 */
export function clearMetadataCache(): void {
    void redisCache.invalidatePattern('tokenMetadata:*')
}
