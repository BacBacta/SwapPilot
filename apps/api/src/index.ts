import { createServer } from './server';

const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '0.0.0.0';

const app = createServer({ logger: true });

async function main() {
	await app.listen({ port, host });
}

main().catch((error) => {
	app.log.error({ error }, 'Failed to start server');
	process.exitCode = 1;
});
