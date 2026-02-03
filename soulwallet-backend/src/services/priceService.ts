import axios from 'axios';

const JUPITER_PRICE_API = 'https://price.jup.ag/v6/price';

// Cache for prices (10 second TTL)
const priceCache = new Map<string, { price: number; timestamp: number }>();
const CACHE_TTL = 10 * 1000; // 10 seconds

/**
 * Fetch current token price from Jupiter Price API
 * @param mintToken Token mint address
 * @returns Price in USDC (or 0 if not found)
 */
export async function getTokenPrice(mintToken: string): Promise<number> {
    const now = Date.now();
    const cached = priceCache.get(mintToken);
    
    // Return cached price if valid
    if (cached && now - cached.timestamp < CACHE_TTL) {
        return cached.price;
    }

    try {
        const response = await axios.get(JUPITER_PRICE_API, {
            params: { ids: mintToken },
            timeout: 5000
        });

        const priceData = response.data?.data?.[mintToken];
        const price = priceData?.price || 0;

        // Cache the price
        priceCache.set(mintToken, { price, timestamp: now });
        
        return price;
    } catch (error) {
        console.warn(`Failed to fetch price for ${mintToken}:`, error);
        // Return cached price even if expired, or 0
        return cached?.price || 0;
    }
}

/**
 * Fetch multiple token prices at once
 * @param mintTokens Array of token mint addresses
 * @returns Map of mint -> price
 */
export async function getTokenPrices(mintTokens: string[]): Promise<Record<string, number>> {
    const now = Date.now();
    const result: Record<string, number> = {};
    const toFetch: string[] = [];

    // Check cache first
    for (const mint of mintTokens) {
        const cached = priceCache.get(mint);
        if (cached && now - cached.timestamp < CACHE_TTL) {
            result[mint] = cached.price;
        } else {
            toFetch.push(mint);
        }
    }

    if (toFetch.length === 0) {
        return result;
    }

    try {
        const response = await axios.get(JUPITER_PRICE_API, {
            params: { ids: toFetch.join(',') },
            timeout: 5000
        });

        const data = response.data?.data || {};
        
        for (const mint of toFetch) {
            const price = data[mint]?.price || 0;
            result[mint] = price;
            priceCache.set(mint, { price, timestamp: now });
        }
    } catch (error) {
        console.warn('Failed to fetch prices:', error);
        // Use cached prices for failed fetches
        for (const mint of toFetch) {
            result[mint] = priceCache.get(mint)?.price || 0;
        }
    }

    return result;
}

/**
 * Clear price cache (useful for testing)
 */
export function clearPriceCache(): void {
    priceCache.clear();
}
