import { inject } from 'vitest';

const testDatabaseUrl = inject('testDatabaseUrl');
process.env.DATABASE_URL = testDatabaseUrl;
process.env.DATABASE_URL_TEST = testDatabaseUrl;
