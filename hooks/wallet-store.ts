import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@/lib/create-context-hook';
import { useQuery } from '@tanstack/react-query';

export interface Token {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  balance: number;
  value: number;
  logo?: string;
}

export interface CopiedWallet {
  id: string;
  username: string;
  walletAddress: string;
  roi: number;
  pnl: number;
}

export const [WalletProvider, useWallet] = createContextHook(() => {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [copiedWallets, setCopiedWallets] = useState<CopiedWallet[]>([]);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [dailyPnl, setDailyPnl] = useState<number>(0);

  // Fetch wallet data
  const walletQuery = useQuery({
    queryKey: ['wallet'],
    queryFn: async () => {
      // In a real app, this would be an API call
      const storedTokens = await AsyncStorage.getItem('tokens');
      const storedWallets = await AsyncStorage.getItem('copiedWallets');
      
      return {
        tokens: storedTokens ? JSON.parse(storedTokens) : mockTokens,
        copiedWallets: storedWallets ? JSON.parse(storedWallets) : mockCopiedWallets,
      };
    },
  });

  useEffect(() => {
    if (walletQuery.data) {
      setTokens(walletQuery.data.tokens);
      setCopiedWallets(walletQuery.data.copiedWallets);
      
      // Calculate totals
      const total = walletQuery.data.tokens.reduce(
        (sum: number, token: Token) => sum + token.value,
        0
      );
      setTotalBalance(total);
      
      // Mock daily PnL (in a real app this would be calculated from historical data)
      setDailyPnl(total * 0.045); // 4.5% daily change
    }
  }, [walletQuery.data]);

  // Save tokens to AsyncStorage whenever they change
  useEffect(() => {
    if (tokens.length > 0) {
      AsyncStorage.setItem('tokens', JSON.stringify(tokens));
    }
  }, [tokens]);

  // Save copied wallets to AsyncStorage whenever they change
  useEffect(() => {
    if (copiedWallets.length > 0) {
      AsyncStorage.setItem('copiedWallets', JSON.stringify(copiedWallets));
    }
  }, [copiedWallets]);

  return {
    tokens,
    copiedWallets,
    totalBalance,
    dailyPnl,
    isLoading: walletQuery.isLoading,
    refetch: walletQuery.refetch,
  };
});

// Mock data with real token logos
const mockTokens: Token[] = [
  {
    id: '1',
    symbol: 'RNDR',
    name: 'Render Token',
    price: 8.75,
    change24h: 12.4,
    balance: 100.0,
    value: 875.00,
    logo: 'https://assets.coingecko.com/coins/images/11636/large/rndr.png',
  },
  {
    id: '2',
    symbol: 'SOL',
    name: 'Solana',
    price: 153.43,
    change24h: 3.2,
    balance: 47.87,
    value: 7345.00,
    logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  },
  {
    id: '3',
    symbol: 'PEPE',
    name: 'Pepe',
    price: 0.0000087,
    change24h: 24.7,
    balance: 1000000.0,
    value: 8700.00,
    logo: 'https://assets.coingecko.com/coins/images/29850/large/pepe-token.jpeg',
  },
  {
    id: '4',
    symbol: 'JUP',
    name: 'Jupiter',
    price: 0.8200,
    change24h: 2.8,
    balance: 1000.0,
    value: 820.00,
    logo: 'https://static.jup.ag/jup/icon.png',
  },
  {
    id: '5',
    symbol: 'WIF',
    name: 'Dogwifhat',
    price: 0.002120,
    change24h: 18.1,
    balance: 1226.42,
    value: 2600.00,
    logo: 'https://bafkreifryvyui4gshimmxl26uec3ol3kummjnuljb34vt7gl7cgml3hnrq.ipfs.nftstorage.link',
  },
  {
    id: '6',
    symbol: 'BONK',
    name: 'Bonk',
    price: 0.000003,
    change24h: 6.4,
    balance: 266666666.67,
    value: 800.00,
    logo: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
  },
  {
    id: '7',
    symbol: 'RAY',
    name: 'Raydium',
    price: 4.32,
    change24h: 8.7,
    balance: 185.5,
    value: 801.36,
    logo: 'https://raydium.io/logo.png',
  },
  {
    id: '8',
    symbol: 'USDC',
    name: 'USD Coin',
    price: 1.00,
    change24h: 0.1,
    balance: 2500.0,
    value: 2500.00,
    logo: 'https://assets.coingecko.com/coins/images/6319/large/USD_Coin_icon.png',
  },
  {
    id: '9',
    symbol: 'PYTH',
    name: 'Pyth Network',
    price: 0.38,
    change24h: 15.2,
    balance: 3200.0,
    value: 1216.00,
    logo: 'https://pyth.network/token.svg',
  },
  {
    id: '10',
    symbol: 'ORCA',
    name: 'Orca',
    price: 3.45,
    change24h: -2.1,
    balance: 290.0,
    value: 1000.50,
    logo: 'https://www.orca.so/static/media/orca_logo.4d9d78c5.svg',
  },
  {
    id: '11',
    symbol: 'MNGO',
    name: 'Mango',
    price: 0.025,
    change24h: 12.8,
    balance: 20000.0,
    value: 500.00,
    logo: 'https://trade.mango.markets/assets/icons/mngo.svg',
  },
];

const mockCopiedWallets: CopiedWallet[] = [
  {
    id: '1',
    username: 'alphawhale',
    walletAddress: 'sol1234...5678',
    roi: 71.2,
    pnl: 3420.44,
  },
  {
    id: '2',
    username: 'dogepumpmaster',
    walletAddress: 'sol8765...4321',
    roi: 54.8,
    pnl: 2015.00,
  },
];
