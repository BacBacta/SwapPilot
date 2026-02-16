// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 0.1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Do not send PII (IP addresses, cookies, user-agent, etc.) for privacy compliance
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: false,

  // Filter out non-critical wallet/provider errors that don't affect UX
  beforeSend(event, hint) {
    const error = hint?.originalException;
    const errorMessage = typeof error === "string" ? error : error?.message || "";
    
    // Drop errors originating from browser extensions (wallets, ad-blockers, etc.)
    // These are not actionable app bugs and can be very noisy in Sentry.
    const hasExtensionFrame =
      event?.exception?.values?.some((ex) =>
        ex?.stacktrace?.frames?.some((frame) => {
          const filename = frame?.filename || "";
          return (
            filename.startsWith("chrome-extension://") ||
            filename.startsWith("moz-extension://") ||
            filename.startsWith("safari-extension://")
          );
        })
      ) ?? false;
    if (hasExtensionFrame) {
      return null;
    }

    // Ignore wallet provider detection errors on mobile browsers
    // These occur when injectedWallet tries to detect wallets on browsers
    // with partial EIP-1193 support (e.g., mobile Chrome, Brave)
    const ignoredPatterns = [
      /Method not found/i,
      /invoking post/i,
      /User rejected/i, // User cancelled wallet action - not an error
      /User denied/i,
      /chrome\.runtime\.sendMessage\(\) called from a webpage must specify an Extension ID/i,
      // MetaMask state / availability (environment issues, not app bugs)
      /KeyRing is locked/i,
      /MetaMask extension not found/i,
      // RainbowKit/React portal edge-case: harmless DOM cleanup error that can be triggered
      // when a modal is opened/closed during rapid re-renders.
      /Node\.removeChild/i,
      /The node to be removed is not a child of this node/i,
      // Wallet extensions can conflict while injecting providers (TronLink / others)
      /Cannot assign to read only property 'tronLink'/i,
      // Wallet extensions can conflict while injecting/overwriting EIP-1193 providers
      /Cannot redefine property:\s*ethereum/i,
      /Cannot set property ethereum/i,
      /Failed to assign ethereum proxy/i,
      /Invalid property descriptor/i,
      /Event `Event` \(type=error\) captured as promise rejection/i,
    ];
    
    if (ignoredPatterns.some(pattern => pattern.test(errorMessage))) {
      return null; // Drop the event
    }

    // Ignore non-Error promise rejections from DOM Event objects
    if (error instanceof Event && error.type === "error") {
      return null;
    }
    
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
