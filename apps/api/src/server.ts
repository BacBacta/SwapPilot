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
  type Adapter,
} from '@swappilot/adapters';

import { buildDeterministicMockQuote } from './mock';
import { FileReceiptStore } from './store/fileReceiptStore';
import { MemoryReceiptStore, type ReceiptStore } from './store/receiptStore';

import rateLimit from '@fastify/rate-limit';

import { createMetrics, type Metrics } from './obs/metrics';
import { NoopQuoteCache, type QuoteCache } from './cache/quoteCache';
import { createRedisClient, RedisQuoteCache } from './cache/redisQuoteCache';

export type CreateServerOptions = {
  logger?: boolean;
  config?: AppConfig;
  receiptStore?: ReceiptStore;
  preflightClient?: PreflightClient;
  riskEngine?: RiskEngine;
  pancakeSwapAdapter?: Adapter;
  quoteCache?: QuoteCache;
  metrics?: Metrics;
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

  // Create adapters map for the mock quote builder
  const adapters = new Map<string, Adapter>([
    ['pancakeswap', pancakeSwapAdapter],
    ['1inch', oneInchAdapter],
    ['okx-dex', okxAdapter],
    ['kyberswap', kyberSwapAdapter],
    ['paraswap', paraSwapAdapter],
  ]);

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
      const {
        receiptId,
        rankedQuotes,
        bestRawQuotes,
        bestExecutableQuoteProviderId,
        bestRawOutputProviderId,
        beqRecommendedProviderId,
        receipt,
      } = await buildDeterministicMockQuote(request.body, {
        preflightClient,
        riskEngine,
        adapters,
        quoteCache,
        quoteCacheTtlSeconds: config.redis.quoteCacheTtlSeconds,
        logger: request.log,
        metrics,
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

  return app;
}
