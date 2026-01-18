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
    ],
  },
  // Allow API calls to Fly.io deployed API
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return [];
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

// Sentry configuration - only apply if env vars are set
function wrapWithSentry(config: NextConfig): NextConfig {
  const org = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;
  const authToken = process.env.SENTRY_AUTH_TOKEN;

  // Only wrap with Sentry if we have the required config
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN || !org || !project || !authToken) {
    return config;
  }

  return withSentryConfig(config, {
    silent: true,
    org,
    project,
    authToken,
  });
}

export default wrapWithSentry(nextConfig);
