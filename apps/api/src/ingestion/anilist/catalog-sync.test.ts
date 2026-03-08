import assert from "node:assert/strict";
import test from "node:test";
import type { Client } from "pg";

import { syncAniListMangaCatalog } from "./catalog-sync.js";
import type {
  AniListMediaPage,
  CatalogSyncCheckpoint,
  PersistPageResult,
} from "./types.js";

function buildPage(page: number, hasNextPage: boolean, ids: number[]): AniListMediaPage {
  return {
    pageInfo: {
      currentPage: page,
      hasNextPage,
      lastPage: hasNextPage ? page + 1 : page,
      perPage: ids.length,
      total: ids.length,
    },
    media: ids.map((id, index) => ({
      id,
      siteUrl: `https://anilist.co/manga/${id}`,
      updatedAt: 1000 - index,
      title: {
        romaji: `Title ${id}`,
        english: `Title ${id}`,
        native: `Title ${id}`,
      },
      synonyms: [],
      description: `Description ${id}`,
      coverImage: {
        large: `https://example.com/${id}.jpg`,
      },
      bannerImage: null,
      averageScore: null,
      popularity: null,
      favourites: null,
      status: "FINISHED",
      format: "MANGA",
      countryOfOrigin: "JP",
      isAdult: false,
      startDate: null,
      endDate: null,
      chapters: null,
      volumes: null,
      source: "MANGA",
    })),
  };
}

test("syncAniListMangaCatalog resumes from the saved checkpoint and persists pages in order", async () => {
  const persistedPages: number[][] = [];
  let currentCheckpoint: CatalogSyncCheckpoint = {
    nextPage: 3,
    perPage: 50,
    lastProcessedSourceId: 30100,
    totalPagesProcessed: 2,
    totalRecordsProcessed: 100,
    status: "running",
    failureCount: 0,
    lastError: null,
  };

  const result = await syncAniListMangaCatalog(
    {
      apiUrl: "https://graphql.anilist.co",
      databaseUrl: "postgresql://example",
      maxPages: 2,
    },
    {
      async fetchPage(_apiUrl: string, page: number) {
        if (page === 3) {
          return buildPage(3, true, [30101, 30102]);
        }

        if (page === 4) {
          return buildPage(4, true, [30103, 30104]);
        }

        throw new Error(`Unexpected page ${page}`);
      },
      async sleep() {},
      now: () => 0,
      async withClient<T>(_databaseUrl: string, operation: (client: Client) => Promise<T>) {
        const fakeClient = {
          async query(sql: string) {
            if (sql.includes("pg_try_advisory_lock")) {
              return { rowCount: 1, rows: [{ locked: true }] };
            }

            return { rowCount: 1, rows: [] };
          },
        };

        return operation(fakeClient as never);
      },
      async loadCheckpoint() {
        return currentCheckpoint;
      },
      async resetCheckpoint() {
        throw new Error("resetCheckpoint should not be called");
      },
      async markRunning(_client: Client, checkpoint: CatalogSyncCheckpoint) {
        currentCheckpoint = {
          ...checkpoint,
          status: "running",
          lastError: null,
        };
        return currentCheckpoint;
      },
      async persistPage(
        _client: Client,
        page: AniListMediaPage,
        checkpoint: CatalogSyncCheckpoint,
      ): Promise<{ persisted: PersistPageResult; checkpoint: CatalogSyncCheckpoint }> {
        persistedPages.push(page.media.map((media) => media.id));
        currentCheckpoint = {
          ...checkpoint,
          nextPage: checkpoint.nextPage + 1,
          lastProcessedSourceId: page.media[page.media.length - 1]?.id ?? null,
          totalPagesProcessed: checkpoint.totalPagesProcessed + 1,
          totalRecordsProcessed: checkpoint.totalRecordsProcessed + page.media.length,
          status: "running",
          failureCount: 0,
          lastError: null,
        };

        return {
          persisted: {
            insertedCount: page.media.length,
            updatedCount: 0,
            titleRowsWritten: page.media.length * 3,
          },
          checkpoint: currentCheckpoint,
        };
      },
      async saveFailure() {
        throw new Error("saveFailure should not be called");
      },
      logger: {
        info() {},
        warn() {},
        error() {},
      },
    },
  );

  assert.equal(result.startPage, 3);
  assert.equal(result.pageCount, 2);
  assert.equal(result.stopReason, "max-pages");
  assert.equal(result.checkpoint.nextPage, 5);
  assert.equal(result.checkpoint.totalRecordsProcessed, 104);
  assert.deepEqual(persistedPages, [[30101, 30102], [30103, 30104]]);
});

test("syncAniListMangaCatalog cools down for one minute after repeated 429 responses", async () => {
  let attempt = 0;
  const sleeps: number[] = [];
  const warnings: string[] = [];
  let persisted = false;

  const result = await syncAniListMangaCatalog(
    {
      apiUrl: "https://graphql.anilist.co",
      databaseUrl: "postgresql://example",
      maxPages: 1,
      retryLimit: 1,
    },
    {
      async fetchPage() {
        attempt += 1;

        if (attempt <= 3) {
          throw new Error("AniList request failed with status 429: Too Many Requests");
        }

        return buildPage(1, true, [30001, 30002]);
      },
      async sleep(milliseconds: number) {
        sleeps.push(milliseconds);
      },
      now: () => 0,
      async withClient<T>(_databaseUrl: string, operation: (client: Client) => Promise<T>) {
        const fakeClient = {
          async query(sql: string) {
            if (sql.includes("pg_try_advisory_lock")) {
              return { rowCount: 1, rows: [{ locked: true }] };
            }
            return { rowCount: 0, rows: [] };
          },
        };

        return operation(fakeClient as never);
      },
      async loadCheckpoint() {
        return {
          nextPage: 1,
          perPage: 50,
          lastProcessedSourceId: null,
          totalPagesProcessed: 0,
          totalRecordsProcessed: 0,
          status: "idle",
          failureCount: 0,
          lastError: null,
        };
      },
      async resetCheckpoint() {
        throw new Error("resetCheckpoint should not be called");
      },
      async markRunning(_client: Client, checkpoint: CatalogSyncCheckpoint) {
        return {
          ...checkpoint,
          status: "running",
        };
      },
      async persistPage(
        _client: Client,
        _page,
        checkpoint: CatalogSyncCheckpoint,
      ): Promise<{ persisted: PersistPageResult; checkpoint: CatalogSyncCheckpoint }> {
        persisted = true;

        return {
          persisted: {
            insertedCount: 2,
            updatedCount: 0,
            titleRowsWritten: 4,
          },
          checkpoint: {
            ...checkpoint,
            nextPage: 2,
            totalPagesProcessed: checkpoint.totalPagesProcessed + 1,
            totalRecordsProcessed: checkpoint.totalRecordsProcessed + 2,
            status: "running",
          },
        };
      },
      async saveFailure() {
        throw new Error("saveFailure should not be called when cooldown recovers");
      },
      logger: {
        info() {},
        warn(event: string, fields: Record<string, unknown>) {
          warnings.push(`${event}:${String(fields.cooldownMs ?? fields.backoffMs ?? "")}`);
        },
        error() {},
      },
    },
  );

  assert.equal(attempt, 4);
  assert.equal(persisted, true);
  assert.equal(result.pageCount, 1);
  assert.deepEqual(sleeps.slice(0, 3), [2000, 3000, 60_000]);
  assert.ok(sleeps.includes(60_000));
  assert.ok(warnings.includes("anilist.catalog.fetch.cooldown:60000"));
});
