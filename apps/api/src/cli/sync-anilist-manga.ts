import { loadConfig } from "../config.js";
import { syncAniListMangaUpdates } from "../ingestion/anilist/sync.js";

interface CliArgs {
  perPage: number;
  overlapSeconds: number;
  maxPages?: number;
}

function parsePositiveInteger(value: string, flagName: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive integer`);
  }

  return parsed;
}

function parseNonNegativeInteger(value: string, flagName: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${flagName} must be a non-negative integer`);
  }

  return parsed;
}

function parseArgs(argv: string[]): CliArgs {
  let perPage = 50;
  let overlapSeconds = 3600;
  let maxPages: number | undefined;

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

    if (argument.startsWith("--overlap-seconds=")) {
      overlapSeconds = parseNonNegativeInteger(
        argument.slice("--overlap-seconds=".length),
        "--overlap-seconds",
      );
      continue;
    }

    if (argument === "--overlap-seconds") {
      const nextValue = argv[index + 1];

      if (!nextValue) {
        throw new Error("Missing value for --overlap-seconds");
      }

      overlapSeconds = parseNonNegativeInteger(nextValue, "--overlap-seconds");
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

    throw new Error(`Unknown argument: ${argument}`);
  }

  return {
    perPage,
    overlapSeconds,
    maxPages,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const result = await syncAniListMangaUpdates({
    apiUrl: config.aniListApiUrl,
    databaseUrl: config.databaseUrl,
    perPage: args.perPage,
    overlapSeconds: args.overlapSeconds,
    maxPages: args.maxPages,
  });

  console.log("AniList manga sync complete.");
  console.log(`Fetched: ${result.fetchedCount}`);
  console.log(`Processed: ${result.processedCount}`);
  console.log(`Inserted: ${result.insertedCount}`);
  console.log(`Updated: ${result.updatedCount}`);
  console.log(`Titles written: ${result.titleRowsWritten}`);
  console.log(`Pages fetched: ${result.pageCount}`);
  console.log(`Stop reason: ${result.stopReason}`);
  console.log(`Boundary before: ${result.boundaryBefore.lastUpdatedAt}/${result.boundaryBefore.lastSourceId}`);
  console.log(`Boundary after: ${result.boundaryAfter.lastUpdatedAt}/${result.boundaryAfter.lastSourceId}`);
  console.log(`Boundary saved: ${result.boundarySaved ? "yes" : "no"}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`AniList manga sync failed: ${message}`);
  process.exitCode = 1;
});
