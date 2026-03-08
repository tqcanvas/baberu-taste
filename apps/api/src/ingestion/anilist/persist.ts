import type { Client } from "pg";

import type { MappedAniListRecord, PersistPageResult } from "./types.js";

interface ContentItemRow {
  content_item_id: string;
}

function getContentItemValues(record: MappedAniListRecord): Array<boolean | number | string | null> {
  return [
    record.contentItem.mediaType,
    record.contentItem.displayTitle,
    record.contentItem.descriptionShort,
    record.contentItem.imageUrl,
    record.contentItem.bannerImageUrl,
    record.contentItem.averageScore,
    record.contentItem.popularity,
    record.contentItem.favourites,
    record.contentItem.status,
    record.contentItem.format,
    record.contentItem.countryOfOrigin,
    record.contentItem.isAdult,
    record.contentItem.startYear,
    record.contentItem.startMonth,
    record.contentItem.startDay,
    record.contentItem.endYear,
    record.contentItem.endMonth,
    record.contentItem.endDay,
  ];
}

async function findExistingContentItemId(
  client: Client,
  record: MappedAniListRecord,
): Promise<number | null> {
  const result = await client.query<ContentItemRow>(
    `
      SELECT content_item_id
      FROM sources
      WHERE source_name = $1
        AND source_entity_type = $2
        AND source_id = $3
      LIMIT 1
    `,
    [record.source.sourceName, record.source.sourceEntityType, record.source.sourceId],
  );

  if (result.rowCount !== 1) {
    return null;
  }

  return Number(result.rows[0].content_item_id);
}

async function insertContentItem(client: Client, record: MappedAniListRecord): Promise<number> {
  const result = await client.query<{ id: string }>(
    `
      INSERT INTO content_items (
        media_type,
        display_title,
        description_short,
        image_url,
        banner_image_url,
        average_score,
        popularity,
        favourites,
        status,
        format,
        country_of_origin,
        is_adult,
        start_year,
        start_month,
        start_day,
        end_year,
        end_month,
        end_day
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16, $17, $18
      )
      RETURNING id
    `,
    getContentItemValues(record),
  );

  return Number(result.rows[0].id);
}

async function updateContentItem(
  client: Client,
  contentItemId: number,
  record: MappedAniListRecord,
): Promise<void> {
  await client.query(
    `
      UPDATE content_items
      SET media_type = $1,
          display_title = $2,
          description_short = $3,
          image_url = $4,
          banner_image_url = $5,
          average_score = $6,
          popularity = $7,
          favourites = $8,
          status = $9,
          format = $10,
          country_of_origin = $11,
          is_adult = $12,
          start_year = $13,
          start_month = $14,
          start_day = $15,
          end_year = $16,
          end_month = $17,
          end_day = $18,
          updated_at = NOW()
      WHERE id = $19
    `,
    [...getContentItemValues(record), contentItemId],
  );
}

async function upsertMangaDetails(
  client: Client,
  contentItemId: number,
  record: MappedAniListRecord,
): Promise<void> {
  await client.query(
    `
      INSERT INTO manga_details (content_item_id, chapters, volumes, source_material)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (content_item_id) DO UPDATE
      SET chapters = EXCLUDED.chapters,
          volumes = EXCLUDED.volumes,
          source_material = EXCLUDED.source_material
    `,
    [
      contentItemId,
      record.mangaDetails.chapters,
      record.mangaDetails.volumes,
      record.mangaDetails.sourceMaterial,
    ],
  );
}

async function insertSource(
  client: Client,
  contentItemId: number,
  record: MappedAniListRecord,
): Promise<void> {
  await client.query(
    `
      INSERT INTO sources (
        content_item_id,
        source_name,
        source_entity_type,
        source_id,
        source_url,
        source_updated_at,
        last_fetched_at,
        payload_hash,
        raw_payload
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8::jsonb)
    `,
    [
      contentItemId,
      record.source.sourceName,
      record.source.sourceEntityType,
      record.source.sourceId,
      record.source.sourceUrl,
      record.source.sourceUpdatedAt,
      record.payloadHash,
      JSON.stringify(record.rawPayload),
    ],
  );
}

async function updateSource(
  client: Client,
  contentItemId: number,
  record: MappedAniListRecord,
): Promise<void> {
  await client.query(
    `
      UPDATE sources
      SET content_item_id = $1,
          source_url = $2,
          source_updated_at = $3,
          last_fetched_at = NOW(),
          payload_hash = $4,
          raw_payload = $5::jsonb,
          updated_at = NOW()
      WHERE source_name = $6
        AND source_entity_type = $7
        AND source_id = $8
    `,
    [
      contentItemId,
      record.source.sourceUrl,
      record.source.sourceUpdatedAt,
      record.payloadHash,
      JSON.stringify(record.rawPayload),
      record.source.sourceName,
      record.source.sourceEntityType,
      record.source.sourceId,
    ],
  );
}

async function replaceTitles(
  client: Client,
  contentItemId: number,
  record: MappedAniListRecord,
): Promise<void> {
  await client.query("DELETE FROM content_titles WHERE content_item_id = $1", [contentItemId]);

  for (const title of record.titles) {
    await client.query(
      `
        INSERT INTO content_titles (
          content_item_id,
          title_type,
          title,
          normalized_title,
          is_primary,
          sort_order
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        contentItemId,
        title.titleType,
        title.title,
        title.normalizedTitle,
        title.isPrimary,
        title.sortOrder,
      ],
    );
  }
}

export async function persistAniListPage(
  client: Client,
  records: MappedAniListRecord[],
): Promise<PersistPageResult> {
  const result: PersistPageResult = {
    insertedCount: 0,
    updatedCount: 0,
    titleRowsWritten: 0,
  };

  for (const record of records) {
    const existingContentItemId = await findExistingContentItemId(client, record);
    const contentItemId = existingContentItemId ?? (await insertContentItem(client, record));

    if (existingContentItemId) {
      result.updatedCount += 1;
      await updateContentItem(client, contentItemId, record);
      await updateSource(client, contentItemId, record);
    } else {
      result.insertedCount += 1;
      await insertSource(client, contentItemId, record);
    }

    await upsertMangaDetails(client, contentItemId, record);
    await replaceTitles(client, contentItemId, record);

    result.titleRowsWritten += record.titles.length;
  }

  return result;
}

