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
