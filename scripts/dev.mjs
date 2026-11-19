import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const client = new URL('../client/', import.meta.url);
const server = new URL('../server/', import.meta.url);
const requireFromClient = createRequire(new URL('package.json', client));
const vite = join(dirname(requireFromClient.resolve('vite/package.json')), 'bin', 'vite.js');

const processes = [
  spawn(process.execPath, ['--env-file-if-exists=.env', '--watch', 'src/server.ts'], { cwd: server, stdio: 'inherit' }),
  spawn(process.execPath, [vite], { cwd: client, stdio: 'inherit' }),
];

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of processes) child.kill('SIGTERM');
}

for (const child of processes) {
  child.on('exit', (code) => stop(code ?? 1));
  child.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
}

process.on('SIGINT', () => stop(130));
process.on('SIGTERM', () => stop(143));
