FROM node:20-slim

WORKDIR /workspace

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY prisma ./prisma

RUN pnpm install --no-frozen-lockfile
RUN pnpm prisma:generate

COPY apps/api ./apps/api

WORKDIR /workspace/apps/api

EXPOSE 3000

CMD ["pnpm", "exec", "ts-node", "src/main.ts"]