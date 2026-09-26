# ─── Build ───────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @kairos/api...
COPY packages/core packages/core
COPY apps/api apps/api
RUN pnpm --filter @kairos/core build && pnpm --filter @kairos/api build
RUN pnpm deploy --filter @kairos/api --prod --legacy /out && cp -r apps/api/dist apps/api/prisma /out/ \
 && cd /out && npx prisma generate

# ─── Runtime ─────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S kairos && adduser -S kairos -G kairos
COPY --from=build --chown=kairos:kairos /out .
USER kairos
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:4000/api/health || exit 1
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
