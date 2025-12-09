# External Platform WebView Implementation

## Overview

The market tab needs to support external DEX platforms (Raydium, Pump.fun, BullX, DexScreener) via WebView with wallet connection capability.

## Current State

```typescript
// app/(tabs)/market.tsx - Lines 186-198
case 'raydium':
case 'pumpfun':
case 'bullx':
case 'dexscreener':
  return (
    <View style={styles.webViewPlaceholder}>
      <Text>External platform would load here in a WebView.</Text>
    </View>
  );
```

**Problem**: No actual WebView implementation

## Implementation Plan

### Step 1: Install Dependencies

```bash
npx expo install react-native-webview
```

### Step 2: Create WebView Component

```typescript
// components/market/ExternalPlatformWebView.tsx

import React, { useRef, useState, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useSolanaWallet } from '../../hooks/solana-wallet-store';
import { COLORS } from '../../constants/colors';

interface ExternalPlatformWebViewProps {
  platform: 'raydium' | 'pumpfun' | 'bullx' | 'dexscreener';
  onError?: (error: string) => void;
}

const PLATFORM_URLS = {
  raydium: 'https://raydium.io/swap/',
  pumpfun: 'https://pump.fun/',
  bullx: 'https://bullx.io/',
  dexscreener: 'https://dexscreener.com/solana',
};

export const ExternalPlatformWebView: React.FC<ExternalPlatformWebViewProps> = ({
  platform,
  onError,
}) => {
  const webViewRef = useRef<WebView>(null);
  const { publicKey, wallet } = useSolanaWallet();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inject wallet connection script
  const injectedJavaScript = `
    (function() {
      // Create Phantom-like wallet interface
      window.solana = {
        isPhantom: true,
        isConnected: ${!!publicKey},
        publicKey: ${publicKey ? `{ toBase58: () => '${publicKey}' }` : 'null'},
        
        connect: async function() {
          return new Promise((resolve, reject) => {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'WALLET_CONNECT_REQUEST'
            }));
            
            // Wait for response
            window._walletConnectResolve = resolve;
            window._walletConnectReject = reject;
          });
        },
        
        disconnect: async function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'WALLET_DISCONNECT_REQUEST'
          }));
        },
        
        signTransaction: async function(transaction) {
          return new Promise((resolve, reject) => {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SIGN_TRANSACTION_REQUEST',
              transaction: transaction.serialize().toString('base64')
            }));
            
            window._signTransactionResolve = resolve;
            window._signTransactionReject = reject;
          });
        },
        
        signAllTransactions: async function(transactions) {
          return Promise.all(transactions.map(tx => this.signTransaction(tx)));
        },
        
        signMessage: async function(message) {
          return new Promise((resolve, reject) => {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SIGN_MESSAGE_REQUEST',
              message: Array.from(message).join(',')
            }));
            
            window._signMessageResolve = resolve;
            window._signMessageReject = reject;
          });
        }
      };
      
      // Dispatch event to notify dApps
      window.dispatchEvent(new Event('solana#initialized'));
      
      true;
    })();
  `;

  const handleMessage = useCallback(async (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      switch (data.type) {
        case 'WALLET_CONNECT_REQUEST':
          if (publicKey) {
            webViewRef.current?.injectJavaScript(`
              window._walletConnectResolve({ publicKey: { toBase58: () => '${publicKey}' } });
            `);
          } else {
            webViewRef.current?.injectJavaScript(`
              window._walletConnectReject(new Error('Wallet not connected'));
            `);
          }
          break;
          
        case 'SIGN_TRANSACTION_REQUEST':
          // Handle transaction signing
          if (wallet && data.transaction) {
            try {
              // Sign transaction using wallet
              const signedTx = await wallet.signTransaction?.(data.transaction);
              webViewRef.current?.injectJavaScript(`
                window._signTransactionResolve('${signedTx}');
              `);
            } catch (err) {
              webViewRef.current?.injectJavaScript(`
                window._signTransactionReject(new Error('Transaction signing failed'));
              `);
            }
          }
          break;
          
        case 'SIGN_MESSAGE_REQUEST':
          // Handle message signing
          if (wallet && data.message) {
            try {
              const signature = await wallet.signMessage?.(new Uint8Array(data.message.split(',').map(Number)));
              webViewRef.current?.injectJavaScript(`
                window._signMessageResolve({ signature: new Uint8Array([${signature}]) });
              `);
            } catch (err) {
              webViewRef.current?.injectJavaScript(`
                window._signMessageReject(new Error('Message signing failed'));
              `);
            }
          }
          break;
      }
    } catch (err) {
      console.error('WebView message error:', err);
    }
  }, [publicKey, wallet]);

  const handleError = useCallback((syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    setError(nativeEvent.description || 'Failed to load platform');
    onError?.(nativeEvent.description);
  }, [onError]);

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load {platform}</Text>
        <Text style={styles.errorDescription}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => {
            setError(null);
            webViewRef.current?.reload();
          }}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={COLORS.solana} />
          <Text style={styles.loadingText}>Loading {platform}...</Text>
        </View>
      )}
      
      <WebView
        ref={webViewRef}
        source={{ uri: PLATFORM_URLS[platform] }}
        style={styles.webView}
        injectedJavaScript={injectedJavaScript}
        onMessage={handleMessage}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={handleError}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        mixedContentMode="compatibility"
        originWhitelist={['*']}
        userAgent="Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
      />
      
      {!publicKey && (
        <View style={styles.walletWarning}>
          <Text style={styles.walletWarningText}>
            Connect your wallet to trade on {platform}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorDescription: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: COLORS.solana,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  walletWarning: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.warning + '20',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.warning,
  },
  walletWarningText: {
    color: COLORS.warning,
    textAlign: 'center',
    fontSize: 14,
  },
});
```

### Step 3: Update Market Screen

```typescript
// app/(tabs)/market.tsx - Update renderTabContent

import { ExternalPlatformWebView } from '../../components/market/ExternalPlatformWebView';

const renderTabContent = () => {
  switch (activeTab) {
    case 'soulmarket':
      return (/* existing SoulMarket content */);
      
    case 'raydium':
      return <ExternalPlatformWebView platform="raydium" />;
      
    case 'pumpfun':
      return <ExternalPlatformWebView platform="pumpfun" />;
      
    case 'bullx':
      return <ExternalPlatformWebView platform="bullx" />;
      
    case 'dexscreener':
      return <ExternalPlatformWebView platform="dexscreener" />;
      
    default:
      return null;
  }
};
```

## Security Considerations

1. **URL Whitelist**: Only allow known DEX URLs
2. **Transaction Verification**: Show confirmation before signing
3. **Message Signing**: Warn users about message signing requests
4. **Session Management**: Clear WebView data on logout

## Testing Plan

1. Test wallet connection on each platform
2. Test transaction signing flow
3. Test error handling (network issues, invalid URLs)
4. Test on both iOS and Android
5. Test with and without wallet connected

## Known Limitations

1. Some platforms may block WebView access
2. Wallet adapter compatibility varies by platform
3. Deep linking may not work in WebView
4. Some features may require native app
