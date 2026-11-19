import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import type { TestProject } from 'vitest/node';
import { z } from 'zod';

const postgresUrl = z.url({ protocol: /^postgres(ql)?$/ }).transform((value, context) => {
  try {
    return decodeURIComponent(new URL(value).pathname.slice(1));
  } catch {
    context.addIssue({ code: 'custom', message: 'Invalid database name.' });
    return z.NEVER;
  }
});

export default function setup(project: TestProject) {
  const serverDirectory = new URL('../../', import.meta.url);
  const envFile = new URL('.env', serverDirectory);
  if (existsSync(envFile)) loadEnvFile(envFile);

  const { DATABASE_URL, DATABASE_URL_TEST, npm_execpath } = process.env;
  if (!DATABASE_URL_TEST) {
    throw new Error('DATABASE_URL_TEST is required to run tests.');
  }
  if (DATABASE_URL_TEST === DATABASE_URL) {
    throw new Error('DATABASE_URL_TEST must differ from DATABASE_URL.');
  }
  const testDatabase = postgresUrl.safeParse(DATABASE_URL_TEST);
  if (!testDatabase.success || testDatabase.data !== 'campusconnect_test') {
    throw new Error('DATABASE_URL_TEST must target the PostgreSQL database campusconnect_test.');
  }
  if (DATABASE_URL) {
    const devDatabase = postgresUrl.safeParse(DATABASE_URL);
    if (!devDatabase.success || !devDatabase.data || devDatabase.data === testDatabase.data) {
      throw new Error('DATABASE_URL must identify a separate PostgreSQL development database.');
    }
  }
  if (!npm_execpath) {
    throw new Error('Run the test suite with npm test.');
  }

  try {
    execFileSync(process.execPath, [npm_execpath, 'run', 'db:deploy', '--silent'], {
      cwd: serverDirectory,
      env: { ...process.env, DATABASE_URL: DATABASE_URL_TEST },
      stdio: 'ignore',
      timeout: 30_000,
    });
  } catch {
    throw new Error('Test database migration failed. Check that PostgreSQL is running and the test credentials are correct.');
  }

  project.provide('testDatabaseUrl', DATABASE_URL_TEST);
}

declare module 'vitest' {
  interface ProvidedContext {
    testDatabaseUrl: string;
  }
}
