import pg from 'pg@8.23.1';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

// Private one-shot worker. No listener, public URL, learner data, or credential output.
// All paid dispatches reserve a durable budget/receipt before contacting the provider.
const jobs = JSON.parse(Bun.env.CONTENT_JOBS_GZIP ? gunzipSync(Buffer.from(Bun.env.CONTENT_JOBS_GZIP, 'base64')).toString('utf8') : Bun.env.CONTENT_JOBS || '[]');
if (!Array.isArray(jobs) || jobs.length > 100) throw new Error('At most 100 jobs per bounded invocation');
if (!Bun.env.DATABASE_URL || !Bun.env.OPENAI_API_KEY) throw new Error('Database/provider references required');
const pool = new pg.Pool({ connectionString: Bun.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 10000 });
const price = { 'gpt-5.4-mini': [0.75, 4.5], 'gpt-5.4': [2.5, 15], 'gpt-4.1-mini': [0.4, 1.6] };
const budgetId = Bun.env.CONTENT_BUDGET_ID || 'calibration-v1';
const cap = Number(Bun.env.CONTENT_BUDGET_USD || '1');
if (!Number.isFinite(cap) || cap <= 0 || cap > 100) throw new Error('Explicit content budget must be between 0 and 100 USD');
await pool.query('CREATE TABLE IF NOT EXISTS content_worker_budgets (id text PRIMARY KEY, cap_microusd bigint NOT NULL, charged_microusd bigint NOT NULL DEFAULT 0)');
await pool.query('CREATE TABLE IF NOT EXISTS content_worker_receipts (id text PRIMARY KEY, budget_id text NOT NULL REFERENCES content_worker_budgets(id), state text NOT NULL, reserved_microusd bigint NOT NULL, result text, created timestamptz NOT NULL DEFAULT now())');
await pool.query('INSERT INTO content_worker_budgets(id,cap_microusd) VALUES($1,$2) ON CONFLICT DO NOTHING', [budgetId, Math.floor(cap * 1e6)]);
try {
  async function runJob(job) {
    if (!price[job.model] || typeof job.instructions !== 'string' || JSON.stringify(job).length > 120000 || !Number.isInteger(job.max_output_tokens) || job.max_output_tokens < 128 || job.max_output_tokens > 12000) throw new Error('Unsupported content job');
    const request = { model: job.model, store: false, instructions: job.instructions, input: [{ role: 'user', content: typeof job.input === 'string' ? job.input : JSON.stringify(job.input) }], max_output_tokens: job.max_output_tokens, ...(job.text ? { text: job.text } : {}), ...(job.model.startsWith('gpt-5') ? { reasoning: { effort: 'none' } } : {}) };
    const id = createHash('sha256').update(JSON.stringify({ stage: job.stage, request })).digest('hex');
    const [inputRate, outputRate] = price[job.model];
    const reserved = Math.ceil((Buffer.byteLength(JSON.stringify(request)) + 1024) * inputRate + job.max_output_tokens * outputRate);
    const client = await pool.connect();
    let cached;
    try {
      await client.query('BEGIN');
      await client.query('SELECT id FROM content_worker_budgets WHERE id=$1 FOR UPDATE', [budgetId]);
      const prior = (await client.query('SELECT * FROM content_worker_receipts WHERE id=$1', [id])).rows[0];
      if (prior) {
        if (prior.state !== 'completed') throw new Error('Uncertain prior dispatch requires reconciliation: ' + id);
        cached = JSON.parse(prior.result);
      } else {
        const budget = (await client.query('SELECT * FROM content_worker_budgets WHERE id=$1', [budgetId])).rows[0];
        if (Number(budget.charged_microusd) + reserved > Number(budget.cap_microusd)) throw new Error('Content budget exhausted before dispatch');
        await client.query('UPDATE content_worker_budgets SET charged_microusd=charged_microusd+$2 WHERE id=$1', [budgetId, reserved]);
        await client.query("INSERT INTO content_worker_receipts(id,budget_id,state,reserved_microusd) VALUES($1,$2,'dispatched',$3)", [id, budgetId, reserved]);
      }
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
    let result = cached;
    if (!result) {
      const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: 'Bearer ' + Bun.env.OPENAI_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw new Error('Provider HTTP ' + response.status + '; dispatched receipt retained');
      const body = await response.json();
      const output = (body.output || []).flatMap((item) => item.content || []).filter((part) => part.type === 'output_text').map((part) => part.text).join('');
      result = { id, stage: job.stage, providerRunId: body.id, model: body.model || job.model, status: body.status, usage: body.usage, executedAt: new Date().toISOString(), output };
      const usage = body.usage;
      const actual = usage && Number.isSafeInteger(usage.input_tokens) && Number.isSafeInteger(usage.output_tokens) ? Math.ceil(usage.input_tokens * inputRate + usage.output_tokens * outputRate) : reserved;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('UPDATE content_worker_budgets SET charged_microusd=charged_microusd+$2 WHERE id=$1', [budgetId, actual - reserved]);
        await client.query("UPDATE content_worker_receipts SET state='completed',result=$2 WHERE id=$1 AND state='dispatched'", [id, JSON.stringify(result)]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
    }
    const encoded = Buffer.from(JSON.stringify(result)).toString('base64'), chunkSize = 6000;
    for (let offset = 0; offset < encoded.length; offset += chunkSize) console.log(JSON.stringify({ event: 'content_result', id, stage: job.stage, chunk: offset / chunkSize, chunks: Math.ceil(encoded.length / chunkSize), data: encoded.slice(offset, offset + chunkSize) }));
  }
  let index = 0;
  const results = await Promise.allSettled(Array.from({ length: Math.min(3, jobs.length) }, async () => {
    while (index < jobs.length) { const job = jobs[index++]; await runJob(job); }
  }));
  const failure = results.find((result) => result.status === 'rejected');
  if (failure) throw failure.reason;
  const budget = (await pool.query('SELECT * FROM content_worker_budgets WHERE id=$1', [budgetId])).rows[0];
  console.log(JSON.stringify({ event: 'content_budget', budgetId, chargedMicrousd: Number(budget.charged_microusd), capMicrousd: Number(budget.cap_microusd) }));
} finally { await pool.end(); }
