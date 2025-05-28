# Frontend Application Image
ARG REGISTRY=ghcr.io
ARG NAMESPACE=jnardiello/printfarmhq
ARG BASE_TAG=latest

# Build stage
FROM ${REGISTRY}/${NAMESPACE}/printfarmhq-frontend-base:${BASE_TAG} AS builder

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies including devDependencies for build
RUN npm ci --legacy-peer-deps --include=dev

# Copy source code
COPY . .

# Build arguments for API URL
ARG NEXT_PUBLIC_API_URL
ARG DOCKER_ENV=true

# Pre-download Google Fonts to avoid network issues during build
RUN mkdir -p .next/cache/google-fonts

# Build the application
RUN NODE_ENV=production DOCKER_ENV=${DOCKER_ENV} npm run build

# Production stage
FROM ${REGISTRY}/${NAMESPACE}/printfarmhq-frontend-base:${BASE_TAG} AS runner

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
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.title="PrintFarmHQ Frontend"
LABEL org.opencontainers.image.vendor="PrintFarmHQ"

# Set environment variables
ENV PORT=3000 \
    HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start the application
CMD ["npm", "start"]