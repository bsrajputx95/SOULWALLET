import 'react-native-get-random-values';
import { Buffer } from 'buffer';
import { Keypair, VersionedTransaction } from '@solana/web3.js';
import { getKeypairForSigning, getLocalPublicKey } from './wallet';
import { api } from './api';

// Comprehensive fallback token list
const FALLBACK_TOKENS: JupiterToken[] = [
    { symbol: 'SOL', name: 'Solana', address: 'So11111111111111111111111111111111111111112', decimals: 9, logoURI: 'https://cryptologos.cc/logos/solana-sol-logo.png' },
    { symbol: 'USDC', name: 'USD Coin', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6, logoURI: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png' },
    { symbol: 'USDT', name: 'Tether', address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6, logoURI: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
    { symbol: 'BONK', name: 'Bonk', address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5, logoURI: 'https://cryptologos.cc/logos/bonk-bonk-logo.png' },
    { symbol: 'JUP', name: 'Jupiter', address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', decimals: 6, logoURI: 'https://cryptologos.cc/logos/jupiter-ag-jup-logo.png' },
    { symbol: 'RAY', name: 'Raydium', address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', decimals: 6, logoURI: 'https://cryptologos.cc/logos/raydium-ray-logo.png' },
    { symbol: 'ORCA', name: 'Orca', address: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE', decimals: 6, logoURI: 'https://cryptologos.cc/logos/orca-orca-logo.png' },
    { symbol: 'PYTH', name: 'Pyth Network', address: 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3', decimals: 6 },
    { symbol: 'JTO', name: 'Jito', address: 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL', decimals: 9 },
    { symbol: 'WIF', name: 'dogwifhat', address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', decimals: 6 },
    { symbol: 'POPCAT', name: 'Popcat', address: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr', decimals: 9 },
    { symbol: 'W', name: 'Wormhole', address: '85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ', decimals: 6 },
    { symbol: 'TNSR', name: 'Tensor', address: 'TNSRxcUxoT9xBG3de7Pi76yNzNdH1zvViMxfD4uNf9k', decimals: 9 },
    { symbol: 'SAMO', name: 'Samoyedcoin', address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', decimals: 9 },
    { symbol: 'MEW', name: 'cat in a dogs world', address: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5', decimals: 6 },
];

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
    priceImpact?: number;
    slippageBps?: number;
    routePlan: Array<{
        swapInfo: {
            label: string;
        };
    }>;
    otherAmountThreshold: string;
    requestId?: string;
    swapType?: string;
    platformFee?: any;
    feeMint?: string;
    feeBps?: number;
    inUsdValue?: number;
    outUsdValue?: number;
    swapUsdValue?: number;
}

let tokenListCache: JupiterToken[] | null = null;
let tokenListCacheTime: number = 0;
const TOKEN_CACHE_TTL = 5 * 60 * 1000;

export const getTokenList = async (): Promise<JupiterToken[]> => {
    const now = Date.now();
    if (tokenListCache && now - tokenListCacheTime < TOKEN_CACHE_TTL) {
        return tokenListCache;
    }

    // Use fallback tokens immediately - API often fails in React Native
    console.log('[Swap] Using fallback token list (15 tokens)');
    tokenListCache = FALLBACK_TOKENS;
    tokenListCacheTime = now;
    return tokenListCache;
};

// Cache for token decimals fetched from API
const decimalsCache: Record<string, number> = {};

/**
 * Get decimals for a specific token by mint address.
 * First checks the local fallback list, then fetches from Jupiter API.
 * Falls back to 9 (most common for Solana SPL tokens) if API fails.
 */
export const getTokenDecimals = async (mintAddress: string): Promise<number> => {
    // Check fallback list first
    const tokens = await getTokenList();
    const token = tokens.find(t => t.address === mintAddress);
    if (token) return token.decimals;

    // Check cache
    if (decimalsCache[mintAddress] !== undefined) {
        return decimalsCache[mintAddress];
    }

    // Fetch from Jupiter token API
    try {
        console.log(`[Swap] Fetching decimals for unknown token: ${mintAddress}`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const response = await fetch(
            `https://api.jup.ag/tokens/v1/token/${mintAddress}`,
            { signal: controller.signal }
        );
        clearTimeout(timeout);

        if (response.ok) {
            const data = await response.json();
            const decimals = data.decimals ?? 9;
            decimalsCache[mintAddress] = decimals;
            console.log(`[Swap] Token ${mintAddress} has ${decimals} decimals`);
            return decimals;
        }
    } catch (err: any) {
        console.warn(`[Swap] Failed to fetch decimals for ${mintAddress}:`, err.message);
    }

    // Default to 9 (most Solana SPL tokens use 9 decimals)
    console.log(`[Swap] Using default 9 decimals for ${mintAddress}`);
    decimalsCache[mintAddress] = 9;
    return 9;
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

    // If no results and query looks like a mint address, allow direct input
    if (results.length === 0 && query.length >= 32 && query.length <= 44) {
        // Return as a custom token entry
        return [{
            symbol: 'Unknown',
            name: 'Custom Token',
            address: query,
            decimals: 9, // Default
        }];
    }

    return results.slice(0, 20);
};

export const getQuote = async (
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number,
    signal?: AbortSignal
): Promise<SwapQuote | null> => {
    console.log(`[Swap] Getting quote via backend: ${inputMint} -> ${outputMint}, amount: ${amount}`);

    try {
        const params = new URLSearchParams({
            inputMint,
            outputMint,
            amount: amount.toString(),
            slippageBps: slippageBps.toString(),
        });

        const options: RequestInit = {};
        if (signal) {
            options.signal = signal;
        }

        const data = await api.request<SwapQuote>(`/swap/quote?${params}`, options);

        console.log(`[Swap] Quote success: ${data.outAmount} out`);
        return data;
    } catch (e: any) {
        console.error(`[Swap] Quote failed:`, e.message || e);
        throw new Error(e.message || 'Quote failed. Please try again.');
    }
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

        console.log('[Swap] Getting swap transaction from backend...');

        // Use Ultra API flow - get transaction with taker
        const swapData = await api.request<{ swapTransaction: string; requestId: string }>('/swap/transaction', {
            method: 'POST',
            body: JSON.stringify({
                inputMint: quote.inputMint,
                outputMint: quote.outputMint,
                amount: quote.inAmount,
                userPublicKey: publicKey,
                slippageBps: quote.slippageBps,
            }),
        });

        console.log(`[Swap] Got transaction from backend`);

        const { swapTransaction, requestId } = swapData;

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

        const signedTx = Buffer.from(transaction.serialize()).toString('base64');

        // Clear keypair from memory
        const secretKeyRef = keypair.secretKey;
        for (let i = 0; i < secretKeyRef.length; i++) {
            secretKeyRef[i] = 0;
        }
        keypair = null;

        console.log('[Swap] Executing swap via backend...');

        // Execute via Ultra API
        const result = await api.request<{ status: string; signature: string; error?: string }>('/swap/execute', {
            method: 'POST',
            body: JSON.stringify({
                signedTransaction: signedTx,
                requestId,
            }),
        });

        if (result.status === 'Success') {
            console.log('[Swap] Transaction successful:', result.signature);
            return {
                success: true,
                signature: result.signature,
                explorerUrl: `https://solscan.io/tx/${result.signature}`,
            };
        } else {
            console.error('[Swap] Transaction failed:', result.error);
            return { success: false, error: result.error || 'Swap execution failed' };
        }

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
