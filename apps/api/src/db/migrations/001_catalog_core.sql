CREATE TABLE IF NOT EXISTS content_items (
  id BIGSERIAL PRIMARY KEY,
  media_type TEXT NOT NULL,
  display_title TEXT NOT NULL,
  description_short TEXT,
  image_url TEXT,
  banner_image_url TEXT,
  average_score INTEGER,
  popularity INTEGER,
  favourites INTEGER,
  status TEXT,
  format TEXT,
  country_of_origin TEXT,
  is_adult BOOLEAN NOT NULL DEFAULT FALSE,
  start_year INTEGER,
  start_month INTEGER,
  start_day INTEGER,
  end_year INTEGER,
  end_month INTEGER,
  end_day INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (media_type <> ''),
  CHECK (display_title <> ''),
  CHECK (start_month IS NULL OR start_month BETWEEN 1 AND 12),
  CHECK (start_day IS NULL OR start_day BETWEEN 1 AND 31),
  CHECK (end_month IS NULL OR end_month BETWEEN 1 AND 12),
  CHECK (end_day IS NULL OR end_day BETWEEN 1 AND 31)
);

CREATE TABLE IF NOT EXISTS manga_details (
  content_item_id BIGINT PRIMARY KEY REFERENCES content_items(id) ON DELETE CASCADE,
  chapters INTEGER,
  volumes INTEGER,
  source_material TEXT,
  CHECK (chapters IS NULL OR chapters >= 0),
  CHECK (volumes IS NULL OR volumes >= 0)
);

CREATE TABLE IF NOT EXISTS content_titles (
  id BIGSERIAL PRIMARY KEY,
  content_item_id BIGINT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  title_type TEXT NOT NULL,
  title TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (title_type IN ('romaji', 'english', 'native', 'synonym')),
  CHECK (title <> ''),
  CHECK (normalized_title <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS content_titles_item_type_title_idx
  ON content_titles (content_item_id, title_type, normalized_title);

CREATE INDEX IF NOT EXISTS content_titles_normalized_title_idx
  ON content_titles (normalized_title);

CREATE INDEX IF NOT EXISTS content_titles_primary_idx
  ON content_titles (content_item_id, is_primary, sort_order);

CREATE TABLE IF NOT EXISTS sources (
  id BIGSERIAL PRIMARY KEY,
  content_item_id BIGINT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  source_entity_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_url TEXT,
  source_updated_at TIMESTAMPTZ,
  last_fetched_at TIMESTAMPTZ,
  payload_hash TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source_name <> ''),
  CHECK (source_entity_type <> ''),
  CHECK (source_id <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS sources_external_identity_idx
  ON sources (source_name, source_entity_type, source_id);

CREATE INDEX IF NOT EXISTS sources_content_item_idx
  ON sources (content_item_id);

CREATE INDEX IF NOT EXISTS content_items_media_type_idx
  ON content_items (media_type);

CREATE INDEX IF NOT EXISTS content_items_popularity_idx
  ON content_items (popularity DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS content_items_average_score_idx
  ON content_items (average_score DESC NULLS LAST);
