# Frontend Application Image

# Build stage
FROM node:20-alpine AS builder

# Install system dependencies
RUN apk add --no-cache libc6-compat curl

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set environment variables
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies including devDependencies for build
RUN npm ci --legacy-peer-deps --include=dev

# Copy source code
COPY . .

# Build arguments for API URL
ARG NEXT_PUBLIC_API_URL
ARG DOCKER_ENV=true
ARG BACKEND_URL

# Pre-download Google Fonts to avoid network issues during build
RUN mkdir -p .next/cache/google-fonts

# Build the application
RUN NODE_ENV=production DOCKER_ENV=${DOCKER_ENV} BACKEND_URL=${BACKEND_URL} npm run build

# Production stage
FROM node:20-alpine AS runner

# Install system dependencies
RUN apk add --no-cache libc6-compat curl

# Set working directory
WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set environment variables
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# Copy built application from builder
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Add labels for GitHub Container Registry
LABEL org.opencontainers.image.source="https://github.com/jnardiello/printfarmhq"
LABEL org.opencontainers.image.description="PrintFarmHQ Frontend - Complete 3D printing management platform"
LABEL org.opencontainers.image.licenses="AGPL"
LABEL org.opencontainers.image.title="PrintFarmHQ Frontend"
LABEL org.opencontainers.image.vendor="PrintFarmHQ"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start the application
CMD ["npm", "start"]