FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @kairos/web...
COPY packages/core packages/core
COPY apps/web apps/web
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @kairos/core build && pnpm --filter @kairos/web build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S kairos && adduser -S kairos -G kairos
COPY --from=build --chown=kairos:kairos /repo/apps/web/.next/standalone ./
COPY --from=build --chown=kairos:kairos /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=kairos:kairos /repo/apps/web/public ./apps/web/public
USER kairos
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
