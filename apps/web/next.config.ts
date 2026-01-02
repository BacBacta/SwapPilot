import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
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

export default nextConfig;
