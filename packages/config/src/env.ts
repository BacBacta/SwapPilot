import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3001),

  API_PORT: z.coerce.number().int().positive().default(3001),
  WEB_PORT: z.coerce.number().int().positive().default(3000),

  RECEIPT_STORE: z.enum(['memory', 'file']).default('file'),
  RECEIPT_STORE_PATH: z.string().default('./.data/receipts'),

  SWAP_LOG_STORE: z.enum(['memory', 'file']).default('file'),
  SWAP_LOG_STORE_PATH: z.string().default('./.data/swaps'),

  // Redis / caching
  REDIS_URL: z.string().default(''),
  QUOTE_CACHE_TTL_SECONDS: z.coerce.number().int().min(1).max(300).default(5),

  // API gateway rate limiting
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(10_000).default(120),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(100).max(60 * 60 * 1000).default(60_000),

  // Observability
  METRICS_ENABLED: z
    .preprocess((v) => {
      if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        return s === '1' || s === 'true' || s === 'yes' || s === 'on';
      }
      return v;
    }, z.boolean())
    .default(true),

  // Sentry error tracking
  SENTRY_DSN: z.string().default(''),
  SENTRY_TEST_TOKEN: z.string().default(''),
  ADMIN_API_TOKEN: z.string().default(''),
  // Logtail (BetterStack) for log aggregation
  LOGTAIL_TOKEN: z.string().default(''),

  // RPC / Preflight
  // Comma-separated list of BSC (BNB Chain) JSON-RPC endpoints.
  BSC_RPC_URLS: z.string().default('https://bsc-dataseed.binance.org,https://bsc-dataseed1.defibit.io,https://bsc-dataseed1.ninicoin.io'),
  RPC_QUORUM: z.coerce.number().int().min(1).max(5).default(2),
  RPC_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(2_500),
  RPC_ENABLE_TRACE: z
    .preprocess((v) => {
      if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        return s === '1' || s === 'true' || s === 'yes' || s === 'on';
      }
      return v;
    }, z.boolean())
    .default(false),

  // Risk heuristics
  RISK_KNOWN_TOKENS: z.string().default([
    '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
    '0x55d398326f99059fF775485246999027B3197955', // USDT
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // USDC
    '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', // BTCB
    '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', // WETH
    '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', // CAKE
  ].join(',')),
  RISK_MEME_TOKENS: z.string().default(''),

  // PancakeSwap (DEX) quoting
  // Leave empty to keep PancakeSwap deep-link only.
  PANCAKESWAP_V2_ROUTER: z.string().default('0x10ED43C718714eb63d5aA57B78B54704E256024E'),
  PANCAKESWAP_V3_QUOTER: z.string().default(''),
  // PancakeSwap factories (used by on-chain sellability heuristics)
  // Defaults are from PancakeSwap developer docs (BSC mainnet).
  PANCAKESWAP_V2_FACTORY: z.string().default('0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73'),
  PANCAKESWAP_V3_FACTORY: z.string().default('0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865'),
  // Wrapped native token used for BNB (BSC mainnet WBNB by default).
  // Override if you run against a different chain/RPC.
  PANCAKESWAP_WBNB: z.string().default('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'),
  PANCAKESWAP_QUOTE_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(2_000),

  // Sellability heuristic configuration (BSC)
  // Multicall3 default is the standard deployment address.
  SELLABILITY_MULTICALL3_ADDRESS: z.string().default('0xcA11bde05977b3631167028862bE2a173976CA11'),
  // Comma-separated list of base tokens to check liquidity against on BSC.
  // Defaults include common bases; override if you prefer a smaller set.
  SELLABILITY_BASE_TOKENS_BSC: z
    .string()
    .default(
      [
        // WBNB
        '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
        // USDT
        '0x55d398326f99059fF775485246999027B3197955',
        // USDC
        '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
        // BTCB
        '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
        // ETH (Binance-Peg ETH)
        '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
      ].join(','),
    ),

  // Token security (BSC) - external best-effort checks (e.g., GoPlus)
  TOKEN_SECURITY_GOPLUS_ENABLED: z.coerce.boolean().default(true),
  TOKEN_SECURITY_GOPLUS_BASE_URL: z.string().default('https://api.gopluslabs.io'),
  TOKEN_SECURITY_HONEYPOTIS_ENABLED: z.coerce.boolean().default(true),
  TOKEN_SECURITY_HONEYPOTIS_BASE_URL: z.string().default('https://api.honeypot.is'),
  // BscScan contract verification (optional, improves evidence when oracles are missing)
  TOKEN_SECURITY_BSCSCAN_ENABLED: z.coerce.boolean().default(false),
  TOKEN_SECURITY_BSCSCAN_BASE_URL: z.string().default('https://api.bscscan.com'),
  TOKEN_SECURITY_BSCSCAN_API_KEY: z.string().default(''),
  TOKEN_SECURITY_TIMEOUT_MS: z.coerce.number().int().min(50).max(10_000).default(800),
  TOKEN_SECURITY_CACHE_TTL_MS: z.coerce.number().int().min(1_000).max(86_400_000).default(15 * 60 * 1000),
  // Ultra-secure (SAFE) strict max tax percent (buy/sell/transfer) before failing.
  TOKEN_SECURITY_TAX_STRICT_MAX_PERCENT: z.coerce.number().min(0).max(100).default(5),
  // SAFE fallback: minimum liquidity to treat unknown tokens as OK when security oracles are missing.
  TOKEN_SECURITY_FALLBACK_MIN_LIQUIDITY_USD: z.coerce.number().min(0).max(10_000_000).default(50_000),

  // DexScreener liquidity checks
  DEXSCREENER_ENABLED: z.coerce.boolean().default(true),
  DEXSCREENER_BASE_URL: z.string().default('https://api.dexscreener.com'),
  DEXSCREENER_TIMEOUT_MS: z.coerce.number().int().min(50).max(10_000).default(1_200),
  DEXSCREENER_CACHE_TTL_MS: z.coerce.number().int().min(1_000).max(86_400_000).default(2 * 60 * 1000),
  DEXSCREENER_MIN_LIQUIDITY_USD: z.coerce.number().min(0).max(10_000_000).default(100),
});

