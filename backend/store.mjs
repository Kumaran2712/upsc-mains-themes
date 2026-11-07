import { DatabaseSync, backup } from 'node:sqlite';
import { readFileSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fail } from './errors.mjs';

export const dayKey = (now = Date.now()) => new Date(now + 330 * 60_000).toISOString().slice(0, 10);
export const resetSeconds = (now = Date.now()) => Math.ceil((Date.parse(dayKey(now) + 'T00:00:00+05:30') + 86400000 - now) / 1000);

export class Store {
  constructor(path, now = () => Date.now()) {
    this.now = now;
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    if (path !== ':memory:') chmodSync(path, 0o600);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;');
    const version = this.db.prepare('PRAGMA user_version').get().user_version;
    if (version > 5) throw new Error('This database needs a newer server version');
    this.transaction(() => {
      if (version === 1) {
        const columns = new Set(this.db.prepare('PRAGMA table_info(operations)').all().map((c) => c.name));
        for (const column of ['model', 'prompt_version', 'provider_usage']) {
          if (!columns.has(column)) this.db.exec(`ALTER TABLE operations ADD COLUMN ${column} TEXT`);
        }
      }
      if (version >= 1 && version < 3) {
        const columns = new Set(this.db.prepare('PRAGMA table_info(operations)').all().map((c) => c.name));
        for (const column of ['lesson_version TEXT', 'lease_expires INTEGER']) {
          if (!columns.has(column.split(' ')[0])) this.db.exec(`ALTER TABLE operations ADD COLUMN ${column}`);
        }
        this.db.prepare('UPDATE operations SET lease_expires=created+180000 WHERE lease_expires IS NULL').run();
      }
      if (version >= 1 && version < 4) {
        const columns = new Set(this.db.prepare('PRAGMA table_info(operations)').all().map((c) => c.name));
        for (const column of ['reserved_cost INTEGER', 'actual_cost INTEGER', 'price_version TEXT']) {
          if (!columns.has(column.split(' ')[0])) this.db.exec(`ALTER TABLE operations ADD COLUMN ${column}`);
        }
      }
      if (version >= 1 && version < 5) {
        const sql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
        this.db.exec('DROP INDEX IF EXISTS one_running_operation');
        this.db.exec('ALTER TABLE operations RENAME TO operations_legacy');
        this.db.exec(sql.match(/CREATE TABLE IF NOT EXISTS operations \([\s\S]+?\n\);/)[0]);
        const columns = this.db.prepare('PRAGMA table_info(operations_legacy)').all().map((c) => c.name).join(',');
        this.db.exec(`INSERT INTO operations(${columns}) SELECT ${columns} FROM operations_legacy`);
        this.db.exec('DROP TABLE operations_legacy');
      }
      this.db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
      this.db.exec(readFileSync(new URL('./modules/activity/schema.sql', import.meta.url), 'utf8'));
      this.db.exec(readFileSync(new URL('./modules/learning/schema.sql', import.meta.url), 'utf8'));
    });
    this.cleanup();
  }
  cleanup() {
    this.db.prepare('DELETE FROM sessions WHERE expires <= ?').run(this.now());
    this.db.prepare('DELETE FROM counters WHERE period < ?').run(new Date(this.now() - 8 * 86400000).toISOString().slice(0, 10));
    this.db.prepare("UPDATE operations SET state='failed', result=NULL WHERE state='running' AND created < ?").run(this.now() - 180_000);
    this.db.prepare('DELETE FROM operations WHERE created < ?').run(this.now() - 7 * 86400000);
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  userByName(name) { return this.db.prepare('SELECT * FROM users WHERE username=?').get(name); }
  createUser(name, passwordHash, recoveryHash) {
    const id = randomUUID();
    this.db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(id, name, passwordHash, recoveryHash, this.now());
    return { id, username: name };
  }
  createSession(userId, tokenHash, csrf, seconds) {
    this.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(tokenHash, userId, csrf, this.now() + seconds * 1000);
  }
  session(tokenHash) {
    return this.db.prepare('SELECT s.*,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires>?').get(tokenHash, this.now());
  }
  signOut(tokenHash) { this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash); }
  recover(userId, passwordHash, recoveryHash) {
    this.transaction(() => {
      this.db.prepare('UPDATE users SET password_hash=?, recovery_hash=? WHERE id=?').run(passwordHash, recoveryHash, userId);
      this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId);
    });
  }
  deleteUser(userId) {
    this.transaction(() => {
      this.db.prepare('DELETE FROM users WHERE id=?').run(userId);
      this.db.prepare('DELETE FROM counters WHERE bucket=?').run(`user:${userId}`);
    });
  }
  counter(bucket, period) {
    return this.db.prepare('SELECT calls,tokens FROM counters WHERE bucket=? AND period=?').get(bucket, period) || { calls: 0, tokens: 0 };
  }
  increment(bucket, period, calls, tokens = 0) {
    this.db.prepare('INSERT INTO counters VALUES(?,?,?,?) ON CONFLICT(bucket,period) DO UPDATE SET calls=calls+excluded.calls,tokens=tokens+excluded.tokens').run(bucket, period, calls, tokens);
  }
  rateLimit(bucket, period, limit, retryAfter) {
    this.transaction(() => {
      if (this.counter(bucket, period).calls >= limit) fail(429, 'rate_limited', 'Please wait before trying again.', retryAfter);
      this.increment(bucket, period, 1);
    });
  }
  row(userId, conceptId) { return this.db.prepare('SELECT * FROM conversations WHERE user_id=? AND concept_id=?').get(userId, conceptId); }
  ensure(userId, conceptId) {
    this.db.prepare('INSERT INTO conversations(user_id,concept_id,updated) VALUES(?,?,?) ON CONFLICT DO NOTHING').run(userId, conceptId, this.now());
    return this.row(userId, conceptId);
  }
  checkRevision(userId, conceptId, revision) {
    const row = this.row(userId, conceptId);
    if ((row?.revision || 0) !== revision) fail(409, 'conversation_changed', 'This conversation changed in another tab. Refresh it before continuing.');
    return row;
  }
  assertIdle(userId) {
    const active = this.db.prepare("SELECT id FROM operations WHERE user_id=? AND state='running'").get(userId);
    if (active) fail(409, 'request_running', 'A reply is already being prepared. Wait for it to finish, then refresh.', 3);
  }
  messages(userId, conceptId, limit = 60) {
    return this.db.prepare('SELECT id,role,text,created FROM (SELECT id,role,text,created FROM messages WHERE user_id=? AND concept_id=? ORDER BY id DESC LIMIT ?) ORDER BY id').all(userId, conceptId, limit);
  }
  addMessage(userId, conceptId, role, text) {
    this.db.prepare('INSERT INTO messages(user_id,concept_id,role,text,created) VALUES(?,?,?,?,?)').run(userId, conceptId, role, text, this.now());
  }
  state(userId, conceptId) {
    const row = this.row(userId, conceptId);
    return {
      conceptId, status: row?.status || 'Not started', revisit: Boolean(row?.revisit), revision: row?.revision || 0,
      updated: row?.updated || 0, messages: row ? this.messages(userId, conceptId) : [],
      assessment: publicAssessment(row?.assessment ? JSON.parse(row.assessment) : null),
    };
  }
  progress(userId) {
    return this.db.prepare('SELECT concept_id,status,revisit,revision,updated FROM conversations WHERE user_id=? ORDER BY updated DESC').all(userId)
      .map((r) => ({ conceptId: r.concept_id, status: r.status, revisit: Boolean(r.revisit), revision: r.revision, updated: r.updated }));
  }
  operation(userId, id) { return this.db.prepare('SELECT * FROM operations WHERE user_id=? AND id=?').get(userId, id); }
  reserve({ userId, ip, id, conceptId, fingerprint, kind, revision, tokens, config, promptVersion }) {
    return this.transaction(() => {
      const prior = this.operation(userId, id);
      if (prior) {
        if (prior.fingerprint !== fingerprint) fail(409, 'request_mismatch', 'This request ID was already used for different content.');
        if (prior.state === 'completed') return { replay: JSON.parse(prior.result) };
        fail(409, prior.state === 'running' ? 'request_running' : 'request_failed', prior.state === 'running' ? 'This reply is still being prepared. Refresh shortly.' : 'This attempt did not finish. Please send a new request.', 3);
      }
      this.assertIdle(userId); this.checkRevision(userId, conceptId, revision);
      const period = dayKey(this.now());
      for (const [bucket, maxCalls, maxTokens] of [
        [`user:${userId}`, config.userDailyCalls, config.userDailyTokens],
        [`ip:${ip}`, config.ipDailyCalls, config.globalDailyTokens],
        ['global', config.globalDailyCalls, config.globalDailyTokens],
      ]) {
        const usage = this.counter(bucket, period);
        if (usage.calls >= maxCalls || usage.tokens + tokens > maxTokens) fail(429, 'daily_limit', 'The free tutor allowance has been reached for today. The concepts and reusable prompt remain available. Allowances reset at midnight IST.', resetSeconds(this.now()));
      }
      for (const bucket of [`user:${userId}`, `ip:${ip}`, 'global']) this.increment(bucket, period, 1, tokens);
      this.db.prepare('INSERT INTO operations(user_id,id,concept_id,fingerprint,kind,state,created,model,prompt_version) VALUES(?,?,?,?,?,?,?,?,?)').run(userId, id, conceptId, fingerprint, kind, 'running', this.now(), config.model, promptVersion || null);
      return { period, reserved: tokens, userId, ip, id };
    });
  }
  finish(reservation, sessionHash, mutate, usage) {
    return this.transaction(() => {
      if (!this.session(sessionHash) || this.operation(reservation.userId, reservation.id)?.state !== 'running') fail(401, 'session_expired', 'Sign in again to continue.');
      const recorded = usage && [usage.input_tokens, usage.output_tokens].every((n) => Number.isSafeInteger(n) && n >= 0)
        ? { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens } : null;
      if (recorded) {
        const difference = recorded.input_tokens + recorded.output_tokens - reservation.reserved;
        for (const bucket of [`user:${reservation.userId}`, `ip:${reservation.ip}`, 'global']) this.increment(bucket, reservation.period, 0, difference);
      }
      const result = mutate();
      this.db.prepare("UPDATE operations SET state='completed',result=?,provider_usage=? WHERE user_id=? AND id=?").run(JSON.stringify(result), recorded ? JSON.stringify(recorded) : null, reservation.userId, reservation.id);
      return result;
    });
  }
  failOperation(r) {
    this.db.prepare("UPDATE operations SET state='failed',result=NULL WHERE user_id=? AND id=? AND state='running'").run(r.userId, r.id);
    // Keep conservative token reservations: a failed connection can still incur provider usage.
  }
  usage(userId, config) {
    const usage = this.counter(`user:${userId}`, dayKey(this.now()));
    return { used: usage.calls, limit: config.userDailyCalls, remaining: Math.max(0, config.userDailyCalls - usage.calls), tokenRemaining: Math.max(0, config.userDailyTokens - usage.tokens), resetsIn: resetSeconds(this.now()) };
  }
  reset(userId, conceptId, revision) {
    return this.transaction(() => {
      this.assertIdle(userId); this.checkRevision(userId, conceptId, revision); this.ensure(userId, conceptId);
      this.db.prepare('DELETE FROM messages WHERE user_id=? AND concept_id=?').run(userId, conceptId);
      this.db.prepare("UPDATE conversations SET status='Exploring',assessment=NULL,revisit=0,revision=revision+1,updated=? WHERE user_id=? AND concept_id=?").run(this.now(), userId, conceptId);
      return this.state(userId, conceptId);
    });
  }
  bookmark(userId, conceptId, value, revision) {
    return this.transaction(() => {
      this.assertIdle(userId); this.checkRevision(userId, conceptId, revision); this.ensure(userId, conceptId);
      this.db.prepare('UPDATE conversations SET revisit=?,revision=revision+1,updated=? WHERE user_id=? AND concept_id=?').run(Number(value), this.now(), userId, conceptId);
      return this.state(userId, conceptId);
    });
  }
  export(userId) {
    return { version: 1, exportedAt: new Date(this.now()).toISOString(), progress: this.progress(userId).map((entry) => this.state(userId, entry.conceptId)) };
  }
  async backup(path) { await backup(this.db, path); chmodSync(path, 0o600); }
  close() { this.db.close(); }
}

export function publicAssessment(assessment) {
  if (!assessment) return null;
  const index = assessment.answers.length;
  return {
    id: assessment.id, complete: index === 3, index,
    question: index < 3 ? assessment.questions[index].question : null,
    draft: index < 3 ? assessment.draft || '' : '',
    answers: assessment.answers.map((answer, i) => ({ question: assessment.questions[i].question, answer, ...assessment.feedback[i] })),
  };
}
