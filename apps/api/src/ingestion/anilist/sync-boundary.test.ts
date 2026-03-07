import assert from "node:assert/strict";
import test from "node:test";

import {
  EMPTY_SYNC_BOUNDARY,
  applySyncBoundaryOverlap,
  compareMediaToSyncBoundary,
  getNewerMediaPrefix,
  getSyncBoundaryFromMedia,
  loadAniListMangaSyncBoundary,
  maxSyncBoundary,
  saveAniListMangaSyncBoundary,
} from "./sync-boundary.js";
import type { AniListMedia } from "./types.js";

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

test("applySyncBoundaryOverlap subtracts seconds and resets the id tie-breaker", () => {
  assert.deepEqual(applySyncBoundaryOverlap({ lastUpdatedAt: 100, lastSourceId: 50 }, 30), {
    lastUpdatedAt: 70,
    lastSourceId: 0,
  });
});

test("compareMediaToSyncBoundary uses updatedAt first and source id second", () => {
  const boundary = { lastUpdatedAt: 100, lastSourceId: 50 };

  assert.equal(compareMediaToSyncBoundary(buildMedia({ updatedAt: 101, id: 1 }), boundary), 1);
  assert.equal(compareMediaToSyncBoundary(buildMedia({ updatedAt: 99, id: 999 }), boundary), -1);
  assert.equal(compareMediaToSyncBoundary(buildMedia({ updatedAt: 100, id: 60 }), boundary), 1);
  assert.equal(compareMediaToSyncBoundary(buildMedia({ updatedAt: 100, id: 40 }), boundary), -1);
  assert.equal(compareMediaToSyncBoundary(buildMedia({ updatedAt: 100, id: 50 }), boundary), 0);
});

test("getNewerMediaPrefix returns only the newer prefix of a sorted page", () => {
  const boundary = { lastUpdatedAt: 100, lastSourceId: 50 };
  const page = [
    buildMedia({ updatedAt: 102, id: 500 }),
    buildMedia({ updatedAt: 100, id: 60 }),
    buildMedia({ updatedAt: 100, id: 50 }),
    buildMedia({ updatedAt: 99, id: 999 }),
  ];

  assert.deepEqual(
    getNewerMediaPrefix(page, boundary).map((media) => media.id),
    [500, 60],
  );
});

test("maxSyncBoundary keeps the newest position", () => {
  assert.deepEqual(
    maxSyncBoundary({ lastUpdatedAt: 100, lastSourceId: 50 }, { lastUpdatedAt: 100, lastSourceId: 60 }),
    { lastUpdatedAt: 100, lastSourceId: 60 },
  );
  assert.deepEqual(
    maxSyncBoundary({ lastUpdatedAt: 100, lastSourceId: 50 }, { lastUpdatedAt: 101, lastSourceId: 1 }),
    { lastUpdatedAt: 101, lastSourceId: 1 },
  );
  assert.deepEqual(getSyncBoundaryFromMedia(buildMedia({ updatedAt: 123, id: 456 })), {
    lastUpdatedAt: 123,
    lastSourceId: 456,
  });
});

test("loadAniListMangaSyncBoundary returns an empty boundary when the row is absent", async () => {
  const fakeClient = {
    async query() {
      return {
        rowCount: 0,
        rows: [],
      };
    },
  };

  assert.deepEqual(await loadAniListMangaSyncBoundary(fakeClient as never), EMPTY_SYNC_BOUNDARY);
});

test("saveAniListMangaSyncBoundary writes the expected boundary values", async () => {
  let capturedValues: unknown[] | undefined;

  const fakeClient = {
    async query(_sql: string, values: unknown[]) {
      capturedValues = values;
      return {
        rowCount: 1,
        rows: [],
      };
    },
  };

  await saveAniListMangaSyncBoundary(fakeClient as never, {
    lastUpdatedAt: 321,
    lastSourceId: 654,
  });

  assert.deepEqual(capturedValues, [321, 654]);
});
