import { Pool } from "pg";

export interface ContentItemCard {
  id: number;
  displayTitle: string;
  descriptionShort: string | null;
  imageUrl: string | null;
}

interface ContentItemRow {
  id: string;
  display_title: string;
  description_short: string | null;
  image_url: string | null;
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
  const pool = getPool();
  const safeLimit = Math.max(1, Math.min(limit, 200));
  const result = await pool.query<ContentItemRow>(
    `
      SELECT id, display_title, description_short, image_url
      FROM content_items
      WHERE media_type = 'manga'
      ORDER BY popularity DESC NULLS LAST, id ASC
      LIMIT $1
    `,
    [safeLimit],
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    displayTitle: row.display_title,
    descriptionShort: row.description_short,
    imageUrl: row.image_url,
  }));
}
