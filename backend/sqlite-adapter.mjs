import { AsyncLocalStorage } from 'node:async_hooks';

/** Keeps the pilot compatible while HTTP/domain services use asynchronous storage. */
export class SqliteDatabase {
  constructor(store) { this.store = store; this.context = new AsyncLocalStorage(); this.tail = Promise.resolve(); }
  async exclusive(fn) {
    if (this.context.getStore()) return fn();
    const previous = this.tail;
    let release; this.tail = new Promise((resolve) => { release = resolve; });
    await previous;
    try { return await this.context.run(true, fn); } finally { release(); }
  }
  prepare(sql) {
    const statement = this.store.db.prepare(sql);
    return Object.fromEntries(['get', 'all', 'run'].map((method) => [method, (...args) => this.exclusive(() => statement[method](...args))]));
  }
  async transaction(fn) {
    if (this.context.getStore()) throw new Error('Nested database transaction is unsupported');
    return this.exclusive(async () => {
      this.store.db.exec('BEGIN IMMEDIATE');
      try { const value = await fn(); this.store.db.exec('COMMIT'); return value; }
      catch (error) { this.store.db.exec('ROLLBACK'); throw error; }
    });
  }
  async close() { await this.exclusive(() => this.store.close()); }
}
