FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/mobile/package.json packages/mobile/package.json
RUN npm ci --workspace=@confidence-trivia/shared --workspace=@confidence-trivia/server

COPY tsconfig.json tsconfig.json
COPY packages/shared packages/shared
COPY packages/server packages/server

RUN npm run build --workspace=packages/shared \
    && npm run build --workspace=packages/server

FROM node:20-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=2567
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/mobile/package.json packages/mobile/package.json
RUN npm ci --omit=dev --ignore-scripts \
      --workspace=@confidence-trivia/shared \
      --workspace=@confidence-trivia/server \
    && npm cache clean --force

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/server/dist packages/server/dist

EXPOSE 2567
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

USER node
CMD ["node", "packages/server/dist/index.js"]
