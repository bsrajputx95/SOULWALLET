# ==========================================
# Stage 1: Dependencies
# ==========================================
FROM node:22-alpine AS dependencies

# Install system dependencies
RUN apk add --no-cache libc6-compat python3 make g++ wget && \
    apk cache clean

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies and generate Prisma client
RUN npm ci --only=production --legacy-peer-deps && \
    npx prisma generate && \
    npm cache clean --force

RUN npm prune --production --legacy-peer-deps

# ==========================================
# Stage 2: Builder
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run server:build

# ==========================================
# Stage 3: Runner
# ==========================================
FROM node:22-alpine AS runner

LABEL org.opencontainers.image.title="SoulWallet Backend"
LABEL org.opencontainers.image.description="Solana wallet backend API"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="SoulWallet"
LABEL maintainer="team@soulwallet.com"

# Add security scanning labels
LABEL org.opencontainers.image.title="SoulWallet API"
LABEL org.opencontainers.image.description="Backend API for SoulWallet application"
LABEL org.opencontainers.image.vendor="SoulWallet"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.created=""
LABEL org.opencontainers.image.source="https://github.com/soulwallet/soulwallet"
LABEL org.opencontainers.image.licenses="MIT"

# Install wget for healthcheck
RUN apk add --no-cache wget

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 soulwallet

RUN mkdir -p /app/logs && chown -R soulwallet:nodejs /app/logs

# Copy necessary files from previous stages
COPY --from=dependencies --chown=soulwallet:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=soulwallet:nodejs /app/dist ./dist
COPY --from=builder --chown=soulwallet:nodejs /app/prisma ./prisma
COPY --from=builder --chown=soulwallet:nodejs /app/package*.json ./
COPY --from=builder --chown=soulwallet:nodejs /app/tsconfig.server.json ./

# Set proper working directory permissions
RUN chown -R soulwallet:nodejs /app

RUN apk add --no-cache dumb-init

USER soulwallet

# Expose port
EXPOSE 3001

# Health check labels
LABEL org.opencontainers.image.healthcheck.interval="15s"
LABEL org.opencontainers.image.healthcheck.timeout="5s"
LABEL org.opencontainers.image.healthcheck.start-period="60s"
LABEL org.opencontainers.image.healthcheck.retries="3"
LABEL org.opencontainers.image.healthcheck.test='["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/health"]'

# Health check
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Run migrations and start application
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && exec dumb-init node -r tsconfig-paths/register dist/src/server/fastify.js"]
