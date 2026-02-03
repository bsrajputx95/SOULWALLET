import 'react-native-get-random-values';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import { getKeypairForSigning, getLocalPublicKey } from './wallet';

const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6';
const JUPITER_TOKEN_API = 'https://api.jup.ag/tokens?tags=verified';
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.EXPO_PUBLIC_HELIUS_API_KEY}`;

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
        const timeout = setTimeout(() => controller.abort(), 30000);
        const response = await fetch(JUPITER_TOKEN_API, { signal: controller.signal });
        clearTimeout(timeout);
        
        if (!response.ok) {
            throw new Error('Failed to fetch token list');
        }

        const tokens: any[] = await response.json();
        tokenListCache = tokens
            .filter(t => t.tags?.includes('verified') && t.symbol && t.name && t.address && t.decimals !== undefined)
            .map(t => ({
                symbol: t.symbol,
                name: t.name,
                address: t.address,
                decimals: t.decimals,
                logoURI: t.logoURI,
            }));
        tokenListCacheTime = now;
        return tokenListCache;
    } catch (error) {
        if (tokenListCache && tokenListCache.length > 0) return tokenListCache;
        // Return hardcoded fallback for critical tokens
        return [
            { symbol: 'SOL', name: 'Solana', address: 'So11111111111111111111111111111111111111112', decimals: 9 },
            { symbol: 'USDC', name: 'USD Coin', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
            { symbol: 'USDT', name: 'Tether', address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
        ];
    }
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
    try {
        const publicKey = await getLocalPublicKey();
        if (!publicKey) {
            return { success: false, error: 'No wallet found. Please create a wallet first.' };
        }

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
            throw new Error(errorData.error || 'Failed to build swap transaction');
        }

        const swapData = await swapResponse.json();
        const { swapTransaction } = swapData;

        if (!swapTransaction) {
            return { success: false, error: 'No transaction returned from Jupiter' };
        }

        let keypair = await getKeypairForSigning(userPin);
        if (!keypair) {
            return { success: false, error: 'Invalid PIN. Please try again.' };
        }

        const transactionBuffer = Buffer.from(swapTransaction, 'base64');
        const transaction = VersionedTransaction.deserialize(transactionBuffer);

        transaction.sign([keypair]);

        const secretKeyRef = keypair.secretKey;
        for (let i = 0; i < secretKeyRef.length; i++) {
            secretKeyRef[i] = 0;
        }
        // @ts-ignore
        keypair = null;

        const connection = new Connection(HELIUS_RPC, 'confirmed');

        const signature = await connection.sendRawTransaction(transaction.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
        });

        const latestBlockhash = await connection.getLatestBlockhash();
        await connection.confirmTransaction(
            {
                signature,
                blockhash: latestBlockhash.blockhash,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            },
            'confirmed'
        );

        return {
            success: true,
            signature,
            explorerUrl: `https://solscan.io/tx/${signature}`,
        };
    } catch (error: any) {
        const msg = error?.message || '';
        if (msg.includes('insufficient') || msg.includes('balance')) {
            return { success: false, error: 'Insufficient balance for swap and fees' };
        }
        if (msg.includes('blockhash')) {
            return { success: false, error: 'Network busy, please retry' };
        }
        if (msg.includes('slippage') || msg.includes('Slippage')) {
            return { success: false, error: 'Price changed too much. Increase slippage or retry.' };
        }

        return { success: false, error: msg || 'Swap failed' };
    }
};
