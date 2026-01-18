import * as Sentry from '@sentry/node';

export function initSentry(dsn: string | undefined, environment: string) {
  if (!dsn) {
    console.log('[Sentry] No DSN provided, skipping initialization');
    return;
  }

  Sentry.init({
    dsn,
    environment,
    // Performance monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    // Set sampling rate for profiling (relative to tracesSampleRate)
    profilesSampleRate: 0.1,
    // Error filtering
    beforeSend(event, hint) {
      // Don't send expected errors (rate limits, validation, etc.)
      const error = hint.originalException;
      if (error instanceof Error) {
        // Skip rate limit errors
        if (error.message.includes('rate limit') || error.message.includes('Rate limit')) {
          return null;
        }
        // Skip validation errors (user input issues)
        if (error.message.includes('validation') || error.message.includes('Validation')) {
          return null;
        }
      }
      return event;
    },
    // Integrations
    integrations: [
      Sentry.httpIntegration(),
    ],
  });

  console.log(`[Sentry] Initialized for environment: ${environment}`);
}

export function captureException(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, { extra: context });
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  Sentry.captureMessage(message, level);
}

export function setUser(userId: string, extra?: Record<string, string>) {
  Sentry.setUser({ id: userId, ...extra });
}

export function addBreadcrumb(category: string, message: string, data?: Record<string, unknown>) {
  Sentry.addBreadcrumb({ category, message, data, level: 'info' });
}

export { Sentry };
