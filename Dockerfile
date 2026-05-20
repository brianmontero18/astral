# ─── Build stage ──────────────────────────────────────────────────────────────
# Installs full toolchain (tsc, @types, vite) and compiles. Discarded afterwards.
FROM node:20-alpine AS build

WORKDIR /app

# Build-time vars for Vite (Render passes service env vars marked
# "Available at build time" as build args).
ARG VITE_SUPERTOKENS_AUTH_ENABLED
ARG VITE_SUPERTOKENS_APP_NAME
ARG VITE_SUPERTOKENS_API_DOMAIN
ARG VITE_SUPERTOKENS_WEBSITE_DOMAIN
ARG VITE_SUPERTOKENS_API_BASE_PATH
ARG VITE_SUPERTOKENS_WEBSITE_BASE_PATH
ARG VITE_SUPPORT_HREF

ENV VITE_SUPERTOKENS_AUTH_ENABLED=$VITE_SUPERTOKENS_AUTH_ENABLED \
    VITE_SUPERTOKENS_APP_NAME=$VITE_SUPERTOKENS_APP_NAME \
    VITE_SUPERTOKENS_API_DOMAIN=$VITE_SUPERTOKENS_API_DOMAIN \
    VITE_SUPERTOKENS_WEBSITE_DOMAIN=$VITE_SUPERTOKENS_WEBSITE_DOMAIN \
    VITE_SUPERTOKENS_API_BASE_PATH=$VITE_SUPERTOKENS_API_BASE_PATH \
    VITE_SUPERTOKENS_WEBSITE_BASE_PATH=$VITE_SUPERTOKENS_WEBSITE_BASE_PATH \
    VITE_SUPPORT_HREF=$VITE_SUPPORT_HREF

# Deps first (cached while package*.json is unchanged)
COPY frontend/package*.json frontend/
RUN cd frontend && npm ci
COPY backend/package*.json backend/
RUN cd backend && npm ci

# Frontend: compile React → frontend/dist
COPY frontend/ frontend/
RUN cd frontend && npm run build

# Backend: compile TS → backend/dist
COPY backend/ backend/
RUN cd backend && npm run build

# ─── Runtime stage ────────────────────────────────────────────────────────────
# Production-only deps + compiled output. No compiler, no @types, no vitest.
FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production PORT=8080

# Production-only backend deps
COPY backend/package*.json backend/
RUN cd backend && npm ci --omit=dev

# Compiled backend + runtime assets (fonts for PDF rendering)
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/assets backend/assets

# Compiled frontend, served as static files by Fastify
COPY --from=build /app/frontend/dist frontend/dist

EXPOSE 8080
CMD ["node", "backend/dist/server.js"]
