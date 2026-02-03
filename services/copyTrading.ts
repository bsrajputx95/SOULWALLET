import * as SecureStore from 'expo-secure-store';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import { executeSwap, getQuote, getTokenDecimals } from './swap';
import { getKeypairForSigning } from './wallet';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// Types
export interface CopyTradingConfig {
    id: string;
    traderAddress: string;
    totalInvestment: number;
    perTradeAmount: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    exitWithTrader: boolean;
    isActive: boolean;
}

export interface CopyTradeQueueItem {
    id: string;
    configId: string;
    traderTxSignature: string;
    traderAddress: string;
    inputMint: string;    // Token to buy (what we receive)
    inputSymbol: string;
    outputMint: string;   // Token to spend (what we pay with)
    outputSymbol: string;
    inputAmount: number;  // Amount to receive
    outputAmount: number; // Amount to spend (perTradeAmount)
    entryPrice: number;
    slPrice?: number;
    tpPrice?: number;
    status: string;
    expiresAt: string;
    createdAt: string;
}

export interface CopyPosition {
    id: string;
    configId: string;
    traderTxSignature: string;
    inputMint: string;
    inputSymbol: string;
    outputMint: string;
    outputSymbol: string;
    entryAmount: number;
    entryPrice: number;
    tokenAmount: number;
    slPrice?: number;
    tpPrice?: number;
    slOrderId?: string;
    tpOrderId?: string;
    status: string;
    closedAt?: string;
    createdAt: string;
}

interface CreateConfigParams {
    traderAddress: string;
    totalInvestment: number;
    perTradeAmount: number;
    stopLossPercent: number;
    takeProfitPercent: number;
    exitWithTrader: boolean;
}

/**
 * Create or update copy trading configuration
 */
export async function createCopyConfig(
    config: CreateConfigParams,
    authToken: string
): Promise<{ success: boolean; config?: CopyTradingConfig; error?: string }> {
    try {
        const response = await fetch(`${API_URL}/copy-trade/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`
            },
            body: JSON.stringify(config)
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error || 'Failed to create config' };
        }

        return { success: true, config: data.config };
    } catch (error: any) {
        return { success: false, error: error.message || 'Network error' };
    }
}

/**
 * Fetch user's copy trading config
 */
