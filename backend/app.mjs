import { createServer } from 'node:http';
import { randomUUID, randomInt } from 'node:crypto';
import { createReadStream, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { concepts } from '../src/lib/stage0/curriculum.ts';
import { lessons, tutorInstructions, assessorInstructions, questionsFor, PROMPT_VERSION } from './lessons.mjs';
import { Store, dayKey } from './store.mjs';
import { PostgresStore } from './postgres-store.mjs';
import { SqliteDatabase } from './sqlite-adapter.mjs';
import { OpenAIProvider, tokenReservation } from './provider.mjs';
import { ActivityService } from './modules/activity/service.mjs';
import { HttpError, fail, text, revision, requestId } from './errors.mjs';
import { username, password, passwordHash, verifyPassword, hash, token, ipHash, equal, cookie, readCookie } from './auth.mjs';

const knownConcepts = new Set(concepts.map((c) => c.id));
const mediaTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2' };

export function createApplication(config, dependencies = {}) {
  const suppliedStore = dependencies.store || new Store(config.dbPath);
  const store = suppliedStore instanceof Store ? new PostgresStore(new SqliteDatabase(suppliedStore)) : suppliedStore;
  if (suppliedStore instanceof Store) store.now = suppliedStore.now;
  const activity = new ActivityService(store);
  const provider = dependencies.provider || new OpenAIProvider(config);
  const logger = dependencies.logger || ((event) => console.error(JSON.stringify(event)));
  const controllers = new Map();
  let hashing = 0;
  const cleanup = setInterval(() => { Promise.resolve(store.cleanup()).catch(() => logger({ event: 'cleanup_failed' })); }, 60_000); cleanup.unref();

  function json(res, status, value) {
    res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.end(JSON.stringify(value));
  }
  async function body(req) {
    if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) fail(415, 'json_required', 'Use a JSON request.');
    if (req.headers['x-stage0-client'] !== 'web') fail(403, 'client_required', 'Refresh the page before trying again.');
    if (Number(req.headers['content-length']) > 16_384) fail(413, 'request_too_large', 'This request is too large.');
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 16_384) fail(413, 'request_too_large', 'This request is too large.'); chunks.push(chunk); }
    let value;
    try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail(400, 'invalid_json', 'The request could not be read.'); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(400, 'invalid_json', 'A JSON object is required.');
    return value;
  }
  function concept(value) {
    if (typeof value !== 'string' || !knownConcepts.has(value)) fail(404, 'concept_not_found', 'This concept was not found.');
    return value;
  }
  function lessonFor(value) {
    const id = concept(value), lesson = lessons.get(id);
    if (!lesson) fail(409, 'lesson_not_ready', 'The live tutor for this concept is not available yet. Its free guide and reusable prompt are available.');
    if (lesson.evaluatedModel && (lesson.evaluatedModel !== config.model || lesson.evaluatedPromptVersion !== PROMPT_VERSION)) fail(409, 'evaluation_required', 'This lesson is being checked for the current tutor. Its explanation remains available.');
    return lesson;
  }
  function requireAI() {
    if (!provider.ready) fail(503, 'ai_not_configured', 'The live tutor is not activated yet. The free guide and reusable prompt remain available.');
  }
  async function sessionFor(req, mutation = false) {
    const value = readCookie(req, config), sessionHash = value ? hash(value) : '';
    const session = value ? (await store.session(sessionHash)) : null;
    if (!session) fail(401, 'sign_in_required', 'Sign in to save your progress and use the free tutor.');
    if (mutation && !equal(req.headers['x-csrf-token'], session.csrf)) fail(403, 'invalid_csrf', 'Refresh the page before continuing.');
    return { ...session, sessionHash };
  }
  async function issueSession(res, user, expectedPasswordHash = user.password_hash) {
    const value = token(), csrf = token();
    (await store.createSession(user.id, hash(value), csrf, config.sessionSeconds, expectedPasswordHash));
    // Keep a bounded number of devices; expired sessions are removed by maintenance.
    (await store.db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash NOT IN (SELECT token_hash FROM sessions WHERE user_id=? ORDER BY expires DESC LIMIT 10)').run(user.id, user.id));
    res.setHeader('Set-Cookie', cookie(config, value));
    return { user: { username: user.username }, csrf, usage: (await store.usage(user.id, config)) };
  }
  async function replay(userId, id, fingerprint) {
    const prior = (await store.operation(userId, id));
    if (!prior) return null;
    if (prior.fingerprint !== fingerprint) fail(409, 'request_mismatch', 'This request ID was already used for different content.');
    if (prior.state === 'completed') return JSON.parse(prior.result);
    fail(409, prior.state === 'running' ? 'request_running' : 'request_failed', prior.state === 'running' ? 'Your previous reply is still being prepared. Refresh shortly.' : 'That attempt did not finish. Send a new request to try again.', 3);
  }
  async function authLimit(ip) {
    const hour = new Date(store.now()).toISOString().slice(0, 13);
    (await store.rateLimit(`auth:${ip}`, hour, config.authHourlyLimit, 3600));
  }
  async function hashWork(fn) {
    if (hashing >= 2) fail(503, 'sign_in_busy', 'Sign-in is busy. Please try again shortly.', 3);
    hashing++;
    try { return await fn(); } finally { hashing--; }
  }
  function abortUser(userId) {
    for (const active of controllers.values()) if (active.userId === userId) active.controller.abort();
  }
  function streamStart(res) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-transform'); res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    return (event, data) => { if (!res.destroyed && !res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
  }
  function prepareOperation(req, res, session, id) {
    const controller = new AbortController(), key = `${session.user_id}:${id}`;
    controllers.set(key, { userId: session.user_id, controller });
    res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    return { signal: controller.signal, close: () => controllers.delete(key) };
  }
  function externalError(error) {
    return error instanceof HttpError ? error : new HttpError(500, 'server_error', 'Something went wrong. Your saved progress is safe; please refresh and try again.');
  }

  async function handle(req, res) {
    const trace = randomUUID();
    res.setHeader('X-Request-Id', trace); res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Vary', 'Origin');
    try {
      const url = new URL(req.url, 'http://localhost');
      if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url);
      const origin = req.headers.origin;
      if (origin && !config.origins.includes(origin)) fail(403, 'origin_denied', 'This site is not allowed to access the tutor service.');
      if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Access-Control-Allow-Credentials', 'true'); }
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Stage0-Client,X-CSRF-Token');
        res.setHeader('Access-Control-Max-Age', '600'); res.statusCode = 204; res.end(); return;
      }
      if (req.method !== 'GET' && req.method !== 'POST') fail(405, 'method_not_allowed', 'This request method is not supported.');
      // Custom headers + JSON force a preflight. Exact Origin checks also protect login/signup.
      if (req.method === 'POST' && !origin) fail(403, 'origin_required', 'An allowed site origin is required.');
      const forwarded = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean);
      const remote = config.trustedProxyHops > 0 && forwarded.length >= config.trustedProxyHops ? forwarded.at(-config.trustedProxyHops) : req.socket.remoteAddress || 'unknown';
      const ip = ipHash(remote, config.secret);
      const path = url.pathname.replace(/^\/api\/v1(?=\/)/, '/api').replace(/\/$/, '');

      if (path === '/api/health/live' && req.method === 'GET') { json(res, 200, { live: true }); return; }
      if (path === '/api/health/ready' && req.method === 'GET') {
        await store.db.prepare('SELECT 1 AS ready').get(); json(res, 200, { ready: true }); return;
      }
      if (path === '/api/capabilities' && req.method === 'GET') {
        json(res, 200, { tutorConfigured: provider.ready, placements: [...lessons.keys()], promptVersion: PROMPT_VERSION }); return;
      }
      if (path === '/api/health' && req.method === 'GET') {
        json(res, 200, { service: 'stage0', ready: provider.ready, pilotConcepts: [...lessons.keys()], promptVersion: PROMPT_VERSION }); return;
      }
      if (path === '/api/session' && req.method === 'GET') {
        const raw = readCookie(req, config), session = raw ? (await store.session(hash(raw))) : null;
        json(res, 200, session ? { user: { username: session.username }, csrf: session.csrf, usage: (await store.usage(session.user_id, config)) } : { user: null, csrf: null, usage: null }); return;
      }
      if (path.startsWith('/api/auth/') && req.method === 'POST' && path !== '/api/auth/logout') {
        (await authLimit(ip)); const value = await body(req), name = username(value.username);
        if (path === '/api/auth/signup') {
          const secret = password(value.password);
          (await store.rateLimit(`signup:${ip}`, dayKey(store.now()), config.signupDailyLimit, 86400));
          if ((await store.userByName(name))) fail(409, 'username_unavailable', 'That username is unavailable. Choose another.');
          const hashed = await hashWork(() => passwordHash(secret)), recoveryCode = token();
          if ((await store.userByName(name))) fail(409, 'username_unavailable', 'That username is unavailable. Choose another.');
          const user = (await store.createUser(name, hashed, hash(recoveryCode)));
          json(res, 201, { ...(await issueSession(res, user, hashed)), recoveryCode }); return;
        }
        if (path === '/api/auth/login') {
          const user = (await store.userByName(name));
          const verified = await hashWork(() => verifyPassword(value.password, user?.password_hash));
          if (!verified || (await store.userByName(name))?.password_hash !== user.password_hash) fail(401, 'invalid_credentials', 'The username or password is incorrect.');
          const current = readCookie(req, config); if (current) (await store.signOut(hash(current)));
          json(res, 200, (await issueSession(res, user))); return;
        }
        if (path === '/api/auth/recover') {
          const user = (await store.userByName(name)), code = text(value.recoveryCode, 'Recovery code', 43, 43), newPassword = password(value.password);
          if (!user || !equal(user.recovery_hash, hash(code))) fail(401, 'invalid_credentials', 'The username or recovery code is incorrect.');
          const hashed = await hashWork(() => passwordHash(newPassword)), recoveryCode = token();
          if ((await store.userByName(name))?.recovery_hash !== user.recovery_hash) fail(409, 'recovery_used', 'This recovery code was already used.');
          abortUser(user.id); (await store.recover(user.id, hashed, hash(recoveryCode), user.recovery_hash));
          json(res, 200, { ...(await issueSession(res, user, hashed)), recoveryCode }); return;
        }
        fail(404, 'not_found', 'This account action was not found.');
      }

      const session = (await sessionFor(req, req.method === 'POST')), userId = session.user_id;
      if (path === '/api/auth/logout' && req.method === 'POST') {
        await body(req); (await store.signOut(session.sessionHash)); abortUser(userId);
        res.setHeader('Set-Cookie', cookie(config, '', 0)); json(res, 200, { ok: true }); return;
      }
      if (path === '/api/account/export' && req.method === 'GET') { json(res, 200, { ...(await store.export(userId)), activities: await activity.snapshot(userId) }); return; }
      if (path === '/api/account/delete' && req.method === 'POST') {
        (await authLimit(ip)); const value = await body(req), user = (await store.userByName(session.username));
        if (!await hashWork(() => verifyPassword(value.password, user.password_hash)) || (await store.userByName(session.username))?.password_hash !== user.password_hash) fail(401, 'invalid_credentials', 'The password is incorrect.');
        abortUser(userId); (await store.deleteUser(userId, session.sessionHash, user.password_hash)); res.setHeader('Set-Cookie', cookie(config, '', 0)); json(res, 200, { ok: true }); return;
      }
      if (path === '/api/activity' && req.method === 'GET') { json(res, 200, await activity.snapshot(userId)); return; }
      if (path === '/api/activity/import' && req.method === 'POST') { json(res, 200, await activity.import(userId, await body(req))); return; }
      if (path.startsWith('/api/activity/') && req.method === 'POST') { json(res, 200, await activity.save(userId, path.split('/').at(-1), await body(req))); return; }
      if (path === '/api/progress' && req.method === 'GET') { json(res, 200, { entries: (await store.progress(userId)), usage: (await store.usage(userId, config)) }); return; }
      if ((path === '/api/history/messages' || path === '/api/history/assessments') && req.method === 'GET') {
        const id = concept(url.searchParams.get('conceptId')), before = Number(url.searchParams.get('before') || (path.endsWith('/messages') ? Number.MAX_SAFE_INTEGER : store.now() + 1));
        if (!Number.isSafeInteger(before) || before < 1) fail(422, 'invalid_cursor', 'Choose a valid history position.');
        const messages = path.endsWith('/messages'), beforeId = url.searchParams.get('beforeId') || '';
        if (beforeId && (messages || !/^[a-zA-Z0-9_-]{1,128}$/.test(beforeId))) fail(422, 'invalid_cursor', 'Choose a valid history position.');
        const entries = messages ? await store.olderMessages(userId, id, before, 51) : await store.assessmentHistory(userId, id, before, 51, beforeId);
        const page = messages ? entries.slice(-50) : entries.slice(0, 50), last = page.at(-1);
        json(res, 200, { entries: page, hasMore: entries.length > 50, nextCursor: entries.length > 50 ? messages ? { before: page[0].id } : { before: last.recorded, beforeId: last.id } : null }); return;
      }
      if (path === '/api/conversation' && req.method === 'GET') {
        json(res, 200, { conversation: (await store.state(userId, concept(url.searchParams.get('conceptId')))), usage: (await store.usage(userId, config)) }); return;
      }
      if (path === '/api/operation/cancel' && req.method === 'POST') {
        const value = await body(req), id = requestId(value.id);
        const result = await store.cancelOperation(userId, id);
        controllers.get(`${userId}:${id}`)?.controller.abort(); json(res, 200, result); return;
      }
      if (path === '/api/operation' && req.method === 'GET') {
        const op = (await store.operation(userId, requestId(url.searchParams.get('id'))));
        if (!op) fail(404, 'not_found', 'This request was not found.');
        json(res, 200, { state: op.state, result: op.state === 'completed' ? JSON.parse(op.result) : null }); return;
      }
      if ((path === '/api/conversation/reset' || path === '/api/conversation/bookmark') && req.method === 'POST') {
        const value = await body(req), id = concept(value.conceptId), rev = revision(value.revision);
        if (path.endsWith('/bookmark') && typeof value.revisit !== 'boolean') fail(422, 'invalid_input', 'Choose whether to save this concept to revisit.');
        const conversation = path.endsWith('/reset') ? (await store.reset(userId, id, rev)) : (await store.bookmark(userId, id, value.revisit, rev));
        json(res, 200, { conversation, usage: (await store.usage(userId, config)) }); return;
      }
      if (path === '/api/chat' && req.method === 'POST') {
        const value = await body(req), lesson = lessonFor(value.conceptId), message = text(value.message, 'Question'), id = requestId(value.requestId), rev = revision(value.revision);
        const fingerprint = hash(JSON.stringify({ kind: 'chat', conceptId: lesson.id, message, rev }));
        const previous = (await replay(userId, id, fingerprint));
        if (previous) { const send = streamStart(res); send('done', previous); res.end(); return; }
        requireAI();
        const instructions = tutorInstructions(lesson);
        // Server-owned history only: callers cannot insert assistant/system messages.
        const history = (await (await store.messages(userId, lesson.id, 12)).map((m) => ({ role: m.role === 'student' ? 'user' : 'assistant', content: m.text })));
        while (Buffer.byteLength(JSON.stringify(history)) > 16_000) history.shift();
        const messages = [...history, { role: 'user', content: message }];
        const reservation = (await store.reserve({ userId, ip, id, conceptId: lesson.id, fingerprint, kind: 'chat', revision: rev, tokens: tokenReservation(instructions, messages, config.maxOutputTokens), config, promptVersion: PROMPT_VERSION, lessonVersion: lesson.version }));
        if (reservation.replay) { const send = streamStart(res); send('done', reservation.replay); res.end(); return; }
        const active = prepareOperation(req, res, session, id), send = streamStart(res);
        const heartbeat = setInterval(() => { if (!res.destroyed) res.write(': keepalive\n\n'); }, 10000); heartbeat.unref();
        send('start', { requestId: id });
        try {
          const reply = await provider.stream({ instructions, messages, signal: active.signal, onDelta: (delta) => send('delta', { text: delta }) });
          if (active.signal.aborted) fail(499, 'cancelled', 'The request was cancelled.');
          const result = (await store.finish(reservation, session.sessionHash, async () => {
            (await store.checkRevision(userId, lesson.id, rev)); const row = (await store.ensure(userId, lesson.id));
            (await store.addMessage(userId, lesson.id, 'student', message)); (await store.addMessage(userId, lesson.id, 'tutor', reply.text));
            const check = row.assessment ? JSON.parse(row.assessment) : null;
            (await store.db.prepare('UPDATE conversations SET assessment=?,revision=revision+1,updated=? WHERE user_id=? AND concept_id=?').run(check?.answers.length === 3 ? row.assessment : null, store.now(), userId, lesson.id));
            return { conversation: (await store.state(userId, lesson.id)), usage: (await store.usage(userId, config)) };
          }, reply.usage));
          send('done', result);
        } catch (error) {
          (await store.failOperation(reservation, active.signal.aborted ? 'cancelled' : 'indeterminate')); const safe = externalError(error);
          logger({ trace, event: 'chat_failed', code: safe.code }); send('error', { code: safe.code, message: safe.message });
        } finally { clearInterval(heartbeat); active.close(); res.end(); }
        return;
      }
      if (path === '/api/assessment/start' && req.method === 'POST') {
        const value = await body(req), lesson = lessonFor(value.conceptId), rev = revision(value.revision);
        requireAI();
        const result = (await store.transaction(async () => {
          (await store.assertIdle(userId)); (await store.checkRevision(userId, lesson.id, rev)); const row = (await store.ensure(userId, lesson.id));
          if (row.assessment) await store.recordAssessment(userId, lesson.id, JSON.parse(row.assessment));
          const assessment = { recordedAt: store.now(), lessonSnapshot: lesson, id: randomUUID(), questions: questionsFor(lesson, randomInt(1, 2 ** 31), row.attempts), answers: [], feedback: [], version: PROMPT_VERSION, lessonVersion: lesson.version };
          await store.recordAssessment(userId, lesson.id, assessment);
          (await store.db.prepare("UPDATE conversations SET assessment=?,attempts=attempts+1,status='Exploring',revision=revision+1,updated=? WHERE user_id=? AND concept_id=?").run(JSON.stringify(assessment), store.now(), userId, lesson.id));
          return { conversation: (await store.state(userId, lesson.id)), usage: (await store.usage(userId, config)) };
        }));
        json(res, 200, result); return;
      }
      if (path === '/api/assessment/answer' && req.method === 'POST') {
        const value = await body(req), lesson = lessonFor(value.conceptId), answer = text(value.answer, 'Your answer'), id = requestId(value.requestId), rev = revision(value.revision);
        const fingerprint = hash(JSON.stringify({ kind: 'assessment', conceptId: lesson.id, assessmentId: value.assessmentId, answer, rev }));
        const prior = (await replay(userId, id, fingerprint)); if (prior) { json(res, 200, prior); return; }
        requireAI();
        (await store.checkRevision(userId, lesson.id, rev));
        const row = (await store.row(userId, lesson.id)), assessment = row?.assessment ? JSON.parse(row.assessment) : null;
        if (!assessment || assessment.id !== value.assessmentId || assessment.answers.length >= 3) fail(409, 'check_changed', 'Refresh your understanding check before answering.');
        if (/\b(ignore|disregard|override).{0,80}(rubric|instructions|system|grad)|\bmark me (as )?understood\b/i.test(answer)) fail(422, 'answer_needed', 'Please explain the idea or scenario in your own words so the check has evidence to assess.');
        const normal = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
        if (answer.length >= 80 && (await (await store.messages(userId, lesson.id)).some((m) => m.role === 'tutor' && normal(m.text).includes(normal(answer))))) fail(422, 'independent_answer_needed', 'Try explaining the idea in your own words, rather than copying a tutor reply.');
        const gradingLesson = assessment.lessonSnapshot || lesson;
        if ((!assessment.lessonSnapshot && assessment.lessonVersion && assessment.lessonVersion !== lesson.version) || (gradingLesson.evaluatedModel && gradingLesson.evaluatedModel !== config.model)) fail(409, 'check_version_changed', 'This lesson or tutor changed. Start a fresh check; your earlier feedback remains saved.');
        const question = assessment.questions[assessment.answers.length], instructions = assessorInstructions(gradingLesson, question);
        const reservation = (await store.reserve({ userId, ip, id, conceptId: lesson.id, fingerprint, kind: 'assessment', revision: rev, tokens: tokenReservation(instructions, [{ answer }], Math.max(1200, config.maxOutputTokens)), config, promptVersion: PROMPT_VERSION, lessonVersion: gradingLesson.version }));
        if (reservation.replay) { json(res, 200, reservation.replay); return; }
        const active = prepareOperation(req, res, session, id);
        try {
          const { result: evidence, usage } = await provider.assess({ instructions, answer, signal: active.signal });
          if (active.signal.aborted) fail(499, 'cancelled', 'The request was cancelled.');
          const result = (await store.finish(reservation, session.sessionHash, async () => {
            (await store.checkRevision(userId, lesson.id, rev));
            assessment.answers.push(answer); assessment.feedback.push(evidence); delete assessment.draft;
            await store.recordAssessment(userId, lesson.id, assessment);
            const anyGap = assessment.feedback.some((e) => e.score < 2 || e.misconception);
            const status = anyGap ? 'Developing' : assessment.answers.length === 3 ? 'Understood' : 'Exploring';
            (await store.db.prepare('UPDATE conversations SET assessment=?,status=?,revision=revision+1,updated=? WHERE user_id=? AND concept_id=?').run(JSON.stringify(assessment), status, store.now(), userId, lesson.id));
            return { conversation: (await store.state(userId, lesson.id)), usage: (await store.usage(userId, config)) };
          }, usage));
          json(res, 200, result);
        } catch (error) { (await store.failOperation(reservation, active.signal.aborted ? 'cancelled' : 'indeterminate')); throw error; }
        finally { active.close(); }
        return;
      }
      if (path === '/api/assessment/draft' && req.method === 'POST') {
        const value = await body(req), id = concept(value.conceptId), rev = revision(value.revision);
        if (typeof value.draft !== 'string' || value.draft.length > 1200 || value.draft.includes('\0')) fail(422, 'invalid_input', 'The draft must contain at most 1200 characters.');
        (await store.transaction(async () => {
          (await store.assertIdle(userId)); (await store.checkRevision(userId, id, rev));
          const row = (await store.row(userId, id)), check = row?.assessment ? JSON.parse(row.assessment) : null;
          if (!check || check.id !== value.assessmentId || check.answers.length !== value.index || check.answers.length >= 3) fail(409, 'check_changed', 'This understanding check has changed. Refresh before saving the draft.');
          check.draft = value.draft;
          (await store.db.prepare('UPDATE conversations SET assessment=? WHERE user_id=? AND concept_id=?').run(JSON.stringify(check), userId, id));
        }));
        json(res, 200, { ok: true }); return;
      }
      fail(404, 'not_found', 'This tutor service endpoint was not found.');
    } catch (error) {
      const safe = externalError(error);
      if (safe.status >= 500) logger({ trace, event: 'request_failed', code: safe.code });
      if (res.headersSent) { if (!res.writableEnded) res.end(); return; }
      if (safe.retryAfter) res.setHeader('Retry-After', String(safe.retryAfter));
      json(res, safe.status === 499 ? 503 : safe.status, { error: { code: safe.code, message: safe.message }, requestId: trace });
    }
  }
  function serveStatic(req, res, url) {
    if (!config.staticDir || !['GET', 'HEAD'].includes(req.method)) { json(res, 404, { error: { code: 'not_found', message: 'This page was not found.' } }); return; }
    let file;
    try {
      file = resolve(config.staticDir, '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(config.staticDir + sep) && file !== config.staticDir) fail(404, 'not_found', 'This page was not found.');
      if (statSync(file).isDirectory()) file = resolve(file, 'index.html');
      const type = mediaTypes[extname(file)], stat = statSync(file);
      if (!type || !stat.isFile()) fail(404, 'not_found', 'This page was not found.');
      res.setHeader('Content-Type', type); res.setHeader('Content-Length', stat.size);
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('Cache-Control', file.includes(`${sep}_astro${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
      if (req.method === 'HEAD') res.end(); else createReadStream(file).on('error', () => res.destroy()).pipe(res);
    } catch {
      try {
        const page = resolve(config.staticDir, '404.html');
        const size = statSync(page).size;
        res.statusCode = 404; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Content-Length', size);
        if (req.method === 'HEAD') res.end(); else createReadStream(page).on('error', () => res.destroy()).pipe(res);
      } catch { json(res, 404, { error: { code: 'not_found', message: 'This page was not found.' } }); }
    }
  }
  const server = createServer({ maxHeaderSize: 16384, requestTimeout: 20000, headersTimeout: 10000 }, handle);
  server.keepAliveTimeout = 5000;
  async function close() {
    clearInterval(cleanup); for (const { controller } of controllers.values()) controller.abort();
    await new Promise((resolve) => server.close(resolve)); server.closeAllConnections(); (await store.close());
  }
  return { server, store, provider, close };
}
