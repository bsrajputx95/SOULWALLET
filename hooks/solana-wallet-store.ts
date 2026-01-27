// Polyfill must be imported first before @solana/web3.js
import 'react-native-get-random-values';

import { useState, useEffect } from 'react';
import createContextHook from '@/lib/create-context-hook';
import { getSecureItem, setSecureItem, deleteSecureItem, SecureStorage } from '@/lib/secure-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trpcClient } from '@/lib/trpc';
import { logger } from '@/lib/client-logger';
import {
  applyOptimisticBalanceUpdate,
  confirmOptimisticBalanceUpdate,
  revertOptimisticBalanceUpdate,
  SOL_MINT
} from './optimistic-updates';

import type {
  ParsedAccountData
} from '@solana/web3.js';
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction
} from '@solana/web3.js';
import bs58 from 'bs58';
import { Platform } from 'react-native';

// SPL Token imports - only for native platforms
let TOKEN_PROGRAM_ID: any;
let getAssociatedTokenAddress: any;
let createAssociatedTokenAccountInstruction: any;
let createTransferInstruction: any;
let getAccount: any;

// RPC Endpoint Failover Configuration
const RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com',
  'https://rpc.ankr.com/solana',
  process.env.EXPO_PUBLIC_SOLANA_RPC_URL,
].filter(Boolean);

let currentRpcIndex = 0;

// Create connection with failover
async function createConnection(): Promise<Connection> {
  const maxAttempts = RPC_ENDPOINTS.length;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const endpoint = RPC_ENDPOINTS[currentRpcIndex];
    if (!endpoint) {
      currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
      attempts++;
      continue;
    }

    const connection = new Connection(endpoint, 'confirmed');

    try {
      // Test connection with timeout
      await Promise.race([
        connection.getVersion(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]);
      logger.info('Connected to RPC:', endpoint);
      return connection;
    } catch (error) {
      logger.warn('RPC failed:', endpoint, error instanceof Error ? error.message : 'Unknown error');
      currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
      attempts++;
    }
  }

  // If all endpoints fail, return a connection anyway (offline mode)
  logger.warn('All RPC endpoints failed. Running in offline mode.');
  return new Connection(RPC_ENDPOINTS[0] || 'https://api.mainnet-beta.solana.com', 'confirmed');
}

// Dynamically import SPL token functions only on native platforms
const loadSplTokenFunctions = async () => {
  // Platform gate: skip SPL token loading on web to avoid bundler/runtime errors
  if (Platform.OS === 'web') {
    logger.info('Skipping SPL Token loading on web platform');
    return;
  }

  try {
    const splToken = await import('@solana/spl-token');
    TOKEN_PROGRAM_ID = splToken.TOKEN_PROGRAM_ID;
    getAssociatedTokenAddress = splToken.getAssociatedTokenAddress;
    createAssociatedTokenAccountInstruction = splToken.createAssociatedTokenAccountInstruction;
    createTransferInstruction = splToken.createTransferInstruction;
    getAccount = splToken.getAccount;
    logger.info('SPL Token functions loaded successfully');
  } catch (error) {
    logger.warn('SPL Token functions not available:', error);
  }
};

interface TokenBalance {
  mint: string;
  symbol: string;
  name: string;
  balance: number;
  decimals: number;
  logo?: string;
  uiAmount: number;
}

interface SolanaWalletState {
  wallet: Keypair | null;
  publicKey: string | null;
  balance: number;
  tokenBalances: TokenBalance[];
  isLoading: boolean;
  connection: Connection;
  needsUnlock?: boolean;
}

const STORAGE_KEY = 'solana_wallet_private_key';
const ENCRYPTED_MARKER_KEY = 'wallet_is_encrypted';
const SESSION_KEY = 'wallet_session';
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface WalletSession {
  passwordHash: string; // Store hashed password for session verification
  unlockedAt: number;   // Timestamp when unlocked
  expiresAt: number;    // Timestamp when session expires
}