export async function fetchCopyConfig(
    authToken: string
): Promise<{ success: boolean; config?: CopyTradingConfig; error?: string }> {
    try {
        const response = await fetch(`${API_URL}/copy-trade/config`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error };
        }

        return { success: true, config: data.config };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Check for pending copy trade queue items
 */
export async function checkCopyTradeQueue(
    authToken: string
): Promise<{ success: boolean; queue?: CopyTradeQueueItem[]; error?: string }> {
    try {
        const response = await fetch(`${API_URL}/copy-trade/queue`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error };
        }

        return { success: true, queue: data.queue };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Execute a copy trade from queue
 * Step 1: Execute main swap
 * Step 2: Create SL limit order
 * Step 3: Create TP limit order
 * Step 4: Mark as executed
 */
export async function executeCopyTrade(
    queueItem: CopyTradeQueueItem,
    pin: string,
    authToken: string
): Promise<{ 
    success: boolean; 
    signature?: string; 
    slOrderId?: string; 
    tpOrderId?: string;
    error?: string;
}> {
    try {
        // Step 1: Execute main swap (buy the token)
        // Use outputAmount (amount to spend) with correct decimals for USDC/SOL (6 or 9)
        const outputDecimals = queueItem.outputMint === 'So11111111111111111111111111111111111111112' ? 9 : 6;
        const amountInSmallestUnits = Math.floor(
            queueItem.outputAmount * Math.pow(10, outputDecimals)
        );

        const quote = await getQuote(
            queueItem.outputMint,  // From token (what we spend, e.g., USDC)
            queueItem.inputMint,   // To token (what we buy, e.g., trader's token)
            amountInSmallestUnits,
            50 // 0.5% slippage
        );

        if (!quote) {
            return { success: false, error: 'Failed to get swap quote' };
        }

        // Execute the swap
        const swapResult = await executeSwap(quote, pin);

        if (!swapResult.success) {
            return { success: false, error: swapResult.error || 'Swap failed' };
        }

        // Get keypair for signing limit orders
        let keypair = await getKeypairForSigning(pin);
        if (!keypair) {
            return { success: false, error: 'Invalid PIN' };
        }

        let slOrderId: string | undefined;
        let tpOrderId: string | undefined;

        // Step 2 & 3: Create and submit SL/TP limit orders via Jupiter Limit Order API
        // Sign and submit on-chain before persisting order IDs
        try {
            const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.EXPO_PUBLIC_HELIUS_API_KEY}`;
            const connection = new Connection(HELIUS_RPC, 'confirmed');

            // Get the bought token's decimals for accurate SL/TP calculation
            const inputTokenDecimals = await getTokenDecimals(queueItem.inputMint);

            if (keypair && queueItem.slPrice) {
                // Create Stop Loss order (sell input token at loss price)
                // quote.outAmount is in input token's base units (smallest denomination)
                const tokenAmountHuman = parseFloat(quote.outAmount) / Math.pow(10, inputTokenDecimals);
                const slOutAmountRaw = Math.floor(
                    tokenAmountHuman * queueItem.slPrice * Math.pow(10, outputDecimals)
                );

                const slOrder = await createJupiterLimitOrder({
                    owner: keypair.publicKey.toBase58(),
                    inToken: queueItem.inputMint,      // Token we bought
                    outToken: queueItem.outputMint,    // Token we want back (USDC/SOL)
                    inAmount: quote.outAmount,         // Amount of tokens to sell (raw)
                    outAmount: slOutAmountRaw.toString(),
                });
                
                if (slOrder?.transaction) {
                    // Sign and submit the limit order transaction
                    const slResult = await signAndSubmitLimitOrder(slOrder.transaction, keypair, connection);
                    if (slResult.success) {
                        slOrderId = slOrder.orderId;
                    }
                }
            }

            if (keypair && queueItem.tpPrice) {
                // Create Take Profit order (sell input token at profit price)
                const tokenAmountHuman = parseFloat(quote.outAmount) / Math.pow(10, inputTokenDecimals);
                const tpOutAmountRaw = Math.floor(
                    tokenAmountHuman * queueItem.tpPrice * Math.pow(10, outputDecimals)
                );

                const tpOrder = await createJupiterLimitOrder({
                    owner: keypair.publicKey.toBase58(),
                    inToken: queueItem.inputMint,      // Token we bought
                    outToken: queueItem.outputMint,    // Token we want back (USDC/SOL)
                    inAmount: quote.outAmount,         // Amount of tokens to sell (raw)
                    outAmount: tpOutAmountRaw.toString(),
                });
                
                if (tpOrder?.transaction) {
                    // Sign and submit the limit order transaction
                    const tpResult = await signAndSubmitLimitOrder(tpOrder.transaction, keypair, connection);
                    if (tpResult.success) {
                        tpOrderId = tpOrder.orderId;
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to create SL/TP orders:', e);
            // Continue even if SL/TP creation fails - main swap succeeded
        }

        // Clear keypair from memory
        const secretKeyRef = keypair.secretKey;
        for (let i = 0; i < secretKeyRef.length; i++) {
            secretKeyRef[i] = 0;
        }
        // @ts-ignore
        keypair = null;

        // Step 4: Mark as executed
        const executeResponse = await fetch(
            `${API_URL}/copy-trade/execute/${queueItem.id}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`
                },
                body: JSON.stringify({ slOrderId, tpOrderId })
            }
        );

        const executeData = await executeResponse.json();

        if (!executeResponse.ok) {
            return { success: false, error: executeData.error };
        }

        return {
            success: true,
            signature: swapResult.signature,
            slOrderId,
            tpOrderId
        };

    } catch (error: any) {
        return { success: false, error: error.message || 'Execution failed' };
    }
}

/**
 * Fetch user's open copy positions
 */
export async function fetchCopyPositions(
    authToken: string
): Promise<{ success: boolean; positions?: CopyPosition[]; error?: string }> {
    try {
        const response = await fetch(`${API_URL}/copy-trade/positions`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error };
        }

        return { success: true, positions: data.positions };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Close a copy position manually
 * Signs and broadcasts cancel transactions for SL/TP and sell transaction
 */
export async function closeCopyPosition(
    positionId: string,
    pin: string,
    authToken: string
): Promise<{ success: boolean; sellSignature?: string; error?: string }> {
    try {
        // Step 1: Get close transactions from backend
        const response = await fetch(
            `${API_URL}/copy-trade/close/${positionId}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error };
        }

        const { cancelTransactions, sellTransaction } = data;

        // Step 2: Get keypair for signing
        let keypair = await getKeypairForSigning(pin);
        if (!keypair) {
            return { success: false, error: 'Invalid PIN' };
        }

        const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.EXPO_PUBLIC_HELIUS_API_KEY}`;
        const connection = new Connection(HELIUS_RPC, 'confirmed');

        // Step 3: Sign and broadcast cancel transactions for SL/TP
        if (cancelTransactions && cancelTransactions.length > 0) {
            for (const cancel of cancelTransactions) {
                if (cancel.transaction) {
                    try {
                        const txBuffer = Buffer.from(cancel.transaction, 'base64');
                        const transaction = VersionedTransaction.deserialize(txBuffer);
                        transaction.sign([keypair]);
                        
                        await connection.sendRawTransaction(transaction.serialize(), {
                            skipPreflight: false,
                            preflightCommitment: 'confirmed'
                        });
                        // Don't wait for confirmation for cancels, they can fail silently
                    } catch (e) {
                        // Ignore cancel errors
                    }
                }
            }
        }

        // Step 4: Sign and broadcast sell transaction
        if (!sellTransaction?.transaction) {
            return { success: false, error: 'No sell transaction provided' };
        }

        const sellTxBuffer = Buffer.from(sellTransaction.transaction, 'base64');
        const sellTx = VersionedTransaction.deserialize(sellTxBuffer);
        sellTx.sign([keypair]);

        const sellSignature = await connection.sendRawTransaction(sellTx.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed'
        });

        // Wait for confirmation
        const latestBlockhash = await connection.getLatestBlockhash();
        await connection.confirmTransaction({
            signature: sellSignature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
        }, 'confirmed');

        // Clear keypair from memory
        const secretKeyRef = keypair.secretKey;
        for (let i = 0; i < secretKeyRef.length; i++) {
            secretKeyRef[i] = 0;
        }
        // @ts-ignore
        keypair = null;

        // Step 5: Confirm close with backend
        const confirmResponse = await fetch(
            `${API_URL}/copy-trade/confirm-close/${positionId}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`
                },
                body: JSON.stringify({ sellSignature })
            }
        );

        const confirmData = await confirmResponse.json();

        if (!confirmResponse.ok) {
            return { success: false, error: confirmData.error };
        }

        return { success: true, sellSignature };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Stop copy trading (delete config)
 */
export async function stopCopyTrading(
    authToken: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch(`${API_URL}/copy-trade/config`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${authToken}` }
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Jupiter Limit Order API helpers
const JUPITER_LIMIT_API = 'https://jup.ag/api/limit/v1';

