#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
COMPOSE_DIR="$ROOT_DIR/infra/postgres"
ENV_FILE="$COMPOSE_DIR/.env"
COMPOSE_FILE="$COMPOSE_DIR/compose.yml"
OUTPUT_PATH=${1:-"$ROOT_DIR/backups/${POSTGRES_DB:-baberu_taste}_$(date +%Y-%m-%d_%H-%M-%S).dump"}

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Copy .env.example and set local Postgres values." >&2
  exit 1
fi

set -a
. "$ENV_FILE"
set +a

OUTPUT_DIR=$(dirname "$OUTPUT_PATH")

mkdir -p "$OUTPUT_DIR"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc >"$OUTPUT_PATH"

echo "Backup written to $OUTPUT_PATH"
