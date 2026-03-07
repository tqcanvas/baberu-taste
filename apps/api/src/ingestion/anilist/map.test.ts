import assert from "node:assert/strict";
import test from "node:test";

import { mapAniListPage, normalizeTitle } from "./map.js";
import type { AniListMedia } from "./types.js";

function buildMedia(overrides: Partial<AniListMedia> = {}): AniListMedia {
  return {
    id: 1,
    siteUrl: "https://anilist.co/manga/1",
    updatedAt: 1_700_000_000,
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

test("normalizeTitle trims, collapses whitespace, and lowercases", () => {
  assert.equal(normalizeTitle("  Fullmetal   Alchemist "), "fullmetal alchemist");
});

test("mapAniListPage chooses the english title as primary and preserves alternates", () => {
  const media = buildMedia({
    id: 123,
    title: {
      english: "  Fullmetal   Alchemist ",
      romaji: "Hagane no Renkinjutsushi",
      native: "鋼の錬金術師",
    },
    synonyms: [" Full Metal Alchemist ", "", null],
  });

  const result = mapAniListPage([media]);

  assert.equal(result.validationErrors.length, 0);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].displayTitle, "Fullmetal Alchemist");

  const primaryTitle = result.records[0].titles.find((title) => title.isPrimary);

  assert.ok(primaryTitle);
  assert.equal(primaryTitle.titleType, "english");
  assert.equal(primaryTitle.normalizedTitle, "fullmetal alchemist");
  assert.deepEqual(
    result.records[0].titles.map((title) => title.titleType),
    ["english", "romaji", "native", "synonym"],
  );
});

test("mapAniListPage maps AniList fields into the normalized record shape", () => {
  const media = buildMedia({
    id: 456,
    description: "<p>Line one</p><br><p>Line two</p>",
    source: "LIGHT_NOVEL",
  });

  const result = mapAniListPage([media]);
  const record = result.records[0];

  assert.equal(result.validationErrors.length, 0);
  assert.equal(record.sourceId, "456");
  assert.equal(record.contentItem.mediaType, "manga");
  assert.equal(record.contentItem.descriptionShort, "Line one Line two");
  assert.equal(record.mangaDetails.sourceMaterial, "LIGHT_NOVEL");
  assert.equal(record.source.sourceName, "anilist");
  assert.equal(record.source.sourceEntityType, "media");
  assert.equal(record.source.sourceUrl, "https://anilist.co/manga/1");
  assert.ok(record.source.sourceUpdatedAt instanceof Date);
  assert.match(record.payloadHash, /^[a-f0-9]{64}$/);
});

test("mapAniListPage rejects records that do not have any usable title", () => {
  const media = buildMedia({
    id: 999,
    title: {
      english: " ",
      romaji: null,
      native: null,
    },
    synonyms: ["", "   ", null],
  });

  const result = mapAniListPage([media]);

  assert.equal(result.records.length, 0);
  assert.deepEqual(result.validationErrors, [
    {
      sourceId: "999",
      message: "AniList media is missing all candidate titles",
    },
  ]);
});

