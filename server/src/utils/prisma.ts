import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';

let client: PrismaClient | undefined;

export function db() {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is required.');
    const limit = new URL(connectionString).searchParams.get('connection_limit');
    const max = limit === null ? 10 : Number(limit);
    if (!Number.isSafeInteger(max) || max < 1) throw new Error('Invalid database connection_limit.');
    client = new PrismaClient({ adapter: new PrismaPg({ connectionString, max }) });
  }
  return client;
}
