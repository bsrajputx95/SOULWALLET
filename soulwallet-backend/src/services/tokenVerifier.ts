import { PublicKey } from '@solana/web3.js';
import axios from 'axios';

export interface TokenVerificationResult {
    valid: boolean;
    source?: 'jupiter' | 'pumpfun' | 'birdeye' | 'unknown';
    symbol?: string;
    name?: string;
    price?: number;
    verified?: boolean;
    error?: string;
}

const JUPITER_PRICE_API = 'https://price.jup.ag/v6/price';
const PUMP_FUN_API = 'https://api.pump.fun/coins';
const BIRDEYE_API = 'https://public-api.birdeye.so/defi/token';

export async function verifyToken(address: string): Promise<TokenVerificationResult> {
    try {
        // Step 1: Validate Solana address format
        try {
            new PublicKey(address);
        } catch {
            return { valid: false, error: 'Invalid Solana address format' };
        }

        let tokenSymbol: string | undefined;
        let tokenName: string | undefined;
        let tokenPrice: number | undefined;
        let tokenSource: TokenVerificationResult['source'];
        let tokenVerified = false;

        // Step 2: Try Jupiter Token API for metadata (most reliable for name/symbol)
        try {
            const response = await axios.get(`https://tokens.jup.ag/token/${address}`, {
                timeout: 5000
            });
            if (response.data && response.data.symbol) {
                tokenSymbol = response.data.symbol;
                tokenName = response.data.name || response.data.symbol;
                tokenSource = 'jupiter';
                tokenVerified = true;
            }
        } catch {
            // Continue to next source
        }

        // Step 3: Try Jupiter Price API for price
        try {
            const response = await axios.get(`${JUPITER_PRICE_API}?ids=${address}`, {
                timeout: 5000
            });
            const data = response.data.data?.[address];
            if (data && data.price) {
                tokenPrice = data.price;
                if (!tokenSymbol && data.mintSymbol) {
                    tokenSymbol = data.mintSymbol;
                    tokenName = data.mintSymbol;
                    tokenSource = 'jupiter';
                }
            }
        } catch {
            // Continue
        }

        // If we have symbol from Jupiter, return early
        if (tokenSymbol) {
            return {
                valid: true,
                source: tokenSource || 'jupiter',
                symbol: tokenSymbol,
                name: tokenName || tokenSymbol,
                price: tokenPrice || 0,
                verified: tokenVerified
            };
        }

        // Step 4: Check Pump.fun API for new tokens
        try {
            const response = await axios.get(`${PUMP_FUN_API}/${address}`, {
                timeout: 5000
            });
            if (response.data && response.data.symbol) {
                const { symbol, name, marketCap, totalSupply } = response.data;
                const price = totalSupply > 0 ? marketCap / totalSupply : 0;
                return {
                    valid: true,
                    source: 'pumpfun',
                    symbol,
                    name,
                    price,
                    verified: false
                };
            }
        } catch {
            // Continue
        }

        // Step 5: Check BirdEye API
        const birdeyeKey = process.env.BIRDEYE_API_KEY;
        if (birdeyeKey) {
            try {
                const response = await axios.get(`${BIRDEYE_API}?address=${address}`, {
                    headers: { 'X-API-KEY': birdeyeKey },
                    timeout: 5000
                });
                const data = response.data.data;
                if (data && data.symbol) {
                    return {
                        valid: true,
                        source: 'birdeye',
                        symbol: data.symbol,
                        name: data.name,
                        price: data.price,
                        verified: data.verified || false
                    };
                }
            } catch {
                // Continue
            }
        }

        // Step 6: Try DexScreener API as last resort
        try {
            const response = await axios.get(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
                timeout: 5000
            });
            const pairs = response.data?.pairs;
            if (pairs && pairs.length > 0) {
                const token = pairs[0].baseToken.address.toLowerCase() === address.toLowerCase()
                    ? pairs[0].baseToken
                    : pairs[0].quoteToken;
                return {
                    valid: true,
                    source: 'unknown',
                    symbol: token.symbol,
                    name: token.name,
                    price: parseFloat(pairs[0].priceUsd) || 0,
                    verified: false
                };
            }
        } catch {
            // Continue
        }

        // Step 7: Valid address but no data found anywhere
        return {
            valid: true,
            source: 'unknown',
            symbol: address.slice(0, 6) + '...',
            name: 'Unknown Token',
            price: 0,
            verified: false
        };
    } catch (error) {
        return {
            valid: false,
            error: 'Token verification failed'
        };
    }
}
