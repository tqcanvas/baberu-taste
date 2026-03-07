import type { Client } from "pg";

import { fetchAniListMangaCatalogPage } from "../../anilist/client.js";
import { withAdvisoryLock, withDatabaseClient } from "../../db/client.js";
import { mapAniListPage } from "./map.js";
import { persistAniListPage } from "./persist.js";
import {
  loadAniListMangaCatalogSyncCheckpoint,
  markAniListMangaCatalogSyncRunning,
  resetAniListMangaCatalogSyncCheckpoint,
  saveAniListMangaCatalogSyncFailure,
  saveAniListMangaCatalogSyncSuccess,
} from "./catalog-sync-checkpoint.js";
import type {
  AniListMediaPage,
  CatalogSyncCheckpoint,
  PersistPageResult,
  SyncAniListMangaCatalogResult,
} from "./types.js";

const ANILIST_MANGA_CATALOG_LOCK_KEY_1 = 2026;
const ANILIST_MANGA_CATALOG_LOCK_KEY_2 = 1;
const ANILIST_MAX_PER_PAGE = 50;
const DEFAULT_REQUESTS_PER_MINUTE = 30;
const DEFAULT_RETRY_LIMIT = 3;
const DEFAULT_BASE_BACKOFF_MS = 2000;

export interface SyncAniListMangaCatalogOptions {
  apiUrl: string;
  databaseUrl: string;
  perPage?: number;
  requestsPerMinute?: number;
  retryLimit?: number;
  baseBackoffMs?: number;
  maxPages?: number;
  startPage?: number;
  restart?: boolean;
}

interface SyncAniListMangaCatalogLogger {
  info(event: string, fields: Record<string, unknown>): void;
  warn(event: string, fields: Record<string, unknown>): void;
  error(event: string, fields: Record<string, unknown>): void;
}

interface CatalogSyncDependencies {
  fetchPage: (apiUrl: string, page: number, perPage: number) => Promise<AniListMediaPage>;
  sleep: (milliseconds: number) => Promise<void>;
  now: () => number;
  withClient: <T>(databaseUrl: string, operation: (client: Client) => Promise<T>) => Promise<T>;
  logger: SyncAniListMangaCatalogLogger;
  loadCheckpoint: (client: Client, perPage: number) => Promise<CatalogSyncCheckpoint>;
  resetCheckpoint: (client: Client, perPage: number, startPage: number) => Promise<CatalogSyncCheckpoint>;
  markRunning: (client: Client, checkpoint: CatalogSyncCheckpoint) => Promise<CatalogSyncCheckpoint>;
  persistPage: (
    client: Client,
    page: AniListMediaPage,
    checkpoint: CatalogSyncCheckpoint,
  ) => Promise<{ persisted: PersistPageResult; checkpoint: CatalogSyncCheckpoint }>;
  saveFailure: (
    client: Client,
    checkpoint: CatalogSyncCheckpoint,
    page: number,
    errorMessage: string,
  ) => Promise<CatalogSyncCheckpoint>;
}

class RequestThrottle {
  private nextRequestAt = 0;

  constructor(
    private readonly intervalMs: number,
    private readonly now: () => number,
    private readonly sleep: (milliseconds: number) => Promise<void>,
  ) {}

  async waitTurn(): Promise<void> {
    const currentTime = this.now();
    const waitMs = Math.max(0, this.nextRequestAt - currentTime);

    if (waitMs > 0) {
      await this.sleep(waitMs);
    }

    this.nextRequestAt = Math.max(this.nextRequestAt, this.now()) + this.intervalMs;
  }
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function createConsoleLogger(): SyncAniListMangaCatalogLogger {
  function write(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>) {
    const line = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      event,
      ...fields,
    });

    if (level === "error") {
      console.error(line);
      return;
    }

    if (level === "warn") {
      console.warn(line);
      return;
    }

    console.log(line);
  }

  return {
    info(event, fields) {
      write("info", event, fields);
    },
    warn(event, fields) {
      write("warn", event, fields);
    },
    error(event, fields) {
      write("error", event, fields);
    },
  };
}

