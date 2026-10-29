# Canteiro Digital — imagem única: aplicativo (Next.js exportado) + API (Node/Express) num só serviço.
# Montar:   docker build -t canteiro-digital .
# Rodar:    veja docker-compose.yml (sobe junto o PostgreSQL)

# ---------- 1. aplicativo (exportação estática, servido na raiz pelo servidor)
FROM node:22-alpine AS app
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_BASE_PATH=""
RUN npm run build

# ---------- 2. servidor (TypeScript → JavaScript)
FROM node:22-alpine AS api
WORKDIR /srv
COPY server/package.json server/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

# ---------- 3. imagem final, só com o necessário para rodar
FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 PASTA_APP=/app/out
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=api /srv/dist ./dist
COPY server/migracoes ./migracoes
COPY --from=app /src/out /app/out
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/api/saude || exit 1
CMD ["node", "dist/index.js"]
