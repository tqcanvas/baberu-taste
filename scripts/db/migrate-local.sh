#!/bin/sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
COMPOSE_DIR="$ROOT_DIR/infra/postgres"
MIGRATIONS_DIR="$ROOT_DIR/apps/api/src/db/migrations"
ENV_FILE="$COMPOSE_DIR/.env"
COMPOSE_FILE="$COMPOSE_DIR/compose.yml"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE. Copy .env.example and set local Postgres values." >&2
  exit 1
fi

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "Missing migrations directory: $MIGRATIONS_DIR" >&2
  exit 1
fi

set -a
. "$ENV_FILE"
set +a

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

echo "Waiting for local Postgres on port ${POSTGRES_PORT:-5432}..."

attempts=0
until compose exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
  attempts=$((attempts + 1))

  if [ "$attempts" -ge 30 ]; then
    echo "Postgres did not become ready. Start it first with: npm run db:up" >&2
    exit 1
  fi

  sleep 1
done

compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL

for migration in "$MIGRATIONS_DIR"/*.sql; do
  if [ ! -f "$migration" ]; then
    continue
  fi

  filename=$(basename "$migration")

  already_applied=$(
    compose exec -T postgres psql -At -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
      -c "SELECT 1 FROM schema_migrations WHERE filename = '$filename' LIMIT 1;"
  )

  if [ "$already_applied" = "1" ]; then
    echo "Skipping $filename"
    continue
  fi

  echo "Applying $filename"

  {
    printf 'BEGIN;\n'
    cat "$migration"
    printf "\nINSERT INTO schema_migrations (filename) VALUES ('%s');\n" "$filename"
    printf 'COMMIT;\n'
  } | compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"
done
