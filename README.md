# Weichat MVP

A full-stack real-time messaging MVP featuring Next.js 15, NestJS 10, PostgreSQL, Redis, MinIO, and WebRTC voice calls.

## Monorepo layout
```
.
├── apps/
│   ├── server/         # NestJS API, Socket.IO, WebRTC signaling
│   └── web/            # Next.js 15 client (App Router)
├── packages/
│   └── types/          # Shared TypeScript models
├── prisma/             # Prisma schema
└── infra/              # Docker Compose & Nginx gateway
```

## Getting started (local development)

1. Install dependencies:
   ```bash
   corepack enable
   pnpm install
   ```

2. Configure environment variables:
   - Copy `apps/server/.env.example` to `.env` and adjust secrets if needed.
   - Copy `apps/web/.env.example` to `.env`.

3. Run database migrations:
   ```bash
   pnpm --filter @chat-app/server prisma:migrate
   ```

4. Start development servers in parallel:
   ```bash
   pnpm --filter @chat-app/types dev &
   pnpm --filter @chat-app/server dev
   pnpm --filter @chat-app/web dev
   ```

## Docker Compose

For a production-like stack with PostgreSQL, Redis, MinIO, Nest server, Next web app, and Nginx reverse proxy:
```bash
docker compose -f infra/docker-compose.yaml up -d --build
```
See `infra/README.md` for details.

## Prisma

The data model is defined in `prisma/schema.prisma`. To generate artifacts and run migrations:
```bash
pnpm --filter @chat-app/server prisma:generate
pnpm --filter @chat-app/server prisma:migrate -- --name init
```

## Linting & formatting
```bash
pnpm lint
pnpm format
```

## Testing
Placeholder commands are wired up; add unit/e2e tests under respective apps as the project evolves.

## E2E testing idea
Use Playwright to script sign-in flows, conversation creation, message delivery, and voice call setup between two browser contexts while asserting Socket.IO events and WebRTC stream state.
