import type { Client } from "pg";

import type { CatalogSyncCheckpoint, CatalogSyncStatus } from "./types.js";

type Queryable = Pick<Client, "query">;

interface CatalogSyncCheckpointRow {
  next_page: string;
  per_page: string;
  last_processed_source_id: string | null;
  total_pages_processed: string;
  total_records_processed: string;
  status: CatalogSyncStatus;
  failure_count: string;
  last_error: string | null;
}

export const DEFAULT_CATALOG_SYNC_STATUS: CatalogSyncStatus = "idle";

export function createDefaultCatalogSyncCheckpoint(perPage: number): CatalogSyncCheckpoint {
  return {
    nextPage: 1,
    perPage,
    lastProcessedSourceId: null,
    totalPagesProcessed: 0,
    totalRecordsProcessed: 0,
    status: DEFAULT_CATALOG_SYNC_STATUS,
    failureCount: 0,
    lastError: null,
  };
}

function mapCheckpointRow(row: CatalogSyncCheckpointRow): CatalogSyncCheckpoint {
  return {
    nextPage: Number(row.next_page),
    perPage: Number(row.per_page),
    lastProcessedSourceId:
      row.last_processed_source_id === null ? null : Number(row.last_processed_source_id),
    totalPagesProcessed: Number(row.total_pages_processed),
    totalRecordsProcessed: Number(row.total_records_processed),
    status: row.status,
    failureCount: Number(row.failure_count),
    lastError: row.last_error,
  };
}

export async function loadAniListMangaCatalogSyncCheckpoint(
  client: Queryable,
  perPage: number,
): Promise<CatalogSyncCheckpoint> {
  const result = await client.query<CatalogSyncCheckpointRow>(
    `
      SELECT
        next_page,
        per_page,
        last_processed_source_id,
        total_pages_processed,
        total_records_processed,
        status,
        failure_count,
        last_error
      FROM catalog_sync_checkpoints
      WHERE source_name = 'anilist'
        AND source_entity_type = 'media'
        AND media_type = 'manga'
      LIMIT 1
    `,
  );

  if (result.rowCount !== 1) {
    return createDefaultCatalogSyncCheckpoint(perPage);
  }

  return mapCheckpointRow(result.rows[0]);
}

export async function resetAniListMangaCatalogSyncCheckpoint(
  client: Queryable,
  perPage: number,
  startPage: number,
): Promise<CatalogSyncCheckpoint> {
  const result = await client.query<CatalogSyncCheckpointRow>(
    `
      INSERT INTO catalog_sync_checkpoints (
        source_name,
        source_entity_type,
        media_type,
        next_page,
        per_page,
        last_processed_source_id,
        total_pages_processed,
        total_records_processed,
        status,
        failure_count,
        last_error,
        started_at,
        last_requested_at,
        last_completed_at
      )
      VALUES ('anilist', 'media', 'manga', $1, $2, NULL, 0, 0, 'idle', 0, NULL, NULL, NULL, NULL)
      ON CONFLICT (source_name, source_entity_type, media_type) DO UPDATE
      SET next_page = EXCLUDED.next_page,
          per_page = EXCLUDED.per_page,
          last_processed_source_id = NULL,
          total_pages_processed = 0,
          total_records_processed = 0,
          status = 'idle',
          failure_count = 0,
          last_error = NULL,
          started_at = NULL,
          last_requested_at = NULL,
          last_completed_at = NULL,
          updated_at = NOW()
      RETURNING
        next_page,
        per_page,
        last_processed_source_id,
        total_pages_processed,
        total_records_processed,
        status,
        failure_count,
        last_error
    `,
    [startPage, perPage],
  );

  return mapCheckpointRow(result.rows[0]);
}

