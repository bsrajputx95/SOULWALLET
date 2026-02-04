# SoulWallet Project Structure

## Overview
This document outlines the organized structure of the SoulWallet React Native application.

## Directory Structure

```
SOULWALLET/
├── app/                      # Expo Router app directory
│   ├── (auth)/              # Auth group - login/signup screens
│   │   ├── _layout.tsx      # Auth layout wrapper
│   │   ├── login.tsx        # Login screen
│   │   ├── signup.tsx       # Signup screen
│   │   └── forgot-password.tsx
│   ├── (tabs)/              # Main tab group
│   │   ├── _layout.tsx      # Tab bar layout
│   │   ├── index.tsx        # Home screen
│   │   ├── portfolio.tsx    # Portfolio screen
│   │   ├── market.tsx       # Market screen (placeholder)
│   │   └── sosio.tsx        # Social feed (placeholder)
│   ├── coin/                # Dynamic coin details
│   │   └── [symbol].tsx
│   ├── post/                # Dynamic post details
│   │   └── [id].tsx
│   ├── profile/             # Profile screens
│   │   ├── self.tsx         # Own profile
│   │   └── [username].tsx   # Other user profile
│   ├── _layout.tsx          # Root layout with providers
│   ├── account.tsx          # Account settings
│   ├── settings.tsx         # App settings
│   ├── solana-setup.tsx     # Wallet setup
│   └── +not-found.tsx       # 404 page
│
├── components/              # React components
│   ├── index.ts             # Barrel exports
│   ├── UI Components
│   │   ├── NeonButton.tsx
│   │   ├── NeonCard.tsx
│   │   ├── NeonInput.tsx
│   │   ├── NeonDivider.tsx
│   │   └── GlowingText.tsx
│   ├── Wallet
│   │   ├── WalletCard.tsx
│   │   ├── SendModal.tsx
│   │   ├── ReceiveModal.tsx
│   │   └── SwapModal.tsx
│   ├── Trading
│   │   ├── TokenCard.tsx
│   │   ├── TraderCard.tsx
│   │   ├── CopyTradingModal.tsx
│   │   └── QueueStatusBanner.tsx
│   ├── Social
│   │   ├── SocialPost.tsx
│   │   ├── SocialButton.tsx
│   │   └── TokenBagModal.tsx
│   └── Utils
│       ├── ErrorBoundary.tsx
│       ├── SkeletonLoader.tsx
│       ├── TabBar.tsx
│       └── WebPreviewBanner.tsx
│
├── constants/               # App constants
│   ├── index.ts             # Barrel exports
│   ├── colors.ts            # Color palette
│   ├── theme.ts             # Typography & spacing
│   ├── validation.ts        # Validation rules
│   ├── blockchain.ts        # Blockchain constants
│   ├── fees.ts              # Fee structure
│   ├── limits.ts            # App limits
│   └── decimals.ts          # Decimal places
│
├── contexts/                # React contexts
│   └── AuthContext.tsx      # Auth state management
│
├── services/                # Business logic & API
│   ├── index.ts             # Barrel exports
│   ├── api.ts               # API client
│   ├── wallet.ts            # Wallet operations
│   ├── swap.ts              # Swap/Jupiter integration
│   ├── copyTrading.ts       # Copy trading logic
│   └── backgroundTasks.ts   # Background tasks
│
├── utils/                   # Utility functions
│   ├── index.ts             # Barrel exports
│   ├── session.ts           # Session management
│   ├── formatPrice.ts       # Price formatting
│   ├── toast.ts             # Toast notifications
│   ├── performance.ts       # Performance monitoring
│   └── rateLimiter.ts       # Rate limiting
│
├── types/                   # TypeScript types
│   └── market-filters.ts
│
├── assets/                  # Static assets
│   └── images/
│
└── soulwallet-backend/      # Backend (Prisma + API)
    └── prisma/
        ├── schema.prisma
        └── migrations/
```

## Import Patterns

### Recommended: Path Aliases
```typescript
// Good - Use path aliases
import { NeonButton, WalletCard } from '@/components';
import { COLORS, FONTS } from '@/constants';
import { api } from '@/services';
import { validateSession } from '@/utils';

// Avoid - Relative paths
import { NeonButton } from '../../../components/NeonButton';
```

### Auth Context Usage
```typescript
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { token, isLoading, logout, setToken } = useAuth();
  // ...
}
```

## Key Conventions

1. **Barrel Exports**: Each folder has an `index.ts` for clean imports
2. **Path Aliases**: Use `@/` prefix for all imports
3. **Console Logs**: Wrap in `if (__DEV__)` for development-only logs
4. **Error Handling**: Use centralized API client with automatic 401 handling
5. **Session Management**: Use `validateSession()` on protected screens
