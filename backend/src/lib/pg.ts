// src/lib/pg.ts
import { Client } from 'pg';

let client: Client | null = null;

export async function getPgClient() {
    if (client) return client;
    client = new Client({
        connectionString: process.env.DATABASE_URL
    });
    await client.connect();
    return client;
}
