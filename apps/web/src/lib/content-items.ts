import { Pool } from "pg";

export const CONTENT_ITEM_PAGE_SIZE = 12;

export interface ContentItemCard {
  id: number;
  displayTitle: string;
  descriptionShort: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
}

export interface ContentItemPage {
  items: ContentItemCard[];
  hasMore: boolean;
  nextOffset: number;
}

interface ContentItemRow {
  id: string;
  display_title: string;
  description_short: string | null;
  image_url: string | null;
  source_url: string | null;
}

declare global {
  var baberuWebPool: Pool | undefined;
}

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();

  if (!databaseUrl) {
    throw new Error("Missing required environment variable: DATABASE_URL or POSTGRES_URL");
  }

  return databaseUrl;
}

function getPool(): Pool {
  if (!globalThis.baberuWebPool) {
    globalThis.baberuWebPool = new Pool({
      connectionString: getDatabaseUrl(),
    });
  }

  return globalThis.baberuWebPool;
}

export async function listContentItems(limit = 60): Promise<ContentItemCard[]> {
  return (await listContentItemPage({ limit, offset: 0 })).items;
}

export async function listContentItemPage({
  limit = CONTENT_ITEM_PAGE_SIZE,
  offset = 0,
}: {
  limit?: number;
  offset?: number;
} = {}): Promise<ContentItemPage> {
  const pool = getPool();
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const safeOffset = Math.max(0, offset);
  const result = await pool.query<ContentItemRow>(
    `
      SELECT
        content_items.id,
        content_items.display_title,
        content_items.description_short,
        content_items.image_url,
        anilist_source.source_url
      FROM content_items
      LEFT JOIN LATERAL (
        SELECT source_url
        FROM sources
        WHERE content_item_id = content_items.id
          AND source_name = 'anilist'
          AND source_entity_type = 'media'
        LIMIT 1
      ) AS anilist_source ON TRUE
      WHERE media_type = 'manga'
      ORDER BY popularity DESC NULLS LAST, id ASC
      LIMIT $1
      OFFSET $2
    `,
    [safeLimit + 1, safeOffset],
  );

  const rows = result.rows.slice(0, safeLimit);
  const items = rows.map((row) => ({
    id: Number(row.id),
    displayTitle: row.display_title,
    descriptionShort: row.description_short,
    imageUrl: row.image_url,
    sourceUrl: row.source_url,
  }));

  return {
    items,
    hasMore: result.rows.length > safeLimit,
    nextOffset: safeOffset + items.length,
  };
}
