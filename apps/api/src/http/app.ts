import {
  fetchSchemaPreviewRows,
  getSchemaPreviewTable,
  listSchemaPreviewTables,
  normalizePreviewLimit,
  type SchemaPreviewRows,
  type SchemaPreviewTable,
  type SchemaPreviewTableName,
} from "../db/schema-preview.js";

export interface HttpRequestContext {
  method: string;
  url: string;
}

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

interface SchemaPreviewAppDependencies {
  listTables: () => SchemaPreviewTable[];
  getTable: (tableName: string) => SchemaPreviewTable | null;
  fetchRows: (tableName: SchemaPreviewTableName, limit: number) => Promise<SchemaPreviewRows>;
}

function jsonResponse(status: number, payload: unknown): HttpResponse {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload, null, 2),
  };
}

function htmlResponse(status: number, html: string): HttpResponse {
  return {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
    body: html,
  };
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderRowsTable(preview: SchemaPreviewRows): string {
  if (preview.rows.length === 0) {
    return "<p>No rows available.</p>";
  }

  const headCells = preview.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("");
  const bodyRows = preview.rows
    .map((row) => {
      const cells = preview.columns
        .map((column) => `<td>${escapeHtml(row[column] ?? "")}</td>`)
        .join("");

      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `
    <table>
      <thead>
        <tr>${headCells}</tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
  `;
}

function renderIndexPage(
  tables: SchemaPreviewTable[],
  selectedTable: SchemaPreviewTable,
  preview: SchemaPreviewRows,
): string {
  const links = tables
    .map((table) => {
      const isSelected = table.tableName === selectedTable.tableName;
      const label = isSelected ? `<strong>${escapeHtml(table.displayName)}</strong>` : escapeHtml(table.displayName);

      return `
        <li>
          <a href="/?table=${encodeURIComponent(table.tableName)}&limit=${preview.limit}">${label}</a>
          <span>(${escapeHtml(table.tableName)})</span>
        </li>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Schema Preview</title>
        <style>
          body {
            margin: 0;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            background: #f5f0e5;
            color: #1f1c17;
          }
          main {
            max-width: 1200px;
            margin: 0 auto;
            padding: 24px;
          }
          a {
            color: #7d3d19;
          }
          .card {
            background: #fffaf2;
            border: 1px solid #d7c5aa;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 16px;
          }
          ul {
            padding-left: 18px;
            margin: 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          th,
          td {
            border: 1px solid #d7c5aa;
            padding: 8px;
            text-align: left;
            vertical-align: top;
          }
          th {
            background: #efe0c7;
          }
        </style>
      </head>
      <body>
        <main>
          <div class="card">
            <h1>Schema Preview</h1>
            <p>Read-only preview of local Postgres tables.</p>
            <p>
              JSON endpoints:
              <a href="/schema">/schema</a>
              and
              <a href="/schema/${encodeURIComponent(selectedTable.tableName)}/rows?limit=${preview.limit}">
                /schema/${escapeHtml(selectedTable.tableName)}/rows
              </a>
            </p>
          </div>
          <div class="card">
            <h2>Tables</h2>
            <ul>${links}</ul>
          </div>
          <div class="card">
            <h2>${escapeHtml(selectedTable.displayName)}</h2>
            <p>${escapeHtml(selectedTable.description)}</p>
            <p>Showing up to ${escapeHtml(preview.limit)} rows from <code>${escapeHtml(selectedTable.tableName)}</code>.</p>
            ${renderRowsTable(preview)}
          </div>
        </main>
      </body>
    </html>
  `;
}

export function createSchemaPreviewApp(
  databaseUrl: string,
  dependencies: Partial<SchemaPreviewAppDependencies> = {},
): (request: HttpRequestContext) => Promise<HttpResponse> {
  const listTables = dependencies.listTables ?? listSchemaPreviewTables;
  const getTable = dependencies.getTable ?? getSchemaPreviewTable;
  const fetchRows =
    dependencies.fetchRows ??
    ((tableName, limit) => fetchSchemaPreviewRows(databaseUrl, tableName, limit));

  return async (request) => {
    if (request.method !== "GET") {
      return jsonResponse(405, { error: "Method not allowed" });
    }

    const url = new URL(request.url, "http://localhost");
    const tables = listTables();

    if (url.pathname === "/health") {
      return jsonResponse(200, { status: "ok" });
    }

    if (url.pathname === "/schema") {
      return jsonResponse(200, { tables });
    }

    if (url.pathname === "/") {
      const fallbackTable = tables[0];
      const selectedTable =
        getTable(url.searchParams.get("table") ?? "") ?? fallbackTable;
      const limit = normalizePreviewLimit(url.searchParams.get("limit"), selectedTable);
      const preview = await fetchRows(selectedTable.tableName, limit);

      return htmlResponse(200, renderIndexPage(tables, selectedTable, preview));
    }

    const schemaRowsMatch = url.pathname.match(/^\/schema\/([^/]+)\/rows$/);

    if (schemaRowsMatch) {
      const tableName = decodeURIComponent(schemaRowsMatch[1]);
      const table = getTable(tableName);

      if (!table) {
        return jsonResponse(404, { error: `Unknown preview table: ${tableName}` });
      }

      const limit = normalizePreviewLimit(url.searchParams.get("limit"), table);
      const preview = await fetchRows(table.tableName, limit);

      return jsonResponse(200, preview);
    }

    return jsonResponse(404, { error: "Not found" });
  };
}

