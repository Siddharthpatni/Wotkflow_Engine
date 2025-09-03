FROM node:20-alpine AS base

# Install Python and build dependencies
RUN apk add --no-cache python3 py3-pip make g++ postgresql-client

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
FROM base AS deps
RUN npm ci --only=production

# Install all dependencies for building
FROM base AS build-deps
RUN npm ci

# Build application
FROM build-deps AS build
COPY . .
RUN npm run build || true

# Production image
FROM base AS runtime

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    mkdir -p logs && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})" || exit 1

CMD ["node", "src/index.js"]
