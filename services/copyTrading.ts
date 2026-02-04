import * as SecureStore from 'expo-secure-store';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { executeSwap, getQuote, getTokenDecimals } from './swap';
import { getKeypairForSigning } from './wallet';
import { api } from './api';

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
    type: 'entry' | 'exit';  // 'entry' = buy, 'exit' = sell
    inputMint: string;    // For entry: token to buy; For exit: token to sell
    inputSymbol: string;
    outputMint: string;   // For entry: token to spend; For exit: token to receive
    outputSymbol: string;
    inputAmount: number;  // For entry: amount to receive; For exit: amount to sell
    outputAmount: number; // For entry: amount to spend; For exit: amount to receive
    entryPrice: number;
    slPrice?: number;
    tpPrice?: number;
    cancelTransactions?: string; // JSON string of cancel transactions (exit trades only)
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
        const data = await api.post<{ success: boolean; config: CopyTradingConfig; error?: string }>('/copy-trade/config', config);
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
        const data = await api.get<{ success: boolean; config: CopyTradingConfig }>('/copy-trade/config');
        return { success: true, config: data.config };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
    }
}

/**
 * Check for pending copy trade queue items
 */
export async function checkCopyTradeQueue(
    authToken: string
): Promise<{ success: boolean; queue?: CopyTradeQueueItem[]; error?: string }> {
    try {
        const data = await api.get<{ success: boolean; queue: CopyTradeQueueItem[] }>('/copy-trade/queue');
        return { success: true, queue: data.queue };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Execute a copy trade from queue (BUY flow for entry trades)
 * Step 1: Execute main swap
 * Step 2: Create SL limit order
 * Step 3: Create TP limit order
 * Step 4: Mark as executed with actual amounts
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

        // Calculate actual executed amounts from the swap result
        // quote.outAmount is the actual amount received in smallest units
        const inputTokenDecimals = await getTokenDecimals(queueItem.inputMint);
        const actualOutputAmount = parseFloat(quote.outAmount) / Math.pow(10, inputTokenDecimals);
        const actualEntryPrice = actualOutputAmount > 0 
            ? queueItem.outputAmount / actualOutputAmount 
            : queueItem.entryPrice;

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
        } catch {
            // Continue even if SL/TP creation fails - main swap succeeded
        }

        // Clear keypair from memory
        const secretKeyRef = keypair.secretKey;
        for (let i = 0; i < secretKeyRef.length; i++) {
            secretKeyRef[i] = 0;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        keypair = null as unknown as Keypair;

        // Step 4: Mark as executed with actual executed amounts
        const executedData = {
            actualInputAmount: queueItem.outputAmount,  // What we spent
            actualOutputAmount: actualOutputAmount,      // What we actually received
            actualEntryPrice: actualEntryPrice           // Actual executed price
        };

        await api.post(`/copy-trade/execute/${queueItem.id}`, { slOrderId, tpOrderId, executedData });

        return {
            success: true,
            signature: swapResult.signature,
            slOrderId,
            tpOrderId
        };

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Execution failed';
        return { success: false, error: errorMessage };
    }
}

/**
 * Execute a copy trade SELL for exit trades (exit-with-trader flow)
 * Step 1: Execute sell swap (sell position token back to stable/SOL)
 * Step 2: Mark position as closed
 */
