# ---- 1. Install dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- 2. Build ----
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* values are inlined into the browser bundle at build time, so they are build args.
# They are URLs the *browser* calls, so localhost:800x is correct even though this runs in Docker.
ARG NEXT_PUBLIC_DJANGO_URL=http://localhost:8001
ARG NEXT_PUBLIC_FASTAPI_URL=http://localhost:8002
ARG NEXT_PUBLIC_EXPRESS_URL=http://localhost:8003
ARG NEXT_PUBLIC_GO_URL=http://localhost:8004
ARG NEXT_PUBLIC_PHP_URL=http://localhost:8005
ARG NEXT_PUBLIC_PYTHON_URL=http://localhost:8006
ARG NEXT_PUBLIC_REQUEST_TIMEOUT_MS=5000

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- 3. Run: only the standalone server and static assets ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
