import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import { checkCopyTradeQueue, executeCopyTrade } from './copyTrading';

const COPY_TRADE_CHECK_TASK = 'copy-trade-check';

// Define the background task
TaskManager.defineTask(COPY_TRADE_CHECK_TASK, async () => {
    try {
        console.log('[Background] Checking copy trade queue...');

        // Get auth token
        const authToken = await SecureStore.getItemAsync('token');
        if (!authToken) {
            console.log('[Background] No auth token');
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        // Check queue
        const result = await checkCopyTradeQueue(authToken);
        if (!result.success || !result.queue || result.queue.length === 0) {
            return BackgroundFetch.BackgroundFetchResult.NoData;
        }

        // Get auto-execute threshold
        const threshold = parseFloat(
            process.env.EXPO_PUBLIC_AUTO_EXECUTE_THRESHOLD || '50'
        );

        // Get cached PIN (if user enabled auto-execute)
        const cachedPinData = await SecureStore.getItemAsync('cached_pin');
        const canAutoExecute = !!cachedPinData;

        for (const item of result.queue) {
            const tradeValue = item.entryPrice * item.inputAmount;

            if (canAutoExecute && tradeValue <= threshold) {
                // Auto-execute small trades
                console.log(`[Background] Auto-executing trade ${item.id} ($${tradeValue})`);
                const pin = cachedPinData; // In production, decrypt this
                await executeCopyTrade(item, pin, authToken);
            } else {
                // Show notification for manual execution
                console.log(`[Background] Trade pending: ${item.inputSymbol} ($${tradeValue})`);
                // Notification would be shown here
            }
        }

        return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (error) {
        console.error('[Background] Task error:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

/**
 * Register background fetch task
 */
export async function registerBackgroundTasks(): Promise<void> {
    try {
        // Check if task is already registered
        const isRegistered = await TaskManager.isTaskRegisteredAsync(COPY_TRADE_CHECK_TASK);
        if (isRegistered) {
            console.log('[Background] Task already registered');
            return;
        }

        // Register task to run every 15 minutes (minimum allowed)
        await BackgroundFetch.registerTaskAsync(COPY_TRADE_CHECK_TASK, {
            minimumInterval: 15 * 60, // 15 minutes in seconds
            stopOnTerminate: false,
            startOnBoot: true,
        });

        console.log('[Background] Task registered successfully');
    } catch (error) {
        console.error('[Background] Registration error:', error);
    }
}

/**
 * Unregister background task
 */
export async function unregisterBackgroundTasks(): Promise<void> {
    try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(COPY_TRADE_CHECK_TASK);
        if (isRegistered) {
            await BackgroundFetch.unregisterTaskAsync(COPY_TRADE_CHECK_TASK);
            console.log('[Background] Task unregistered');
        }
    } catch (error) {
        console.error('[Background] Unregister error:', error);
    }
}

/**
 * Check background task status
 */
export async function getBackgroundTaskStatus(): Promise<{
    isRegistered: boolean;
    status: BackgroundFetch.BackgroundFetchStatus | null;
}> {
    try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(COPY_TRADE_CHECK_TASK);
        const status = await BackgroundFetch.getStatusAsync();
        return { isRegistered, status };
    } catch (error) {
        console.error('[Background] Status check error:', error);
        return { isRegistered: false, status: null };
    }
}
