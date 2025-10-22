# RORK AI Dependencies Setup

This document outlines the Rork AI dependencies that were imported/replaced in the SOULWALLET project.

## 📦 Dependencies Replaced

### 1. `@nkzw/create-context-hook`

**Original Import:**
```typescript
import createContextHook from '@nkzw/create-context-hook';
```

**Replacement:**
Created local implementation at `lib/create-context-hook.ts`

**New Import:**
```typescript
import createContextHook from '@/lib/create-context-hook';
```

**Files Updated:**
- `hooks/account-store.ts`
- `hooks/auth-store.ts` 
- `hooks/market-store.ts`
- `hooks/social-store.ts`
- `hooks/solana-wallet-store.ts`
- `hooks/wallet-store.ts`

### 2. Backend tRPC App Router

**Original Import:**
```typescript
import type { AppRouter } from "@/backend/trpc/app-router";
```

**Created:**
- `backend/trpc/app-router.ts` - Complete TypeScript interface definitions for tRPC routes

## 🔧 New Services Created

### 1. Jupiter Swap Integration
- **File:** `services/jupiter-swap.ts`
- **Purpose:** Real Jupiter Protocol integration for Solana token swaps
- **Features:**
  - Get swap quotes
  - Execute swaps
  - Token list management
  - Price information
  - Route validation

## 🌍 Environment Configuration

### Updated `.env.example`:
```env
# Rork AI API Configuration
EXPO_PUBLIC_RORK_API_BASE_URL=https://api.rork.com

# Solana Configuration  
EXPO_PUBLIC_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Jupiter API Configuration
EXPO_PUBLIC_JUPITER_API_URL=https://quote-api.jup.ag/v6

# Development Configuration
EXPO_PUBLIC_DEV_MODE=true
EXPO_PUBLIC_LOG_LEVEL=debug

# Social Media Configuration
EXPO_PUBLIC_ENABLE_SOCIAL_FEATURES=true
EXPO_PUBLIC_MAX_POST_LENGTH=280

# Wallet Configuration
EXPO_PUBLIC_DEFAULT_SLIPPAGE=0.5
EXPO_PUBLIC_MAX_PRIORITY_FEE=10000000
```

## 📱 Configuration Files

### `package.json`
Complete package configuration with all necessary dependencies:
- React Native & Expo ecosystem
- Solana Web3.js for blockchain integration
- tRPC for type-safe APIs
- Development tools and testing

### `app.json`
Expo configuration with:
- Dark theme UI
- Platform-specific settings
- Plugin configurations
- Custom scheme setup

## 🔄 API Integration Structure

### tRPC Router Structure (`backend/trpc/app-router.ts`):

```typescript
interface AppRouter {
  auth: {
    login: { input: LoginInput; output: LoginOutput };
    signup: { input: SignupInput; output: SignupOutput };
  };
  social: {
    getPosts: { input: GetPostsInput; output: SocialPost[] };
    createPost: { input: CreatePostInput; output: ApiResponse<SocialPost> };
    likePost: { input: { postId: string }; output: { liked: boolean; count: number } };
    repost: { input: { postId: string }; output: { reposted: boolean; count: number } };
  };
  account: {
    getUserProfile: { input: {}; output: UserProfile };
    updateUserProfile: { input: Partial<UserProfile>; output: ApiResponse<any> };
    // ... more account endpoints
  };
  market: {
    getTokens: { input: MarketFilters; output: Token[] };
    getTokenDetails: { input: { symbol: string }; output: TokenDetail };
  };
  trading: {
    createCopyTrade: { input: CopyTradeSetup; output: ApiResponse<any> };
    stopCopyTrade: { input: { tradeId: string }; output: ApiResponse<{}> };
  };
}
```

## 🚀 Next Steps

1. **Install Dependencies:**
   ```bash
   bun install
   ```

2. **Setup Environment:**
   - Copy `.env.example` to `.env`
   - Update `EXPO_PUBLIC_RORK_API_BASE_URL` with your actual Rork AI API endpoint

3. **Start Development:**
   ```bash
   bun run start
   ```

## 🔗 External Services Integration

### Rork AI API
- Base URL configured via environment variable
- Authentication headers automatically included
- Type-safe API calls via tRPC

### Jupiter Protocol
- Real Solana DEX aggregation
- Quote and swap functionality
- Token price feeds
- Route optimization

## ⚠️ Important Notes

1. **Environment Variables:** Make sure to set up proper environment variables before running
2. **Rork AI Backend:** The tRPC app router interfaces are defined but you'll need to implement the actual backend
3. **Testing:** All mock data systems remain in place for development
4. **Production:** Update API endpoints and remove mock data for production deployment

## 🛠️ Development Workflow

1. **Local Development:** Uses mock data and local implementations
2. **API Integration:** Connect to Rork AI backend via tRPC
3. **Blockchain Integration:** Real Solana mainnet connection via Web3.js
4. **Social Features:** Full social media functionality with real-time updates

This setup provides a complete foundation for the SOULWALLET app with all Rork AI dependencies properly imported and configured.