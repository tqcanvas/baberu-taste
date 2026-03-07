import { fetchAniListMangaPage } from "../anilist/client.js";
import { loadConfig } from "../config.js";
import { withDatabaseTransaction } from "../db/client.js";
import { mapAniListPage } from "../ingestion/anilist/map.js";
import { persistAniListPage } from "../ingestion/anilist/persist.js";

interface CliArgs {
  page: number;
  perPage: number;
}

function parsePositiveInteger(value: string, flagName: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive integer`);
  }

  return parsed;
}

function parseArgs(argv: string[]): CliArgs {
  let page = 1;
  let perPage = 10;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument.startsWith("--page=")) {
      page = parsePositiveInteger(argument.slice("--page=".length), "--page");
      continue;
    }

    if (argument === "--page") {
      const nextValue = argv[index + 1];

      if (!nextValue) {
        throw new Error("Missing value for --page");
      }

      page = parsePositiveInteger(nextValue, "--page");
      index += 1;
      continue;
    }

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

    throw new Error(`Unknown argument: ${argument}`);
  }

  return { page, perPage };
}

function printValidationFailureSummary(fetchedCount: number, validationErrors: string[]): void {
  console.error("AniList ingestion failed validation.");
  console.error(`Fetched: ${fetchedCount}`);
  console.error(`Validation failures: ${validationErrors.length}`);

  for (const validationError of validationErrors) {
    console.error(`- ${validationError}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig();
  const media = await fetchAniListMangaPage(config.aniListApiUrl, args.page, args.perPage);
  const mappedPage = mapAniListPage(media);

  if (mappedPage.validationErrors.length > 0) {
    const errors = mappedPage.validationErrors.map((error) =>
      error.sourceId ? `${error.sourceId}: ${error.message}` : error.message,
    );

    printValidationFailureSummary(media.length, errors);
    process.exitCode = 1;
    return;
  }

  const persisted = await withDatabaseTransaction(config.databaseUrl, (client) =>
    persistAniListPage(client, mappedPage.records),
  );

  console.log("AniList ingestion complete.");
  console.log(`Fetched: ${media.length}`);
  console.log(`Inserted: ${persisted.insertedCount}`);
  console.log(`Updated: ${persisted.updatedCount}`);
  console.log(`Titles written: ${persisted.titleRowsWritten}`);
  console.log("Validation failures: 0");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`AniList ingestion failed: ${message}`);
  process.exitCode = 1;
});

