import assert from "node:assert/strict";
import test from "node:test";

import { createSchemaPreviewApp } from "./app.js";

const TABLES = [
  {
    tableName: "content_items",
    displayName: "Content Items",
    description: "Shared catalog rows for ingested media entries.",
    defaultLimit: 20,
    maxLimit: 100,
  },
  {
    tableName: "sources",
    displayName: "Sources",
    description: "External source identities and fetch metadata for ingested rows.",
    defaultLimit: 20,
    maxLimit: 100,
  },
] as const;

test("GET /health returns a health response", async () => {
  const app = createSchemaPreviewApp("postgresql://example");
  const response = await app({ method: "GET", url: "/health" });

  assert.equal(response.status, 200);
  assert.match(response.body, /"status": "ok"/);
});

test("GET /schema returns the previewable tables", async () => {
  const app = createSchemaPreviewApp("postgresql://example", {
    listTables: () => [...TABLES],
  });
  const response = await app({ method: "GET", url: "/schema" });

  assert.equal(response.status, 200);
  assert.match(response.body, /content_items/);
  assert.match(response.body, /sources/);
});

test("GET /schema/:table/rows clamps the limit and returns preview rows", async () => {
  const seen: Array<{ tableName: string; limit: number }> = [];
  const app = createSchemaPreviewApp("postgresql://example", {
    listTables: () => [...TABLES],
    getTable: (tableName) => TABLES.find((table) => table.tableName === tableName) ?? null,
    async fetchRows(tableName, limit) {
      seen.push({ tableName, limit });

      return {
        table: TABLES[0],
        limit,
        columns: ["id", "display_title"],
        rows: [{ id: 1, display_title: "Monster" }],
      };
    },
  });

  const response = await app({
    method: "GET",
    url: "/schema/content_items/rows?limit=999",
  });

  assert.equal(response.status, 200);
  assert.deepEqual(seen, [{ tableName: "content_items", limit: 100 }]);
  assert.match(response.body, /Monster/);
});

test("GET / returns HTML preview and escapes row values", async () => {
  const app = createSchemaPreviewApp("postgresql://example", {
    listTables: () => [...TABLES],
    getTable: (tableName) => TABLES.find((table) => table.tableName === tableName) ?? null,
    async fetchRows(_tableName, limit) {
      return {
        table: TABLES[0],
        limit,
        columns: ["display_title"],
        rows: [{ display_title: "<script>alert(1)</script>" }],
      };
    },
  });

  const response = await app({
    method: "GET",
    url: "/?table=content_items&limit=5",
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers["content-type"], "text/html; charset=utf-8");
  assert.match(response.body, /Schema Preview/);
  assert.doesNotMatch(response.body, /<script>alert\(1\)<\/script>/);
  assert.match(response.body, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test("GET /schema/:table/rows returns 404 for unknown tables", async () => {
  const app = createSchemaPreviewApp("postgresql://example", {
    listTables: () => [...TABLES],
    getTable: () => null,
  });
  const response = await app({ method: "GET", url: "/schema/unknown/rows" });

  assert.equal(response.status, 404);
  assert.match(response.body, /Unknown preview table/);
});

