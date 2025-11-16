import React from 'react';
import { useEffect } from 'react';
import { Platform } from 'react-native';

interface PerformanceMetrics {
  bundleLoadTime: number;
  screenLoadTime: number;
  memoryUsage?: number;
  jsHeapSize?: number;
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private startTimes: Map<string, number> = new Map();

  // Start timing a performance metric
  startTiming(key: string): void {
    this.startTimes.set(key, Date.now());
  }

  // End timing and record the metric
  endTiming(key: string): number {
    const startTime = this.startTimes.get(key);
    if (!startTime) {
      console.warn(`Performance: No start time found for ${key}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.startTimes.delete(key);
    
    // Store or update metrics
    const existing = this.metrics.get(key) || {} as PerformanceMetrics;
    this.metrics.set(key, {
      ...existing,
      screenLoadTime: duration,
    });

    if (__DEV__) {
      console.log(`Performance: ${key} took ${duration}ms`);
    }

    return duration;
  }

  // Record bundle load time
  recordBundleLoadTime(time: number): void {
    if (__DEV__) {
      console.log(`Performance: Bundle loaded in ${time}ms`);
    }
  }

  // Get memory usage (if available)
  getMemoryUsage(): number | undefined {
    if (Platform.OS === 'web' && 'performance' in window && 'memory' in (window as any).performance) {
      return (window as any).performance.memory.usedJSHeapSize;
    }
    return undefined;
  }

  // Log performance summary
  logSummary(): void {
    if (!__DEV__) return;

    console.log('=== Performance Summary ===');
    this.metrics.forEach((metrics, key) => {
      console.log(`${key}:`, metrics);
    });

    const memoryUsage = this.getMemoryUsage();
    if (memoryUsage) {
      console.log(`Memory Usage: ${(memoryUsage / 1024 / 1024).toFixed(2)} MB`);
    }
  }

  // Get all metrics
  getMetrics(): Map<string, PerformanceMetrics> {
    return new Map(this.metrics);
  }

  // Clear all metrics
  clear(): void {
    this.metrics.clear();
    this.startTimes.clear();
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for performance monitoring
export const usePerformanceMonitor = () => {
  const startTiming = (key: string) => performanceMonitor.startTiming(key);
  const endTiming = (key: string) => performanceMonitor.endTiming(key);
  const logSummary = () => performanceMonitor.logSummary();
  const getMetrics = () => performanceMonitor.getMetrics();

  return {
    startTiming,
    endTiming,
    logSummary,
    getMetrics,
  };
};

// HOC for screen performance monitoring
export const withPerformanceMonitoring = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  screenName: string
) => {
  return (props: P) => {
    useEffect(() => {
      performanceMonitor.startTiming(screenName);
      
      return () => {
        performanceMonitor.endTiming(screenName);
      };
    }, []);

    return React.createElement(WrappedComponent, props);
  };
};

// Bundle size tracking
export const trackBundleSize = () => {
  if (__DEV__ && Platform.OS === 'web') {
    // Track when the bundle is loaded
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.name.includes('.js') || entry.name.includes('.bundle')) {
          console.log(`Bundle: ${entry.name} - ${entry.duration}ms`);
        }
      });
    });
    
    observer.observe({ entryTypes: ['resource'] });
  }
};