import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { PostgresDatabase } from '../backend/postgres.mjs';

export async function migrateSqlite(sourcePath, databaseUrl) {
const sqlite = new DatabaseSync(sourcePath, { readOnly: true }), target = new PostgresDatabase(databaseUrl);
try {
  await target.migrate();
  if (sqlite.prepare("SELECT count(*) AS n FROM operations WHERE state='running'").get().n) throw new Error('Source has unresolved operations; drain/reconcile them first');
  const tables = ['users', 'conversations', 'messages', 'operations', 'counters', 'roadmap_progress', 'practice_attempts', 'map_attempts', 'import_receipts', 'ai_spend', 'assessment_attempts'];
  const counts = {};
  await target.transaction(async () => {
    for (const table of [...tables, 'sessions']) if ((await target.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n !== 0) throw new Error('Target must be empty; refusing to merge learner databases');
    for (const table of tables) {
      const columns = (await target.query('SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 ORDER BY ordinal_position', [table])).rows.map((r) => r.column_name);
      if (!sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)) { counts[table] = 0; continue; }
      const expectedRows = [];
      const sourceColumns = new Set(sqlite.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
      for (const row of sqlite.prepare(`SELECT * FROM ${table}`).iterate()) {
        const values = columns.map((column) => sourceColumns.has(column) ? row[column] : column === 'lease_expires' ? row.created + 180000 : column === 'generation' ? 1 : null);
        expectedRows.push(JSON.stringify(values));
        await target.query(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${values.map((_, i) => '$' + (i + 1)).join(',')})`, values);
      }
      counts[table] = sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get().n;
      if ((await target.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n !== counts[table]) throw new Error('Row-count mismatch: ' + table);
      const actualRows = (await target.query(`SELECT ${columns.join(',')} FROM ${table}`)).rows.map((row) => JSON.stringify(columns.map((column) => row[column])));
      const fingerprint = (rows) => createHash('sha256').update(JSON.stringify(rows.sort())).digest('hex');
      if (fingerprint(expectedRows) !== fingerprint(actualRows)) throw new Error('Record hash mismatch: ' + table);
    }
    await target.query("SELECT setval(pg_get_serial_sequence('messages','id'), COALESCE((SELECT max(id) FROM messages), 1), EXISTS(SELECT 1 FROM messages))");
  });
  return { imported: counts, verification: 'Every imported row matched its canonical hash', sessions: 'Fresh login required; hashes and accounts preserved', source: 'Left read-only' };
} finally { sqlite.close(); await target.close(); }

}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  if (!process.env.DATABASE_URL || !process.argv.includes('--write-paused')) throw new Error('Set DATABASE_URL and confirm --write-paused after stopping/draining the pilot. Use a consistent SQLite backup.');
  const sourcePath = process.argv[2]; if (!sourcePath || sourcePath.startsWith('--')) throw new Error('Pass the backed-up SQLite path first');
  console.log(JSON.stringify(await migrateSqlite(sourcePath, process.env.DATABASE_URL)));
}
