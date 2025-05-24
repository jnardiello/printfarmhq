# Dockerfile for Next.js frontend

# ---- Builder Stage ----
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED 1

# Copy package.json and lockfile
COPY package.json package-lock.json* ./

# Install dependencies (including devDependencies for build tools like TailwindCSS, TypeScript)
RUN npm ci --legacy-peer-deps

# Copy the rest of the application code
COPY . .

# Accept build args
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build the Next.js application
RUN NODE_ENV=production npm run build

# ---- Runner Stage ----
FROM node:20-alpine AS runner

WORKDIR /app

# Set environment variables
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built assets from builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Ensure the .next folder is writable by the Next.js app
RUN chown -R nextjs:nodejs /app/.next

# Switch to the non-root user
USER nextjs

EXPOSE 3000

# Start the Next.js application
CMD ["npm", "start"] 