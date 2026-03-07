import { loadConfig } from "../config.js";
import { syncAniListMangaCatalog } from "../ingestion/anilist/catalog-sync.js";

interface CliArgs {
  perPage: number;
  requestsPerMinute: number;
  retryLimit: number;
  maxPages?: number;
  startPage?: number;
  restart: boolean;
}

function parsePositiveInteger(value: string, flagName: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive integer`);
  }

  return parsed;
}

function parseArgs(argv: string[]): CliArgs {
  let perPage = 50;
  let requestsPerMinute = 30;
  let retryLimit = 3;
  let maxPages: number | undefined;
  let startPage: number | undefined;
  let restart = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument.startsWith("--per-page=")) {
      perPage = parsePositiveInteger(argument.slice("--per-page=".length), "--per-page");
      continue;
    }

    if (argument === "--per-page") {
      const nextValue = argv[index + 1];

      if (!nextValue) {
        throw new Error("Missing value for --per-page");
      }

      perPage = parsePositiveInteger(nextValue, "--per-page");
      index += 1;
      continue;
    }

    if (argument.startsWith("--requests-per-minute=")) {
      requestsPerMinute = parsePositiveInteger(
        argument.slice("--requests-per-minute=".length),
        "--requests-per-minute",
      );
      continue;
    }

    if (argument === "--requests-per-minute") {
      const nextValue = argv[index + 1];

      if (!nextValue) {
        throw new Error("Missing value for --requests-per-minute");
      }

      requestsPerMinute = parsePositiveInteger(nextValue, "--requests-per-minute");
      index += 1;
      continue;
    }

    if (argument.startsWith("--retry-limit=")) {
      retryLimit = parsePositiveInteger(argument.slice("--retry-limit=".length), "--retry-limit");
      continue;
    }

    if (argument === "--retry-limit") {
      const nextValue = argv[index + 1];

      if (!nextValue) {
        throw new Error("Missing value for --retry-limit");
      }

      retryLimit = parsePositiveInteger(nextValue, "--retry-limit");
      index += 1;
      continue;
    }

    if (argument.startsWith("--max-pages=")) {
      maxPages = parsePositiveInteger(argument.slice("--max-pages=".length), "--max-pages");
      continue;
    }

    if (argument === "--max-pages") {
      const nextValue = argv[index + 1];

      if (!nextValue) {
        throw new Error("Missing value for --max-pages");
      }

      maxPages = parsePositiveInteger(nextValue, "--max-pages");
      index += 1;
      continue;
    }

    if (argument.startsWith("--start-page=")) {
      startPage = parsePositiveInteger(argument.slice("--start-page=".length), "--start-page");
      continue;
    }

    if (argument === "--start-page") {
      const nextValue = argv[index + 1];

      if (!nextValue) {
        throw new Error("Missing value for --start-page");
      }

      startPage = parsePositiveInteger(nextValue, "--start-page");
      index += 1;
      continue;
    }

    if (argument === "--restart") {
      restart = true;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return {
    perPage,
    requestsPerMinute,
    retryLimit,
    maxPages,
    startPage,
    restart,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const result = await syncAniListMangaCatalog({
    apiUrl: config.aniListApiUrl,
    databaseUrl: config.databaseUrl,
    perPage: args.perPage,
    requestsPerMinute: args.requestsPerMinute,
    retryLimit: args.retryLimit,
    maxPages: args.maxPages,
    startPage: args.startPage,
    restart: args.restart,
  });

  console.log("AniList manga catalog sync complete.");
  console.log(`Fetched: ${result.fetchedCount}`);
  console.log(`Inserted: ${result.insertedCount}`);
  console.log(`Updated: ${result.updatedCount}`);
  console.log(`Titles written: ${result.titleRowsWritten}`);
  console.log(`Pages processed: ${result.pageCount}`);
  console.log(`Start page: ${result.startPage}`);
  console.log(`End page: ${result.endPage}`);
  console.log(`Stop reason: ${result.stopReason}`);
  console.log(`Checkpoint next page: ${result.checkpoint.nextPage}`);
  console.log(`Checkpoint status: ${result.checkpoint.status}`);
  console.log(`Checkpoint total records: ${result.checkpoint.totalRecordsProcessed}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`AniList manga catalog sync failed: ${message}`);
  process.exitCode = 1;
});
