# Dockerfile for MossGuard Playground
# Multi-stage build for production deployment

# ---- Build stage ----
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@11 --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY package.json ./

# Copy all packages (needed for workspace build)
COPY packages/ ./packages/
COPY apps/ ./apps/

# Install and build
RUN pnpm install --frozen-lockfile
RUN pnpm build

# ---- Production stage ----
FROM node:22-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@11 --activate

WORKDIR /app

# Copy only production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/playground/dist ./apps/playground/dist
COPY --from=builder /app/apps/playground/package.json ./apps/playground/package.json

# Expose port (Render/Fly.io use PORT env)
EXPOSE 3000

# Run the server
CMD ["node", "apps/playground/server.mjs"]
