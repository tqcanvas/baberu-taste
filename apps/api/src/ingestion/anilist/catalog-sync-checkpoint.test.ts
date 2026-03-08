import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultCatalogSyncCheckpoint,
  loadAniListMangaCatalogSyncCheckpoint,
  saveAniListMangaCatalogSyncFailure,
  saveAniListMangaCatalogSyncSuccess,
} from "./catalog-sync-checkpoint.js";

test("createDefaultCatalogSyncCheckpoint starts from page 1", () => {
  assert.deepEqual(createDefaultCatalogSyncCheckpoint(50), {
    nextPage: 1,
    perPage: 50,
    lastProcessedSourceId: null,
    totalPagesProcessed: 0,
    totalRecordsProcessed: 0,
    status: "idle",
    failureCount: 0,
    lastError: null,
  });
});

test("loadAniListMangaCatalogSyncCheckpoint returns defaults when the row is missing", async () => {
  const fakeClient = {
    async query() {
      return {
        rowCount: 0,
        rows: [],
      };
    },
  };

  assert.deepEqual(await loadAniListMangaCatalogSyncCheckpoint(fakeClient as never, 50), {
    nextPage: 1,
    perPage: 50,
    lastProcessedSourceId: null,
    totalPagesProcessed: 0,
    totalRecordsProcessed: 0,
    status: "idle",
    failureCount: 0,
    lastError: null,
  });
});

test("saveAniListMangaCatalogSyncSuccess advances the page and clears failures", async () => {
  let capturedValues: unknown[] | undefined;

  const fakeClient = {
    async query(_sql: string, values: unknown[]) {
      capturedValues = values;
      return {
        rowCount: 1,
        rows: [
          {
            next_page: "3",
            per_page: "50",
            last_processed_source_id: "30099",
            total_pages_processed: "2",
            total_records_processed: "100",
            status: "running",
            failure_count: "0",
            last_error: null,
          },
        ],
      };
    },
  };

  const result = await saveAniListMangaCatalogSyncSuccess(
    fakeClient as never,
    createDefaultCatalogSyncCheckpoint(50),
    3,
    50,
    30099,
    "running",
  );

  assert.deepEqual(capturedValues, [3, 50, 30099, 1, 50, "running"]);
  assert.equal(result.nextPage, 3);
  assert.equal(result.totalPagesProcessed, 2);
  assert.equal(result.totalRecordsProcessed, 100);
});

test("saveAniListMangaCatalogSyncFailure keeps the current page and records the error", async () => {
  let capturedValues: unknown[] | undefined;

  const fakeClient = {
    async query(_sql: string, values: unknown[]) {
      capturedValues = values;
      return {
        rowCount: 1,
        rows: [
          {
            next_page: "4",
            per_page: "50",
            last_processed_source_id: "30149",
            total_pages_processed: "3",
            total_records_processed: "150",
            status: "failed",
            failure_count: "2",
            last_error: "fetch failed",
          },
        ],
      };
    },
  };

  const result = await saveAniListMangaCatalogSyncFailure(
    fakeClient as never,
    {
      nextPage: 4,
      perPage: 50,
      lastProcessedSourceId: 30149,
      totalPagesProcessed: 3,
      totalRecordsProcessed: 150,
      status: "running",
      failureCount: 1,
      lastError: null,
    },
    4,
    "fetch failed",
  );

  assert.deepEqual(capturedValues, [4, 50, 30149, 3, 150, "fetch failed"]);
  assert.equal(result.status, "failed");
  assert.equal(result.failureCount, 2);
  assert.equal(result.lastError, "fetch failed");
});
