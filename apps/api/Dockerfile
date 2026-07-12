# syntax=docker/dockerfile:1
# Multi-stage build for the MediLocal API (pnpm monorepo). Build context = repo root:
#   docker build -f apps/api/Dockerfile -t medilocal-api .

# ---------- builder ----------
FROM node:22-bookworm-slim AS builder
RUN corepack enable
WORKDIR /repo

# Manifests first so the install layer caches until a dependency actually changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --ignore-scripts

# Sources, then build shared → generate Prisma client → build the API.
COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/
RUN pnpm --filter @medilocal/shared build \
 && pnpm --filter @medilocal/api exec prisma generate \
 && pnpm --filter @medilocal/api build

# Self-contained production bundle (prod deps only, workspace pkgs inlined) → /app.
# --legacy: copy workspace deps without the pnpm-10 injected-packages requirement.
RUN pnpm --filter @medilocal/api --prod --legacy deploy /app

# The generated Prisma client (.prisma/client) isn't an npm package, so `deploy`
# skips it — bring the schema/migrations in and regenerate it inside the bundle.
RUN cp -r apps/api/prisma /app/prisma \
 && cd /app && node_modules/.bin/prisma generate

# ---------- runner ----------
FROM node:22-bookworm-slim AS runner
# openssl: Prisma engine · postgresql-client: backups/psql · tini: proper PID 1 (SIGTERM → graceful shutdown)
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl postgresql-client tini \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production

# Pruned bundle (node_modules incl. generated Prisma client + prisma/), then the built app.
COPY --from=builder /app ./
COPY --from=builder /repo/apps/api/dist ./dist

EXPOSE 3000
# Apply pending migrations on boot, then start. tini forwards signals for clean shutdown.
ENTRYPOINT ["tini", "--"]
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main.js"]
