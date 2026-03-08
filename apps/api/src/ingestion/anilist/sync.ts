import { fetchAniListUpdatedMangaPage } from "../../anilist/client.js";
import { withDatabaseClient, withDatabaseTransaction } from "../../db/client.js";
import { mapAniListPage } from "./map.js";
import { persistAniListPage } from "./persist.js";
import {
  applySyncBoundaryOverlap,
  getNewerMediaPrefix,
  getSyncBoundaryFromMedia,
  loadAniListMangaSyncBoundary,
  maxSyncBoundary,
  saveAniListMangaSyncBoundary,
} from "./sync-boundary.js";
import type {
  AniListMedia,
  PersistPageResult,
  SyncAniListMangaResult,
  SyncBoundary,
} from "./types.js";

export interface SyncAniListMangaOptions {
  apiUrl: string;
  databaseUrl: string;
  perPage: number;
  overlapSeconds: number;
  maxPages?: number;
}

interface SyncAniListMangaDependencies {
  fetchPage: (apiUrl: string, page: number, perPage: number) => Promise<AniListMedia[]>;
  loadBoundary: (databaseUrl: string) => Promise<SyncBoundary>;
  persistPage: (databaseUrl: string, mediaList: AniListMedia[]) => Promise<PersistPageResult>;
  saveBoundary: (databaseUrl: string, boundary: SyncBoundary) => Promise<void>;
}

const defaultDependencies: SyncAniListMangaDependencies = {
  fetchPage: fetchAniListUpdatedMangaPage,
  loadBoundary: (databaseUrl) =>
    withDatabaseClient(databaseUrl, (client) => loadAniListMangaSyncBoundary(client)),
  persistPage: async (databaseUrl, mediaList) => {
    const mappedPage = mapAniListPage(mediaList);

    if (mappedPage.validationErrors.length > 0) {
      const summary = mappedPage.validationErrors
        .map((error) => (error.sourceId ? `${error.sourceId}: ${error.message}` : error.message))
        .join("; ");

      throw new Error(`AniList sync validation failed: ${summary}`);
    }

    return withDatabaseTransaction(databaseUrl, (client) =>
      persistAniListPage(client, mappedPage.records),
    );
  },
  saveBoundary: (databaseUrl, boundary) =>
    withDatabaseTransaction(databaseUrl, (client) => saveAniListMangaSyncBoundary(client, boundary)),
};

export async function syncAniListMangaUpdates(
  options: SyncAniListMangaOptions,
  dependencies: SyncAniListMangaDependencies = defaultDependencies,
): Promise<SyncAniListMangaResult> {
  const boundaryBefore = await dependencies.loadBoundary(options.databaseUrl);
  const effectiveBoundary = applySyncBoundaryOverlap(boundaryBefore, options.overlapSeconds);

  let boundaryAfter = boundaryBefore;
  let boundarySaved = false;
  let fetchedCount = 0;
  let processedCount = 0;
  let insertedCount = 0;
  let updatedCount = 0;
  let titleRowsWritten = 0;
  let pageCount = 0;
  let stopReason: SyncAniListMangaResult["stopReason"] = "exhausted";

  for (let page = 1; ; page += 1) {
    if (options.maxPages !== undefined && page > options.maxPages) {
      stopReason = "max-pages";
      break;
    }

    const mediaList = await dependencies.fetchPage(options.apiUrl, page, options.perPage);

    pageCount += 1;
    fetchedCount += mediaList.length;

    if (mediaList.length === 0) {
      stopReason = "exhausted";
      break;
    }

    const processableMedia = getNewerMediaPrefix(mediaList, effectiveBoundary);

    if (processableMedia.length === 0) {
      stopReason = "boundary";
      break;
    }

    const persisted = await dependencies.persistPage(options.databaseUrl, processableMedia);

    processedCount += processableMedia.length;
    insertedCount += persisted.insertedCount;
    updatedCount += persisted.updatedCount;
    titleRowsWritten += persisted.titleRowsWritten;
    boundaryAfter = maxSyncBoundary(boundaryAfter, getSyncBoundaryFromMedia(processableMedia[0]));

    if (processableMedia.length < mediaList.length) {
      stopReason = "boundary";
      break;
    }
  }

  if (stopReason !== "max-pages") {
    await dependencies.saveBoundary(options.databaseUrl, boundaryAfter);
    boundarySaved = true;
  }

  return {
    fetchedCount,
    processedCount,
    insertedCount,
    updatedCount,
    titleRowsWritten,
    pageCount,
    stopReason,
    boundaryBefore,
    boundaryAfter,
    boundarySaved,
  };
}