const defaultDependencies: CatalogSyncDependencies = {
  fetchPage: fetchAniListMangaCatalogPage,
  sleep: defaultSleep,
  now: Date.now,
  withClient: withDatabaseClient,
  logger: createConsoleLogger(),
  loadCheckpoint: loadAniListMangaCatalogSyncCheckpoint,
  resetCheckpoint: resetAniListMangaCatalogSyncCheckpoint,
  markRunning: markAniListMangaCatalogSyncRunning,
  persistPage: persistCatalogPage,
  saveFailure: saveAniListMangaCatalogSyncFailure,
};

function parseErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizePerPage(perPage: number | undefined): number {
  if (perPage === undefined) {
    return ANILIST_MAX_PER_PAGE;
  }

  if (!Number.isInteger(perPage) || perPage <= 0) {
    throw new Error("--per-page must be a positive integer");
  }

  return Math.min(perPage, ANILIST_MAX_PER_PAGE);
}

function normalizeRequestsPerMinute(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_REQUESTS_PER_MINUTE;
  }

  if (!Number.isInteger(value) || value <= 0 || value > DEFAULT_REQUESTS_PER_MINUTE) {
    throw new Error(`--requests-per-minute must be between 1 and ${DEFAULT_REQUESTS_PER_MINUTE}`);
  }

  return value;
}

function normalizeRetryLimit(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_RETRY_LIMIT;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new Error("--retry-limit must be a non-negative integer");
  }

  return value;
}

function isRetryableError(error: unknown): boolean {
  const message = parseErrorMessage(error).toLowerCase();
  return !message.includes("validation failed");
}

async function fetchPageWithRetries(
  options: {
    apiUrl: string;
    page: number;
    perPage: number;
    retryLimit: number;
    baseBackoffMs: number;
  },
  dependencies: CatalogSyncDependencies,
  throttle: RequestThrottle,
): Promise<AniListMediaPage> {
  for (let attempt = 1; ; attempt += 1) {
    await throttle.waitTurn();

    try {
      dependencies.logger.info("anilist.catalog.fetch.start", {
        page: options.page,
        perPage: options.perPage,
        attempt,
      });

      const result = await dependencies.fetchPage(options.apiUrl, options.page, options.perPage);

      dependencies.logger.info("anilist.catalog.fetch.success", {
        page: options.page,
        perPage: options.perPage,
        attempt,
        fetched: result.media.length,
        hasNextPage: result.pageInfo?.hasNextPage ?? null,
      });

      return result;
    } catch (error) {
      const message = parseErrorMessage(error);
      const retryable = isRetryableError(error);

      dependencies.logger.error("anilist.catalog.fetch.failure", {
        page: options.page,
        perPage: options.perPage,
        attempt,
        retryable,
        message,
      });

      if (!retryable || attempt > options.retryLimit) {
        throw error;
      }

      const backoffMs = options.baseBackoffMs * 2 ** (attempt - 1);
      dependencies.logger.warn("anilist.catalog.fetch.retry", {
        page: options.page,
        attempt,
        backoffMs,
      });
      await dependencies.sleep(backoffMs);
    }
  }
}

function getLastProcessedSourceId(page: AniListMediaPage): number | null {
  const lastMedia = page.media[page.media.length - 1];
  return lastMedia ? lastMedia.id : null;
}

