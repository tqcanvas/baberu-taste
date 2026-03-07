const DEFAULT_ANILIST_API_URL = "https://graphql.anilist.co";
const DEFAULT_PORT = 3001;

export interface AppConfig {
  databaseUrl: string;
  aniListApiUrl: string;
  port: number;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getPort(): number {
  const rawPort = process.env.PORT?.trim();

  if (!rawPort) {
    return DEFAULT_PORT;
  }

  const parsedPort = Number.parseInt(rawPort, 10);

  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    throw new Error("PORT must be a positive integer when provided");
  }

  return parsedPort;
}

export function loadConfig(): AppConfig {
  const databaseUrl = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();

  if (!databaseUrl) {
    throw new Error("Missing required environment variable: DATABASE_URL or POSTGRES_URL");
  }

  return {
    databaseUrl,
    aniListApiUrl: process.env.ANILIST_API_URL?.trim() || DEFAULT_ANILIST_API_URL,
    port: getPort(),
  };
}
