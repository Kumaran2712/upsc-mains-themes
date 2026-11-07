import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFile } from 'node:fs/promises';

// Application timestamps/counters are bounded safe integers, including BIGINT columns.
pg.types.setTypeParser(20, (value) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) throw new Error('Database integer exceeds safe range');
  return number;
});

export class PostgresDatabase {
  constructor(connectionString, max = 10) {
    this.pool = new pg.Pool({ connectionString, max, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000, statement_timeout: 10000 });
    this.context = new AsyncLocalStorage();
    this.pool.on('error', () => console.error(JSON.stringify({ event: 'database_connection_error' })));
  }
  async query(sql, parameters = []) {
    const client = this.context.getStore() || this.pool;
    return client.query(sql, parameters);
  }
  prepare(sql) {
    let index = 0;
    const parameterized = sql.replace(/\?/g, () => '$' + (++index));
    return {
      get: async (...parameters) => (await this.query(parameterized, parameters)).rows[0],
      all: async (...parameters) => (await this.query(parameterized, parameters)).rows,
      run: async (...parameters) => ({ changes: (await this.query(parameterized, parameters)).rowCount }),
    };
  }
  async transaction(fn) {
    if (this.context.getStore()) throw new Error('Nested database transaction is unsupported');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize quota/revision writes across replicas. No provider work occurs here.
      await client.query('SELECT pg_advisory_xact_lock(879031)');
      const result = await this.context.run(client, fn);
      await client.query('COMMIT'); return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async migrate() {
    await this.transaction(async () => {
      await this.query('CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
      for (const [version, file] of [[1, '001-postgres.sql'], [2, '002-operation-versions.sql'], [3, '../modules/activity/schema.sql'], [4, '004-ai-spend.sql'], [5, '005-operation-fencing.sql'], [6, '../modules/learning/schema.sql']]) {
        const prior = await this.query('SELECT version FROM schema_migrations WHERE version=$1', [version]);
        if (prior.rowCount) continue;
        await this.query(await readFile(new URL('./migrations/' + file, import.meta.url), 'utf8'));
        await this.query('INSERT INTO schema_migrations(version) VALUES($1)', [version]);
      }
    });
  }
  async close() { await this.pool.end(); }
}
