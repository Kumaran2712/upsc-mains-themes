import { mkdirSync, chownSync, chmodSync, existsSync, lstatSync } from 'node:fs';
import { dirname } from 'node:path';
import { readConfig } from './config.mjs';

// Railway mounts volumes as root. If launched as root for volume preparation,
// fix only the configured database paths, then drop privileges before serving HTTP.
if (process.getuid?.() === 0) {
  const config = readConfig();
  if (config.dbPath === ':memory:') throw new Error('A production container needs a persistent database path');
  const directory = dirname(config.dbPath);
  if (directory === '/' || (existsSync(directory) && lstatSync(directory).isSymbolicLink())) throw new Error('Use a dedicated database directory');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chownSync(directory, 1000, 1000); chmodSync(directory, 0o700);
  for (const path of [config.dbPath, config.dbPath + '-wal', config.dbPath + '-shm']) {
    if (!existsSync(path)) continue;
    if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()) throw new Error('The database path must be a regular file');
    chownSync(path, 1000, 1000); chmodSync(path, 0o600);
  }
  process.setgroups([]); process.setgid(1000); process.setuid(1000);
}
await import('./server.mjs');
