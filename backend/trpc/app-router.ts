import type { User } from '../../hooks/auth-store';

// Social Media Types
export interface SocialPost {
  id: string;
  username: string;
  profileImage?: string;
  isVerified: boolean;
  content: string;
  timestamp: string;
  likes: number;
  comments: number;
  reposts: number;
  mentionedToken?: string;
  visibility?: 'public' | 'vip' | 'followers';
  images?: string[];
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: string;
  profileImage?: string;
  defaultCurrency?: string;
  language?: string;
  twoFactorEnabled?: boolean;
  walletAddress?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SecuritySettings {
  userId: string;
  twoFactorEnabled: boolean;
  lastPasswordChange: string;
  loginAttempts: number;
  lockedUntil?: string;
  recoveryEmail?: string;
  backupCodes?: string[];
}

export interface WalletInfo {
  publicKey: string;
  walletType: 'solana' | 'ethereum';
  isBackedUp: boolean;
  createdAt: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginResponse {
  id: string;
  username: string;
  email: string;
  token: string;
}

export interface SignupResponse {
  id: string;
  username: string;
  email: string;
}

// Define the tRPC App Router structure
export interface AppRouter {
  auth: {
    login: {
      input: { username: string; password: string };
      output: LoginResponse;
    };
    signup: {
      input: { username: string; email: string; password: string };
      output: SignupResponse;
    };
    logout: {
      input: {};
      output: { success: boolean };
    };
  };
  
  social: {
    getPosts: {
      input: { 
        feed: 'all' | 'following' | 'vip'; 
        search?: string;
        limit?: number;
        cursor?: string;
      };
      output: SocialPost[];
    };
    createPost: {
      input: { 
        content: string; 
        mentionedToken?: string; 
        visibility: 'public' | 'vip' | 'followers';
        images?: string[];
      };
      output: ApiResponse<SocialPost>;
    };
    likePost: {
      input: { postId: string };
      output: { liked: boolean; count: number };
    };
    repost: {
      input: { postId: string };
      output: { reposted: boolean; count: number };
    };
    getComments: {
      input: { postId: string; limit?: number; cursor?: string };
      output: any[]; // Define comment type as needed
    };
    createComment: {
      input: { postId: string; content: string };
      output: ApiResponse<any>;
    };
  };

  account: {
    getUserProfile: {
      input: {};
      output: UserProfile;
    };
    updateUserProfile: {
      input: Partial<UserProfile>;
      output: ApiResponse<{ profile: UserProfile }>;
    };
    getSecuritySettings: {
      input: {};
      output: SecuritySettings;
    };
    updateSecuritySettings: {
      input: { twoFactorEnabled?: boolean; recoveryEmail?: string };
      output: ApiResponse<{ settings: SecuritySettings }>;
    };
    resetPassword: {
      input: { currentPassword: string; newPassword: string };
      output: ApiResponse<{}>;
    };
    getWalletInfo: {
      input: {};
      output: WalletInfo;
    };
    getWalletPrivateKey: {
      input: { password: string };
      output: ApiResponse<{ privateKey: string }>;
    };
    getWalletRecoveryPhrase: {
      input: { password: string };
      output: ApiResponse<{ phrase: string }>;
    };
    generateBackupCodes: {
      input: {};
      output: ApiResponse<{ codes: string[] }>;
    };
    uploadProfileImage: {
      input: { imageBase64: string; mimeType: string };
      output: ApiResponse<{ imageUrl: string }>;
    };
    deleteAccount: {
      input: { password: string; confirmText: string };
      output: ApiResponse<{}>;
    };
  };

  market: {
    getTokens: {
      input: { 
        filters?: string[];
        search?: string;
        limit?: number;
        sortBy?: 'price' | 'volume' | 'change' | 'marketCap';
      };
      output: any[]; // Define token type as needed
    };
    getTokenDetails: {
      input: { symbol: string };
      output: any; // Define detailed token type
    };
    getTopTraders: {
      input: { limit?: number; period?: string };
      output: any[]; // Define trader type
    };
  };

  trading: {
    createCopyTrade: {
      input: {
        targetWalletAddress: string;
        totalAmount: number;
        amountPerTrade: number;
        stopLoss?: number;
        takeProfit?: number;
      };
      output: ApiResponse<any>;
    };
    stopCopyTrade: {
      input: { tradeId: string };
      output: ApiResponse<{}>;
    };
    getCopyTradeStats: {
      input: {};
      output: {
        activeCopies: number;
        totalTrades: number;
        profitLoss: number;
        profitLossPercentage: number;
      };
    };
  };
}