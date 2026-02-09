import 'react-native-get-random-values';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import { getKeypairForSigning, getLocalPublicKey } from './wallet';

const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6';
// Use Jupiter's strict token list (verified tokens only)
const JUPITER_TOKEN_API = 'https://token.jup.ag/strict';
// Use public Solana RPC as fallback if Helius fails
const SOLANA_RPC = process.env.EXPO_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const HELIUS_RPC = process.env.EXPO_PUBLIC_HELIUS_API_KEY 
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.EXPO_PUBLIC_HELIUS_API_KEY}`
    : SOLANA_RPC;

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

    // Use fallback tokens immediately - API often fails in React Native
    console.log('[Swap] Using fallback token list (15 tokens)');
    tokenListCache = FALLBACK_TOKENS;
    tokenListCacheTime = now;
    return tokenListCache;
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
    console.log(`[Swap] Getting quote: ${inputMint} -> ${outputMint}, amount: ${amount}`);
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

            const url = `${JUPITER_QUOTE_API}/quote?${params}`;
            console.log(`[Swap] Quote URL: ${url.substring(0, 80)}...`);
            
            const response = await fetch(url, { signal });
            console.log(`[Swap] Quote response status: ${response.status}`);
            
            if (response.ok) {
                const data = await response.json();
                console.log(`[Swap] Quote received: ${data.outAmount} out`);
                return data;
            }
            lastError = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
            console.warn(`[Swap] Quote attempt ${i+1} failed:`, lastError);
        } catch (e: any) { 
            lastError = e;
            console.warn(`[Swap] Quote attempt ${i+1} error:`, e.message || e);
        }
        if (i < 2) await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error(lastError?.error || lastError?.message || 'Quote failed after retries');
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
