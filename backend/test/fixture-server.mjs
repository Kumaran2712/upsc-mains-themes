// Browser QA only. This process uses a local protocol fixture, never a real API key.
import { modelFixture } from './helpers.mjs';
import { readConfig } from '../config.mjs';
import { createApplication } from '../app.mjs';
const model = await modelFixture();
const config = readConfig({ NODE_ENV: 'test', OPENAI_API_KEY: 'test-key-not-a-real-credential', OPENAI_BASE_URL: model.base + '/v1/',
  HOST: '127.0.0.1', PORT: process.env.FIXTURE_PORT || '8787', DATABASE_PATH: ':memory:', SERVE_STATIC: 'true', ALLOWED_ORIGINS: 'http://127.0.0.1:' + (process.env.FIXTURE_PORT || '8787'),
  AUTH_HOURLY_LIMIT: '100', SIGNUP_DAILY_LIMIT: '100', USER_DAILY_CALLS: '100', USER_DAILY_TOKENS: '9000000', GLOBAL_DAILY_TOKENS: '10000000' });
const app = createApplication(config);
app.server.listen(config.port, '127.0.0.1', () => console.log('Browser QA server: http://127.0.0.1:' + config.port + ' — local AI protocol fixture, not live AI.'));
let closing = false;
async function close() { if (closing) return; closing = true; await app.close(); await model.close(); }
process.on('SIGINT', close); process.on('SIGTERM', close);
