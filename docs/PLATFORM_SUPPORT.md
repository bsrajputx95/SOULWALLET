# Platform Support Guide

> **SOULWALLET V1 Platform Support Matrix**

---

## Supported Platforms

| Platform | Status | Notes |
|----------|--------|-------|
| **iOS** | ✅ Full Support | All features available |
| **Android** | ✅ Full Support | All features available |
| **Web** | ⚠️ Preview Mode | Limited functionality |

---

## Platform-Specific Details

### iOS & Android (Native)

Full wallet functionality including:
- ✅ Wallet creation with BIP39 mnemonic backup
- ✅ Wallet import (mnemonic or private key)
- ✅ SOL and SPL token balances
- ✅ Send/Receive SOL and SPL tokens
- ✅ Jupiter swap integration
- ✅ iBuy feature with FIFO sell logic
- ✅ Copy trading
- ✅ Portfolio tracking with real-time prices
- ✅ Push notifications

**Security:**
- PBKDF2 key derivation: **310,000 iterations** (uses native `react-native-quick-crypto`)
- Secure storage via `expo-secure-store`
- Hardware-accelerated encryption

---

### Web (Preview Mode)

**Available Features:**
- ✅ Account creation and authentication
- ✅ Social feed (read/write posts)
- ✅ Market data viewing
- ✅ Portfolio viewing (if wallet already linked)
- ✅ Settings management

**Limited/Disabled Features:**
- ⚠️ SPL token functions disabled (web bundle size constraints)
- ⚠️ No transaction signing (requires native wallet)
- ⚠️ Send/Swap buttons show "Mobile App Required" tooltip
- ⚠️ Push notifications not available

**Security:**
- PBKDF2 key derivation: **250,000 iterations** (CryptoJS fallback)
- AsyncStorage fallback (less secure than native SecureStore)

> **Recommendation:** For full wallet features and maximum security, use the iOS or Android mobile app.

---

## Web Platform Limitations Detail

### Why SPL Token Functions Are Disabled on Web

1. **Bundle Size**: `@solana/spl-token` adds ~200KB to the web bundle
2. **Performance**: Token operations require multiple RPC calls that perform poorly in JS
3. **Security**: Web cannot securely store private keys long-term

### PBKDF2 Iteration Difference

| Platform | Iterations | Reason |
|----------|------------|--------|
| Native | 310,000 | Hardware-accelerated via `react-native-quick-crypto` |
| Web | 250,000 | JavaScript performance limitations |

Both values exceed OWASP recommendations (minimum 210,000 for SHA-256 as of 2023).

---

## Migration Notes

### For Users with Web-Created Accounts

If you created your account on web and later install the mobile app:
1. Your account and profile sync automatically
2. You'll need to create or import a wallet on mobile for full functionality
3. Portfolio data linked to your wallet will appear once wallet is connected

---

## Technical Implementation

### Platform Detection

```typescript
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';
const isNative = Platform.OS !== 'web';
```

### Feature Flags

```typescript
// lib/secure-storage.ts
const PBKDF2_ITERATIONS = 310000;
const PBKDF2_ITERATIONS_WEB = 250000;

// hooks/solana-wallet-store.ts
const loadSplTokenFunctions = async () => {
  // Only load on native to avoid web bundle size issues
  try {
    const splToken = await import('@solana/spl-token');
    // ... set up functions
  } catch (error) {
    // Graceful fallback for web
  }
};
```

---

## FAQ

### Q: Can I use SOULWALLET on web?
**A:** Yes, but with limited functionality. Web is best for viewing your portfolio and social interactions. For full wallet features (send, receive, swap), use the mobile app.

### Q: Is my data synced between web and mobile?
**A:** Yes, your account, social data, and portfolio are synced. Wallet operations must be performed on mobile.

### Q: Why can't I swap tokens on web?
**A:** Transaction signing requires native security features. Future versions may add WalletConnect support for web.

---

## Roadmap

### V1 (Current)
- Web: Preview mode with limited features
- Mobile: Full functionality

### V2 (Planned)
- Web: WalletConnect integration for external wallet support
- Web: Read-only SPL token balances via backend API
- PWA support for mobile-like experience

---

*Last updated: 2026-01-08*
