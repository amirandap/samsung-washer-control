#!/bin/bash
# Recrea el contenedor "washer-control" (api + mcp unificados).
# Reemplaza los procesos PM2 washer-api + washer-mcp.
#
# --net=host + /var/run/dbus: el modulo de la bascula (scale.js) usa
# @stoprocent/noble para BLE via BlueZ/D-Bus - necesita el mismo acceso
# que tenia corriendo directo en el host bajo PM2.
set -euo pipefail
cd "$(dirname "$0")"

# Serializa deploys en el droplet compartido -- GitHub Actions' cancel-in-progress mata el
# job del runner pero no el proceso SSH remoto ya en marcha (appleboy/ssh-action no lo
# propaga). Ver incidente vivaldi_webai 2026-07-20. El lock espera hasta 10 min al deploy
# anterior en vez de competir con el.
LOCK_FILE="/tmp/samsung-washer-control-deploy.lock"
exec 200>"$LOCK_FILE"
if ! flock -w 600 200; then
  echo "ERROR: otro deploy sigue corriendo despues de esperar 10 min, abortando"
  exit 1
fi

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
