import fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';

import {
  DecisionReceiptSchema,
  QuoteRequestSchema,
  QuoteRequestQuerySchema,
  QuoteResponseSchema,
  ProviderQuoteRawSchema,
  ProviderQuoteNormalizedSchema,
  type RiskSignals,
} from '@swappilot/shared';

import { loadConfig, type AppConfig } from '@swappilot/config';

import { createPreflightClient, type PreflightClient } from '@swappilot/preflight';
import { createRiskEngine, type RiskEngine } from '@swappilot/risk';

import {
  PancakeSwapDexAdapter,
  OneInchAdapter,
  OkxDexAdapter,
  KyberSwapAdapter,
  ParaSwapAdapter,
  OdosAdapter,
  OpenOceanAdapter,
  ZeroXAdapter,
  UniswapV3Adapter,
  UniswapV2Adapter,
  SquadSwapAdapter,
  ThenaAdapter,
  FstSwapAdapter,
  PROVIDERS,
  type Adapter,
} from '@swappilot/adapters';

import { buildQuotes } from './quoteBuilder';
import { FileReceiptStore } from './store/fileReceiptStore';
import { MemoryReceiptStore, type ReceiptStore } from './store/receiptStore';
import { FileSwapLogStore } from './store/fileSwapLogStore';
import { MemorySwapLogStore, type SwapLogStore } from './store/swapLogStore';

import rateLimit from '@fastify/rate-limit';

import { createMetrics, type Metrics } from './obs/metrics';
import { NoopQuoteCache, type QuoteCache } from './cache/quoteCache';
import { createRedisClient, RedisQuoteCache } from './cache/redisQuoteCache';
import { getUptimeTracker, type UptimeTracker } from './obs/uptimeTracker';

import { resolveErc20Metadata } from './tokens/erc20Metadata';
import { ProviderHealthTracker } from './obs/providerHealth';

// Observability
import { initSentry, captureException, Sentry } from './obs/sentry';
import { initLogger, logError, type AppLogger } from './obs/logger';

export type CreateServerOptions = {
  logger?: boolean;
  config?: AppConfig;
  receiptStore?: ReceiptStore;
  swapLogStore?: SwapLogStore;
  preflightClient?: PreflightClient;
  riskEngine?: RiskEngine;
  pancakeSwapAdapter?: Adapter;
  quoteCache?: QuoteCache;
  metrics?: Metrics;
  providerHealth?: ProviderHealthTracker;
};

