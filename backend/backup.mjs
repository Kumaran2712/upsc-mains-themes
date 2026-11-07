import { resolve, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { readConfig } from './config.mjs';
import { Store } from './store.mjs';

const config = readConfig();
if (config.databaseUrl) throw new Error('PostgreSQL is active: use pg_dump; refusing to back up the inactive SQLite database.');
const target = resolve(process.argv[2] || `backend/var/backups/stage0-${new Date().toISOString().replaceAll(':', '-')}.sqlite`);
if (target === config.dbPath) throw new Error('The backup destination must differ from the active database');
mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
const store = new Store(config.dbPath);
try { await store.backup(target); console.log(`Consistent SQLite backup written to ${target}`); }
finally { store.close(); }
