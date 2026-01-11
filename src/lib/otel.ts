/**
 * OpenTelemetry SDK Initialization
 * 
 * Provides distributed tracing across the application using OpenTelemetry.
 * - Exports traces to Jaeger for visualization
 * - Auto-instruments HTTP, Fastify, Prisma, and Redis
 * - Adds service metadata for correlation
 * 
 * IMPORTANT: This file must be imported BEFORE any other application code
 * to ensure proper instrumentation of all modules.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { Resource } from '@opentelemetry/resources';
import { DiagConsoleLogger, DiagLogLevel, diag, trace, context, SpanStatusCode } from '@opentelemetry/api';

// Enable OpenTelemetry debug logging in development
if (process.env.OTEL_DEBUG === 'true') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

// SDK instance (singleton)
let sdk: NodeSDK | null = null;
let isInitialized = false;

/**
 * Initialize OpenTelemetry SDK
 * Call this BEFORE any other imports in your main entry point
 */
export function initializeOpenTelemetry(): void {
    if (isInitialized) {
        return;
    }

    // Skip in test environment
    if (process.env.NODE_ENV === 'test') {
        console.log('[OpenTelemetry] Skipping initialization in test environment');
        return;
    }

    // Skip if tracing is disabled
    if (process.env.OTEL_TRACING_ENABLED === 'false') {
        console.log('[OpenTelemetry] Tracing disabled via OTEL_TRACING_ENABLED=false');
        return;
    }

    const jaegerEndpoint = process.env.OTEL_EXPORTER_JAEGER_ENDPOINT || 'http://jaeger:14268/api/traces';
    const serviceName = process.env.OTEL_SERVICE_NAME || 'soulwallet-api';
    const serviceVersion = process.env.npm_package_version || '1.0.0';
    const environment = process.env.NODE_ENV || 'development';

    try {
        // Configure Jaeger exporter
        const jaegerExporter = new JaegerExporter({
            endpoint: jaegerEndpoint,
        });

        // Create SDK with auto-instrumentation
        // Using string literals for resource attributes to avoid package version conflicts
        sdk = new NodeSDK({
            resource: new Resource({
                'service.name': serviceName,
                'service.version': serviceVersion,
                'deployment.environment': environment,
                'service.instance.id': process.env.HOSTNAME || `instance-${process.pid}`,
            }) as any,
            traceExporter: jaegerExporter,
            instrumentations: [
                getNodeAutoInstrumentations({
                    // Instrument HTTP requests
                    '@opentelemetry/instrumentation-http': {
                        enabled: true,
                        ignoreIncomingRequestHook: (req) => {
                            // Skip health checks and metrics endpoints
                            const url = req.url || '';
                            return url.includes('/health') || url.includes('/metrics');
                        },
                    },
                    // Instrument Fastify
                    '@opentelemetry/instrumentation-fastify': {
                        enabled: true,
                    },
                    // Instrument Redis (ioredis)
                    '@opentelemetry/instrumentation-ioredis': {
                        enabled: true,
                    },
                    // Instrument Prisma (via pg)
                    '@opentelemetry/instrumentation-pg': {
                        enabled: true,
                    },
                    // Disable fs instrumentation (too noisy)
                    '@opentelemetry/instrumentation-fs': {
                        enabled: false,
                    },
                }),
            ],
        });

        // Start the SDK
        sdk.start();
        isInitialized = true;

        console.log(`[OpenTelemetry] Initialized successfully`);
        console.log(`  - Service: ${serviceName}@${serviceVersion}`);
        console.log(`  - Environment: ${environment}`);
        console.log(`  - Jaeger endpoint: ${jaegerEndpoint}`);

    } catch (error) {
        console.error('[OpenTelemetry] Failed to initialize:', error);
    }
}

/**
 * Shutdown OpenTelemetry SDK gracefully
 * Call this in your application shutdown handler
 */
export async function shutdownOpenTelemetry(): Promise<void> {
    if (!sdk) {
        return;
    }

    try {
        await sdk.shutdown();
        console.log('[OpenTelemetry] Shut down successfully');
    } catch (error) {
        console.error('[OpenTelemetry] Error during shutdown:', error);
    }
}

/**
 * Get the current trace ID for logging correlation
 * Returns the trace ID if in an active span, otherwise undefined
 */
export function getCurrentTraceId(): string | undefined {
    const span = trace.getActiveSpan();
    if (span) {
        return span.spanContext().traceId;
    }
    return undefined;
}

/**
 * Get the current span ID for logging correlation
 */
export function getCurrentSpanId(): string | undefined {
    const span = trace.getActiveSpan();
    if (span) {
        return span.spanContext().spanId;
    }
    return undefined;
}

/**
 * Create a custom span for tracing specific operations
 * @param name - Name of the span
 * @param fn - Function to execute within the span
 */
export async function withSpan<T>(
    name: string,
    fn: () => Promise<T>,
    attributes?: Record<string, string | number | boolean>
): Promise<T> {
    const tracer = trace.getTracer('soulwallet-api');

    return tracer.startActiveSpan(name, async (span) => {
        try {
            if (attributes) {
                Object.entries(attributes).forEach(([key, value]) => {
                    span.setAttribute(key, value);
                });
            }

            const result = await fn();
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
        } catch (error: any) {
            span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error.message,
            });
            span.recordException(error);
            throw error;
        } finally {
            span.end();
        }
    });
}

/**
 * Add attributes to the current span
 */
export function addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
    const span = trace.getActiveSpan();
    if (span) {
        Object.entries(attributes).forEach(([key, value]) => {
            span.setAttribute(key, value);
        });
    }
}

/**
 * Record an error in the current span
 */
export function recordSpanError(error: Error): void {
    const span = trace.getActiveSpan();
    if (span) {
        span.recordException(error);
        span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
        });
    }
}

// Export trace and context for advanced usage
export { trace, context };

// Export check for initialization status
export function isOpenTelemetryInitialized(): boolean {
    return isInitialized;
}
