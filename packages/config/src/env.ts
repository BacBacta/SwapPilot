import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3001),

  API_PORT: z.coerce.number().int().positive().default(3001),
  WEB_PORT: z.coerce.number().int().positive().default(3000),

  RECEIPT_STORE: z.enum(['memory', 'file']).default('file'),
  RECEIPT_STORE_PATH: z.string().default('./.data/receipts'),

  // Redis / caching
  REDIS_URL: z.string().default(''),
  QUOTE_CACHE_TTL_SECONDS: z.coerce.number().int().min(1).max(300).default(10),

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
  RISK_KNOWN_TOKENS: z.string().default(''),
  RISK_MEME_TOKENS: z.string().default(''),

  // PancakeSwap (DEX) quoting
  // Leave empty to keep PancakeSwap deep-link only.
  PANCAKESWAP_V2_ROUTER: z.string().default('0x10ED43C718714eb63d5aA57B78B54704E256024E'),
  PANCAKESWAP_V3_QUOTER: z.string().default(''),
  // Wrapped native token used for BNB (BSC mainnet WBNB by default).
  // Override if you run against a different chain/RPC.
  PANCAKESWAP_WBNB: z.string().default('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'),
  PANCAKESWAP_QUOTE_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(2_000),
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
    wbnb: string;
    quoteTimeoutMs: number;
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
      wbnb: env.PANCAKESWAP_WBNB.trim(),
      quoteTimeoutMs: env.PANCAKESWAP_QUOTE_TIMEOUT_MS,
    },
  };
}
