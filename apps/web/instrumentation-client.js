// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://4a02392b17dabe691cec9e062975ce35@o4510733389201408.ingest.de.sentry.io/4510733402177616",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Filter out non-critical wallet/provider errors that don't affect UX
  beforeSend(event, hint) {
    const error = hint?.originalException;
    const errorMessage = typeof error === "string" ? error : error?.message || "";
    
    // Ignore wallet provider detection errors on mobile browsers
    // These occur when injectedWallet tries to detect wallets on browsers
    // with partial EIP-1193 support (e.g., mobile Chrome, Brave)
    const ignoredPatterns = [
      /Method not found/i,
      /invoking post/i,
      /User rejected/i, // User cancelled wallet action - not an error
      /User denied/i,
      // MetaMask state / availability (environment issues, not app bugs)
      /KeyRing is locked/i,
      /MetaMask extension not found/i,
      // RainbowKit/React portal edge-case: harmless DOM cleanup error that can be triggered
      // when a modal is opened/closed during rapid re-renders.
      /Node\.removeChild/i,
      /The node to be removed is not a child of this node/i,
      // Wallet extensions can conflict while injecting providers (TronLink / others)
      /Cannot assign to read only property 'tronLink'/i,
    ];
    
    if (ignoredPatterns.some(pattern => pattern.test(errorMessage))) {
      return null; // Drop the event
    }
    
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
