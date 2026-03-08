#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
COMPOSE_DIR="$ROOT_DIR/infra/postgres"
ENV_FILE="$COMPOSE_DIR/.env"
COMPOSE_FILE="$COMPOSE_DIR/compose.yml"
INPUT_PATH=${1:-}
TARGET_DB=${2:-}

if [ -z "$INPUT_PATH" ]; then
  echo "Usage: $0 <backup-file> [target-db]" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Copy .env.example and set local Postgres values." >&2
  exit 1
fi

if [ ! -f "$INPUT_PATH" ]; then
  echo "Backup file not found: $INPUT_PATH" >&2
  exit 1
fi

set -a
. "$ENV_FILE"
set +a

if [ -z "$TARGET_DB" ]; then
  TARGET_DB=$POSTGRES_DB
fi

case "$INPUT_PATH" in
  *.sql)
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
      psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$TARGET_DB" <"$INPUT_PATH"
    ;;
  *)
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
      pg_restore -U "$POSTGRES_USER" -d "$TARGET_DB" --clean --if-exists <"$INPUT_PATH"
    ;;
esac

echo "Restore completed from $INPUT_PATH into $TARGET_DB"
