import fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';

import { z } from 'zod';

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

import { buildDeterministicMockQuote } from './mock';
import { FileReceiptStore } from './store/fileReceiptStore';
import { MemoryReceiptStore, type ReceiptStore } from './store/receiptStore';

export type CreateServerOptions = {
  logger?: boolean;
  config?: AppConfig;
  receiptStore?: ReceiptStore;
};

export function createServer(options: CreateServerOptions = {}): FastifyInstance {
  const config = options.config ?? loadConfig(process.env);
  const receiptStore =
    options.receiptStore ??
    (config.receiptStore.type === 'memory'
      ? new MemoryReceiptStore()
      : new FileReceiptStore(config.receiptStore.path));

  const app = fastify({
    logger: options.logger ?? true,
    genReqId: () => randomUUID(),
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', request.id);
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

  app.get('/health', async () => {
    return { status: 'ok' } as const;
  });

  const api = app.withTypeProvider<ZodTypeProvider>();

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
      } = buildDeterministicMockQuote(request.body);

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
