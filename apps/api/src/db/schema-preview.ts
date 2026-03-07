import type { Client } from "pg";

import { withDatabaseClient } from "./client.js";

export interface SchemaPreviewTable {
  tableName: SchemaPreviewTableName;
  displayName: string;
  description: string;
  defaultLimit: number;
  maxLimit: number;
}

interface SchemaPreviewTableDefinition extends SchemaPreviewTable {
  selectClause: string;
  orderByClause: string;
}

export type SchemaPreviewTableName =
  | "content_items"
  | "manga_details"
  | "content_titles"
  | "sources"
  | "sync_boundaries";

export interface SchemaPreviewRows {
  table: SchemaPreviewTable;
  limit: number;
  columns: string[];
  rows: Array<Record<string, unknown>>;
}

type PreviewRow = Record<string, unknown>;
type Queryable = Pick<Client, "query">;

const TABLE_DEFINITIONS: Record<SchemaPreviewTableName, SchemaPreviewTableDefinition> = {
  content_items: {
    tableName: "content_items",
    displayName: "Content Items",
    description: "Shared catalog rows for ingested media entries.",
    defaultLimit: 20,
    maxLimit: 100,
    selectClause: `
      id,
      media_type,
      display_title,
      average_score,
      popularity,
      favourites,
      status,
      format,
      country_of_origin,
      is_adult,
      created_at,
      updated_at
    `,
    orderByClause: "id DESC",
  },
  manga_details: {
    tableName: "manga_details",
    displayName: "Manga Details",
    description: "Manga-specific detail rows keyed by content item.",
    defaultLimit: 20,
    maxLimit: 100,
    selectClause: `
      content_item_id,
      chapters,
      volumes,
      source_material
    `,
    orderByClause: "content_item_id DESC",
  },
  content_titles: {
    tableName: "content_titles",
    displayName: "Content Titles",
    description: "Primary and alternate titles used for search and recognition.",
    defaultLimit: 30,
    maxLimit: 100,
    selectClause: `
      id,
      content_item_id,
      title_type,
      title,
      normalized_title,
      is_primary,
      sort_order,
      created_at
    `,
    orderByClause: "content_item_id DESC, sort_order ASC, id DESC",
  },
  sources: {
    tableName: "sources",
    displayName: "Sources",
    description: "External source identities and fetch metadata for ingested rows.",
    defaultLimit: 20,
    maxLimit: 100,
    selectClause: `
      id,
      content_item_id,
      source_name,
      source_entity_type,
      source_id,
      source_url,
      source_updated_at,
      last_fetched_at,
      payload_hash,
      CASE
        WHEN raw_payload IS NULL THEN NULL
        ELSE LEFT(raw_payload::text, 240)
      END AS raw_payload_preview,
      created_at,
      updated_at
    `,
    orderByClause: "id DESC",
  },
  sync_boundaries: {
    tableName: "sync_boundaries",
    displayName: "Sync Boundaries",
    description: "Saved AniList watermark positions used for incremental sync.",
    defaultLimit: 20,
    maxLimit: 100,
    selectClause: `
      source_name,
      source_entity_type,
      media_type,
      last_source_updated_at,
      last_source_id,
      last_completed_at,
      created_at,
      updated_at
    `,
    orderByClause: "source_name ASC, source_entity_type ASC, media_type ASC",
  },
};

function getDefinition(tableName: SchemaPreviewTableName): SchemaPreviewTableDefinition {
  return TABLE_DEFINITIONS[tableName];
}

function toPublicTable(definition: SchemaPreviewTableDefinition): SchemaPreviewTable {
  return {
    tableName: definition.tableName,
    displayName: definition.displayName,
    description: definition.description,
    defaultLimit: definition.defaultLimit,
    maxLimit: definition.maxLimit,
  };
}

function normalizeRow(row: PreviewRow): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row));
}

export function listSchemaPreviewTables(): SchemaPreviewTable[] {
  return Object.values(TABLE_DEFINITIONS).map(toPublicTable);
}

export function getSchemaPreviewTable(tableName: string): SchemaPreviewTable | null {
  if (!(tableName in TABLE_DEFINITIONS)) {
    return null;
  }

  return toPublicTable(TABLE_DEFINITIONS[tableName as SchemaPreviewTableName]);
}

export function normalizePreviewLimit(rawLimit: string | null | undefined, table: SchemaPreviewTable): number {
  if (!rawLimit) {
    return table.defaultLimit;
  }

  const parsedLimit = Number.parseInt(rawLimit, 10);

  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
    return table.defaultLimit;
  }

  return Math.min(parsedLimit, table.maxLimit);
}

async function querySchemaPreviewRows(
  client: Queryable,
  tableName: SchemaPreviewTableName,
  limit: number,
): Promise<SchemaPreviewRows> {
  const definition = getDefinition(tableName);
  const result = await client.query<PreviewRow>(
    `
      SELECT ${definition.selectClause}
      FROM ${definition.tableName}
      ORDER BY ${definition.orderByClause}
      LIMIT $1
    `,
    [limit],
  );

  const rows = result.rows.map(normalizeRow);
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return {
    table: toPublicTable(definition),
    limit,
    columns,
    rows,
  };
}

export async function fetchSchemaPreviewRows(
  databaseUrl: string,
  tableName: SchemaPreviewTableName,
  limit: number,
): Promise<SchemaPreviewRows> {
  return withDatabaseClient(databaseUrl, (client) => querySchemaPreviewRows(client, tableName, limit));
}

