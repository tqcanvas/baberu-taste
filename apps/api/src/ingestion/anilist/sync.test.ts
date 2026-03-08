import assert from "node:assert/strict";
import test from "node:test";

import { syncAniListMangaUpdates } from "./sync.js";
import type { AniListMedia, PersistPageResult, SyncBoundary } from "./types.js";

function buildMedia(overrides: Partial<AniListMedia> = {}): AniListMedia {
  return {
    id: 1,
    siteUrl: "https://anilist.co/manga/1",
    updatedAt: 100,
    title: {
      romaji: "Default Romaji",
      english: "Default English",
      native: "Default Native",
    },
    synonyms: [],
    description: "Default description",
    coverImage: {
      large: "https://example.com/cover.jpg",
    },
    bannerImage: "https://example.com/banner.jpg",
    averageScore: 80,
    popularity: 1000,
    favourites: 200,
    status: "FINISHED",
    format: "MANGA",
    countryOfOrigin: "JP",
    isAdult: false,
    startDate: {
      year: 2001,
      month: 1,
      day: 1,
    },
    endDate: {
      year: 2005,
      month: 12,
      day: 31,
    },
    chapters: 108,
    volumes: 27,
    source: "MANGA",
    ...overrides,
  };
}

test("syncAniListMangaUpdates persists only newer rows and saves the newest boundary", async () => {
  const boundaryBefore: SyncBoundary = {
    lastUpdatedAt: 100,
    lastSourceId: 50,
  };
  const persistedPages: number[][] = [];
  const savedBoundaries: SyncBoundary[] = [];

  const result = await syncAniListMangaUpdates(
    {
      apiUrl: "https://graphql.anilist.co",
      databaseUrl: "postgresql://example",
      perPage: 50,
      overlapSeconds: 0,
    },
    {
      async fetchPage() {
        return [
          buildMedia({ id: 700, updatedAt: 102 }),
          buildMedia({ id: 60, updatedAt: 100 }),
          buildMedia({ id: 50, updatedAt: 100 }),
          buildMedia({ id: 40, updatedAt: 100 }),
        ];
      },
      async loadBoundary() {
        return boundaryBefore;
      },
      async persistPage(_databaseUrl: string, mediaList: AniListMedia[]): Promise<PersistPageResult> {
        persistedPages.push(mediaList.map((media) => media.id));

        return {
          insertedCount: mediaList.length,
          updatedCount: 0,
          titleRowsWritten: mediaList.length * 3,
        };
      },
      async saveBoundary(_databaseUrl: string, boundary: SyncBoundary) {
        savedBoundaries.push(boundary);
      },
    },
  );

  assert.deepEqual(persistedPages, [[700, 60]]);
  assert.deepEqual(savedBoundaries, [{ lastUpdatedAt: 102, lastSourceId: 700 }]);
  assert.equal(result.fetchedCount, 4);
  assert.equal(result.processedCount, 2);
  assert.equal(result.insertedCount, 2);
  assert.equal(result.updatedCount, 0);
  assert.equal(result.stopReason, "boundary");
  assert.equal(result.boundarySaved, true);
});

test("syncAniListMangaUpdates does not advance the boundary when max-pages stops the run early", async () => {
  const savedBoundaries: SyncBoundary[] = [];

  const result = await syncAniListMangaUpdates(
    {
      apiUrl: "https://graphql.anilist.co",
      databaseUrl: "postgresql://example",
      perPage: 2,
      overlapSeconds: 0,
      maxPages: 1,
    },
    {
      async fetchPage(_apiUrl: string, page: number) {
        if (page === 1) {
          return [buildMedia({ id: 900, updatedAt: 200 }), buildMedia({ id: 800, updatedAt: 190 })];
        }

        return [buildMedia({ id: 700, updatedAt: 180 })];
      },
      async loadBoundary() {
        return {
          lastUpdatedAt: 0,
          lastSourceId: 0,
        };
      },
      async persistPage(_databaseUrl: string, mediaList: AniListMedia[]): Promise<PersistPageResult> {
        return {
          insertedCount: mediaList.length,
          updatedCount: 0,
          titleRowsWritten: mediaList.length,
        };
      },
      async saveBoundary(_databaseUrl: string, boundary: SyncBoundary) {
        savedBoundaries.push(boundary);
      },
    },
  );

  assert.equal(result.stopReason, "max-pages");
  assert.equal(result.boundarySaved, false);
  assert.equal(result.processedCount, 2);
  assert.deepEqual(savedBoundaries, []);
  assert.deepEqual(result.boundaryAfter, {
    lastUpdatedAt: 200,
    lastSourceId: 900,
  });
});
