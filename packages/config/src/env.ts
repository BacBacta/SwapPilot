import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3001),

  API_PORT: z.coerce.number().int().positive().default(3001),
  WEB_PORT: z.coerce.number().int().positive().default(3000),

  RECEIPT_STORE: z.enum(['memory', 'file']).default('file'),
  RECEIPT_STORE_PATH: z.string().default('./.data/receipts'),
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
};

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
  };
}
