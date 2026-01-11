/**
 * Dependency Injection Container
 * Uses tsyringe for IoC container and dependency injection
 * Plan: Phase 2 - Dependency Injection Implementation
 */
import 'reflect-metadata';
import { container } from 'tsyringe';

// Service tokens for injection
export const SERVICE_TOKENS = {
    RpcManager: 'RpcManager',
    FeeManager: 'FeeManager',
    QueueManager: 'QueueManager',
    JupiterSwap: 'JupiterSwap',
    TransactionSimulator: 'TransactionSimulator',
    JitoService: 'JitoService',
    CustodialWallet: 'CustodialWallet',
    KeyManagementService: 'KeyManagementService',
    ProfitSharing: 'ProfitSharing',
    CopyTradingService: 'CopyTradingService',
    CircuitBreaker: 'CircuitBreaker',
} as const;

/**
 * Initialize the DI container with all services
 * Called during server bootstrap before routes are registered
 */
export function setupContainer(): void {
    // Lazy registration - services are imported and registered on demand
    // This prevents circular dependency issues

    // Key Management Service (factory function, registered first for deps)
    container.register(SERVICE_TOKENS.KeyManagementService, {
        useFactory: () => require('../services/keyManagement').getKeyManagementService()
    });

    // Core infrastructure services
    container.registerSingleton(SERVICE_TOKENS.RpcManager, require('../services/rpcManager').RpcManager);
    container.registerSingleton(SERVICE_TOKENS.FeeManager, require('../services/feeManager').FeeManager);
    container.registerSingleton(SERVICE_TOKENS.QueueManager, require('../services/queueManager').QueueManager);

    // Blockchain services
    container.registerSingleton(SERVICE_TOKENS.JupiterSwap, require('../services/jupiterSwap').JupiterSwap);
    container.registerSingleton(SERVICE_TOKENS.TransactionSimulator, require('../services/transactionSimulator').TransactionSimulator);
    container.registerSingleton(SERVICE_TOKENS.JitoService, require('../services/jitoService').JitoService);

    // Business services
    container.registerSingleton(SERVICE_TOKENS.CustodialWallet, require('../services/custodialWallet').CustodialWalletService);
    container.registerSingleton(SERVICE_TOKENS.ProfitSharing, require('../services/profitSharing').ProfitSharing);

    // Copy trading service (different directory)
    container.registerSingleton(SERVICE_TOKENS.CopyTradingService, require('../../services/copyTradingService').CopyTradingService);
}

/**
 * Resolve a service from the container
 * @param token - Service token from SERVICE_TOKENS
 */
export function resolveService<T>(token: string): T {
    return container.resolve<T>(token);
}

/**
 * Get the raw container for advanced usage
 */
export { container };

export default container;
