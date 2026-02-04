import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import { checkCopyTradeQueue, executeCopyTrade, executeCopyTradeSell } from './copyTrading';
import { getCachedPin } from './wallet';

const COPY_TRADE_CHECK_TASK = 'copy-trade-check';

// Define the background task
TaskManager.defineTask(COPY_TRADE_CHECK_TASK, async () => {
    try {
        // Get auth token
        const authToken = await SecureStore.getItemAsync('token');
        if (!authToken) {
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

        // Get cached PIN (if user enabled auto-execute and PIN not expired)
        const cachedPin = await getCachedPin();
        const canAutoExecute = !!cachedPin;

        for (const item of result.queue) {
            const tradeValue = item.entryPrice * item.inputAmount;

            // Route based on trade type: entry = buy, exit = sell
            const isExitTrade = item.type === 'exit';

            if (canAutoExecute && tradeValue <= threshold) {
                // Auto-execute small trades based on type
                if (isExitTrade) {
                    // Exit trades use sell execution path
                    await executeCopyTradeSell(item, cachedPin, authToken);
                } else {
                    // Entry trades use buy execution path
                    await executeCopyTrade(item, cachedPin, authToken);
                }
            } else {
                // Show notification for manual execution
                // Notification would be shown here
            }
        }

        return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch {
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
            return;
        }

        // Register task to run every 15 minutes (minimum allowed)
        await BackgroundFetch.registerTaskAsync(COPY_TRADE_CHECK_TASK, {
            minimumInterval: 15 * 60, // 15 minutes in seconds
            stopOnTerminate: false,
            startOnBoot: true,
        });
    } catch {
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
        }
    } catch {
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
    } catch {
        return { isRegistered: false, status: null };
    }
}
