import fastify, { type FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';

export type CreateServerOptions = {
  logger?: boolean;
};

export function createServer(options: CreateServerOptions = {}): FastifyInstance {
  const app = fastify({
    logger: options.logger ?? true,
    genReqId: () => randomUUID(),
  });

  app.get('/health', async () => {
    return { status: 'ok' } as const;
  });

  return app;
}
