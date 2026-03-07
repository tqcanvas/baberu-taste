import assert from "node:assert/strict";
import test from "node:test";

import {
  getSchemaPreviewTable,
  listSchemaPreviewTables,
  normalizePreviewLimit,
} from "./schema-preview.js";

test("listSchemaPreviewTables returns the allowed preview tables", () => {
  assert.deepEqual(
    listSchemaPreviewTables().map((table) => table.tableName),
    ["content_items", "manga_details", "content_titles", "sources", "sync_boundaries"],
  );
});

test("getSchemaPreviewTable returns null for unknown tables", () => {
  assert.equal(getSchemaPreviewTable("unknown_table"), null);
});

test("normalizePreviewLimit uses defaults and caps oversized values", () => {
  const table = getSchemaPreviewTable("content_items");

  assert.ok(table);
  assert.equal(normalizePreviewLimit(undefined, table), table.defaultLimit);
  assert.equal(normalizePreviewLimit("not-a-number", table), table.defaultLimit);
  assert.equal(normalizePreviewLimit("999", table), table.maxLimit);
  assert.equal(normalizePreviewLimit("5", table), 5);
});

