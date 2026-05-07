#!/usr/bin/env bash
# sync-db.sh — Sync presets and clothing_items between local and production
# Usage:
#   ./scripts/sync-db.sh push   — local → production
#   ./scripts/sync-db.sh pull   — production → local

set -euo pipefail

REMOTE_HOST="root@10.0.0.111"
REMOTE_SSH_KEY="$HOME/.ssh/id_ed25519_10.0.0.111"
REMOTE_DB="/opt/samsung-washer-control/data/washer.db"
LOCAL_DB="$(cd "$(dirname "$0")/.." && pwd)/data/washer.db"
TABLES=("presets" "clothing_items")
REMOTE_PM2_APP="washer-api"

# ── helpers ──────────────────────────────────────────────────────────────────
dump_tables() {
  local db="$1"; shift
  local tables=("$@")
  for t in "${tables[@]}"; do
    sqlite3 "$db" "DELETE FROM $t;"
    sqlite3 "$db" ".dump $t" | grep -E '^INSERT '
  done
}

remote_exec() { ssh -i "$REMOTE_SSH_KEY" "$REMOTE_HOST" "$@"; }

# ── push: local → production ──────────────────────────────────────────────────
push() {
  echo "▶ Pushing local DB → production..."

  # 1. Dump data tables from local
  local tmpfile
  tmpfile=$(mktemp /tmp/washer-sync-XXXXXX.sql)

  for t in "${TABLES[@]}"; do
    echo "DELETE FROM $t;" >> "$tmpfile"
    sqlite3 "$LOCAL_DB" ".dump $t" | grep -E '^INSERT ' >> "$tmpfile" || true
  done

  echo "  Exported $(wc -l < "$tmpfile") SQL rows"

  # 2. Stop server, apply to remote DB, restart
  remote_exec "pm2 stop $REMOTE_PM2_APP --silent"
  cat "$tmpfile" | remote_exec "sqlite3 $REMOTE_DB"
  remote_exec "pm2 start $REMOTE_PM2_APP --silent"

  rm -f "$tmpfile"
  echo "✓ Push complete. Production DB updated."
}

# ── pull: production → local ──────────────────────────────────────────────────
pull() {
  echo "▶ Pulling production DB → local..."

  local tmpfile
  tmpfile=$(mktemp /tmp/washer-sync-XXXXXX.sql)

  for t in "${TABLES[@]}"; do
    echo "DELETE FROM $t;" >> "$tmpfile"
    remote_exec "sqlite3 $REMOTE_DB \".dump $t\"" | grep -E '^INSERT ' >> "$tmpfile" || true
  done

  echo "  Exported $(wc -l < "$tmpfile") SQL rows"

  for t in "${TABLES[@]}"; do
    sqlite3 "$LOCAL_DB" "DELETE FROM $t;"
  done
  sqlite3 "$LOCAL_DB" < "$tmpfile"

  rm -f "$tmpfile"
  echo "✓ Pull complete. Local DB updated."
}

# ── main ──────────────────────────────────────────────────────────────────────
case "${1:-}" in
  push) push ;;
  pull) pull ;;
  *)
    echo "Usage: $0 push|pull"
    echo "  push  — sync local → production (overwrites remote presets & clothing)"
    echo "  pull  — sync production → local (overwrites local presets & clothing)"
    exit 1
    ;;
esac
