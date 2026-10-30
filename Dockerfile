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

# CUDA execution provider binaries are too big for npm and ship from nuget.
# libcuda comes from the nvidia runtime; cuDNN/cuBLAS are not on the host, so
# they're installed here from NVIDIA's repo. cuDNN 9 for ORT 1.24's CUDA 12 build.
ARG ORT_CUDA=1
RUN if [ "$ORT_CUDA" = "1" ]; then \
        ONNXRUNTIME_NODE_INSTALL=cuda12 node node_modules/onnxruntime-node/script/install.js; \
        apt-get update && apt-get install -y --no-install-recommends \
            ca-certificates curl gnupg; \
        curl -fsSL https://developer.download.nvidia.com/compute/cuda/repos/debian12/x86_64/cuda-keyring_1.1-1_all.deb \
            -o /tmp/cuda-keyring.deb; \
        dpkg -i /tmp/cuda-keyring.deb && rm /tmp/cuda-keyring.deb; \
        apt-get update && apt-get install -y --no-install-recommends \
            cuda-cudart-12-8 libcudnn9-cuda-12 libcublas-12-8 libcurand-12-8 libcufft-12-8 libcusparse-12-8; \
        rm -rf /var/lib/apt/lists/*; \
    fi

EXPOSE 4100

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
