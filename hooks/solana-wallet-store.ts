import { useState, useEffect } from 'react';
import createContextHook from '@/lib/create-context-hook';
import { getSecureItem, setSecureItem, deleteSecureItem } from '@/lib/secure-storage';
import { 
  Connection, 
  PublicKey, 
  Keypair, 
  Transaction, 
  SystemProgram, 
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  ParsedAccountData
} from '@solana/web3.js';
import bs58 from 'bs58';
import { Platform } from 'react-native';

// SPL Token imports - only for native platforms
let TOKEN_PROGRAM_ID: any;
let getAssociatedTokenAddress: any;
let createAssociatedTokenAccountInstruction: any;
let createTransferInstruction: any;
let getAccount: any;

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
}

const SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';
const STORAGE_KEY = 'solana_wallet_private_key';

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
    connection: new Connection(SOLANA_RPC_URL, 'confirmed')
  });

  // Load wallet from storage on mount
  useEffect(() => {
    const initializeWallet = async () => {
      await loadSplTokenFunctions();
      await loadWallet();
    };
    initializeWallet();
  }, []);

  // Load wallet from secure storage
  const loadWallet = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const privateKeyString = await getSecureItem(STORAGE_KEY);
      
      if (privateKeyString) {
        const privateKeyBytes = bs58.decode(privateKeyString);
        const wallet = Keypair.fromSecretKey(privateKeyBytes);
        const publicKey = wallet.publicKey.toString();
        
        setState(prev => ({ 
          ...prev, 
          wallet, 
          publicKey,
          isLoading: false 
        }));
        
        // Load balances
        await refreshBalances(wallet);
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      if (__DEV__) console.error('Error loading wallet:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      // Silent fail for initial load - user can create/import wallet
    }
  };

  // Create new wallet
  const createWallet = async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const wallet = Keypair.generate();
      const privateKeyString = bs58.encode(wallet.secretKey);
      const publicKey = wallet.publicKey.toString();
      
      await setSecureItem(STORAGE_KEY, privateKeyString);
      
      setState(prev => ({ 
        ...prev, 
        wallet, 
        publicKey,
        isLoading: false 
      }));
      
      console.log('New wallet created:', publicKey);
      return wallet;
    } catch (error) {
      if (__DEV__) console.error('Error creating wallet:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      throw new Error('Failed to create wallet. Please try again.');
    }
  };

  // Import wallet from private key
  const importWallet = async (privateKeyString: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      const privateKeyBytes = bs58.decode(privateKeyString);
      const wallet = Keypair.fromSecretKey(privateKeyBytes);
      const publicKey = wallet.publicKey.toString();
      
      await setSecureItem(STORAGE_KEY, privateKeyString);
      
      setState(prev => ({ 
        ...prev, 
        wallet, 
        publicKey,
        isLoading: false 
      }));
      
      await refreshBalances(wallet);
      console.log('Wallet imported:', publicKey);
      return wallet;
    } catch (error) {
      if (__DEV__) console.error('Error importing wallet:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      throw new Error('Invalid private key. Please check and try again.');
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
      let tokenBalances: TokenBalance[] = [];
      
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
              
              tokenBalances.push({
                mint,
                symbol: tokenData?.[0] || mint.slice(0, 8),
                name: tokenData?.[1].name || 'Unknown Token',
                balance: tokenInfo.tokenAmount.amount,
                decimals: tokenInfo.tokenAmount.decimals,
                logo: tokenData?.[1].logo,
                uiAmount: tokenInfo.tokenAmount.uiAmount
              });
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

  // Send SOL
  const sendSol = async (toAddress: string, amount: number) => {
    if (!state.wallet) throw new Error('No wallet connected');
    
    try {
      setState(prev => ({ ...prev, isLoading: true }));
      
      const toPublicKey = new PublicKey(toAddress);
      const lamports = amount * LAMPORTS_PER_SOL;
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: state.wallet.publicKey,
          toPubkey: toPublicKey,
          lamports
        })
      );
      
      const signature = await sendAndConfirmTransaction(
        state.connection,
        transaction,
        [state.wallet]
      );
      
      console.log('SOL transfer successful:', signature);
      
      // Refresh balances after successful transfer
      await refreshBalances();
      
      setState(prev => ({ ...prev, isLoading: false }));
      return signature;
      
    } catch (error: any) {
      if (__DEV__) console.error('Error sending SOL:', error);
      setState(prev => ({ ...prev, isLoading: false }));
      
      // Provide user-friendly error messages
      if (error?.message?.includes('insufficient funds')) {
        throw new Error('Insufficient SOL balance for this transaction.');
      } else if (error?.message?.includes('invalid')) {
        throw new Error('Invalid recipient address. Please check and try again.');
      } else {
        throw new Error('Transaction failed. Please check your network connection and try again.');
      }
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
      
      // Get or create destination token account
      const destinationTokenAccount = await getAssociatedTokenAddress(
        mintPublicKey,
        toPublicKey
      );
      
      const transaction = new Transaction();
      
      // Check if destination token account exists
      try {
        await getAccount(state.connection, destinationTokenAccount);
      } catch (error: any) {
        // If account doesn't exist, create it
        if (error.name === 'TokenAccountNotFoundError' || error.message?.includes('could not find account')) {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              state.wallet.publicKey,
              destinationTokenAccount,
              toPublicKey,
              mintPublicKey
            )
          );
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
      
      const signature = await sendAndConfirmTransaction(
        state.connection,
        transaction,
        [state.wallet]
      );
      
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
    createWallet,
    importWallet,
    loadWallet,
    deleteWallet,
    refreshBalances,
    sendSol,
    sendToken,
    getTokenInfo,
    getAvailableTokens
  };
});
