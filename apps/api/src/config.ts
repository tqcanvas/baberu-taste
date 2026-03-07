const DEFAULT_ANILIST_API_URL = "https://graphql.anilist.co";

export interface AppConfig {
  databaseUrl: string;
  aniListApiUrl: string;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function loadConfig(): AppConfig {
  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();

  if (!databaseUrl) {
    throw new Error("Missing required environment variable: DATABASE_URL or POSTGRES_URL");
  }

  return {
    databaseUrl,
    aniListApiUrl: process.env.ANILIST_API_URL?.trim() || DEFAULT_ANILIST_API_URL,
  };
}
