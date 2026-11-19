# 多階段：web 與 worker 共用同一 image，不同 command（§8）
FROM node:20-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH="/pnpm:$PATH"
RUN corepack enable
# Chromium + sharp 依賴
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium fonts-noto-cjk ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
ENV CHROME_PATH=/usr/bin/chromium
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
RUN pnpm build
RUN pnpm worker:build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/dist ./dist
# Prisma client + CLI（migrate deploy）與 sharp 為 worker 所需的原生依賴；其餘已 bundle 進 dist/worker.js
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/node_modules/sharp ./node_modules/sharp
COPY --from=build /app/node_modules/@img ./node_modules/@img
COPY --from=deps /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY prisma ./prisma
COPY content ./content
COPY package.json ./

EXPOSE 3000
# web 為預設；worker 容器以 command 覆蓋
CMD ["node", "server.js"]