interface JupiterLimitOrderParams {
    owner: string;
    inToken: string;
    outToken: string;
    inAmount: string;
    outAmount: string;
}

interface JupiterLimitOrderResponse {
    orderId: string;
    transaction: string;
}

/**
 * Sign and submit a Jupiter limit order transaction
 */
async function signAndSubmitLimitOrder(
    base64Transaction: string,
    keypair: any,
    connection: Connection
): Promise<{ success: boolean; signature?: string; error?: string }> {
    try {
        // Decode base64 transaction
        const transactionBuffer = Buffer.from(base64Transaction, 'base64');
        const transaction = VersionedTransaction.deserialize(transactionBuffer);

        // Sign transaction
        transaction.sign([keypair]);

        // Send transaction
        const signature = await connection.sendRawTransaction(transaction.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed'
        });

        // Wait for confirmation
        const latestBlockhash = await connection.getLatestBlockhash();
        await connection.confirmTransaction({
            signature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
        }, 'confirmed');

        return { success: true, signature };
    } catch (error: any) {
        console.error('Failed to sign/submit limit order:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Create a Jupiter limit order
 */
async function createJupiterLimitOrder(
    params: JupiterLimitOrderParams
): Promise<JupiterLimitOrderResponse | null> {
    try {
        const response = await fetch(`${JUPITER_LIMIT_API}/createOrder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        });

        if (!response.ok) {
            console.warn('Jupiter limit order creation failed:', await response.text());
            return null;
        }

        return await response.json();
    } catch (error) {
        console.warn('Failed to create Jupiter limit order:', error);
        return null;
    }
}