export type Env = z.infer<typeof EnvSchema>;

export type AppConfig = {
  nodeEnv: Env['NODE_ENV'];
  host: string;
  port: number;
  receiptStore: {
    type: Env['RECEIPT_STORE'];
    path: string;
  };
  swapLogStore: {
    type: Env['SWAP_LOG_STORE'];
    path: string;
  };
  redis: {
    url: string | null;
    quoteCacheTtlSeconds: number;
  };
  rateLimit: {
    max: number;
    windowMs: number;
  };
  metrics: {
    enabled: boolean;
  };
  observability: {
    sentryDsn: string | null;
    sentryTestToken: string | null;
    adminApiToken: string | null;
    logtailToken: string | null;
  };
  rpc: {
    bscUrls: string[];
    quorum: number;
    timeoutMs: number;
    enableTrace: boolean;
  };
  risk: {
    knownTokens: string[];
    memeTokens: string[];
  };
  pancakeswap: {
    v2Router: string | null;
    v3Quoter: string | null;
    v2Factory: string;
    v3Factory: string;
    wbnb: string;
    quoteTimeoutMs: number;
  };
  sellability: {
    multicall3Address: string;
    baseTokensBsc: string[];
  };
  tokenSecurity: {
    enabled: boolean;
    goPlusEnabled: boolean;
    goPlusBaseUrl: string;
    honeypotIsEnabled: boolean;
    honeypotIsBaseUrl: string;
    bscScanEnabled: boolean;
    bscScanBaseUrl: string;
    bscScanApiKey: string;
    timeoutMs: number;
    cacheTtlMs: number;
    taxStrictMaxPercent: number;
    fallbackMinLiquidityUsd: number;
  };
  dexScreener: {
    enabled: boolean;
    baseUrl: string;
    timeoutMs: number;
    cacheTtlMs: number;
    minLiquidityUsd: number;
  };
};

