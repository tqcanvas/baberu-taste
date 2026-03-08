import { Client } from "pg";

export async function withDatabaseClient<T>(
  databaseUrl: string,
  operation: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();

  try {
    return await operation(client);
  } finally {
    await client.end();
  }
}

export async function withDatabaseTransaction<T>(
  databaseUrl: string,
  operation: (client: Client) => Promise<T>,
): Promise<T> {
  return withDatabaseClient(databaseUrl, async (client) => {
    let beganTransaction = false;

    try {
      await client.query("BEGIN");
      beganTransaction = true;

      const result = await operation(client);

      await client.query("COMMIT");
      return result;
    } catch (error) {
      if (beganTransaction) {
        await client.query("ROLLBACK");
      }

      throw error;
    }
  });
}

export async function withAdvisoryLock<T>(
  client: Client,
  key1: number,
  key2: number,
  operation: () => Promise<T>,
): Promise<T> {
  const lockResult = await client.query<{ locked: boolean }>(
    "SELECT pg_try_advisory_lock($1, $2) AS locked",
    [key1, key2],
  );

  if (!lockResult.rows[0]?.locked) {
    throw new Error("Another AniList manga catalog sync is already running");
  }

  try {
    return await operation();
  } finally {
    await client.query("SELECT pg_advisory_unlock($1, $2)", [key1, key2]);
  }
}
