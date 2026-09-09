FROM node:24-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig*.json nest-cli.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
COPY docker ./docker
RUN npm run build

# El CLI y el seed quedan fuera de la imagen que atiende solicitudes.
FROM build AS migrate
USER node
ENTRYPOINT ["node", "docker/entrypoint.cjs"]
CMD ["npm", "run", "prisma:deploy"]

FROM base AS production-dependencies
COPY package.json package-lock.json ./
# @prisma/client declara el CLI como peer opcional; no hace falta para ejecutar la API.
RUN npm ci --omit=dev --legacy-peer-deps --ignore-scripts --no-audit --no-fund \
    && test ! -d node_modules/prisma

FROM base AS runtime
ENV NODE_ENV=production PORT=3000 UPLOADS_DIR=/app/uploads
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY docker ./docker
RUN mkdir -p /app/uploads && chown node:node /app/uploads
USER node
EXPOSE 3000
ENTRYPOINT ["node", "docker/entrypoint.cjs"]
CMD ["node", "dist/main.js"]
