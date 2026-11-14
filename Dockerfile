# syntax=docker/dockerfile:1.7

# Use the same Node.js and Debian family for native dependencies in both stages.
ARG NODE_VERSION=22.13.0

FROM node:${NODE_VERSION}-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY src ./src

RUN npm run build

RUN npm prune --omit=dev

FROM node:${NODE_VERSION}-bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=8887

WORKDIR /app

COPY --chown=node:node package.json package-lock.json message-board.html ./
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist

RUN mkdir -p /app/tls \
    && chown node:node /app/tls \
    && chmod 700 /app/tls

EXPOSE 8887

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node","-e","const https = require('node:https'); const fs = require('node:fs'); https.get('https://127.0.0.1:8887/api/message-board', { ca: fs.readFileSync('tls/server.crt') }, (res) => { res.resume(); if (res.statusCode !== 200) process.exit(1); }).on('error', () => process.exit(1));"]

CMD ["node", "dist/server.js"]
