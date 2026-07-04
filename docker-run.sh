#!/bin/bash
# Recrea el contenedor "washer-control" (api + mcp unificados).
# Reemplaza los procesos PM2 washer-api + washer-mcp.
#
# --net=host + /var/run/dbus: el modulo de la bascula (scale.js) usa
# @stoprocent/noble para BLE via BlueZ/D-Bus - necesita el mismo acceso
# que tenia corriendo directo en el host bajo PM2.
set -euo pipefail
cd "$(dirname "$0")"

docker build -t washer-control:latest .

docker stop washer-control 2>/dev/null || true
docker rm washer-control 2>/dev/null || true

docker run -d \
  --name washer-control \
  --restart=unless-stopped \
  --network=host \
  -v /var/run/dbus:/var/run/dbus \
  -v "$(pwd)/.env:/app/.env:ro" \
  -v "$(pwd)/data:/app/data" \
  --log-opt max-size=20m --log-opt max-file=3 \
  washer-control:latest