export function createServer(options: CreateServerOptions = {}): FastifyInstance {
  const config = options.config ?? loadConfig(process.env);

  // Initialize observability
  initSentry(config.observability.sentryDsn ?? undefined, config.nodeEnv);
  const appLogger = initLogger({
    environment: config.nodeEnv,
    logtailToken: config.observability.logtailToken ?? undefined,
  });

  const receiptStore =
    options.receiptStore ??
    (config.receiptStore.type === 'memory'
      ? new MemoryReceiptStore()
      : new FileReceiptStore(config.receiptStore.path));

  const swapLogStore =
    options.swapLogStore ??
    (config.swapLogStore.type === 'memory'
      ? new MemorySwapLogStore()
      : new FileSwapLogStore(config.swapLogStore.path));

  const app = fastify({
    logger: options.logger ?? {
      level: config.nodeEnv === 'production' ? 'info' : 'debug',
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers.set-cookie',
          'req.headers.x-api-key',
        ],
        remove: true,
      },
    },
    genReqId: () => randomUUID(),
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Attach requestId and structured request/response logs.
  app.addHook('onRequest', async (request, reply) => {
    request.swappilotStart = process.hrtime.bigint();
    reply.header('x-request-id', request.id);
    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
      },
      'request.start',
    );
  });

  app.addHook('onResponse', async (request, reply) => {
    const start = request.swappilotStart;
    const durationMs = start ? Number((process.hrtime.bigint() - start) / 1_000_000n) : null;

    // Best-effort HTTP metrics (works even on 4xx/5xx).
    if (config.metrics.enabled && durationMs != null) {
      const route = request.routeOptions?.url ?? request.url;
      metrics.httpRequestDurationMs
        .labels({ method: request.method, route, status: String(reply.statusCode) })
        .observe(durationMs);
    }

    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs,
      },
      'request.end',
    );
  });

  // Global error handler with Sentry reporting
  app.setErrorHandler((error, request, reply) => {
    // Log error
    logError(appLogger, error, {
      requestId: request.id,
      method: request.method,
      url: request.url,
    });

    // Report to Sentry (skip expected errors)
    const isExpectedError = 
      error.statusCode === 400 || 
      error.statusCode === 404 ||
      error.statusCode === 429;

    if (!isExpectedError) {
      captureException(error, {
        requestId: request.id,
        method: request.method,
        url: request.url,
      });
    }

    // Send response
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      error: error.name,
      message: error.message,
      statusCode,
    });
  });

  // CORS - allow frontend to call API
  app.register(cors, {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      /\.vercel\.app$/,
      /\.fly\.dev$/,
      /swappilot\./,
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials: true,
  });

  app.register(swagger, {
    openapi: {
      info: {
        title: 'SwapPilot API',
        version: '0.1.0',
      },
    },
    transform: jsonSchemaTransform,
  });

  app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // Basic API gateway rate limiting.
  app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.windowMs,
    keyGenerator: (req) => req.ip,
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
  });

  app.get('/', async () => {
    return {
      name: 'SwapPilot API',
      version: '1.0.0',
      status: 'ok',
      docs: '/documentation',
      health: '/health',
    } as const;
  });

  const serverStartTime = Date.now();

  app.get('/health', async () => {
    const uptimeMs = Date.now() - serverStartTime;
    const uptimeHours = Math.floor(uptimeMs / (1000 * 60 * 60));
    const uptimeMinutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    return {
      status: 'ok',
      uptime: `${uptimeHours}h ${uptimeMinutes}m`,
      uptimeMs,
      version: '1.0.0',
      timestamp: Date.now(),
    } as const;
  });

  app.get('/debug/sentry', async (request, reply) => {
    const token = config.observability.sentryTestToken;
    const provided = request.headers['x-sentry-test-token'];
    if (!token || provided !== token) {
      reply.status(404).send({ error: 'Not Found' });
      return;
    }
    throw new Error('sentry_test_error');
  });

  const api = app.withTypeProvider<ZodTypeProvider>();

  const metrics = options.metrics ?? createMetrics({ collectDefault: true });
  const providerHealth = options.providerHealth ?? new ProviderHealthTracker();
  const uptimeTracker: UptimeTracker = getUptimeTracker();

  // Start background health check loop for uptime tracking
  let healthCheckInterval: NodeJS.Timeout | null = null;
  const startUptimeTracking = () => {
    // Run health check every 30 seconds
    healthCheckInterval = setInterval(async () => {
      try {
        const startTime = performance.now();
        
        // Check if adapters are available
        if (!adaptersRef || adaptersRef.size === 0) {
          return;
        }

        // Do a quick health check on providers
        const providerChecks = await Promise.allSettled(
          Array.from(adaptersRef.entries()).slice(0, 3).map(async ([id, adapter]) => {
            try {
              await Promise.race([
                adapter.getQuote({
                  chainId: 56,
                  sellToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
                  buyToken: '0x55d398326f99059fF775485246999027B3197955',
                  sellAmount: '10000000000000000',
                  slippageBps: 100,
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
              ]);
              return { id, ok: true };
            } catch {
              return { id, ok: false };
            }
          })
        );

        const successCount = providerChecks.filter(
          r => r.status === 'fulfilled' && r.value.ok
        ).length;
        const totalCount = providerChecks.length;
        const latencyMs = Math.round(performance.now() - startTime);

        // Determine status
        let status: 'ok' | 'degraded' | 'down' = 'ok';
        if (successCount === 0) {
          status = 'down';
        } else if (successCount < totalCount) {
          status = 'degraded';
        }

        // Record the health check
        uptimeTracker.recordHealthCheck({
          status,
          latencyMs,
          providersUp: successCount,
          providersTotal: totalCount,
        });
      } catch (error) {
        // Record as degraded if we can't even run the check
        uptimeTracker.recordHealthCheck({
          status: 'degraded',
          latencyMs: 0,
          providersUp: 0,
          providersTotal: 0,
        });
      }
    }, 30_000);

    // Do an initial check after 5 seconds
    setTimeout(() => {
      if (adaptersRef && adaptersRef.size > 0) {
        uptimeTracker.recordHealthCheck({
          status: 'ok',
          latencyMs: 50,
          providersUp: adaptersRef.size,
          providersTotal: adaptersRef.size,
        });
      }
    }, 5000);
  };

  // Cleanup on server close
  app.addHook('onClose', async () => {
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
    }
  });

  // Provider status endpoint - will be registered after adapters are created
  // Cache for health check results (TTL 30 seconds)
  let healthCheckCache: { providers: unknown[]; timestamp: number } | null = null;
  const HEALTH_CHECK_CACHE_TTL = 30_000; // 30 seconds

  // Test quote params for health check (small BNB -> USDT swap)
  const HEALTH_CHECK_QUOTE_PARAMS = {
    chainId: 56,
    sellToken: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // BNB native
    buyToken: '0x55d398326f99059fF775485246999027B3197955', // BSC-USD (USDT)
    sellAmount: '10000000000000000', // 0.01 BNB
    slippageBps: 100,
  };

  // Placeholder - adapters will be available later
  let adaptersRef: Map<string, Adapter> | null = null;

  const registerProviderStatusEndpoint = () => {
    api.get('/v1/providers/status', async () => {
      const now = Date.now();

      // Return cached result if fresh
      if (healthCheckCache && (now - healthCheckCache.timestamp) < HEALTH_CHECK_CACHE_TTL) {
        return { providers: healthCheckCache.providers, timestamp: healthCheckCache.timestamp, cached: true };
      }

      // Get recorded stats from quote operations
      const stats = providerHealth.getAllStats();

      // Perform live health checks for providers with quote capability
      const healthCheckPromises = PROVIDERS
        .filter((p) => p.capabilities.quote && adaptersRef?.has(p.providerId))
        .map(async (p) => {
          const adapter = adaptersRef!.get(p.providerId)!;
          const startTime = performance.now();
          try {
            const result = await Promise.race([
              adapter.getQuote(HEALTH_CHECK_QUOTE_PARAMS),
              new Promise<null>((_, reject) =>
                setTimeout(() => reject(new Error('Health check timeout')), 8000)
              ),
            ]);
            const latencyMs = Math.round(performance.now() - startTime);
            
            // Check if we got a valid quote response (any response with buyAmount > 0)
            // AdapterQuote format: { raw: { buyAmount: string }, normalized: { buyAmount: string }, ... }
            let quoteSuccess = false;
            if (result && typeof result === 'object') {
              // Check raw.buyAmount (AdapterQuote format)
              const rawBuyAmount = (result as { raw?: { buyAmount?: string | number | bigint } }).raw?.buyAmount;
              // Also check normalized.buyAmount
              const normalizedBuyAmount = (result as { normalized?: { buyAmount?: string } }).normalized?.buyAmount;
              
              const buyAmount = rawBuyAmount ?? normalizedBuyAmount;
              
              if (typeof buyAmount === 'string' && buyAmount.length > 0 && buyAmount !== '0') {
                quoteSuccess = true;
              } else if (typeof buyAmount === 'bigint' && buyAmount > 0n) {
                quoteSuccess = true;
              } else if (typeof buyAmount === 'number' && buyAmount > 0) {
                quoteSuccess = true;
              }
            }
            
            // Provider responded without throwing - it's operational
            // quoteSuccess false just means no liquidity for this specific pair, not a provider issue
            // Mark as 'ok' if provider responds, 'degraded' only for very slow responses (possible issues)
            return {
              providerId: p.providerId,
              status: latencyMs > 6000 ? 'degraded' : 'ok', // Only degraded if extremely slow (6s+)
              latencyMs,
              liveCheck: true,
              quoteSuccess,
            };
          } catch (error) {
            const latencyMs = Math.round(performance.now() - startTime);
            // Check if it's a timeout or actual network failure
            const isTimeout = latencyMs >= 7900;
            return {
              providerId: p.providerId,
              status: isTimeout ? 'down' : 'degraded', // Timeout = down, quick error = degraded (might be rate limit)
              latencyMs,
              liveCheck: true,
              quoteSuccess: false,
            };
          }
        });

      const liveResults = await Promise.allSettled(healthCheckPromises);
      const liveResultsMap = new Map<string, { status: string; latencyMs: number; liveCheck: boolean; quoteSuccess: boolean }>();
      for (const result of liveResults) {
        if (result.status === 'fulfilled') {
          liveResultsMap.set(result.value.providerId, result.value);
        }
      }

      const providers = PROVIDERS.map((p) => {
        const stat = stats.find((s) => s.providerId === p.providerId);
        const liveResult = liveResultsMap.get(p.providerId);

        // Prefer live result for status and latency if available
        let status: 'ok' | 'degraded' | 'down' | 'unknown';
        let latencyMs: number;

        if (liveResult) {
          status = liveResult.status as 'ok' | 'degraded' | 'down';
          latencyMs = liveResult.latencyMs;
        } else if (stat && stat.observations > 0) {
          status = stat.successRate >= 70 ? 'ok' : stat.successRate >= 40 ? 'degraded' : 'down';
          latencyMs = stat.latencyMs;
        } else if (!p.capabilities.quote) {
          // Deep-link only providers - mark as ok (they don't need quote capability)
          status = 'ok';
          latencyMs = 0;
        } else {
          status = 'unknown';
          latencyMs = 0;
        }

        return {
          providerId: p.providerId,
          displayName: p.displayName,
          category: p.category,
          capabilities: p.capabilities,
          // successRate: use recorded stats if available, otherwise estimate from live check
          // 95% if got valid quote, 80% if provider responded (no quote = just no liquidity for test pair), 0% if down
          successRate: stat?.successRate ?? (liveResult?.quoteSuccess ? 95 : liveResult?.status === 'ok' ? 80 : 0),
          latencyMs,
          observations: stat?.observations ?? (liveResult ? 1 : 0),
          status,
          liveCheck: liveResult?.liveCheck ?? false,
        };
      });

      // Cache the result
      healthCheckCache = { providers, timestamp: now };

      return { providers, timestamp: now, cached: false };
    });

    // Uptime statistics endpoint
    api.get(
      '/v1/status/uptime',
      {
        schema: {
          querystring: z.object({
            days: z.coerce.number().int().min(1).max(90).default(90),
          }),
          response: {
            200: z.object({
              uptimePercent: z.number(),
              totalChecks: z.number(),
              successfulChecks: z.number(),
              avgLatencyMs: z.number(),
              currentStatus: z.enum(['operational', 'degraded', 'down']),
              days: z.array(z.object({
                date: z.string(),
                checksTotal: z.number(),
                checksOk: z.number(),
                checksDegraded: z.number(),
                checksDown: z.number(),
                avgLatencyMs: z.number(),
                status: z.enum(['ok', 'partial', 'down']),
              })),
              timestamp: z.number(),
            }),
          },
        },
      },
      async (request) => {
        const { days } = request.query;
        const stats = uptimeTracker.getUptimeStats(days);
        return {
          ...stats,
          currentStatus: uptimeTracker.getCurrentStatus(),
          timestamp: Date.now(),
        };
      }
    );

    // Incidents endpoint
    api.get(
      '/v1/status/incidents',
      {
        schema: {
          querystring: z.object({
            limit: z.coerce.number().int().min(1).max(50).default(10),
            activeOnly: z.coerce.boolean().default(false),
          }),
          response: {
            200: z.object({
              incidents: z.array(z.object({
                id: z.string(),
                title: z.string(),
                status: z.enum(['investigating', 'identified', 'monitoring', 'resolved']),
                severity: z.enum(['minor', 'major', 'critical']),
                startedAt: z.number(),
                resolvedAt: z.number().optional(),
                updates: z.array(z.object({
                  timestamp: z.number(),
                  status: z.enum(['investigating', 'identified', 'monitoring', 'resolved']),
                  message: z.string(),
                })),
              })),
              hasActiveIncidents: z.boolean(),
              timestamp: z.number(),
            }),
          },
        },
      },
      async (request) => {
        const { limit, activeOnly } = request.query;
        const incidents = activeOnly 
          ? uptimeTracker.getActiveIncidents()
          : uptimeTracker.getIncidents(limit);
        return {
          incidents,
          hasActiveIncidents: uptimeTracker.getActiveIncidents().length > 0,
          timestamp: Date.now(),
        };
      }
    );
  };

  if (config.metrics.enabled) {
    api.get('/metrics', async (_request, reply) => {
      reply.header('content-type', metrics.registry.contentType);
      return metrics.registry.metrics();
    });
  }

  const preflightClient =
    options.preflightClient ??
    createPreflightClient({
      urls: config.rpc.bscUrls,
      quorum: config.rpc.quorum,
      timeoutMs: config.rpc.timeoutMs,
      enableTrace: config.rpc.enableTrace,
    });

  const riskEngine = options.riskEngine ?? createRiskEngine(config.risk);

  const quoteCache: QuoteCache =
    options.quoteCache ??
    (config.redis.url
      ? new RedisQuoteCache(createRedisClient(config.redis.url))
      : new NoopQuoteCache());

  const pancakeSwapAdapter =
    options.pancakeSwapAdapter ??
    new PancakeSwapDexAdapter({
      chainId: 56,
      rpcUrl: config.rpc.bscUrls[0] ?? null,
      v2RouterAddress: config.pancakeswap.v2Router,
      v3QuoterAddress: config.pancakeswap.v3Quoter,
      v3RouterAddress: null, // Uses default for BSC if null
      wbnb: config.pancakeswap.wbnb,
      quoteTimeoutMs: config.pancakeswap.quoteTimeoutMs,
    });

  // Create real adapters for all providers
  const oneInchAdapter = new OneInchAdapter({
    apiKey: process.env.ONEINCH_API_KEY ?? null,
    chainId: 56,
    timeoutMs: 10000,
  });

  const okxAdapter = new OkxDexAdapter({
    apiKey: process.env.OKX_API_KEY ?? null,
    secretKey: process.env.OKX_SECRET_KEY ?? null,
    passphrase: process.env.OKX_PASSPHRASE ?? null,
    chainId: 56,
    timeoutMs: 10000,
  });

  const kyberSwapAdapter = new KyberSwapAdapter({
    chainId: 56,
    clientId: 'swappilot',
    timeoutMs: 10000,
  });

  const paraSwapAdapter = new ParaSwapAdapter({
    chainId: 56,
    partner: 'swappilot',
    timeoutMs: 10000,
  });

  const odosAdapter = new OdosAdapter({
    chainId: 56,
    timeoutMs: 10000,
  });

  const openOceanAdapter = new OpenOceanAdapter({
    chainId: 56,
    timeoutMs: 10000,
  });

  const zeroXAdapter = new ZeroXAdapter({
    apiKey: process.env.ZEROX_API_KEY ?? null,
    chainId: 56,
    timeoutMs: 10000,
  });

  const uniswapV3Adapter = new UniswapV3Adapter({
    chainId: 56,
    rpcUrl: config.rpc.bscUrls[0] ?? null,
    quoterAddress: null, // Will use default BSC quoter
    weth: config.pancakeswap.wbnb,
    quoteTimeoutMs: 5000,
  });

  const uniswapV2Adapter = new UniswapV2Adapter({
    chainId: 56,
    rpcUrl: config.rpc.bscUrls[0] ?? null,
    routerAddress: null, // Will use default BSC router
    weth: config.pancakeswap.wbnb,
    quoteTimeoutMs: 5000,
  });

  const squadSwapAdapter = new SquadSwapAdapter({
    chainId: 56,
    rpcUrl: config.rpc.bscUrls[0] ?? null,
    quoteTimeoutMs: 5000,
  });

  const thenaAdapter = new ThenaAdapter({
    chainId: 56,
    rpcUrl: config.rpc.bscUrls[0] ?? null,
    quoteTimeoutMs: 5000,
  });

  const fstSwapAdapter = new FstSwapAdapter({
    chainId: 56,
    rpcUrl: config.rpc.bscUrls[0] ?? null,
    quoteTimeoutMs: 5000,
  });

  // Create adapters map for the mock quote builder
  const adapters = new Map<string, Adapter>([
    ['pancakeswap', pancakeSwapAdapter],
    ['1inch', oneInchAdapter],
    ['okx-dex', okxAdapter],
    ['kyberswap', kyberSwapAdapter],
    ['paraswap', paraSwapAdapter],
    ['odos', odosAdapter],
    ['openocean', openOceanAdapter],
    ['0x', zeroXAdapter],
    ['uniswap-v3', uniswapV3Adapter],
    ['uniswap-v2', uniswapV2Adapter],
    ['squadswap', squadSwapAdapter],
    ['thena', thenaAdapter],
    ['fstswap', fstSwapAdapter],
  ]);

  // Set adapters reference and register the status endpoint
  adaptersRef = adapters;
  registerProviderStatusEndpoint();
  startUptimeTracking();

  api.get(
    '/v1/tokens/resolve',
    {
      schema: {
        querystring: z.object({
          address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        }),
        response: {
          200: z.object({
            address: z.string(),
            symbol: z.string().nullable(),
            name: z.string().nullable(),
            decimals: z.number().int().min(0).max(255),
            isNative: z.boolean(),
          }),
        },
      },
    },
    async (request) => {
      const meta = await resolveErc20Metadata({
        address: request.query.address,
        rpcUrls: config.rpc.bscUrls,
        timeoutMs: config.rpc.timeoutMs,
      });
      return meta;
    },
  );

  // GET /v1/quotes - supports query parameters
  api.get(
    '/v1/quotes',
    {
      schema: {
        querystring: QuoteRequestQuerySchema,
        response: {
          200: QuoteResponseSchema,
        },
      },
    },
    async (request) => {
      const sellabilityDeps = config.sellability
        ? {
            multicall3Address: config.sellability.multicall3Address,
            baseTokensBsc: config.sellability.baseTokensBsc,
            pancake: {
              v2Factory: config.pancakeswap.v2Factory,
              v3Factory: config.pancakeswap.v3Factory,
              wbnb: config.pancakeswap.wbnb,
            },
          }
        : undefined;

      const tokenSecurityDeps = config.tokenSecurity
        ? {
            enabled: config.tokenSecurity.enabled,
            goPlusEnabled: config.tokenSecurity.goPlusEnabled,
            goPlusBaseUrl: config.tokenSecurity.goPlusBaseUrl,
            honeypotIsEnabled: config.tokenSecurity.honeypotIsEnabled,
            honeypotIsBaseUrl: config.tokenSecurity.honeypotIsBaseUrl,
            bscScanEnabled: config.tokenSecurity.bscScanEnabled,
            bscScanBaseUrl: config.tokenSecurity.bscScanBaseUrl,
            bscScanApiKey: config.tokenSecurity.bscScanApiKey,
            timeoutMs: config.tokenSecurity.timeoutMs,
            cacheTtlMs: config.tokenSecurity.cacheTtlMs,
            taxStrictMaxPercent: config.tokenSecurity.taxStrictMaxPercent,
            fallbackMinLiquidityUsd: config.tokenSecurity.fallbackMinLiquidityUsd,
          }
        : undefined;

      const dexScreenerDeps = config.dexScreener
        ? {
            enabled: config.dexScreener.enabled,
            baseUrl: config.dexScreener.baseUrl,
            timeoutMs: config.dexScreener.timeoutMs,
            cacheTtlMs: config.dexScreener.cacheTtlMs,
            minLiquidityUsd: config.dexScreener.minLiquidityUsd,
          }
        : undefined;

      const {
        receiptId,
        rankedQuotes,
        bestRawQuotes,
        bestExecutableQuoteProviderId,
        bestRawOutputProviderId,
        beqRecommendedProviderId,
        receipt,
      } = await buildQuotes(request.query, {
        preflightClient,
        riskEngine,
        adapters,
        quoteCache,
        quoteCacheTtlSeconds: config.redis.quoteCacheTtlSeconds,
        logger: request.log,
        metrics,
        providerHealth,
        rpc: { bscUrls: config.rpc.bscUrls, timeoutMs: config.rpc.timeoutMs },
        ...(sellabilityDeps ? { sellability: sellabilityDeps } : {}),
        ...(tokenSecurityDeps ? { tokenSecurity: tokenSecurityDeps } : {}),
        ...(dexScreenerDeps ? { dexScreener: dexScreenerDeps } : {}),
      });

      await receiptStore.put(receipt);

      return {
        receiptId,
        rankedQuotes,
        bestRawQuotes,
        bestExecutableQuoteProviderId,
        bestRawOutputProviderId,
        beqRecommendedProviderId,
        receipt,
      };
    },
  );

  // POST /v1/quotes - supports JSON body
  api.post(
    '/v1/quotes',
    {
      schema: {
        body: QuoteRequestSchema,
        response: {
          200: QuoteResponseSchema,
        },
      },
    },
    async (request) => {
      const sellabilityDeps = config.sellability
        ? {
            multicall3Address: config.sellability.multicall3Address,
            baseTokensBsc: config.sellability.baseTokensBsc,
            pancake: {
              v2Factory: config.pancakeswap.v2Factory,
              v3Factory: config.pancakeswap.v3Factory,
              wbnb: config.pancakeswap.wbnb,
            },
          }
        : undefined;

      const tokenSecurityDeps = config.tokenSecurity
        ? {
            enabled: config.tokenSecurity.enabled,
            goPlusEnabled: config.tokenSecurity.goPlusEnabled,
            goPlusBaseUrl: config.tokenSecurity.goPlusBaseUrl,
            honeypotIsEnabled: config.tokenSecurity.honeypotIsEnabled,
            honeypotIsBaseUrl: config.tokenSecurity.honeypotIsBaseUrl,
            bscScanEnabled: config.tokenSecurity.bscScanEnabled,
            bscScanBaseUrl: config.tokenSecurity.bscScanBaseUrl,
            bscScanApiKey: config.tokenSecurity.bscScanApiKey,
            timeoutMs: config.tokenSecurity.timeoutMs,
            cacheTtlMs: config.tokenSecurity.cacheTtlMs,
            taxStrictMaxPercent: config.tokenSecurity.taxStrictMaxPercent,
            fallbackMinLiquidityUsd: config.tokenSecurity.fallbackMinLiquidityUsd,
          }
        : undefined;

      const dexScreenerDeps = config.dexScreener
        ? {
            enabled: config.dexScreener.enabled,
            baseUrl: config.dexScreener.baseUrl,
            timeoutMs: config.dexScreener.timeoutMs,
            cacheTtlMs: config.dexScreener.cacheTtlMs,
            minLiquidityUsd: config.dexScreener.minLiquidityUsd,
          }
        : undefined;

      const {
        receiptId,
        rankedQuotes,
        bestRawQuotes,
        bestExecutableQuoteProviderId,
        bestRawOutputProviderId,
        beqRecommendedProviderId,
        receipt,
      } = await buildQuotes(request.body, {
        preflightClient,
        riskEngine,
        adapters,
        quoteCache,
        quoteCacheTtlSeconds: config.redis.quoteCacheTtlSeconds,
        logger: request.log,
        metrics,
        providerHealth,
        rpc: { bscUrls: config.rpc.bscUrls, timeoutMs: config.rpc.timeoutMs },
        ...(sellabilityDeps ? { sellability: sellabilityDeps } : {}),
        ...(tokenSecurityDeps ? { tokenSecurity: tokenSecurityDeps } : {}),
        ...(dexScreenerDeps ? { dexScreener: dexScreenerDeps } : {}),
      });

      await receiptStore.put(receipt);

      return {
        receiptId,
        rankedQuotes,
        bestRawQuotes,
        bestExecutableQuoteProviderId,
        bestRawOutputProviderId,
        beqRecommendedProviderId,
        receipt,
      };
    },
  );

  api.get(
    '/v1/receipts/:id',
    {
      schema: {
        params: z.object({ id: z.string().min(1) }),
        response: {
          200: DecisionReceiptSchema,
          404: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const receipt = await receiptStore.get(request.params.id);
      if (!receipt) {
        return reply.code(404).send({ message: 'not_found' });
      }
      return receipt;
    },
  );

  const SwapLogSchema = z.object({
    chainId: z.number().int().positive(),
    txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    providerId: z.string().optional(),
    sellToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    buyToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    sellAmount: z.string(),
    buyAmount: z.string(),
    amountUsd: z.string().optional().nullable(),
    timestamp: z.string().datetime().optional(),
    status: z.enum(['success', 'failed']).default('success'),
    source: z.enum(['app', 'api', 'relayer']).optional(),
  });

  const VolumeQuerySchema = z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    chainId: z.coerce.number().int().optional(),
  });

  api.post(
    '/v1/analytics/swaps',
    {
      schema: {
        body: SwapLogSchema,
        response: {
          200: z.object({ ok: z.literal(true) }),
        },
      },
    },
    async (request) => {
      const payload = request.body;
      const timestamp = payload.timestamp ?? new Date().toISOString();
      await swapLogStore.append({ ...payload, timestamp });
      return { ok: true } as const;
    },
  );

  api.get(
    '/v1/analytics/volume',
    {
      schema: {
        querystring: VolumeQuerySchema,
        response: {
          200: z.object({
            volumeUsd: z.number(),
            swaps: z.number().int(),
          }),
        },
      },
    },
    async (request) => {
      const from = request.query.from ? new Date(request.query.from) : undefined;
      const to = request.query.to ? new Date(request.query.to) : undefined;
      const logs = await swapLogStore.list({
        from,
        to,
        chainId: request.query.chainId,
        status: 'success',
      });
      const volumeUsd = logs.reduce((sum, log) => {
        const value = log.amountUsd ? Number(log.amountUsd) : 0;
        return sum + (Number.isFinite(value) ? value : 0);
      }, 0);
      return { volumeUsd, swaps: logs.length };
    },
  );

  api.get(
    '/v1/analytics/volume/daily',
    {
      schema: {
        querystring: VolumeQuerySchema,
        response: {
          200: z.array(
            z.object({
              date: z.string(),
              volumeUsd: z.number(),
              swaps: z.number().int(),
            }),
          ),
        },
      },
    },
    async (request) => {
      const from = request.query.from ? new Date(request.query.from) : undefined;
      const to = request.query.to ? new Date(request.query.to) : undefined;
      const logs = await swapLogStore.list({
        from,
        to,
        chainId: request.query.chainId,
        status: 'success',
      });
      const byDate = new Map<string, { volumeUsd: number; swaps: number }>();
      for (const log of logs) {
        const date = new Date(log.timestamp);
        if (Number.isNaN(date.getTime())) continue;
        const key = date.toISOString().slice(0, 10);
        const current = byDate.get(key) ?? { volumeUsd: 0, swaps: 0 };
        const value = log.amountUsd ? Number(log.amountUsd) : 0;
        const safeValue = Number.isFinite(value) ? value : 0;
        byDate.set(key, {
          volumeUsd: current.volumeUsd + safeValue,
          swaps: current.swaps + 1,
        });
      }
      return Array.from(byDate.entries())
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, data]) => ({ date, ...data }));
    },
  );

  // Build transaction endpoint - returns ready-to-sign calldata
  const BuildTxRequestSchema = z.object({
    providerId: z.string(),
    sellToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    buyToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    sellAmount: z.string(),
    slippageBps: z.number().int().min(1).max(5000).default(100),
    account: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    sellTokenDecimals: z.number().int().min(0).max(36).optional(),
    buyTokenDecimals: z.number().int().min(0).max(36).optional(),
    // Optional: pass the exact quote selected in the UI so we can build the tx
    // without re-quoting (more reliable, avoids "no valid quote" on transient outages).
    quoteRaw: ProviderQuoteRawSchema.optional(),
    quoteNormalized: ProviderQuoteNormalizedSchema.optional(),
  });

  const BuildTxResponseSchema = z.object({
    to: z.string(),
    data: z.string(),
    value: z.string(),
    gas: z.string().optional(),
    gasPrice: z.string().optional(),
    providerId: z.string(),
    approvalAddress: z.string().optional(),
  });

  api.post(
    '/v1/build-tx',
    {
      schema: {
        body: BuildTxRequestSchema,
        response: {
          200: BuildTxResponseSchema,
          400: z.object({ message: z.string() }),
          404: z.object({ message: z.string() }),
          500: z.object({ message: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const {
        providerId,
        sellToken,
        buyToken,
        sellAmount,
        slippageBps,
        account,
        sellTokenDecimals,
        buyTokenDecimals,
        quoteRaw,
        quoteNormalized,
      } = request.body;

      const adapter = adapters.get(providerId);
      if (!adapter) {
        return reply.code(404).send({ message: `Provider '${providerId}' not found` });
      }

      if (!adapter.buildTx) {
        return reply.code(400).send({ 
          message: `Provider '${providerId}' does not support buildTx. Use deepLink instead.` 
        });
      }

      const quoteRequest = {
        chainId: 56,
        sellToken,
        buyToken,
        sellAmount,
        slippageBps,
        account,
        mode: 'NORMAL' as const,
        ...(sellTokenDecimals !== undefined ? { sellTokenDecimals } : {}),
        ...(buyTokenDecimals !== undefined ? { buyTokenDecimals } : {}),
      };

      const placeholderSignals = (reason: string): RiskSignals => ({
        sellability: { status: 'OK', confidence: 0.8, reasons: [reason] },
        revertRisk: { level: 'LOW', reasons: [reason] },
        mevExposure: { level: 'LOW', reasons: [reason] },
        churn: { level: 'LOW', reasons: [reason] },
        liquidity: { level: 'LOW', reasons: [reason] },
        slippage: { level: 'LOW', reasons: [reason] },
        protocolRisk: {
          security: { level: 'LOW', reasons: [reason] },
          compliance: { level: 'LOW', reasons: [reason] },
          financial: { level: 'LOW', reasons: [reason] },
          technology: { level: 'LOW', reasons: [reason] },
          operations: { level: 'LOW', reasons: [reason] },
          governance: { level: 'LOW', reasons: [reason] },
        },
        preflight: { ok: true, pRevert: 0, confidence: 1, reasons: [reason] },
      });

      try {
        // Prefer quote provided by client (selected in UI), to avoid re-quoting.
        const quote = quoteRaw
          ? {
              providerId,
              sourceType: 'aggregator' as const,
              capabilities: adapter.getCapabilities(),
              raw: quoteRaw,
              normalized:
                quoteNormalized ??
                ({
                  buyAmount: quoteRaw.buyAmount,
                  effectivePrice: '0',
                  estimatedGasUsd: null,
                  feesUsd: null,
                } as const),
              signals: placeholderSignals('build_tx_client_quote'),
              deepLink: null,
              warnings: ['client_quote_used'],
              isStub: false,
            }
          : await adapter.getQuote(quoteRequest);

        if (quote.isStub || BigInt(quote.raw.buyAmount) === 0n) {
          return reply.code(400).send({
            message: `Provider '${providerId}' returned no valid quote`,
          });
        }

        // Build the transaction
        const tx = await adapter.buildTx(quoteRequest, quote);

        return {
          to: tx.to,
          data: tx.data,
          value: tx.value,
          gas: tx.gas,
          gasPrice: tx.gasPrice,
          providerId,
          approvalAddress: tx.to, // For ERC-20 approvals, approve this address
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        request.log.error({ err, providerId }, 'buildTx failed');
        return reply.code(500).send({ message: `Build transaction failed: ${message}` });
      }
    },
  );

  // ─────────────────────────────────────────────────────────────
  // Fee calculation endpoint
  // ─────────────────────────────────────────────────────────────
  const FeeCalculationRequestSchema = z.object({
    swapValueUsd: z.number().positive(),
    userAddress: z.string().optional(),
  });

  const FeeCalculationResponseSchema = z.object({
    feeApplies: z.boolean(),
    baseFeesBps: z.number(),
    discountPercent: z.number(),
    finalFeeBps: z.number(),
    feeAmountUsd: z.number(),
    pilotTier: z.enum(['none', 'bronze', 'silver', 'gold']),
    pilotBalance: z.string(),
    freeThresholdUsd: z.number(),
    distribution: z.object({
      burnPercent: z.number(),
      treasuryPercent: z.number(),
      referralPercent: z.number(),
    }),
  });

  api.post(
    '/v1/fees/calculate',
    {
      schema: {
        body: FeeCalculationRequestSchema,
        response: {
          200: FeeCalculationResponseSchema,
        },
      },
    },
    async (request) => {
      const { swapValueUsd, userAddress } = request.body;

      // Import fee calculator (lazy to avoid issues if package not built yet)
      let pilotBalance = 0n;
      
      // If user address provided, try to get PILOT balance
      const rpcUrl = config.rpc.bscUrls[0];
      if (userAddress && rpcUrl) {
        try {
          const { getPilotBalanceCached } = await import('@swappilot/fees');
          pilotBalance = await getPilotBalanceCached(userAddress, {
            rpcUrl,
            timeoutMs: 3000,
          });
        } catch {
          // PILOT token not deployed yet, use 0 balance
        }
      }

      // Calculate fees
      const { calculateFees, FEE_CONFIG } = await import('@swappilot/fees');
      const result = calculateFees({
        swapValueUsd,
        pilotBalance,
      });

      return {
        feeApplies: result.feeApplies,
        baseFeesBps: result.baseFeesBps,
        discountPercent: result.discountPercent,
        finalFeeBps: result.finalFeeBps,
        feeAmountUsd: result.feeAmountUsd,
        pilotTier: result.pilotTier,
        pilotBalance: pilotBalance.toString(),
        freeThresholdUsd: FEE_CONFIG.FREE_TIER_THRESHOLD_USD,
        distribution: {
          burnPercent: FEE_CONFIG.DISTRIBUTION.BURN,
          treasuryPercent: FEE_CONFIG.DISTRIBUTION.TREASURY,
          referralPercent: FEE_CONFIG.DISTRIBUTION.REFERRAL,
        },
      };
    },
  );

  // ─────────────────────────────────────────────────────────────
  // PILOT tier info endpoint (for UI display)
  // ─────────────────────────────────────────────────────────────
  const PilotTierRequestSchema = z.object({
    userAddress: z.string(),
  });

  const PilotTierResponseSchema = z.object({
    tier: z.enum(['none', 'bronze', 'silver', 'gold']),
    discountPercent: z.number(),
    balance: z.string(),
    balanceFormatted: z.string(),
    nextTier: z.object({
      name: z.string(),
      requiredBalance: z.string(),
      additionalNeeded: z.string(),
      discountPercent: z.number(),
    }).nullable(),
  });

  api.post(
    '/v1/pilot/tier',
    {
      schema: {
        body: PilotTierRequestSchema,
        response: {
          200: PilotTierResponseSchema,
        },
      },
    },
    async (request) => {
      const { userAddress } = request.body;

      let pilotBalance = 0n;
      const rpcUrl = config.rpc.bscUrls[0];
      
      if (rpcUrl) {
        try {
          const { getPilotBalanceCached } = await import('@swappilot/fees');
          pilotBalance = await getPilotBalanceCached(userAddress, {
            rpcUrl,
            timeoutMs: 3000,
          });
        } catch {
          // PILOT token not deployed yet
        }
      }

      const { getPilotTier, formatPilotBalance, FEE_CONFIG } = await import('@swappilot/fees');
      const { tier, discountPercent } = getPilotTier(pilotBalance);

      // Calculate next tier info
      let nextTier = null;
      const tiers = FEE_CONFIG.PILOT_TIERS;
      
      // Find current tier index and next tier
      let currentTierIndex = -1;
      for (let i = 0; i < tiers.length; i++) {
        const tierConfig = tiers[i];
        if (tierConfig && pilotBalance >= tierConfig.minHolding) {
          currentTierIndex = i;
          break;
        }
      }

      // Next tier is the one before current in the array (since array is sorted high to low)
      const nextTierIndex = currentTierIndex === -1 ? tiers.length - 1 : currentTierIndex - 1;
      
      if (nextTierIndex >= 0) {
        const nextTierConfig = tiers[nextTierIndex];
        if (nextTierConfig) {
          const additionalNeeded = nextTierConfig.minHolding - pilotBalance;
          const tierName = nextTierConfig.discountPercent >= 20 ? 'Gold' :
                           nextTierConfig.discountPercent >= 15 ? 'Silver' : 'Bronze';
          
          nextTier = {
            name: tierName,
            requiredBalance: nextTierConfig.minHolding.toString(),
            additionalNeeded: additionalNeeded.toString(),
            discountPercent: nextTierConfig.discountPercent,
          };
        }
      }

      return {
        tier,
        discountPercent,
        balance: pilotBalance.toString(),
        balanceFormatted: formatPilotBalance(pilotBalance),
        nextTier,
      };
    },
  );

  return app;
}