export async function executeCopyTradeSell(
    queueItem: CopyTradeQueueItem,
    pin: string,
    authToken: string
): Promise<{ 
    success: boolean; 
    signature?: string; 
    cancelSignatures?: string[];
    error?: string;
}> {
    try {
        // Validate this is an exit trade
        if (queueItem.type !== 'exit') {
            return { success: false, error: 'Queue item is not an exit trade' };
        }

        // Get keypair for signing (needed for both cancels and sell)
        let keypair = await getKeypairForSigning(pin);
        if (!keypair) {
            return { success: false, error: 'Invalid PIN' };
        }

        const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.EXPO_PUBLIC_HELIUS_API_KEY}`;
        const connection = new Connection(HELIUS_RPC, 'confirmed');

        // Step 1: Sign and broadcast cancel transactions for SL/TP orders
        // These MUST be submitted before the sell to prevent race conditions
        const cancelSignatures: string[] = [];
        if (queueItem.cancelTransactions) {
            try {
                const cancelTxs: { orderId: string; transaction: string }[] = JSON.parse(queueItem.cancelTransactions);
                for (const cancel of cancelTxs) {
                    if (cancel.transaction) {
                        const result = await signAndSubmitLimitOrder(cancel.transaction, keypair, connection);
                        if (result.success) {
                            cancelSignatures.push(result.signature!);
                        } else {
                            // Continue even if cancel fails - sell should still go through
                        }
                    }
                }
            } catch {
                // Continue with sell even if cancels fail
            }
        }

        // Step 2: Execute sell swap
        // For exit: inputMint = token to sell, outputMint = token to receive
        const inputDecimals = await getTokenDecimals(queueItem.inputMint);
        const amountInSmallestUnits = Math.floor(
            queueItem.inputAmount * Math.pow(10, inputDecimals)
        );

        const quote = await getQuote(
            queueItem.inputMint,   // From token (what we sell - the position token)
            queueItem.outputMint,  // To token (what we receive - USDC/SOL)
            amountInSmallestUnits,
            50 // 0.5% slippage
        );

        if (!quote) {
            return { success: false, error: 'Failed to get swap quote for sell' };
        }

        // Execute the swap
        const swapResult = await executeSwap(quote, pin);

        if (!swapResult.success) {
            return { success: false, error: swapResult.error || 'Sell swap failed' };
        }

        // Calculate actual executed amounts
        const outputDecimals = queueItem.outputMint === 'So11111111111111111111111111111111111111112' ? 9 : 6;
        const actualOutputAmount = parseFloat(quote.outAmount) / Math.pow(10, outputDecimals);

        // Step 3: Mark as executed with actual amounts (this will close the position)
        const executedData = {
            actualInputAmount: queueItem.inputAmount,  // What we sold
            actualOutputAmount: actualOutputAmount,     // What we received
            actualEntryPrice: queueItem.entryPrice      // Keep original entry price for P&L
        };

        await api.post(`/copy-trade/execute/${queueItem.id}`, { executedData });

        return {
            success: true,
            signature: swapResult.signature,
            cancelSignatures
        };

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Sell execution failed';
        return { success: false, error: errorMessage };
    }
}

/**
 * Fetch user's open copy positions
 */
export async function fetchCopyPositions(
    authToken: string
): Promise<{ success: boolean; positions?: CopyPosition[]; error?: string }> {
    try {
        const data = await api.get<{ success: boolean; positions: CopyPosition[] }>('/copy-trade/positions');
        return { success: true, positions: data.positions };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
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
        const data = await api.post<{ success: boolean; cancelTransactions: { orderId: string; transaction: string }[]; sellTransaction: { transaction: string } }>(`/copy-trade/close/${positionId}`, {});
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        keypair = null as unknown as Keypair;

        // Step 5: Confirm close with backend
        await api.post(`/copy-trade/confirm-close/${positionId}`, { sellSignature });

        return { success: true, sellSignature };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
    }
}

interface CancelTransaction {
    positionId: string;
    orderId: string;
    transaction: string;
}

interface StopCopyTradingResult {
    success: boolean;
    message?: string;
    cancelTransactions?: CancelTransaction[];
    pendingPositions?: { id: string; status: string }[];
    error?: string;
}

/**
 * Stop copy trading (delete config)
 * Returns cancel transactions that must be signed and broadcast to complete SL/TP cancellation
 */
export async function stopCopyTrading(
    authToken: string
): Promise<StopCopyTradingResult> {
    try {
        const data = await api.delete<{ success: boolean; message: string; cancelTransactions: CancelTransaction[]; pendingPositions: { id: string; status: string }[] }>('/copy-trade/config');
        return { 
            success: true, 
            message: data.message,
            cancelTransactions: data.cancelTransactions,
            pendingPositions: data.pendingPositions
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Submit signed cancel transactions for SL/TP orders
 * Call this after user confirms they want to cancel orders during stop-copy
 */
export async function submitCancelTransactions(
    cancelTransactions: CancelTransaction[],
    pin: string
): Promise<{ 
    success: boolean; 
    signatures?: string[]; 
    failed?: { orderId: string; error: string }[];
    error?: string;
}> {
    try {
        const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.EXPO_PUBLIC_HELIUS_API_KEY}`;
        const connection = new Connection(HELIUS_RPC, 'confirmed');

        // Get keypair for signing
        let keypair = await getKeypairForSigning(pin);
        if (!keypair) {
            return { success: false, error: 'Invalid PIN' };
        }

        const signatures: string[] = [];
        const failed: { orderId: string; error: string }[] = [];

        // Sign and broadcast each cancel transaction
        for (const cancel of cancelTransactions) {
            if (!cancel.transaction) continue;

            try {
                const result = await signAndSubmitLimitOrder(cancel.transaction, keypair, connection);
                if (result.success) {
                    signatures.push(result.signature!);
                } else {
                    failed.push({ orderId: cancel.orderId, error: result.error || 'Unknown error' });
                }
            } catch (e: any) {
                failed.push({ orderId: cancel.orderId, error: e.message || 'Failed to sign cancel' });
            }
        }

        // Clear keypair from memory
        const secretKeyRef = keypair.secretKey;
        for (let i = 0; i < secretKeyRef.length; i++) {
            secretKeyRef[i] = 0;
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        keypair = null as unknown as Keypair;

        return { 
            success: failed.length === 0, 
            signatures,
            failed: failed.length > 0 ? failed : undefined
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: errorMessage };
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
            return null;
        }

        return await response.json();
    } catch {
        return null;
    }
}
