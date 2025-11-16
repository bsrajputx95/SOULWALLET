import { useState, useEffect } from 'react';
import createContextHook from '@/lib/create-context-hook';
import { getSecureItem, setSecureItem, deleteSecureItem, SecureStorage } from '@/lib/secure-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trpcClient } from '@/lib/trpc';

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
      console.log('✅ Connected to RPC:', endpoint);
      return connection;
    } catch (error) {
      console.warn('⚠️ RPC failed:', endpoint, error instanceof Error ? error.message : 'Unknown error');
      currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
      attempts++;
    }
  }
  
  // If all endpoints fail, return a connection anyway (offline mode)
  console.warn('⚠️ All RPC endpoints failed. Running in offline mode.');
  return new Connection(RPC_ENDPOINTS[0] || 'https://api.mainnet-beta.solana.com', 'confirmed');
}

// Dynamically import SPL token functions only on native platforms
const loadSplTokenFunctions = async () => {
  if (Platform.OS === 'web') {
    console.log('SPL Token functions disabled on web');
    return;
  }
  
  try {
    const splToken = await import('@solana/spl-token');
    TOKEN_PROGRAM_ID = splToken.TOKEN_PROGRAM_ID;
    getAssociatedTokenAddress = splToken.getAssociatedTokenAddress;
    createAssociatedTokenAccountInstruction = splToken.createAssociatedTokenAccountInstruction;
    createTransferInstruction = splToken.createTransferInstruction;
    getAccount = splToken.getAccount;
    console.log('SPL Token functions loaded successfully');
  } catch (error) {
    console.warn('SPL Token functions not available:', error);
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
    initializeWallet();
  }, []);

  // Sync wallet address with backend
  const syncWalletAddressToBackend = async (publicKey: string) => {
    try {
      await trpcClient.user.updateWalletAddress.mutate({ walletAddress: publicKey });
      console.log('✅ Wallet address synced to backend:', publicKey);
    } catch (error) {
      // Silent fail - backend sync is not critical for wallet functionality
      if (__DEV__) console.warn('⚠️ Failed to sync wallet to backend:', error);
    }
  };

  // Load wallet from secure storage
  const loadWallet = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const isEncrypted = await AsyncStorage.getItem(ENCRYPTED_MARKER_KEY);
      if (isEncrypted === 'true') {
        setState(prev => ({ ...prev, isLoading: false, needsUnlock: true }));
        return;
      }
      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      if (__DEV__) console.error('Error loading wallet:', error);
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
      setState(prev => ({ ...prev, isLoading: true }));
      const wallet = Keypair.generate();
      const privateKeyString = bs58.encode(wallet.secretKey);
      const publicKey = wallet.publicKey.toString();

      await SecureStorage.setEncryptedPrivateKey(privateKeyString, password);
      await AsyncStorage.setItem(ENCRYPTED_MARKER_KEY, 'true');
      await deleteSecureItem(STORAGE_KEY);

      setState(prev => ({ ...prev, wallet, publicKey, isLoading: false, needsUnlock: false }));
      await syncWalletAddressToBackend(publicKey);
      console.log('New encrypted wallet created:', publicKey);
      return wallet;
    } catch (error) {
      if (__DEV__) console.error('Error creating encrypted wallet:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      throw new Error('Failed to create encrypted wallet. Please try again.');
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
      console.log('Encrypted wallet imported:', publicKey);
      return wallet;
    } catch (error) {
      if (__DEV__) console.error('Error importing encrypted wallet:', error);
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
          console.warn('Error loading token balances:', error);
        }
      }
      

      
      setState(prev => ({ 
        ...prev, 
        balance: solBalanceInSol,
        tokenBalances,
        isLoading: false 
      }));
      
    } catch (error) {
      if (__DEV__) console.error('Error refreshing balances:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      // Silent fail - balances will be retried on next action
    }
  };

  // Send SOL with simulation and enhanced security
  const sendSol = async (toAddress: string, amount: number): Promise<string> => {
    if (!state.wallet) throw new Error('No wallet connected');
    
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
      console.log('✅ Simulation passed');
      
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
      
      console.log('✅ Transaction confirmed:', signature);
      
      // Wait for finalization
      await waitForFinalization(signature);
      await refreshBalances();
      
      setState(prev => ({ ...prev, isLoading: false }));
      return signature;
    } catch (error: any) {
      console.error('❌ Transaction failed:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      throw new Error(`Transaction failed: ${error.message}`);
    }
  };

  // Wait for transaction finalization
  const waitForFinalization = async (signature: string, maxAttempts: number = 30): Promise<void> => {
    for (let i = 0; i < maxAttempts; i++) {
      const status = await state.connection.getSignatureStatus(signature);
      
      if (status.value?.confirmationStatus === 'finalized') {
        console.log('✅ Finalized');
        return;
      }
      
      if (status.value?.err) {
        throw new Error(`Failed: ${JSON.stringify(status.value.err)}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    console.warn('⚠️ Not finalized after max attempts');
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
      console.error('Failed to estimate fee:', error);
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
      
      console.log('Token transfer successful:', signature);
      
      // Refresh balances after successful transfer
      await refreshBalances();
      
      setState(prev => ({ ...prev, isLoading: false }));
      return signature;
      
    } catch (error) {
      console.error('Error sending token:', error);
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
      
      setState({
        wallet: null,
        publicKey: null,
        balance: 0,
        tokenBalances: [],
        isLoading: false,
        connection: state.connection
      });
      
      if (__DEV__) {
        console.log('Wallet deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting wallet:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };
  
  // Execute swap using Jupiter
  const executeSwap = async (swapTransactionBase64: string): Promise<string> => {
    if (!state.wallet) throw new Error('No wallet connected');
    
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      // Deserialize the transaction
      const transaction = Transaction.from(Buffer.from(swapTransactionBase64, 'base64'));
      
      // Sign and send the transaction
      const signature = await sendAndConfirmTransaction(
        state.connection,
        transaction,
        [state.wallet],
        {
          skipPreflight: false,
          commitment: 'confirmed'
        }
      );
      
      console.log('Swap executed successfully:', signature);
      
      // Refresh balances after successful swap
      await refreshBalances();
      
      setState(prev => ({ ...prev, isLoading: false }));
      return signature;
      
    } catch (error) {
      console.error('Error executing swap:', error);
      setState(prev => ({ ...prev, isLoading: false }));
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
