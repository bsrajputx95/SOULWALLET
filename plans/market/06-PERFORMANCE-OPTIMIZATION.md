# Performance Optimization

## Current Issues

1. **No Virtualization**: All tokens rendered at once
2. **No Pagination**: Full list loaded
3. **Expensive Re-renders**: Filter changes re-render all
4. **No Memoization**: Components re-render unnecessarily

## Solutions

### 1. Virtualized Token List

```typescript
// components/market/VirtualizedTokenList.tsx

import React, { useCallback, memo } from 'react';
import { FlatList, View, Text, StyleSheet, RefreshControl } from 'react-native';
import { TokenCard } from '../TokenCard';
import { Token } from '../../hooks/market-store';
import { COLORS } from '../../constants/colors';
import { SkeletonLoader } from '../SkeletonLoader';

interface VirtualizedTokenListProps {
  tokens: Token[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
  onEndReached?: () => void;
  ListHeaderComponent?: React.ReactElement;
}

// Memoized token card wrapper
const MemoizedTokenCard = memo(({ token }: { token: Token }) => (
  <TokenCard
    symbol={token.symbol}
    name={token.name}
    price={token.price}
    change={token.change24h}
    liquidity={token.liquidity}
    volume={token.volume}
    transactions={token.transactions}
    logo={token.logo}
  />
));

export const VirtualizedTokenList: React.FC<VirtualizedTokenListProps> = ({
  tokens,
  isLoading,
  onRefresh,
  onEndReached,
  ListHeaderComponent,
}) => {
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  }, [onRefresh]);

  const renderItem = useCallback(({ item }: { item: Token }) => (
    <MemoizedTokenCard token={item} />
  ), []);

  const keyExtractor = useCallback((item: Token) => item.id, []);

  const getItemLayout = useCallback((data: any, index: number) => ({
    length: 80, // Approximate height of TokenCard
    offset: 80 * index,
    index,
  }), []);

  // Loading skeleton
  if (isLoading && tokens.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        {Array.from({ length: 10 }).map((_, i) => (
          <SkeletonLoader key={i} style={styles.skeleton} />
        ))}
      </View>
    );
  }

  // Empty state
  if (!isLoading && tokens.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No tokens found</Text>
        <Text style={styles.emptySubtitle}>
          Try adjusting your filters or search
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={tokens}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
      removeClippedSubviews={true}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={COLORS.solana}
        />
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={ListHeaderComponent}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
    />
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 16,
  },
  skeleton: {
    height: 72,
    marginBottom: 8,
    borderRadius: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 100,
  },
});
```

### 2. Pagination Support

```typescript
// hooks/market-store.ts - Add pagination

const PAGE_SIZE = 20;

export const [MarketProvider, useMarket] = createContextHook(() => {
  const [page, setPage] = useState(1);
  
  // ... existing code ...

  // Paginated tokens
  const paginatedTokens = useMemo(() => {
    return filteredTokens.slice(0, page * PAGE_SIZE);
  }, [filteredTokens, page]);

  const hasMore = paginatedTokens.length < filteredTokens.length;

  const loadMore = useCallback(() => {
    if (hasMore) {
      setPage(p => p + 1);
    }
  }, [hasMore]);

  const resetPagination = useCallback(() => {
    setPage(1);
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    resetPagination();
  }, [filters, searchQuery]);

  return {
    tokens: paginatedTokens,
    totalCount: filteredTokens.length,
    hasMore,
    loadMore,
    // ... rest
  };
});
```

### 3. Memoized Components

```typescript
// components/TokenCard.tsx - Add memo

import React, { memo } from 'react';

export const TokenCard = memo<TokenCardProps>(({
  symbol,
  name,
  price,
  change,
  liquidity,
  volume,
  transactions,
  logo,
  onPress,
}) => {
  // ... existing implementation
}, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return (
    prevProps.symbol === nextProps.symbol &&
    prevProps.price === nextProps.price &&
    prevProps.change === nextProps.change &&
    prevProps.liquidity === nextProps.liquidity &&
    prevProps.volume === nextProps.volume
  );
});
```

### 4. Debounced Search

```typescript
// hooks/use-debounced-value.ts

import { useState, useEffect } from 'react';

export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Usage in market-store.ts
const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

const filteredTokens = useMemo(() => {
  // Use debouncedSearchQuery instead of searchQuery
  if (debouncedSearchQuery.trim()) {
    // ... filter logic
  }
}, [rawTokens, debouncedSearchQuery, filters]);
```

### 5. Image Caching

```typescript
// components/CachedImage.tsx

import React, { useState } from 'react';
import { Image, View, StyleSheet } from 'react-native';
import FastImage from 'react-native-fast-image';

interface CachedImageProps {
  uri?: string;
  style?: any;
  fallback?: React.ReactNode;
}

export const CachedImage: React.FC<CachedImageProps> = ({
  uri,
  style,
  fallback,
}) => {
  const [error, setError] = useState(false);

  if (!uri || error) {
    return fallback ? <>{fallback}</> : <View style={[style, styles.placeholder]} />;
  }

  return (
    <FastImage
      source={{
        uri,
        priority: FastImage.priority.normal,
        cache: FastImage.cacheControl.immutable,
      }}
      style={style}
      onError={() => setError(true)}
      resizeMode={FastImage.resizeMode.cover}
    />
  );
};

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: '#333',
  },
});
```

### 6. Update Market Screen

```typescript
// app/(tabs)/market.tsx

import { VirtualizedTokenList } from '../../components/market/VirtualizedTokenList';

const renderSoulMarketContent = () => {
  return (
    <VirtualizedTokenList
      tokens={tokens}
      isLoading={isLoading}
      onRefresh={refetch}
      onEndReached={loadMore}
      ListHeaderComponent={
        showFilters ? <FilterChips /> : undefined
      }
    />
  );
};
```

## Performance Metrics

### Before Optimization
- Initial render: ~500ms for 50 tokens
- Scroll FPS: ~30 FPS
- Memory: ~150MB

### After Optimization (Target)
- Initial render: <100ms
- Scroll FPS: 60 FPS
- Memory: <80MB

## Testing

1. Profile with React DevTools
2. Test with 100+ tokens
3. Measure scroll performance
4. Check memory usage
5. Test on low-end devices
