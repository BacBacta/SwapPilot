import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Allow dev origins for VS Code Simple Browser, localhost variants, and Codespaces
  allowedDevOrigins: [
    'http://127.0.0.1:3000',
    'http://localhost:3000',
    'http://127.0.0.1',
    'http://localhost',
    '127.0.0.1',
    'localhost',
  ],
  // Handle optional dependencies that may not be available (WalletConnect, MetaMask SDK)
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'pino-pretty': false,
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
  // Configure external images for next/image
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.coingecko.com',
        pathname: '/coins/images/**',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'tokens.pancakeswap.finance',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.walletconnect.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'assets-cdn.trustwallet.com',
        pathname: '/blockchains/**',
      },
      {
        protocol: 'https',
        hostname: 'swappilot-api.fly.dev',
        pathname: '/v1/token-image/**',
      },
    ],
  },
  // Allow API calls to Fly.io deployed API
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return [];
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiUrl}/v1/:path*`,
      },
      {
        source: '/api/health',
        destination: `${apiUrl}/health`,
      },
    ];
  },
  // Security headers
  async headers() {
    const isProd = process.env.NODE_ENV === 'production';

    const baseHeaders = [
      {
        key: 'X-Frame-Options',
        value: 'DENY',
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff',
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin',
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
      },
    ] as const;

    // Next.js dev server uses patterns that are commonly blocked by strict CSP (e.g. eval in tooling / HMR).
    // Keep CSP strict in production only.
    if (!isProd) {
      return [
        {
          source: '/(.*)',
          headers: [...baseHeaders],
        },
      ];
    }

    return [
      {
        source: '/(.*)',
        headers: [
          ...baseHeaders,
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://vercel.live https://*.sentry.io https://*.posthog.com https://*.i.posthog.com",
              "style-src 'self' 'unsafe-inline'",
              // Token images may be proxied via our API; allow a minimal set of third-party hosts.
              "img-src 'self' data: blob: https://swappilot-api.fly.dev https://assets-cdn.trustwallet.com https://tokens.coingecko.com https://assets.coingecko.com https://*.walletconnect.com",
              "font-src 'self' data:",
              // Allow API calls, analytics, token lists, and RPC endpoints required for wallet balance reads.
              "connect-src 'self' https://swappilot-api.fly.dev https://*.sentry.io https://app.posthog.com https://*.posthog.com https://*.i.posthog.com https://api.web3modal.org https://tokens.pancakeswap.finance https://api.coingecko.com https://bsc-dataseed.binance.org https://bsc-dataseed1.binance.org https://bsc-dataseed2.binance.org https://bsc-dataseed3.binance.org https://bsc-dataseed4.binance.org https://bsc.publicnode.com https://rpc.ankr.com https://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.com wss://*.walletconnect.org blob:",
              "frame-src 'self' https://verify.walletconnect.com https://verify.walletconnect.org",
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

// Sentry configuration - always apply, DSN is in config files
export default withSentryConfig(nextConfig, {
  org: 'swappilot-3a',
  project: 'javascript-nextjs',
  ...(process.env.SENTRY_AUTH_TOKEN ? { authToken: process.env.SENTRY_AUTH_TOKEN } : {}),
  
  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,
  
  // Upload a larger set of source maps for prettier stack traces
  widenClientFileUpload: true,

  // Automatically instrument Vercel Cron Monitors
  webpack: {
    automaticVercelMonitors: true,
  },
});