// Popular Solana tokens with their mint addresses
const POPULAR_TOKENS = {
  'USDC': {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    name: 'USD Coin',
    decimals: 6,
    logo: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png'
  },
  'WIF': {
    mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    name: 'Dogwifhat',
    decimals: 6,
    logo: 'https://bafkreifryvyui4gshimmxl26uec3ol3kummjnuljb34vt7gl7cgml3hnrq.ipfs.nftstorage.link'
  },
  'BONK': {
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    name: 'Bonk',
    decimals: 5,
    logo: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I'
  }
};

export const [SolanaWalletProvider, useSolanaWallet] = createContextHook(() => {
  const [state, setState] = useState<SolanaWalletState>({
    wallet: null,
    publicKey: null,
    balance: 0,
    tokenBalances: [],
    isLoading: false,
    connection: new Connection('https://api.mainnet-beta.solana.com', 'confirmed'), // Temporary, will be replaced by failover
    needsUnlock: false,
  });

  // Load wallet from storage on mount
  useEffect(() => {
    const initializeWallet = async () => {
      await loadSplTokenFunctions();

      // Initialize connection with failover
      const connection = await createConnection();
      setState(prev => ({ ...prev, connection }));

      await loadWallet();
    };
    void initializeWallet().catch((error) => {
      if (__DEV__) logger.error('Failed to initialize wallet:', error);
    });
  }, []);

  // Sync wallet address with backend
  const syncWalletAddressToBackend = async (publicKey: string) => {
    try {
      await trpcClient.user.updateWalletAddress.mutate({ walletAddress: publicKey });
      logger.info('Wallet address synced to backend:', publicKey);
    } catch (error) {
      // Silent fail - backend sync is not critical for wallet functionality
      if (__DEV__) logger.warn('Failed to sync wallet to backend:', error);
    }
  };

  // Simple hash function for session password verification
  const hashPassword = (password: string): string => {
    // Use a simple hash for session verification (not for encryption)
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  };

  // Save wallet session after successful unlock
  const saveSession = async (password: string) => {
    try {
      const session: WalletSession = {
        passwordHash: hashPassword(password),
        unlockedAt: Date.now(),
        expiresAt: Date.now() + SESSION_EXPIRY_MS,
      };
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
      // Also store the password securely for auto-restore (encrypted in SecureStore)
      await setSecureItem('wallet_session_pwd', password);
      logger.info('Wallet session saved, expires in 24 hours');
    } catch (error) {
      logger.warn('Failed to save wallet session:', error);
    }
  };

  // Get valid session if exists
  const getValidSession = async (): Promise<{ session: WalletSession; password: string } | null> => {
    try {
      const sessionStr = await AsyncStorage.getItem(SESSION_KEY);
      if (!sessionStr) return null;

      const session: WalletSession = JSON.parse(sessionStr);

      // Check if session is expired
      if (Date.now() > session.expiresAt) {
        logger.info('Wallet session expired, clearing');
        await clearSession();
        return null;
      }

      // Get the stored password
      const password = await getSecureItem('wallet_session_pwd');
      if (!password) {
        logger.info('No session password found, clearing session');
        await clearSession();
        return null;
      }

      return { session, password };
    } catch (error) {
      logger.warn('Failed to get wallet session:', error);
      return null;
    }
  };

  // Clear wallet session
  const clearSession = async () => {
    try {
      await AsyncStorage.removeItem(SESSION_KEY);
      await deleteSecureItem('wallet_session_pwd');
      logger.info('Wallet session cleared');
    } catch (error) {
      logger.warn('Failed to clear wallet session:', error);
    }
  };

  // Load wallet from secure storage - now with session restore
  const loadWallet = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const isEncrypted = await AsyncStorage.getItem(ENCRYPTED_MARKER_KEY);

      if (isEncrypted === 'true') {
        // Check for valid session - auto-restore if exists
        const sessionData = await getValidSession();

        if (sessionData) {
          try {
            logger.info('Valid session found, auto-restoring wallet...');
            const privateKeyString = await SecureStorage.getDecryptedPrivateKey(sessionData.password);

            if (privateKeyString) {
              const privateKeyBytes = bs58.decode(privateKeyString);
              const wallet = Keypair.fromSecretKey(privateKeyBytes);
              const publicKey = wallet.publicKey.toString();

              setState(prev => ({
                ...prev,
                wallet,
                publicKey,
                isLoading: false,
                needsUnlock: false
              }));

              logger.info('Wallet auto-restored from session:', publicKey);

              // Sync and refresh in background
              void syncWalletAddressToBackend(publicKey);
              void refreshBalances(wallet);
              return;
            }
          } catch (error) {
            logger.warn('Session restore failed, requiring unlock:', error);
            await clearSession();
          }
        }

        // No valid session or restore failed - require unlock
        setState(prev => ({ ...prev, isLoading: false, needsUnlock: true }));
        return;
      }
      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      if (__DEV__) logger.error('Error loading wallet:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      // Silent fail for initial load - user can create/import wallet
    }
  };

  const unlockWallet = async (password: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const privateKeyString = await SecureStorage.getDecryptedPrivateKey(password);
      if (!privateKeyString) {
        setState(prev => ({ ...prev, isLoading: false }));
        throw new Error('No encrypted wallet found');
      }
      const privateKeyBytes = bs58.decode(privateKeyString);
      const wallet = Keypair.fromSecretKey(privateKeyBytes);
      const publicKey = wallet.publicKey.toString();
      setState(prev => ({ ...prev, wallet, publicKey, isLoading: false, needsUnlock: false }));

      // Save session for persistence across app restarts
      await saveSession(password);

      await syncWalletAddressToBackend(publicKey);
      await refreshBalances(wallet);
      return wallet;
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  const createWalletEncrypted = async (password: string) => {
    try {
      logger.info('[Wallet] Starting wallet creation...');
      setState(prev => ({ ...prev, isLoading: true }));

      // Add timeout to prevent indefinite hanging
      const WALLET_CREATION_TIMEOUT = 120000; // 120 seconds - encryption is slow on mobile

      const walletCreationPromise = (async () => {
        // Dynamically import wallet manager
        logger.info('[Wallet] Importing WalletManager...');
        const { WalletManager } = await import('./wallet-creation-store');

        // Create wallet with encryption (heavy crypto operations)
        logger.info('[Wallet] Creating new wallet with encryption...');
        const result = await WalletManager.createNewWallet(password);
        logger.info('[Wallet] Wallet created successfully');

        return result;
      })();

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Wallet creation timeout - took longer than 30 seconds')), WALLET_CREATION_TIMEOUT)
      );

      const result = await Promise.race([walletCreationPromise, timeoutPromise]);
      const wallet = result.keypair;
      const publicKey = result.publicKey;

      // Store wallet metadata - ensure all storage operations complete
      logger.info('[Wallet] Storing wallet metadata...');
      await Promise.all([
        setSecureItem('wallet_public_key', publicKey),
        AsyncStorage.setItem(ENCRYPTED_MARKER_KEY, 'true'),
        deleteSecureItem(STORAGE_KEY)
      ]);
      logger.info('[Wallet] Wallet metadata stored');

      // Update state with new wallet
      setState(prev => ({ ...prev, wallet, publicKey, isLoading: false, needsUnlock: false }));

      // Sync to backend (non-blocking - don't await)
      logger.info('[Wallet] Syncing to backend (non-blocking)...');
      syncWalletAddressToBackend(publicKey).catch(err => {
        if (__DEV__) logger.warn('Backend sync failed (non-critical):', err);
      });

      logger.info('New encrypted wallet created:', publicKey);
      return wallet;
    } catch (error) {
      logger.error('Error creating encrypted wallet:', error);
      setState(prev => ({ ...prev, isLoading: false }));

      // Log the full error for debugging
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : '';
      logger.error('[Wallet] Error details:', errorMsg);
      logger.error('[Wallet] Error stack:', errorStack);

      // Re-throw the original error to see what's actually happening
      throw error;
    }
  };





  const importWalletEncrypted = async (privateKeyString: string, password: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const privateKeyBytes = bs58.decode(privateKeyString);
      const wallet = Keypair.fromSecretKey(privateKeyBytes);
      const publicKey = wallet.publicKey.toString();

      await SecureStorage.setEncryptedPrivateKey(privateKeyString, password);
      await AsyncStorage.setItem(ENCRYPTED_MARKER_KEY, 'true');
      await deleteSecureItem(STORAGE_KEY);

      setState(prev => ({
        ...prev,
        wallet,
        publicKey,
        isLoading: false,
        needsUnlock: false,
      }));

      await syncWalletAddressToBackend(publicKey);
      await refreshBalances(wallet);
      logger.info('Encrypted wallet imported:', publicKey);
      return wallet;
    } catch (error) {
      if (__DEV__) logger.error('Error importing encrypted wallet:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      throw new Error('Invalid private key or password.');
    }
  };

  // Refresh balances
  const refreshBalances = async (wallet?: Keypair) => {
    const currentWallet = wallet || state.wallet;
    if (!currentWallet) return;

    try {
      setState(prev => ({ ...prev, isLoading: true }));

      // Get SOL balance
      const solBalance = await state.connection.getBalance(currentWallet.publicKey);
      const solBalanceInSol = solBalance / LAMPORTS_PER_SOL;

      // Get token balances (only if TOKEN_PROGRAM_ID is available)
      const tokenBalances: TokenBalance[] = [];

      if (TOKEN_PROGRAM_ID) {
        try {
          const tokenAccounts = await state.connection.getParsedTokenAccountsByOwner(
            currentWallet.publicKey,
            { programId: TOKEN_PROGRAM_ID }
          );

          for (const tokenAccount of tokenAccounts.value) {
            const accountData = tokenAccount.account.data as ParsedAccountData;
            const tokenInfo = accountData.parsed.info;

            if (tokenInfo.tokenAmount.uiAmount > 0) {
              const mint = tokenInfo.mint;
              const tokenData = Object.entries(POPULAR_TOKENS).find(
                ([_, data]) => data.mint === mint
              );

              const tokenBalance: TokenBalance = {
                mint,
                symbol: tokenData?.[0] || mint.slice(0, 8),
                name: tokenData?.[1].name || 'Unknown Token',
                balance: tokenInfo.tokenAmount.amount,
                decimals: tokenInfo.tokenAmount.decimals,
                uiAmount: tokenInfo.tokenAmount.uiAmount
              };

              if (tokenData?.[1].logo) {
                tokenBalance.logo = tokenData[1].logo;
              }

              tokenBalances.push(tokenBalance);
            }
          }
        } catch (error) {
          logger.warn('Error loading token balances:', error);
        }
      }



      setState(prev => ({
        ...prev,
        balance: solBalanceInSol,
        tokenBalances,
        isLoading: false
      }));

    } catch (error) {
      if (__DEV__) logger.error('Error refreshing balances:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      // Silent fail - balances will be retried on next action
    }
  };

  // Send SOL with simulation, enhanced security, and optimistic updates
  const sendSol = async (toAddress: string, amount: number): Promise<string> => {
    if (!state.wallet) throw new Error('No wallet connected');

    // Apply optimistic update BEFORE transaction for instant UI feedback
    const currentBalance = state.balance;
    applyOptimisticBalanceUpdate(SOL_MINT, -amount, currentBalance);
    logger.info('Applied optimistic update for SOL send:', -amount);

    try {
      setState(prev => ({ ...prev, isLoading: true }));

      const toPublicKey = new PublicKey(toAddress);
      const lamports = amount * LAMPORTS_PER_SOL;

      // Create transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: state.wallet.publicKey,
          toPubkey: toPublicKey,
          lamports,
        })
      );

      // SIMULATE FIRST
      const simulation = await simulateTransaction(transaction);
      if (!simulation.success) {
        throw new Error(`Simulation failed: ${simulation.error}`);
      }
      logger.info('Simulation passed');

      // Estimate fees
      const fee = await estimateTransactionFee(transaction);

      // Check balance
      const required = (lamports + fee) / LAMPORTS_PER_SOL;
      if (state.balance < required) {
        throw new Error(`Insufficient balance. Required: ${required} SOL`);
      }

      const CONFIRMATION_TIMEOUT_MS = 60000;
      const confirmationPromise = sendAndConfirmTransaction(
        state.connection,
        transaction,
        [state.wallet],
        { commitment: 'confirmed' }
      );
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Transaction confirmation timeout')), CONFIRMATION_TIMEOUT_MS));
      const signature = await Promise.race([confirmationPromise, timeoutPromise]);

      logger.info('Transaction confirmed:', signature);

      // Confirm optimistic update on success
      await confirmOptimisticBalanceUpdate(SOL_MINT);
      logger.info('Confirmed optimistic update for SOL send');

      // Wait for finalization
      await waitForFinalization(signature);
      await refreshBalances();

      setState(prev => ({ ...prev, isLoading: false }));
      return signature;
    } catch (error: any) {
      // Revert optimistic update on failure
      revertOptimisticBalanceUpdate(SOL_MINT);
      logger.info('Reverted optimistic update after failure');

      logger.error('Transaction failed:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      throw new Error(`Transaction failed: ${error.message}`);
    }
  };

  // Wait for transaction finalization
  const waitForFinalization = async (signature: string, maxAttempts: number = 30): Promise<void> => {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await state.connection.getSignatureStatus(signature);

      if (status.value?.confirmationStatus === 'finalized') {
        logger.info('Finalized');
        return;
      }

      if (status.value?.err) {
        throw new Error(`Failed: ${JSON.stringify(status.value.err)}`);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    logger.warn('Not finalized after max attempts');
  };

  // Simulate transaction before sending
  const simulateTransaction = async (transaction: Transaction): Promise<{
    success: boolean;
    error?: string;
    logs?: string[];
    unitsConsumed?: number;
  }> => {
    if (!state.wallet) throw new Error('No wallet connected');

    try {
      const { blockhash } = await state.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = state.wallet.publicKey;

      const simulation = await state.connection.simulateTransaction(transaction);

      if (simulation.value.err) {
        return {
          success: false,
          error: JSON.stringify(simulation.value.err),
          logs: simulation.value.logs || [],
        };
      }

      const result: {
        success: boolean;
        error?: string;
        logs?: string[];
        unitsConsumed?: number;
      } = {
        success: true,
        logs: simulation.value.logs || [],
      };

      if (simulation.value.unitsConsumed !== undefined) {
        result.unitsConsumed = simulation.value.unitsConsumed;
      }

      return result;
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const simulateTransactionComprehensive = async (
    transaction: Transaction
  ): Promise<{ success: boolean; error?: string; logs?: string[]; unitsConsumed?: number; accountChanges?: any[] }> => {
    if (!state.wallet) throw new Error('No wallet connected')
    try {
      const { blockhash, lastValidBlockHeight } = await state.connection.getLatestBlockhash('finalized')
      transaction.recentBlockhash = blockhash
      transaction.feePayer = state.wallet.publicKey
      const simulation = await state.connection.simulateTransaction(transaction, {
        sigVerify: true,
        commitment: 'confirmed',
      } as any)
      if (simulation.value.err) {
        return { success: false, error: JSON.stringify(simulation.value.err), logs: simulation.value.logs || [] }
      }
      const accountChanges = simulation.value.accounts?.map((account: any, index: number) => ({
        index,
        lamports: account?.lamports || 0,
        owner: account?.owner?.toString(),
        data: account?.data,
      }))
      return { success: true, logs: simulation.value.logs || [], unitsConsumed: simulation.value.unitsConsumed, accountChanges }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  // Estimate transaction fee
  const estimateTransactionFee = async (transaction: Transaction): Promise<number> => {
    try {
      const feeCalculator = await state.connection.getFeeForMessage(
        transaction.compileMessage(),
        'confirmed'
      );
      return feeCalculator.value || 5000;
    } catch (error) {
      logger.error('Failed to estimate fee:', error);
      return 5000;
    }
  };

  // Send SPL Token
  const sendToken = async (toAddress: string, amount: number, tokenMint: string, decimals: number) => {
    if (!state.wallet) throw new Error('No wallet connected');
    if (!getAssociatedTokenAddress || !createTransferInstruction) {
      throw new Error('SPL Token functions not available');
    }

    try {
      setState(prev => ({ ...prev, isLoading: true }));

      const toPublicKey = new PublicKey(toAddress);
      const mintPublicKey = new PublicKey(tokenMint);

      // Get source token account
      const sourceTokenAccount = await getAssociatedTokenAddress(
        mintPublicKey,
        state.wallet.publicKey
      );

      const destinationTokenAccount = await getAssociatedTokenAddress(mintPublicKey, toPublicKey);

      const transaction = new Transaction();

      let destinationExists = true
      try {
        await getAccount(state.connection, destinationTokenAccount)
      } catch (error: any) {
        if (error.name === 'TokenAccountNotFoundError' || error.message?.includes('could not find account')) {
          destinationExists = false
          transaction.add(
            createAssociatedTokenAccountInstruction(
              state.wallet.publicKey,
              destinationTokenAccount,
              toPublicKey,
              mintPublicKey
            )
          )
        } else {
          throw error
        }
      }

      // Add transfer instruction
      const transferAmount = amount * Math.pow(10, decimals);
      transaction.add(
        createTransferInstruction(
          sourceTokenAccount,
          destinationTokenAccount,
          state.wallet.publicKey,
          transferAmount
        )
      );

      const sim = await simulateTransactionComprehensive(transaction)
      if (!sim.success) {
        throw new Error(`Simulation failed: ${sim.error}`)
      }
      const fee = await estimateTransactionFee(transaction)
      const solBalance = await state.connection.getBalance(state.wallet.publicKey)
      const requiredSol = fee + (destinationExists ? 0 : 2039280)
      if (solBalance < requiredSol) {
        throw new Error(`Insufficient SOL for transaction fees. Required: ${requiredSol / LAMPORTS_PER_SOL} SOL`)
      }

      const CONFIRMATION_TIMEOUT_MS = 60000;
      const confirmationPromise = sendAndConfirmTransaction(
        state.connection,
        transaction,
        [state.wallet]
      );
      const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Transaction confirmation timeout')), CONFIRMATION_TIMEOUT_MS));
      const signature = await Promise.race([confirmationPromise, timeoutPromise]);

      logger.info('Token transfer successful:', signature);

      // Refresh balances after successful transfer
      await refreshBalances();

      setState(prev => ({ ...prev, isLoading: false }));
      return signature;

    } catch (error) {
      logger.error('Error sending token:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  // Get token info by symbol
  const getTokenInfo = (symbol: string) => {
    return POPULAR_TOKENS[symbol as keyof typeof POPULAR_TOKENS] || null;
  };

  // Delete wallet securely
  const deleteWallet = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      await deleteSecureItem(STORAGE_KEY);
      await SecureStorage.deleteEncryptedPrivateKey();
      await AsyncStorage.removeItem(ENCRYPTED_MARKER_KEY);
      // Clear wallet session
      await clearSession();

      setState({
        wallet: null,
        publicKey: null,
        balance: 0,
        tokenBalances: [],
        isLoading: false,
        connection: state.connection
      });

      if (__DEV__) {
        logger.info('Wallet deleted successfully');
      }
    } catch (error) {
      logger.error('Error deleting wallet:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  // Execute swap using Jupiter - returns signature and output amount
  const executeSwap = async (swapTransactionBase64OrParams: string | {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippageBps?: number;
    expectedOutputAmount?: number; // For optimistic updates
  }): Promise<{ signature: string; outputAmount: number | undefined }> => {
    if (!state.wallet) throw new Error('No wallet connected');

    // Track mints for optimistic updates
    let inputMintForOptimistic: string | undefined;
    let outputMintForOptimistic: string | undefined;
    let inputAmountForOptimistic: number = 0;
    let expectedOutputForOptimistic: number = 0;

    // Extract mint info for optimistic updates if params provided
    if (typeof swapTransactionBase64OrParams !== 'string') {
      inputMintForOptimistic = swapTransactionBase64OrParams.inputMint;
      outputMintForOptimistic = swapTransactionBase64OrParams.outputMint;
      inputAmountForOptimistic = swapTransactionBase64OrParams.amount / 1e9; // Convert from lamports
      expectedOutputForOptimistic = swapTransactionBase64OrParams.expectedOutputAmount || 0;
    }

    // Apply optimistic updates BEFORE transaction for instant UI feedback
    if (inputMintForOptimistic) {
      // Use SOL balance from state if SOL, otherwise default to 0 (will be looked up on refresh)
      const currentInputBalance = inputMintForOptimistic === SOL_MINT ? state.balance : 0;
      applyOptimisticBalanceUpdate(inputMintForOptimistic, -inputAmountForOptimistic, currentInputBalance);
      logger.info('Applied optimistic update for swap input:', -inputAmountForOptimistic);
    }
    if (outputMintForOptimistic && expectedOutputForOptimistic > 0) {
      const currentOutputBalance = outputMintForOptimistic === SOL_MINT ? state.balance : 0;
      applyOptimisticBalanceUpdate(outputMintForOptimistic, expectedOutputForOptimistic, currentOutputBalance);
      logger.info('Applied optimistic update for swap output:', expectedOutputForOptimistic);
    }

    try {
      setState(prev => ({ ...prev, isLoading: true }));

      let transactionBase64: string;
      let outputMint: string | undefined;

      // Handle both string (pre-built tx) and params (need to build tx)
      if (typeof swapTransactionBase64OrParams === 'string') {
        transactionBase64 = swapTransactionBase64OrParams;
      } else {
        // Get swap transaction via backend (avoids CORS/network issues on mobile)
        const params = swapTransactionBase64OrParams;
        outputMint = params.outputMint;

        // Call backend to get swap transaction from Jupiter
        // Note: This requires 2FA - the calling component should pass totpCode if needed
        const swapResult = await trpcClient.swap.swap.mutate({
          fromMint: params.inputMint,
          toMint: params.outputMint,
          amount: params.amount / 1e9, // Convert from lamports to SOL-equivalent units
          slippage: (params.slippageBps || 50) / 100, // Convert bps to percent
        });

        if (!swapResult.swapTransaction) {
          throw new Error('Failed to get swap transaction from backend');
        }

        transactionBase64 = swapResult.swapTransaction;
      }

      // Get pre-swap balances for output token (if we know it)
      let preSwapBalance = 0;
      if (outputMint && TOKEN_PROGRAM_ID) {
        try {
          const tokenAccounts = await state.connection.getParsedTokenAccountsByOwner(
            state.wallet.publicKey,
            { programId: TOKEN_PROGRAM_ID }
          );
          const outputAccount = tokenAccounts.value.find((acc: any) => {
            const parsed = acc.account.data as ParsedAccountData;
            return parsed.parsed.info.mint === outputMint;
          });
          if (outputAccount) {
            const parsed = outputAccount.account.data as ParsedAccountData;
            preSwapBalance = parsed.parsed.info.tokenAmount.uiAmount || 0;
          }
        } catch (e) {
          logger.warn('Could not get pre-swap balance:', e);
        }
      }

      // Deserialize and execute the transaction
      const transaction = Transaction.from(Buffer.from(transactionBase64, 'base64'));

      const signature = await sendAndConfirmTransaction(
        state.connection,
        transaction,
        [state.wallet],
        {
          skipPreflight: false,
          commitment: 'confirmed'
        }
      );

      logger.info('Swap executed successfully:', signature);

      // Confirm optimistic updates on success
      if (inputMintForOptimistic) {
        await confirmOptimisticBalanceUpdate(inputMintForOptimistic);
        logger.info('Confirmed optimistic update for swap input');
      }
      if (outputMintForOptimistic && expectedOutputForOptimistic > 0) {
        await confirmOptimisticBalanceUpdate(outputMintForOptimistic);
        logger.info('Confirmed optimistic update for swap output');
      }

      // Get post-swap balance to calculate output amount
      let outputAmount: number | undefined;
      if (outputMint && TOKEN_PROGRAM_ID) {
        try {
          await state.connection.confirmTransaction(signature, 'finalized');
          await new Promise(resolve => setTimeout(resolve, 2000));

          const tokenAccounts = await state.connection.getParsedTokenAccountsByOwner(
            state.wallet.publicKey,
            { programId: TOKEN_PROGRAM_ID }
          );
          const outputAccount = tokenAccounts.value.find((acc: any) => {
            const parsed = acc.account.data as ParsedAccountData;
            return parsed.parsed.info.mint === outputMint;
          });
          if (outputAccount) {
            const parsed = outputAccount.account.data as ParsedAccountData;
            const postSwapBalance = parsed.parsed.info.tokenAmount.uiAmount || 0;
            outputAmount = postSwapBalance - preSwapBalance;
            logger.info(`Swap output: ${outputAmount} tokens (${preSwapBalance} -> ${postSwapBalance})`);
          }
        } catch (e) {
          logger.warn('Could not get post-swap balance:', e);
        }
      }

      // Refresh balances after successful swap
      await state.connection.confirmTransaction(signature, 'finalized');
      await new Promise(resolve => setTimeout(resolve, 2000));
      await refreshBalances();

      setState(prev => ({ ...prev, isLoading: false }));
      return { signature, outputAmount };

    } catch (error: any) {
      // Revert optimistic updates on failure
      if (inputMintForOptimistic) {
        revertOptimisticBalanceUpdate(inputMintForOptimistic);
        logger.info('Reverted optimistic update for swap input after failure');
      }
      if (outputMintForOptimistic && expectedOutputForOptimistic > 0) {
        revertOptimisticBalanceUpdate(outputMintForOptimistic);
        logger.info('Reverted optimistic update for swap output after failure');
      }

      logger.error('Error executing swap:', error);
      setState(prev => ({ ...prev, isLoading: false }));

      // Identify and throw appropriate error based on failure type
      const errorMessage = error?.message || String(error);

      // Serialization/transform errors (superjson issues)
      if (errorMessage.includes('transform') || errorMessage.includes('serialize') ||
        errorMessage.includes('superjson') || errorMessage.includes('BigInt')) {
        throw new Error('Response serialization error. Please try again.');
      }

      // Network errors
      if (errorMessage.includes('Network') || errorMessage.includes('fetch') ||
        errorMessage.includes('connection') || errorMessage.includes('ECONNREFUSED')) {
        throw new Error('Network error. Please check your connection and try again.');
      }

      // 2FA errors
      if (errorMessage.includes('2FA') || errorMessage.includes('TOTP') ||
        errorMessage.includes('code is required') || errorMessage.includes('Invalid TOTP')) {
        throw new Error('2FA verification failed. Please enter a valid code.');
      }

      // Transaction execution errors
      if (errorMessage.includes('insufficient') || errorMessage.includes('balance')) {
        throw new Error('Insufficient balance for this swap.');
      }

      if (errorMessage.includes('slippage') || errorMessage.includes('price')) {
        throw new Error('Price changed too much. Increase slippage or try again.');
      }

      if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        throw new Error('Transaction timed out. Please try again.');
      }

      // Pass through the original error for unrecognized cases
      throw error;
    }
  };

  // Get all available tokens (wallet tokens + popular tokens)
  const getAvailableTokens = () => {
    const walletTokens = state.tokenBalances.map(token => ({
      symbol: token.symbol,
      name: token.name,
      mint: token.mint,
      decimals: token.decimals,
      logo: token.logo,
      balance: token.uiAmount
    }));

    const popularTokens = Object.entries(POPULAR_TOKENS).map(([symbol, data]) => ({
      symbol,
      name: data.name,
      mint: data.mint,
      decimals: data.decimals,
      logo: data.logo,
      balance: walletTokens.find(t => t.mint === data.mint)?.balance || 0
    }));

    // Add SOL
    const allTokens = [
      {
        symbol: 'SOL',
        name: 'Solana',
        mint: 'So11111111111111111111111111111111111111112',
        decimals: 9,
        logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
        balance: state.balance
      },
      ...popularTokens
    ];

    // Deduplicate by mint address
    const uniqueTokens = allTokens.filter((token, index, self) =>
      index === self.findIndex(t => t.mint === token.mint)
    );

    return uniqueTokens;
  };

  return {
    ...state,
    createWalletEncrypted,
    importWalletEncrypted,
    unlockWallet,
    deleteWallet,
    refreshBalances,
    sendSol,
    sendToken,
    executeSwap,
    getTokenInfo,
    getAvailableTokens
  };
});
