import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Debug mode in development
  debug: process.env.NODE_ENV !== 'production',
  
  // Replay for session replays (optional, 10% in prod)
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  
  integrations: [
    Sentry.replayIntegration(),
    Sentry.browserTracingIntegration(),
  ],

  // Filter out expected errors
  beforeSend(event, hint) {
    const error = hint.originalException;
    if (error instanceof Error) {
      // Skip wallet connection errors (user cancelled, etc.)
      if (error.message.includes('User rejected') || 
          error.message.includes('User denied') ||
          error.message.includes('user rejected')) {
        return null;
      }
      // Skip network errors that are transient
      if (error.message.includes('Failed to fetch') && event.tags?.retryable) {
        return null;
      }
    }
    return event;
  },
});