async function persistCatalogPage(
  client: Client,
  page: AniListMediaPage,
  checkpoint: CatalogSyncCheckpoint,
): Promise<{ persisted: PersistPageResult; checkpoint: CatalogSyncCheckpoint }> {
  const mappedPage = mapAniListPage(page.media);

  if (mappedPage.validationErrors.length > 0) {
    const summary = mappedPage.validationErrors
      .map((error) => (error.sourceId ? `${error.sourceId}: ${error.message}` : error.message))
      .join("; ");

    throw new Error(`AniList catalog validation failed: ${summary}`);
  }

  await client.query("BEGIN");

  try {
    const persisted = await persistAniListPage(client, mappedPage.records);
    const hasNextPage = Boolean(page.pageInfo?.hasNextPage);
    const updatedCheckpoint = await saveAniListMangaCatalogSyncSuccess(
      client,
      checkpoint,
      checkpoint.nextPage + 1,
      page.media.length,
      getLastProcessedSourceId(page),
      hasNextPage ? "running" : "completed",
    );

    await client.query("COMMIT");

    return {
      persisted,
      checkpoint: updatedCheckpoint,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function syncAniListMangaCatalog(
  options: SyncAniListMangaCatalogOptions,
  dependencies: CatalogSyncDependencies = defaultDependencies,
): Promise<SyncAniListMangaCatalogResult> {
  const perPage = normalizePerPage(options.perPage);
  const requestsPerMinute = normalizeRequestsPerMinute(options.requestsPerMinute);
  const retryLimit = normalizeRetryLimit(options.retryLimit);
  const baseBackoffMs = options.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS;
  const requestIntervalMs = Math.ceil(60_000 / requestsPerMinute);
  const throttle = new RequestThrottle(requestIntervalMs, dependencies.now, dependencies.sleep);

  return dependencies.withClient(options.databaseUrl, async (client) =>
    withAdvisoryLock(client, ANILIST_MANGA_CATALOG_LOCK_KEY_1, ANILIST_MANGA_CATALOG_LOCK_KEY_2, async () => {
      let checkpoint = await dependencies.loadCheckpoint(client, perPage);

      if (options.restart || options.startPage !== undefined) {
        checkpoint = await dependencies.resetCheckpoint(
          client,
          perPage,
          options.startPage ?? 1,
        );
      }

      checkpoint = await dependencies.markRunning(client, checkpoint);

      const startPage = checkpoint.nextPage;
      let pageCount = 0;
      let fetchedCount = 0;
      let insertedCount = 0;
      let updatedCount = 0;
      let titleRowsWritten = 0;
      let stopReason: SyncAniListMangaCatalogResult["stopReason"] = "completed";

      for (let page = checkpoint.nextPage; ; page += 1) {
        if (options.maxPages !== undefined && pageCount >= options.maxPages) {
          stopReason = "max-pages";
          break;
        }

        let fetchedPage: AniListMediaPage;

        try {
          fetchedPage = await fetchPageWithRetries(
            {
              apiUrl: options.apiUrl,
              page,
              perPage,
              retryLimit,
              baseBackoffMs,
            },
            dependencies,
            throttle,
          );
        } catch (error) {
          checkpoint = await dependencies.saveFailure(
            client,
            checkpoint,
            page,
            parseErrorMessage(error),
          );
          throw error;
        }

        pageCount += 1;
        fetchedCount += fetchedPage.media.length;

        if (fetchedPage.media.length === 0) {
          checkpoint = await saveAniListMangaCatalogSyncSuccess(
            client,
            checkpoint,
            page,
            0,
            checkpoint.lastProcessedSourceId,
            "completed",
          );
          stopReason = "completed";
          break;
        }

        try {
          const persistedPage = await dependencies.persistPage(client, fetchedPage, checkpoint);

          checkpoint = persistedPage.checkpoint;
          insertedCount += persistedPage.persisted.insertedCount;
          updatedCount += persistedPage.persisted.updatedCount;
          titleRowsWritten += persistedPage.persisted.titleRowsWritten;

          dependencies.logger.info("anilist.catalog.page.persisted", {
            page,
            fetched: fetchedPage.media.length,
            inserted: persistedPage.persisted.insertedCount,
            updated: persistedPage.persisted.updatedCount,
            nextPage: checkpoint.nextPage,
            status: checkpoint.status,
          });
        } catch (error) {
          checkpoint = await dependencies.saveFailure(
            client,
            checkpoint,
            page,
            parseErrorMessage(error),
          );
          dependencies.logger.error("anilist.catalog.page.failure", {
            page,
            message: parseErrorMessage(error),
          });
          throw error;
        }

        if (!fetchedPage.pageInfo?.hasNextPage) {
          stopReason = "completed";
          break;
        }
      }

      dependencies.logger.info("anilist.catalog.complete", {
        startPage,
        endPage: checkpoint.nextPage - 1,
        pageCount,
        fetchedCount,
        insertedCount,
        updatedCount,
        titleRowsWritten,
        stopReason,
      });

      return {
        fetchedCount,
        insertedCount,
        updatedCount,
        titleRowsWritten,
        pageCount,
        startPage,
        endPage: Math.max(startPage, checkpoint.nextPage - 1),
        checkpoint,
        stopReason,
      };
    }),
  );
}