export async function markAniListMangaCatalogSyncRunning(
  client: Queryable,
  checkpoint: CatalogSyncCheckpoint,
): Promise<CatalogSyncCheckpoint> {
  const result = await client.query<CatalogSyncCheckpointRow>(
    `
      INSERT INTO catalog_sync_checkpoints (
        source_name,
        source_entity_type,
        media_type,
        next_page,
        per_page,
        last_processed_source_id,
        total_pages_processed,
        total_records_processed,
        status,
        failure_count,
        last_error,
        started_at,
        last_requested_at
      )
      VALUES ('anilist', 'media', 'manga', $1, $2, $3, $4, $5, 'running', $6, NULL, NOW(), NOW())
      ON CONFLICT (source_name, source_entity_type, media_type) DO UPDATE
      SET next_page = EXCLUDED.next_page,
          per_page = EXCLUDED.per_page,
          status = 'running',
          last_error = NULL,
          started_at = COALESCE(catalog_sync_checkpoints.started_at, NOW()),
          last_requested_at = NOW(),
          updated_at = NOW()
      RETURNING
        next_page,
        per_page,
        last_processed_source_id,
        total_pages_processed,
        total_records_processed,
        status,
        failure_count,
        last_error
    `,
    [
      checkpoint.nextPage,
      checkpoint.perPage,
      checkpoint.lastProcessedSourceId,
      checkpoint.totalPagesProcessed,
      checkpoint.totalRecordsProcessed,
      checkpoint.failureCount,
    ],
  );

  return mapCheckpointRow(result.rows[0]);
}

export async function saveAniListMangaCatalogSyncSuccess(
  client: Queryable,
  checkpoint: CatalogSyncCheckpoint,
  nextPage: number,
  processedCount: number,
  lastProcessedSourceId: number | null,
  status: CatalogSyncStatus,
): Promise<CatalogSyncCheckpoint> {
  const result = await client.query<CatalogSyncCheckpointRow>(
    `
      INSERT INTO catalog_sync_checkpoints (
        source_name,
        source_entity_type,
        media_type,
        next_page,
        per_page,
        last_processed_source_id,
        total_pages_processed,
        total_records_processed,
        status,
        failure_count,
        last_error,
        started_at,
        last_requested_at,
        last_completed_at
      )
      VALUES (
        'anilist',
        'media',
        'manga',
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        0,
        NULL,
        NOW(),
        NOW(),
        CASE WHEN $6 = 'completed' THEN NOW() ELSE NULL END
      )
      ON CONFLICT (source_name, source_entity_type, media_type) DO UPDATE
      SET next_page = EXCLUDED.next_page,
          per_page = EXCLUDED.per_page,
          last_processed_source_id = EXCLUDED.last_processed_source_id,
          total_pages_processed = EXCLUDED.total_pages_processed,
          total_records_processed = EXCLUDED.total_records_processed,
          status = EXCLUDED.status,
          failure_count = 0,
          last_error = NULL,
          started_at = COALESCE(catalog_sync_checkpoints.started_at, NOW()),
          last_requested_at = NOW(),
          last_completed_at = CASE
            WHEN EXCLUDED.status = 'completed' THEN NOW()
            ELSE catalog_sync_checkpoints.last_completed_at
          END,
          updated_at = NOW()
      RETURNING
        next_page,
        per_page,
        last_processed_source_id,
        total_pages_processed,
        total_records_processed,
        status,
        failure_count,
        last_error
    `,
    [
      nextPage,
      checkpoint.perPage,
      lastProcessedSourceId,
      checkpoint.totalPagesProcessed + 1,
      checkpoint.totalRecordsProcessed + processedCount,
      status,
    ],
  );

  return mapCheckpointRow(result.rows[0]);
}

export async function saveAniListMangaCatalogSyncFailure(
  client: Queryable,
  checkpoint: CatalogSyncCheckpoint,
  page: number,
  errorMessage: string,
): Promise<CatalogSyncCheckpoint> {
  const result = await client.query<CatalogSyncCheckpointRow>(
    `
      INSERT INTO catalog_sync_checkpoints (
        source_name,
        source_entity_type,
        media_type,
        next_page,
        per_page,
        last_processed_source_id,
        total_pages_processed,
        total_records_processed,
        status,
        failure_count,
        last_error,
        started_at,
        last_requested_at
      )
      VALUES ('anilist', 'media', 'manga', $1, $2, $3, $4, $5, 'failed', 1, $6, NOW(), NOW())
      ON CONFLICT (source_name, source_entity_type, media_type) DO UPDATE
      SET next_page = $1,
          per_page = $2,
          status = 'failed',
          failure_count = catalog_sync_checkpoints.failure_count + 1,
          last_error = $6,
          last_requested_at = NOW(),
          updated_at = NOW()
      RETURNING
        next_page,
        per_page,
        last_processed_source_id,
        total_pages_processed,
        total_records_processed,
        status,
        failure_count,
        last_error
    `,
    [
      page,
      checkpoint.perPage,
      checkpoint.lastProcessedSourceId,
      checkpoint.totalPagesProcessed,
      checkpoint.totalRecordsProcessed,
      errorMessage,
    ],
  );

  return mapCheckpointRow(result.rows[0]);
}
