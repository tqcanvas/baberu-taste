CREATE TABLE IF NOT EXISTS sync_boundaries (
  source_name TEXT NOT NULL,
  source_entity_type TEXT NOT NULL,
  media_type TEXT NOT NULL,
  last_source_updated_at BIGINT NOT NULL DEFAULT 0,
  last_source_id BIGINT NOT NULL DEFAULT 0,
  last_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_name, source_entity_type, media_type),
  CHECK (source_name <> ''),
  CHECK (source_entity_type <> ''),
  CHECK (media_type <> ''),
  CHECK (last_source_updated_at >= 0),
  CHECK (last_source_id >= 0)
);
