import pino, { type Logger, type LoggerOptions } from 'pino';

export type AppLogger = Logger;

export interface LoggerConfig {
  environment: string;
  logtailToken?: string;
}

export function createLogger(config: LoggerConfig): AppLogger {
  const isProduction = config.environment === 'production';
  
  const baseOptions: LoggerOptions = {
    level: isProduction ? 'info' : 'debug',
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  // If Logtail token is provided, we'll use pino-transport in production
  // For now, we use structured JSON logging that can be picked up by BetterStack
  if (isProduction) {
    // Production: JSON output for log aggregation
    return pino({
      ...baseOptions,
      // Add service metadata
      base: {
        service: 'swappilot-api',
        env: config.environment,
      },
    });
  }

  // Development: pretty print
  return pino({
    ...baseOptions,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  });
}

// Singleton logger instance (initialized later)
let logger: AppLogger | null = null;

export function getLogger(): AppLogger {
  if (!logger) {
    // Fallback logger if not initialized
    logger = pino({ level: 'info' });
  }
  return logger;
}

export function initLogger(config: LoggerConfig): AppLogger {
  logger = createLogger(config);
  return logger;
}

// Utility functions for structured logging
export function logSwapRequest(log: AppLogger, data: {
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  chainId: number;
  userAddress?: string;
  requestId: string;
}) {
  log.info({
    event: 'swap_request',
    ...data,
  }, 'Swap quote requested');
}

export function logSwapQuoteResult(log: AppLogger, data: {
  requestId: string;
  providersQueried: number;
  providersSucceeded: number;
  bestProvider?: string;
  bestAmountOut?: string;
  durationMs: number;
  mode: string;
}) {
  log.info({
    event: 'swap_quote_result',
    ...data,
  }, 'Swap quote completed');
}

export function logSecurityCheck(log: AppLogger, data: {
  token: string;
  chainId: number;
  verdict: string;
  sources: string[];
  durationMs: number;
}) {
  log.info({
    event: 'security_check',
    ...data,
  }, 'Token security check completed');
}

export function logError(log: AppLogger, error: Error, context?: Record<string, unknown>) {
  log.error({
    event: 'error',
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  }, error.message);
}
