import axios from 'axios';

// CoinGecko Price API (FREE - no API key needed)
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Cache for prices (10 second TTL)
const priceCache = new Map<string, { price: number; timestamp: number }>();
const CACHE_TTL = 10 * 1000; // 10 seconds

/**
 * Fetch current token price from CoinGecko API
 * @param coinId CoinGecko coin ID (e.g., 'bitcoin', 'ethereum', 'solana')
 * @returns Price in USD (or 0 if not found)
 */
export async function getTokenPrice(coinId: string): Promise<number> {
    const now = Date.now();
    const cached = priceCache.get(coinId);
    
    // Return cached price if valid
    if (cached && now - cached.timestamp < CACHE_TTL) {
        return cached.price;
    }

    try {
        const response = await axios.get(`${COINGECKO_API}/simple/price`, {
            params: { 
                ids: coinId,
                vs_currencies: 'usd'
            },
            timeout: 5000
        });

        const price = response.data?.[coinId]?.usd || 0;

        // Cache the price
        priceCache.set(coinId, { price, timestamp: now });
        
        return price;
    } catch (error) {
        console.warn(`Failed to fetch price for ${coinId}:`, error);
        // Return cached price even if expired, or 0
        return cached?.price || 0;
    }
}

/**
 * Fetch multiple token prices at once
 * @param coinIds Array of CoinGecko coin IDs
 * @returns Map of coinId -> price
 */
export async function getTokenPrices(coinIds: string[]): Promise<Record<string, number>> {
    const now = Date.now();
    const result: Record<string, number> = {};
    const toFetch: string[] = [];

    // Check cache first
    for (const coinId of coinIds) {
        const cached = priceCache.get(coinId);
        if (cached && now - cached.timestamp < CACHE_TTL) {
            result[coinId] = cached.price;
        } else {
            toFetch.push(coinId);
        }
    }

    if (toFetch.length === 0) {
        return result;
    }

    try {
        const response = await axios.get(`${COINGECKO_API}/simple/price`, {
            params: { 
                ids: toFetch.join(','),
                vs_currencies: 'usd'
            },
            timeout: 5000
        });

        const data = response.data || {};
        
        for (const coinId of toFetch) {
            const price = data[coinId]?.usd || 0;
            result[coinId] = price;
            priceCache.set(coinId, { price, timestamp: now });
        }
    } catch (error) {
        console.warn('Failed to fetch prices:', error);
        // Use cached prices for failed fetches
        for (const coinId of toFetch) {
            result[coinId] = priceCache.get(coinId)?.price || 0;
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
