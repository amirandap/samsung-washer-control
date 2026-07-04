# --- build stage: compila el frontend (dist/ no se commitea, ver .gitignore) ---
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN VITE_BASE_PATH=/lavadora/ npm run build

# --- runtime stage ---
FROM node:20-bookworm-slim
# build deps para los modulos nativos (better-sqlite3, @stoprocent/noble)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ libbluetooth-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# api (server/index.js) + mcp en modo http (server/mcp.js) en un solo contenedor
# .env y data/ (sqlite con tokens de SmartThings) se montan desde el host, no van en la imagen
ENV MCP_HTTP=1
EXPOSE 3001 3002

CMD ["./docker-entrypoint.sh"]
