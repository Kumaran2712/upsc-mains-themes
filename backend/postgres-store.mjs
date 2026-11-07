import { randomUUID } from 'node:crypto';
import { modelPrice, reserveCost, actualCost, PRICE_VERSION } from './prices.mjs';
import { fail } from './errors.mjs';
import { dayKey, resetSeconds, publicAssessment } from './store.mjs';
export class PostgresStore {
  constructor(database) { this.db = database; this.now = () => Date.now(); this.owner = randomUUID(); }
  async cleanup() {
    (await this.db.prepare('DELETE FROM sessions WHERE expires <= ?').run(this.now()));
    (await this.db.prepare('DELETE FROM counters WHERE period < ?').run(new Date(this.now() - 8 * 86400000).toISOString().slice(0, 10)));
    (await this.db.prepare("UPDATE operations SET state='indeterminate',generation=generation+1, result=NULL WHERE state='running' AND lease_expires <= ?").run(this.now()));
    (await this.db.prepare('DELETE FROM operations WHERE created < ?').run(this.now() - 7 * 86400000));
  }
  async transaction(fn) { return (await this.db.transaction(fn)); }
  async userByName(name) { return (await this.db.prepare('SELECT * FROM users WHERE username=?').get(name)); }
  async createUser(name, passwordHash, recoveryHash) {
    const id = randomUUID();
    try { await this.db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(id, name, passwordHash, recoveryHash, this.now()); }
    catch (error) { if (error.code === '23505' || error.errcode === 2067) fail(409, 'username_unavailable', 'That username is unavailable. Choose another.'); throw error; }
    return { id, username: name };
  }
  async createSession(userId, tokenHash, csrf, seconds, expectedPasswordHash) {
    return this.transaction(async () => {
      const user = await this.db.prepare('SELECT password_hash FROM users WHERE id=?').get(userId);
      if (!user || (expectedPasswordHash && user.password_hash !== expectedPasswordHash)) fail(401, 'credentials_changed', 'Your credentials changed. Sign in again.');
      await this.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(tokenHash, userId, csrf, this.now() + seconds * 1000);
    });
  }
  async session(tokenHash) {
    return (await this.db.prepare('SELECT s.*,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires>?').get(tokenHash, this.now()));
  }
  async signOut(tokenHash) {
    await this.transaction(async () => {
      const session = await this.session(tokenHash);
      if (session) await this.db.prepare("UPDATE operations SET state='cancelled',generation=generation+1,cancelled_at=? WHERE user_id=? AND state='running'").run(this.now(), session.user_id);
      await this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash);
    });
  }
  async recover(userId, passwordHash, recoveryHash, expectedRecoveryHash) {
    (await this.transaction(async () => {
      await this.db.prepare("UPDATE operations SET state='cancelled',generation=generation+1,cancelled_at=? WHERE user_id=? AND state='running'").run(this.now(), userId);
      const changed = await this.db.prepare('UPDATE users SET password_hash=?, recovery_hash=? WHERE id=? AND recovery_hash=?').run(passwordHash, recoveryHash, userId, expectedRecoveryHash);
      if (changed.changes !== 1) fail(409, 'recovery_used', 'This recovery code was already used.');
      (await this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(userId));
    }));
  }
  async deleteUser(userId, sessionHash, expectedPasswordHash) {
    (await this.transaction(async () => {
      const current = await this.db.prepare('SELECT password_hash FROM users WHERE id=?').get(userId);
      if (!current || (sessionHash && !(await this.session(sessionHash))) || (expectedPasswordHash && current.password_hash !== expectedPasswordHash)) fail(409, 'account_changed', 'Your account changed. Sign in again before deleting it.');
      (await this.db.prepare('DELETE FROM users WHERE id=?').run(userId));
      (await this.db.prepare('DELETE FROM counters WHERE bucket=?').run(`user:${userId}`));
    }));
  }
  async counter(bucket, period) {
    return (await this.db.prepare('SELECT calls,tokens FROM counters WHERE bucket=? AND period=?').get(bucket, period)) || { calls: 0, tokens: 0 };
  }
  async increment(bucket, period, calls, tokens = 0) {
    (await this.db.prepare('INSERT INTO counters VALUES(?,?,?,?) ON CONFLICT(bucket,period) DO UPDATE SET calls=counters.calls+excluded.calls,tokens=counters.tokens+excluded.tokens').run(bucket, period, calls, tokens));
  }
  async rateLimit(bucket, period, limit, retryAfter) {
    (await this.transaction(async () => {
      if ((await this.counter(bucket, period)).calls >= limit) fail(429, 'rate_limited', 'Please wait before trying again.', retryAfter);
      (await this.increment(bucket, period, 1));
    }));
  }
  async row(userId, conceptId) { return (await this.db.prepare('SELECT * FROM conversations WHERE user_id=? AND concept_id=?').get(userId, conceptId)); }
  async ensure(userId, conceptId) {
    (await this.db.prepare('INSERT INTO conversations(user_id,concept_id,updated) VALUES(?,?,?) ON CONFLICT DO NOTHING').run(userId, conceptId, this.now()));
    return (await this.row(userId, conceptId));
  }
  async checkRevision(userId, conceptId, revision) {
    const row = (await this.row(userId, conceptId));
    if ((row?.revision || 0) !== revision) fail(409, 'conversation_changed', 'This conversation changed in another tab. Refresh it before continuing.');
    return row;
  }
  async assertIdle(userId) {
    const active = (await this.db.prepare("SELECT id FROM operations WHERE user_id=? AND state='running'").get(userId));
    if (active) fail(409, 'request_running', 'A reply is already being prepared. Wait for it to finish, then refresh.', 3);
  }
  async messages(userId, conceptId, limit = 60) {
    return (await this.db.prepare('SELECT id,role,text,created FROM (SELECT id,role,text,created FROM messages WHERE user_id=? AND concept_id=? ORDER BY id DESC LIMIT ?) ORDER BY id').all(userId, conceptId, limit));
  }
  async addMessage(userId, conceptId, role, text) {
    (await this.db.prepare('INSERT INTO messages(user_id,concept_id,role,text,created) VALUES(?,?,?,?,?)').run(userId, conceptId, role, text, this.now()));
  }
  async state(userId, conceptId) {
    const row = (await this.row(userId, conceptId));
    const messages = row ? await this.messages(userId, conceptId) : [];
    const hasOlderMessages = messages.length ? Boolean(await this.db.prepare('SELECT id FROM messages WHERE user_id=? AND concept_id=? AND id<? LIMIT 1').get(userId, conceptId, messages[0].id)) : false;
    return {
      conceptId, status: row?.status || 'Not started', revisit: Boolean(row?.revisit), revision: row?.revision || 0,
      updated: row?.updated || 0, messages, hasOlderMessages,
      assessment: publicAssessment(row?.assessment ? JSON.parse(row.assessment) : null),
    };
  }
  async progress(userId) {
    return (await (await this.db.prepare('SELECT concept_id,status,revisit,revision,updated FROM conversations WHERE user_id=? ORDER BY updated DESC').all(userId))
      .map((r) => ({ conceptId: r.concept_id, status: r.status, revisit: Boolean(r.revisit), revision: r.revision, updated: r.updated })));
  }
  async operation(userId, id) { return (await this.db.prepare('SELECT * FROM operations WHERE user_id=? AND id=?').get(userId, id)); }
  async reserve({ userId, ip, id, conceptId, fingerprint, kind, revision, tokens, config, promptVersion, lessonVersion }) {
    return (await this.transaction(async () => {
      const prior = (await this.operation(userId, id));
      if (prior) {
        if (prior.fingerprint !== fingerprint) fail(409, 'request_mismatch', 'This request ID was already used for different content.');
        if (prior.state === 'completed') return { replay: JSON.parse(prior.result) };
        fail(409, prior.state === 'running' ? 'request_running' : 'request_failed', prior.state === 'running' ? 'This reply is still being prepared. Refresh shortly.' : 'This attempt did not finish. Please send a new request.', 3);
      }
      (await this.assertIdle(userId)); (await this.checkRevision(userId, conceptId, revision));
      const active = await this.db.prepare("SELECT count(*) AS n FROM operations WHERE state='running'").get();
      if (active.n >= (config.maxConcurrentAI || 10)) fail(429, 'tutor_busy', 'The tutor is busy. Please try again shortly.', 5);
      const period = dayKey(this.now());
      const price = modelPrice(config.model);
      if (!price) fail(503, 'pricing_unavailable', 'The tutor is temporarily unavailable while its usage limits are configured.');
      const cost = reserveCost(tokens, price);
      const spent = await this.db.prepare('SELECT microusd FROM ai_spend WHERE period=?').get(period);
      if ((spent?.microusd || 0) + cost > config.dailyBudgetMicrousd) fail(429, 'shared_daily_limit', 'Today’s shared tutor allowance has been reached. Reading and practice remain available. Try again after midnight IST.', resetSeconds(this.now()));
      await this.db.prepare('INSERT INTO ai_spend(period,microusd) VALUES(?,?) ON CONFLICT(period) DO UPDATE SET microusd=ai_spend.microusd+excluded.microusd').run(period, cost);

      for (const [bucket, maxCalls, maxTokens] of [
        [`user:${userId}`, config.userDailyCalls, config.userDailyTokens],
        [`ip:${ip}`, config.ipDailyCalls, config.globalDailyTokens],
        ['global', config.globalDailyCalls, config.globalDailyTokens],
      ]) {
        const usage = (await this.counter(bucket, period));
        if (usage.calls >= maxCalls || usage.tokens + tokens > maxTokens) fail(429, 'daily_limit', 'The free tutor allowance has been reached for today. The concepts and reusable prompt remain available. Allowances reset at midnight IST.', resetSeconds(this.now()));
      }
      for (const bucket of [`user:${userId}`, `ip:${ip}`, 'global']) (await this.increment(bucket, period, 1, tokens));
      (await this.db.prepare('INSERT INTO operations(user_id,id,concept_id,fingerprint,kind,state,created,model,prompt_version,lesson_version,lease_expires,reserved_cost,price_version,lease_owner,generation) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(userId, id, conceptId, fingerprint, kind, 'running', this.now(), config.model, promptVersion || null, lessonVersion || null, this.now() + 180_000, cost, PRICE_VERSION, this.owner, 1));
      return { period, reserved: tokens, reservedCost: cost, price, owner: this.owner, generation: 1, userId, ip, id };
    }));
  }
  async finish(reservation, sessionHash, mutate, usage) {
    return (await this.transaction(async () => {
      const operation = await this.operation(reservation.userId, reservation.id);
      if (!(await this.session(sessionHash)) || operation?.state !== 'running' || operation.lease_expires <= this.now() || operation.lease_owner !== reservation.owner || operation.generation !== reservation.generation) fail(401, 'session_expired', 'Sign in again to continue.');
      const recorded = usage && [usage.input_tokens, usage.output_tokens].every((n) => Number.isSafeInteger(n) && n >= 0)
        ? { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens } : null;
      if (recorded) {
        const difference = recorded.input_tokens + recorded.output_tokens - reservation.reserved;
        for (const bucket of [`user:${reservation.userId}`, `ip:${reservation.ip}`, 'global']) (await this.increment(bucket, reservation.period, 0, difference));
      }
      const chargedCost = recorded ? actualCost(recorded, reservation.price) : reservation.reservedCost;
      if (recorded) await this.db.prepare('UPDATE ai_spend SET microusd=microusd+? WHERE period=?').run(chargedCost - reservation.reservedCost, reservation.period);
      const result = await mutate();
      (await this.db.prepare("UPDATE operations SET state='completed',result=?,provider_usage=?,actual_cost=? WHERE user_id=? AND id=?").run(JSON.stringify(result), recorded ? JSON.stringify(recorded) : null, chargedCost, reservation.userId, reservation.id));
      return result;
    }));
  }
  async failOperation(r, state = 'indeterminate') {
    if (!['cancelled', 'indeterminate', 'failed'].includes(state)) throw new Error('Invalid terminal operation state');
    await this.db.prepare("UPDATE operations SET state=?,generation=generation+1,result=NULL,cancelled_at=? WHERE user_id=? AND id=? AND state='running' AND lease_owner=? AND generation=?").run(state, state === 'cancelled' ? this.now() : null, r.userId, r.id, r.owner, r.generation);
    // Uncertain/cancelled provider calls retain their conservative spend reservation.
  }
  async cancelOperation(userId, id) {
    return this.transaction(async () => {
      const op = await this.operation(userId, id);
      if (!op) fail(404, 'not_found', 'This request was not found.');
      await this.db.prepare("UPDATE operations SET state='cancelled',generation=generation+1,cancelled_at=? WHERE user_id=? AND id=? AND state='running'").run(this.now(), userId, id);
      return { state: (await this.operation(userId, id)).state };
    });
  }
  async usage(userId, config) {
    const usage = (await this.counter(`user:${userId}`, dayKey(this.now())));
    return { used: usage.calls, limit: config.userDailyCalls, remaining: Math.max(0, config.userDailyCalls - usage.calls), tokenRemaining: Math.max(0, config.userDailyTokens - usage.tokens), resetsIn: resetSeconds(this.now()) };
  }
  async reset(userId, conceptId, revision) {
    return (await this.transaction(async () => {
      (await this.assertIdle(userId)); (await this.checkRevision(userId, conceptId, revision)); (await this.ensure(userId, conceptId));
      (await this.db.prepare('DELETE FROM messages WHERE user_id=? AND concept_id=?').run(userId, conceptId));
      await this.db.prepare('DELETE FROM assessment_attempts WHERE user_id=? AND concept_id=?').run(userId, conceptId);
      (await this.db.prepare("UPDATE conversations SET status='Exploring',assessment=NULL,revisit=0,revision=revision+1,updated=? WHERE user_id=? AND concept_id=?").run(this.now(), userId, conceptId));
      return (await this.state(userId, conceptId));
    }));
  }
  async bookmark(userId, conceptId, value, revision) {
    return (await this.transaction(async () => {
      (await this.assertIdle(userId)); (await this.checkRevision(userId, conceptId, revision)); (await this.ensure(userId, conceptId));
      (await this.db.prepare('UPDATE conversations SET revisit=?,revision=revision+1,updated=? WHERE user_id=? AND concept_id=?').run(Number(value), this.now(), userId, conceptId));
      return (await this.state(userId, conceptId));
    }));
  }
  async recordAssessment(userId, conceptId, assessment) {
    await this.db.prepare('INSERT INTO assessment_attempts VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,id) DO UPDATE SET payload=excluded.payload,completed=excluded.completed WHERE assessment_attempts.completed IS NULL').run(userId, assessment.id, conceptId, assessment.lessonVersion || null, JSON.stringify(assessment), assessment.recordedAt || this.now(), assessment.answers.length === 3 ? this.now() : null);
  }
  async assessmentHistory(userId, conceptId, before = this.now() + 1, limit = 50, beforeId = '') {
    const rows = await this.db.prepare('SELECT id,concept_id,lesson_version,payload,recorded,completed FROM assessment_attempts WHERE user_id=? AND concept_id=? AND (recorded<? OR (recorded=? AND id<?)) ORDER BY recorded DESC,id DESC LIMIT ?').all(userId, conceptId, before, before, beforeId, limit);
    return rows.map((row) => ({ conceptId: row.concept_id, lessonVersion: row.lesson_version, recorded: row.recorded, completed: row.completed, ...publicAssessment(JSON.parse(row.payload)) }));
  }
  async olderMessages(userId, conceptId, before, limit = 50) {
    return this.db.prepare('SELECT id,role,text,created FROM (SELECT id,role,text,created FROM messages WHERE user_id=? AND concept_id=? AND id<? ORDER BY id DESC LIMIT ?) history ORDER BY id').all(userId, conceptId, before, limit);
  }
  async export(userId) {
    const progress = [];
    for (const entry of await this.progress(userId)) {
      const state = await this.state(userId, entry.conceptId);
      state.messages = await this.db.prepare('SELECT id,role,text,created FROM messages WHERE user_id=? AND concept_id=? ORDER BY id').all(userId, entry.conceptId);
      progress.push(state);
    }
    const assessments = [];
    for (const entry of progress) {
      const rows = await this.db.prepare('SELECT payload,lesson_version,recorded,completed FROM assessment_attempts WHERE user_id=? AND concept_id=? ORDER BY recorded,id').all(userId, entry.conceptId);
      for (const row of rows) assessments.push({ conceptId: entry.conceptId, lessonVersion: row.lesson_version, recorded: row.recorded, completed: row.completed, ...publicAssessment(JSON.parse(row.payload)) });
    }
    return { version: 2, exportedAt: new Date(this.now()).toISOString(), progress, assessments };
  }
  async backup() { throw new Error('Use pg_dump and the verified PostgreSQL backup runbook'); }
  async close() { (await this.db.close()); }
}
