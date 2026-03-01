FROM node:20-alpine

WORKDIR /app

# Backend deps
COPY backend/package*.json backend/
RUN cd backend && npm ci --omit=dev

# Frontend deps + build
COPY frontend/package*.json frontend/
RUN cd frontend && npm ci
COPY frontend/ frontend/
RUN cd frontend && npm run build

# Backend source + build
COPY backend/ backend/
RUN cd backend && npm run build

ENV NODE_ENV=production PORT=8080
EXPOSE 8080
CMD ["node", "backend/dist/server.js"]
