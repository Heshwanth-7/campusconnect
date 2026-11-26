import { inject } from 'vitest';

const testDatabaseUrl = inject('testDatabaseUrl');
const poolUrl = new URL(testDatabaseUrl);
poolUrl.searchParams.set('connection_limit', '32');
process.env.DATABASE_URL = poolUrl.href;
process.env.DATABASE_URL_TEST = testDatabaseUrl;
