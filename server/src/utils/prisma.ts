import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';

let client: PrismaClient | undefined;

export function db() {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is required.');
    client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }
  return client;
}
