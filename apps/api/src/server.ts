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
  PROVIDERS,
  type Adapter,
} from '@swappilot/adapters';

import { buildQuotes } from './quoteBuilder';
import { FileReceiptStore } from './store/fileReceiptStore';
import { MemoryReceiptStore, type ReceiptStore } from './store/receiptStore';

import rateLimit from '@fastify/rate-limit';

import { createMetrics, type Metrics } from './obs/metrics';
import { NoopQuoteCache, type QuoteCache } from './cache/quoteCache';
import { createRedisClient, RedisQuoteCache } from './cache/redisQuoteCache';

import { resolveErc20Metadata } from './tokens/erc20Metadata';
import { ProviderHealthTracker } from './obs/providerHealth';

export type CreateServerOptions = {
  logger?: boolean;
  config?: AppConfig;
  receiptStore?: ReceiptStore;
  preflightClient?: PreflightClient;
  riskEngine?: RiskEngine;
  pancakeSwapAdapter?: Adapter;
  quoteCache?: QuoteCache;
  metrics?: Metrics;
  providerHealth?: ProviderHealthTracker;
};

export function createServer(options: CreateServerOptions = {}): FastifyInstance {
  const config = options.config ?? loadConfig(process.env);
  const receiptStore =
    options.receiptStore ??
    (config.receiptStore.type === 'memory'
      ? new MemoryReceiptStore()
      : new FileReceiptStore(config.receiptStore.path));

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

  app.get('/health', async () => {
    return { status: 'ok' } as const;
  });

  const api = app.withTypeProvider<ZodTypeProvider>();

  const metrics = options.metrics ?? createMetrics({ collectDefault: true });
  const providerHealth = options.providerHealth ?? new ProviderHealthTracker();

  // Provider status endpoint for dashboard
  api.get('/v1/providers/status', async () => {
    const stats = providerHealth.getAllStats();
    const providers = PROVIDERS.map((p) => {
      const stat = stats.find((s) => s.providerId === p.providerId);
      return {
        providerId: p.providerId,
        displayName: p.displayName,
        category: p.category,
        capabilities: p.capabilities,
        successRate: stat?.successRate ?? 80, // Default if no observations
        latencyMs: stat?.latencyMs ?? 500,
        observations: stat?.observations ?? 0,
        status: stat ? (stat.successRate >= 70 ? 'ok' : stat.successRate >= 40 ? 'degraded' : 'down') : 'unknown',
      };
    });
    return { providers, timestamp: Date.now() };
  });

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
  ]);

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
        sellability: sellabilityDeps,
      });

      await receiptStore.put(receipt);

      return {
        receiptId,
        rankedQuotes,
        bestRawQuotes,
        bestExecutableQuoteProviderId,
        bestRawOutputProviderId,
        beqRecommendedProviderId,
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

  // Build transaction endpoint - returns ready-to-sign calldata
  const BuildTxRequestSchema = z.object({
    providerId: z.string(),
    sellToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    buyToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    sellAmount: z.string(),
    slippageBps: z.number().int().min(1).max(5000).default(100),
    account: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
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
      };

      const placeholderSignals = (reason: string): RiskSignals => ({
        sellability: { status: 'OK', confidence: 0.8, reasons: [reason] },
        revertRisk: { level: 'LOW', reasons: [reason] },
        mevExposure: { level: 'LOW', reasons: [reason] },
        churn: { level: 'LOW', reasons: [reason] },
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

  return app;
}
