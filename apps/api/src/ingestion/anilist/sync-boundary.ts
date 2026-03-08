import type { Client } from "pg";

import type { AniListMedia, SyncBoundary } from "./types.js";

type Queryable = Pick<Client, "query">;

interface SyncBoundaryRow {
  last_source_updated_at: string;
  last_source_id: string;
}

export const EMPTY_SYNC_BOUNDARY: SyncBoundary = {
  lastUpdatedAt: 0,
  lastSourceId: 0,
};

export function getSyncBoundaryFromMedia(media: AniListMedia): SyncBoundary {
  return {
    lastUpdatedAt: media.updatedAt ?? 0,
    lastSourceId: media.id,
  };
}

export function compareMediaToSyncBoundary(media: AniListMedia, boundary: SyncBoundary): number {
  const updatedAt = media.updatedAt ?? 0;

  if (updatedAt > boundary.lastUpdatedAt) {
    return 1;
  }

  if (updatedAt < boundary.lastUpdatedAt) {
    return -1;
  }

  if (media.id > boundary.lastSourceId) {
    return 1;
  }

  if (media.id < boundary.lastSourceId) {
    return -1;
  }

  return 0;
}

export function applySyncBoundaryOverlap(
  boundary: SyncBoundary,
  overlapSeconds: number,
): SyncBoundary {
  if (overlapSeconds <= 0) {
    return boundary;
  }

  return {
    lastUpdatedAt: Math.max(0, boundary.lastUpdatedAt - overlapSeconds),
    lastSourceId: 0,
  };
}

export function getNewerMediaPrefix(
  mediaList: AniListMedia[],
  boundary: SyncBoundary,
): AniListMedia[] {
  const processableMedia: AniListMedia[] = [];

  for (const media of mediaList) {
    if (compareMediaToSyncBoundary(media, boundary) <= 0) {
      break;
    }

    processableMedia.push(media);
  }

  return processableMedia;
}

export function maxSyncBoundary(left: SyncBoundary, right: SyncBoundary): SyncBoundary {
  if (right.lastUpdatedAt > left.lastUpdatedAt) {
    return right;
  }

  if (right.lastUpdatedAt < left.lastUpdatedAt) {
    return left;
  }

  return right.lastSourceId > left.lastSourceId ? right : left;
}

export async function loadAniListMangaSyncBoundary(client: Queryable): Promise<SyncBoundary> {
  const result = await client.query<SyncBoundaryRow>(
    `
      SELECT last_source_updated_at, last_source_id
      FROM sync_boundaries
      WHERE source_name = 'anilist'
        AND source_entity_type = 'media'
        AND media_type = 'manga'
      LIMIT 1
    `,
  );

  if (result.rowCount !== 1) {
    return EMPTY_SYNC_BOUNDARY;
  }

  return {
    lastUpdatedAt: Number(result.rows[0].last_source_updated_at),
    lastSourceId: Number(result.rows[0].last_source_id),
  };
}

export async function saveAniListMangaSyncBoundary(
  client: Queryable,
  boundary: SyncBoundary,
): Promise<void> {
  await client.query(
    `
      INSERT INTO sync_boundaries (
        source_name,
        source_entity_type,
        media_type,
        last_source_updated_at,
        last_source_id,
        last_completed_at
      )
      VALUES ('anilist', 'media', 'manga', $1, $2, NOW())
      ON CONFLICT (source_name, source_entity_type, media_type) DO UPDATE
      SET last_source_updated_at = EXCLUDED.last_source_updated_at,
          last_source_id = EXCLUDED.last_source_id,
          last_completed_at = EXCLUDED.last_completed_at,
          updated_at = NOW()
    `,
    [boundary.lastUpdatedAt, boundary.lastSourceId],
  );
}
