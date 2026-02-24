# syntax=docker/dockerfile:1

# ---- base ----
FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.30.1 --activate
# Build tools required for native addons (lmdb, sharp, onnxruntime-node, ffi-rs, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- production deps ----
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ---- builder ----
FROM base AS builder
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ---- runner ----
FROM node:24-slim AS runner
WORKDIR /app

# Runtime libraries for native modules (libvips for sharp, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips42 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/out ./out

EXPOSE 4100

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
