import { createServer } from "node:http";

import { loadConfig } from "../config.js";
import { createSchemaPreviewApp } from "./app.js";

const config = loadConfig();
const app = createSchemaPreviewApp(config.databaseUrl);

const server = createServer(async (request, response) => {
  const handled = await app({
    method: request.method ?? "GET",
    url: request.url ?? "/",
  });

  response.writeHead(handled.status, handled.headers);
  response.end(handled.body);
});

server.listen(config.port, () => {
  console.log(`Schema preview server listening on http://localhost:${config.port}`);
});

