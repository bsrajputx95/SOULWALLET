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

        // Step 2: Check Jupiter Price API (indicates liquid token)
        try {
            const response = await axios.get(`${JUPITER_PRICE_API}?ids=${address}`, {
                timeout: 5000
            });
            const data = response.data.data?.[address];
            if (data && data.price) {
                return {
                    valid: true,
                    source: 'jupiter',
                    symbol: data.mintSymbol,
                    name: data.mintSymbol,
                    price: data.price,
                    verified: true
                };
            }
        } catch {
            // Continue to next source
        }

        // Step 3: Check Pump.fun API for new tokens
        try {
            const response = await axios.get(`${PUMP_FUN_API}/${address}`, {
                timeout: 5000
            });
            if (response.data) {
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
            // Continue to next source
        }

        // Step 4: Check BirdEye API
        const birdeyeKey = process.env.BIRDEYE_API_KEY;
        if (birdeyeKey) {
            try {
                const response = await axios.get(`${BIRDEYE_API}?address=${address}`, {
                    headers: { 'X-API-KEY': birdeyeKey },
                    timeout: 5000
                });
                const data = response.data.data;
                if (data) {
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
                // Continue to fallback
            }
        }

        // Step 5: Valid address but no price data found
        return {
            valid: true,
            source: 'unknown',
            symbol: 'Unknown',
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
