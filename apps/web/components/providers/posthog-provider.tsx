"use client";

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react';
import { useEffect, type ReactNode } from 'react';

// Initialize PostHog only on client side
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
    // Capture pageviews automatically
    capture_pageview: true,
    // Capture page leaves
    capture_pageleave: true,
    // Session recording disabled in production for privacy
    disable_session_recording: true,
    // Respect Do Not Track
    respect_dnt: true,
    // Persistence
    persistence: 'localStorage+cookie',
  });
}

interface PostHogProviderProps {
  children: ReactNode;
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  return (
    <PHProvider client={posthog}>
      {children}
    </PHProvider>
  );
}

// Custom hook for analytics events
export function useAnalytics() {
  const ph = usePostHog();

  return {
    // Wallet events
    trackWalletConnected: (address: string, walletType: string) => {
      ph?.capture('wallet_connected', {
        wallet_address: address.slice(0, 10) + '...',
        wallet_type: walletType,
      });
    },
    
    trackWalletDisconnected: () => {
      ph?.capture('wallet_disconnected');
    },

    // Swap events
    trackSwapInitiated: (data: {
      sellToken: string;
      buyToken: string;
      sellAmount: string;
      chainId: number;
      mode: string;
    }) => {
      ph?.capture('swap_initiated', data);
    },

    trackSwapQuoteReceived: (data: {
      sellToken: string;
      buyToken: string;
      providersCount: number;
      bestProvider: string;
      estimatedOutput: string;
      mode: string;
    }) => {
      ph?.capture('swap_quote_received', data);
    },

    trackSwapConfirmed: (data: {
      sellToken: string;
      buyToken: string;
      provider: string;
      txHash?: string;
    }) => {
      ph?.capture('swap_confirmed', data);
    },

    trackSwapCompleted: (data: {
      sellToken: string;
      buyToken: string;
      provider: string;
      txHash: string;
      actualOutput: string;
    }) => {
      ph?.capture('swap_completed', {
        ...data,
        $set: { last_swap_date: new Date().toISOString() },
      });
    },

    trackSwapFailed: (data: {
      sellToken: string;
      buyToken: string;
      provider: string;
      error: string;
    }) => {
      ph?.capture('swap_failed', data);
    },

    // Token security events
    trackSecurityWarningShown: (data: {
      token: string;
      verdict: string;
      diagnostics: string[];
    }) => {
      ph?.capture('security_warning_shown', data);
    },

    trackSecurityWarningDismissed: (token: string) => {
      ph?.capture('security_warning_dismissed', { token });
    },

    // Mode switching
    trackModeChanged: (mode: 'safe' | 'turbo') => {
      ph?.capture('mode_changed', { mode });
    },

    // Feature usage
    trackFeatureUsed: (feature: string, metadata?: Record<string, unknown>) => {
      ph?.capture('feature_used', { feature, ...metadata });
    },

    // Identify user (call after wallet connect) — uses truncated address for privacy
    identifyUser: (address: string, properties?: Record<string, unknown>) => {
      // Hash the wallet address to avoid storing PII in analytics
      const anonymousId = address.slice(0, 6) + '…' + address.slice(-4);
      ph?.identify(anonymousId, properties);
    },

    // Reset user (call after wallet disconnect)
    resetUser: () => {
      ph?.reset();
    },
  };
}

// Component to track page views with additional context
export function PostHogPageView() {
  const ph = usePostHog();

  useEffect(() => {
    if (ph) {
      ph.capture('$pageview', {
        url: window.location.href,
        path: window.location.pathname,
      });
    }
  }, [ph]);

  return null;
}
