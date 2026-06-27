import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Make sure .env.local exists with DATABASE_URL=...'
  )
}

export const client = postgres(connectionString, { prepare: false })
export const db = drizzle(client);