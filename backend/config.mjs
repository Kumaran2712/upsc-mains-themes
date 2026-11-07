import { resolve } from 'node:path';

export function readConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  function integer(key, fallback, min = 1, max = 10_000_000) {
    const value = Number(env[key] ?? fallback);
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${key}`);
    return value;
  }
  const origins = (env.ALLOWED_ORIGINS || 'http://localhost:4321,http://127.0.0.1:4321,http://127.0.0.1:4322,http://localhost:8787,http://127.0.0.1:8787')
    .split(',').map((s) => s.trim()).filter(Boolean);
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol) || (production && url.protocol !== 'https:')) throw new Error('ALLOWED_ORIGINS must contain exact HTTPS origins in production');
  }
  if (production && !env.ALLOWED_ORIGINS) throw new Error('Set ALLOWED_ORIGINS before production deployment');
  const secret = env.SESSION_SECRET || (production ? '' : 'development-only-secret-change-before-deploying-32');
  if (secret.length < 32) throw new Error('Set a persistent SESSION_SECRET of at least 32 characters');
  if (production && secret.startsWith('development-')) throw new Error('Development secret cannot be used in production');
  const endpoint = new URL(env.OPENAI_BASE_URL || 'https://api.openai.com/v1/');
  if (!['http:', 'https:'].includes(endpoint.protocol) || (production && endpoint.protocol !== 'https:')) throw new Error('The AI endpoint must use HTTPS in production');
  const dailyBudgetUsd = Number(env.DAILY_AI_BUDGET_USD ?? '5');
  if (!Number.isFinite(dailyBudgetUsd) || dailyBudgetUsd <= 0 || dailyBudgetUsd > 1000) throw new Error('Invalid DAILY_AI_BUDGET_USD');
  if (production && endpoint.hostname !== 'api.openai.com') throw new Error('Configure a verified provider price book before using a different production AI endpoint');
  return {
    dailyBudgetMicrousd: Math.floor(dailyBudgetUsd * 1e6),
    production, secret, origins, databaseUrl: env.DATABASE_URL || '', endpoint: endpoint.href.replace(/\/?$/, '/'),
    apiKey: env.OPENAI_API_KEY || '', model: env.OPENAI_MODEL || 'gpt-4.1-mini',
    host: env.HOST || '127.0.0.1', port: integer('PORT', 8787, 0, 65535),
    dbPath: env.DATABASE_PATH === ':memory:' ? ':memory:' : resolve(env.DATABASE_PATH || 'backend/var/stage0.sqlite'),
    staticDir: env.SERVE_STATIC === 'true' ? resolve('dist') : null,
    userDailyCalls: integer('USER_DAILY_CALLS', 30), ipDailyCalls: integer('IP_DAILY_CALLS', 100),
    globalDailyCalls: integer('GLOBAL_DAILY_CALLS', 500), userDailyTokens: integer('USER_DAILY_TOKENS', 150_000),
    globalDailyTokens: integer('GLOBAL_DAILY_TOKENS', 2_000_000),
    signupDailyLimit: integer('SIGNUP_DAILY_LIMIT', 3), authHourlyLimit: integer('AUTH_HOURLY_LIMIT', 20),
    maxConcurrentAI: integer('MAX_CONCURRENT_AI', 10, 1, 100),
    maxOutputTokens: integer('MAX_OUTPUT_TOKENS', 1000, 128, 4096),
    timeoutMs: integer('AI_TIMEOUT_MS', 45_000, 1000, 120_000),
    sessionSeconds: integer('SESSION_SECONDS', 604_800, 300, 2_592_000),
    trustedProxyHops: integer('TRUST_PROXY_HOPS', 0, 0, 5),
    cookieName: production ? '__Host-stage0' : 'stage0_session',
  };
}
