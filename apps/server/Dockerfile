FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/types/package.json packages/types/package.json
RUN pnpm install
COPY . .
RUN pnpm --filter @chat-app/types build
RUN pnpm --filter @chat-app/server build

FROM node:20-alpine AS runtime
WORKDIR /app
RUN corepack enable
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/package.json
COPY --from=builder /app/apps/server/.env.example ./apps/server/.env.example
COPY --from=builder /app/packages ./packages
ENV NODE_ENV=production
CMD ["pnpm", "--filter", "@chat-app/server", "start"]