function splitCsv(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function loadEnv(input: NodeJS.ProcessEnv = process.env): Env {
  return EnvSchema.parse(input);
}

export function loadConfig(input: NodeJS.ProcessEnv = process.env): AppConfig {
  const env = loadEnv(input);
  return {
    nodeEnv: env.NODE_ENV,
    host: env.HOST,
    port: env.PORT,
    receiptStore: {
      type: env.RECEIPT_STORE,
      path: env.RECEIPT_STORE_PATH,
    },
    swapLogStore: {
      type: env.SWAP_LOG_STORE,
      path: env.SWAP_LOG_STORE_PATH,
    },
    redis: {
      url: env.REDIS_URL.trim().length > 0 ? env.REDIS_URL.trim() : null,
      quoteCacheTtlSeconds: env.QUOTE_CACHE_TTL_SECONDS,
    },
    rateLimit: {
      max: env.RATE_LIMIT_MAX,
      windowMs: env.RATE_LIMIT_WINDOW_MS,
    },
    metrics: {
      enabled: env.METRICS_ENABLED,
    },
    observability: {
      sentryDsn: env.SENTRY_DSN.trim().length > 0 ? env.SENTRY_DSN.trim() : null,
      sentryTestToken:
        env.SENTRY_TEST_TOKEN.trim().length > 0 ? env.SENTRY_TEST_TOKEN.trim() : null,
      adminApiToken:
        env.ADMIN_API_TOKEN.trim().length > 0 ? env.ADMIN_API_TOKEN.trim() : null,
      logtailToken: env.LOGTAIL_TOKEN.trim().length > 0 ? env.LOGTAIL_TOKEN.trim() : null,
    },
    rpc: {
      bscUrls: splitCsv(env.BSC_RPC_URLS),
      quorum: env.RPC_QUORUM,
      timeoutMs: env.RPC_TIMEOUT_MS,
      enableTrace: env.RPC_ENABLE_TRACE,
    },
    risk: {
      knownTokens: splitCsv(env.RISK_KNOWN_TOKENS),
      memeTokens: splitCsv(env.RISK_MEME_TOKENS),
    },
    pancakeswap: {
      v2Router: env.PANCAKESWAP_V2_ROUTER.trim().length > 0 ? env.PANCAKESWAP_V2_ROUTER.trim() : null,
      v3Quoter: env.PANCAKESWAP_V3_QUOTER.trim().length > 0 ? env.PANCAKESWAP_V3_QUOTER.trim() : null,
      v2Factory: env.PANCAKESWAP_V2_FACTORY.trim(),
      v3Factory: env.PANCAKESWAP_V3_FACTORY.trim(),
      wbnb: env.PANCAKESWAP_WBNB.trim(),
      quoteTimeoutMs: env.PANCAKESWAP_QUOTE_TIMEOUT_MS,
    },
    sellability: {
      multicall3Address: env.SELLABILITY_MULTICALL3_ADDRESS.trim(),
      baseTokensBsc: splitCsv(env.SELLABILITY_BASE_TOKENS_BSC),
    },
    tokenSecurity: {
      enabled:
        env.NODE_ENV === 'test'
          ? false
          : Boolean(env.TOKEN_SECURITY_GOPLUS_ENABLED || env.TOKEN_SECURITY_HONEYPOTIS_ENABLED),
      goPlusEnabled: env.NODE_ENV === 'test' ? false : env.TOKEN_SECURITY_GOPLUS_ENABLED,
      goPlusBaseUrl: env.TOKEN_SECURITY_GOPLUS_BASE_URL.trim(),
      honeypotIsEnabled: env.NODE_ENV === 'test' ? false : env.TOKEN_SECURITY_HONEYPOTIS_ENABLED,
      honeypotIsBaseUrl: env.TOKEN_SECURITY_HONEYPOTIS_BASE_URL.trim(),
      bscScanEnabled: env.NODE_ENV === 'test' ? false : env.TOKEN_SECURITY_BSCSCAN_ENABLED,
      bscScanBaseUrl: env.TOKEN_SECURITY_BSCSCAN_BASE_URL.trim(),
      bscScanApiKey: env.TOKEN_SECURITY_BSCSCAN_API_KEY.trim(),
      timeoutMs: env.TOKEN_SECURITY_TIMEOUT_MS,
      cacheTtlMs: env.TOKEN_SECURITY_CACHE_TTL_MS,
      taxStrictMaxPercent: env.TOKEN_SECURITY_TAX_STRICT_MAX_PERCENT,
      fallbackMinLiquidityUsd: env.TOKEN_SECURITY_FALLBACK_MIN_LIQUIDITY_USD,
    },
    dexScreener: {
      enabled: env.NODE_ENV === 'test' ? false : env.DEXSCREENER_ENABLED,
      baseUrl: env.DEXSCREENER_BASE_URL.trim(),
      timeoutMs: env.DEXSCREENER_TIMEOUT_MS,
      cacheTtlMs: env.DEXSCREENER_CACHE_TTL_MS,
      minLiquidityUsd: env.DEXSCREENER_MIN_LIQUIDITY_USD,
    },
  };
}
