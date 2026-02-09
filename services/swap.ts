import 'react-native-get-random-values';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import { getKeypairForSigning, getLocalPublicKey } from './wallet';

const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6';
const JUPITER_TOKEN_API = 'https://token.jup.ag/all';
// Use public Solana RPC as fallback if Helius fails
const SOLANA_RPC = process.env.EXPO_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const HELIUS_RPC = process.env.EXPO_PUBLIC_HELIUS_API_KEY 
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.EXPO_PUBLIC_HELIUS_API_KEY}`
    : SOLANA_RPC;

export interface JupiterToken {
    symbol: string;
    name: string;
    address: string;
    decimals: number;
    logoURI?: string | undefined;
}

export interface SwapQuote {
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    priceImpactPct: string;
    routePlan: Array<{
        swapInfo: {
            label: string;
        };
    }>;
    otherAmountThreshold: string;
}

let tokenListCache: JupiterToken[] | null = null;
let tokenListCacheTime: number = 0;
const TOKEN_CACHE_TTL = 5 * 60 * 1000;

export const getTokenList = async (): Promise<JupiterToken[]> => {
    const now = Date.now();
    if (tokenListCache && now - tokenListCacheTime < TOKEN_CACHE_TTL) {
        return tokenListCache;
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const response = await fetch(JUPITER_TOKEN_API, { signal: controller.signal });
        clearTimeout(timeout);
        
        if (!response.ok) {
            throw new Error('Failed to fetch token list');
        }

        const data = await response.json();
        // Handle both array and object responses
        const tokens = Array.isArray(data) ? data : data.tokens || [];
        
        tokenListCache = tokens
            .filter((t: any) => t.symbol && t.name && t.address && t.decimals !== undefined)
            .map((t: any) => ({
                symbol: t.symbol,
                name: t.name,
                address: t.address,
                decimals: t.decimals,
                logoURI: t.logoURI || t.logo,
            }));
        tokenListCacheTime = now;
        return tokenListCache;
    } catch (error) {
        console.warn('Failed to fetch token list:', error);
        if (tokenListCache && tokenListCache.length > 0) return tokenListCache;
        // Return hardcoded fallback for critical tokens
        return [
            { symbol: 'SOL', name: 'Solana', address: 'So11111111111111111111111111111111111111112', decimals: 9, logoURI: 'https://cryptologos.cc/logos/solana-sol-logo.png' },
            { symbol: 'USDC', name: 'USD Coin', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6, logoURI: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
            { symbol: 'USDT', name: 'Tether', address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6, logoURI: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
            { symbol: 'BONK', name: 'Bonk', address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5 },
            { symbol: 'JUP', name: 'Jupiter', address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', decimals: 6 },
        ];
    }
};

/**
 * Get decimals for a specific token by mint address
 * Returns 6 as default fallback if token not found
 */
export const getTokenDecimals = async (mintAddress: string): Promise<number> => {
    const tokens = await getTokenList();
    const token = tokens.find(t => t.address === mintAddress);
    return token?.decimals ?? 6; // Default to 6 if not found
};

export const searchToken = async (query: string): Promise<JupiterToken[]> => {
    const tokens = await getTokenList();
    if (!query.trim()) {
        return tokens.slice(0, 20);
    }

    const q = query.toLowerCase().trim();
    const results = tokens.filter(
        t =>
            t.symbol.toLowerCase().includes(q) ||
            t.name.toLowerCase().includes(q) ||
            t.address.toLowerCase() === q
    );

    return results.slice(0, 20);
};

export const getQuote = async (
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number,
    signal?: AbortSignal
): Promise<SwapQuote | null> => {
    let lastError;
    for (let i = 0; i < 3; i++) {
        try {
            const params = new URLSearchParams({
                inputMint,
                outputMint,
                amount: amount.toString(),
                slippageBps: slippageBps.toString(),
                onlyDirectRoutes: 'false',
            });

            const response = await fetch(`${JUPITER_QUOTE_API}/quote?${params}`, { signal });
            if (response.ok) return await response.json();
            lastError = await response.json().catch(() => ({}));
        } catch (e) { lastError = e; }
        if (i < 2) await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error(lastError?.error || 'Quote failed after retries');
};

export const executeSwap = async (
    quote: SwapQuote,
    userPin: string
): Promise<{ success: boolean; signature?: string; explorerUrl?: string; error?: string }> => {
    let keypair: Keypair | null = null;
    try {
        const publicKey = await getLocalPublicKey();
        if (!publicKey) {
            return { success: false, error: 'No wallet found. Please create a wallet first.' };
        }

        console.log('[Swap] Getting swap transaction from Jupiter...');
        const swapResponse = await fetch(`${JUPITER_QUOTE_API}/swap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                quoteResponse: quote,
                userPublicKey: publicKey,
                wrapAndUnwrapSol: true,
                dynamicComputeUnitLimit: true,
                prioritizationFeeLamports: 'auto',
            }),
        });

        if (!swapResponse.ok) {
            const errorData = await swapResponse.json().catch(() => ({}));
            console.error('[Swap] Jupiter swap error:', errorData);
            throw new Error(errorData.error || `Failed to build swap transaction: ${swapResponse.status}`);
        }

        const swapData = await swapResponse.json();
        const { swapTransaction } = swapData;

        if (!swapTransaction) {
            return { success: false, error: 'No transaction returned from Jupiter' };
        }

        console.log('[Swap] Decrypting wallet for signing...');
        keypair = await getKeypairForSigning(userPin);
        if (!keypair) {
            return { success: false, error: 'Invalid PIN. Please try again.' };
        }

        console.log('[Swap] Deserializing transaction...');
        const transactionBuffer = Buffer.from(swapTransaction, 'base64');
        const transaction = VersionedTransaction.deserialize(transactionBuffer);

        console.log('[Swap] Signing transaction...');
        transaction.sign([keypair]);

        // Clear keypair from memory
        const secretKeyRef = keypair.secretKey;
        for (let i = 0; i < secretKeyRef.length; i++) {
            secretKeyRef[i] = 0;
        }
        keypair = null;

        console.log('[Swap] Sending transaction...');
        const connection = new Connection(HELIUS_RPC, 'confirmed');

        const signature = await connection.sendRawTransaction(transaction.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
            maxRetries: 3,
        });

        console.log('[Swap] Transaction sent:', signature);

        console.log('[Swap] Confirming transaction...');
        const latestBlockhash = await connection.getLatestBlockhash();
        await connection.confirmTransaction(
            {
                signature,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            },
            'confirmed'
        );

        console.log('[Swap] Transaction confirmed!');
        return {
            success: true,
            signature,
            explorerUrl: `https://solscan.io/tx/${signature}`,
        };
    } catch (error: any) {
        console.error('[Swap] Error:', error);
        const msg = error?.message || '';
        if (msg.includes('insufficient') || msg.includes('balance')) {
            return { success: false, error: 'Insufficient balance for swap and fees' };
        }
        if (msg.includes('blockhash') || msg.includes('expired')) {
            return { success: false, error: 'Network busy or transaction expired, please retry' };
        }
        if (msg.includes('slippage') || msg.includes('Slippage')) {
            return { success: false, error: 'Price changed too much. Increase slippage or retry.' };
        }
        if (msg.includes('PIN') || msg.includes('pin')) {
            return { success: false, error: 'Invalid PIN. Please try again.' };
        }

        return { success: false, error: msg || 'Swap failed. Please try again.' };
    }
};
