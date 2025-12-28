# Build context: repository root
# Example:
#   docker build -f apps/api/Dockerfile -t swappilot-api .
#   docker run --rm -p 3001:3001 --env-file .env swappilot-api

FROM node:20-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
ENV CI=true

RUN corepack enable

# Copy the monorepo (keeps it simple; optimize later with a .dockerignore)
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @swappilot/api... build

EXPOSE 3001

CMD ["node", "apps/api/dist/index.js"]
