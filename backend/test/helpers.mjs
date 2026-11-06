import { createServer } from 'node:http';
import { once } from 'node:events';
import { readConfig } from '../config.mjs';
import { createApplication } from '../app.mjs';
import { Store } from '../store.mjs';
import { readEvents } from '../../src/lib/stage0/sse.ts';

export const origin = 'http://127.0.0.1:4322';
export const goodPassword = 'a-private-test-password-123';
export async function listen(server, port = 0) {
  server.listen(port, '127.0.0.1'); await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}
export async function closeServer(server) {
  server.closeAllConnections(); await new Promise((resolve) => server.close(resolve));
}
export async function modelFixture() {
  const calls = [], release = new Map();
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const data = JSON.parse(Buffer.concat(chunks).toString()); calls.push(data);
    const input = data.input.at(-1)?.content || '';
    if (input.includes('upstream-error')) { res.writeHead(503); res.end('provider detail that must stay private'); return; }
    if (!data.stream) {
      const answer = JSON.parse(input).learner_answer;
      if (answer === 'timeout-answer') { res.destroy(); return; }
      const bad = answer.startsWith('wrong');
      const evidence = answer === 'bad-evidence' ? 'not in the learner answer' : answer;
      const result = { score: bad ? 0 : 2, misconception: bad, evidence, gap: bad ? 'Revisit the central idea.' : '', feedback: bad ? 'This answer confuses the two ideas. Try a new example.' : 'Your explanation gives accurate evidence for this question.' };
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(result) }] }], usage: { input_tokens: 10, output_tokens: 20 } })); return;
    }
    res.setHeader('Content-Type', 'text/event-stream'); res.flushHeaders();
    const event = (value) => `data: ${JSON.stringify(value)}\r\n\r\n`;
    const reply = 'A state has governing authority. Sovereignty does not mean unlimited government power. ₹100 · தமிழ்';
    const frames = event({ type: 'response.output_text.delta', delta: reply.slice(0, 48) }) + event({ type: 'response.output_text.delta', delta: reply.slice(48) });
    // Deliberately split UTF-8 characters and CRLF event separators across writes.
    const bytes = Buffer.from(frames);
    for (let i = 0; i < bytes.length; i += 7) res.write(bytes.subarray(i, i + 7));
    if (input.includes('slow-reply')) await new Promise((resolve) => { release.set(input, resolve); res.once('close', resolve); });
    if (input.includes('incomplete-reply')) { res.end(); return; }
    res.end(event({ type: 'response.completed', response: { status: 'completed', usage: { input_tokens: 10, output_tokens: 20 } } }));
  });
  const base = await listen(server);
  return { base, calls, release, server, close: () => closeServer(server) };
}
export async function fixture(overrides = {}, dependencies = {}) {
  const model = await modelFixture();
  const config = readConfig({ NODE_ENV: 'test', OPENAI_API_KEY: 'test-key-not-a-real-credential', OPENAI_BASE_URL: model.base + '/v1/',
    PORT: '0', ALLOWED_ORIGINS: origin, USER_DAILY_CALLS: '1000', IP_DAILY_CALLS: '2000', GLOBAL_DAILY_CALLS: '3000', USER_DAILY_TOKENS: '9000000', GLOBAL_DAILY_TOKENS: '10000000',
    AUTH_HOURLY_LIMIT: '100', SIGNUP_DAILY_LIMIT: '100', DATABASE_PATH: ':memory:', ...overrides });
  const store = dependencies.store || new Store(':memory:');
  const logs = [], app = createApplication(config, { store, logger: (event) => logs.push(event) });
  const base = await listen(app.server);
  return { app, base, config, model, logs, close: async () => { await app.close(); await model.close(); } };
}
export function client(base) {
  const state = { cookie: '', csrf: '' };
  async function request(path, value, extra = {}) {
    const response = await fetch(base + '/api' + path, {
      method: value === undefined ? 'GET' : 'POST',
      headers: { Origin: origin, 'X-Stage0-Client': 'web', ...(value === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(state.cookie ? { Cookie: state.cookie } : {}), ...(state.csrf ? { 'X-CSRF-Token': state.csrf } : {}), ...extra.headers },
      body: value === undefined ? undefined : JSON.stringify(value), signal: extra.signal,
    });
    const cookie = response.headers.get('set-cookie'); if (cookie) state.cookie = cookie.split(';')[0];
    return response;
  }
  async function json(path, value, extra) {
    const response = await request(path, value, extra); const body = await response.json();
    if (body.csrf) state.csrf = body.csrf;
    return { status: response.status, body, response };
  }
  return { state, request, json, signup: (name) => json('/auth/signup', { username: name, password: goodPassword }) };
}
export async function chat(user, revision = 0, message = 'Explain sovereignty.', requestId = crypto.randomUUID()) {
  const response = await user.request('/chat', { conceptId: 'polity/sovereignty', revision, message, requestId });
  if (!response.ok) return { status: response.status, error: await response.json() };
  const events = []; for await (const e of readEvents(response.body)) events.push({ type: e.event, data: JSON.parse(e.data) });
  return { status: response.status, events, done: events.find((e) => e.type === 'done')?.data, error: events.find((e) => e.type === 'error')?.data };
}
