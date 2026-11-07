import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { digest } from './contract.mjs';
import { modelPrice, actualCost, PRICE_VERSION } from '../../backend/prices.mjs';

// Full prompts stay in the private working receipt for reconciliation. Release
// evidence needs provider output and attribution, not forty repeated requests.
const exportReceipt = ({ request, ...receipt }) => receipt;

export async function atomicJson(path, value) {
  const temporary = path + '.tmp';
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  await rename(temporary, path);
}

// One coordinator owns a budget directory. A crash leaves its lock and all
// uncertain reservations intact; operators reconcile before removing that lock.
export async function createContentClient({ directory, budgetUsd, maxCalls, apiKey, fetcher = fetch, endpoint = 'https://api.openai.com/v1/responses' }) {
  const cap = Math.floor(budgetUsd * 1e6);
  if (!Number.isSafeInteger(cap) || cap < 1 || !Number.isSafeInteger(maxCalls) || maxCalls < 1) throw new Error('Explicit positive currency and call ceilings required');
  if (!apiKey) throw new Error('Provider key required in the job environment');
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('HTTPS provider endpoint required');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const lock = resolve(directory, '.lock'), ledgerPath = resolve(directory, 'budget.json');
  await mkdir(lock).catch(() => { throw new Error('Budget is locked; reconcile the previous coordinator before resuming'); });
  let ledger;
  try {
    await writeFile(resolve(lock, 'owner.json'), JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), { mode: 0o600 });
    try { ledger = JSON.parse(await readFile(ledgerPath, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; ledger = { capMicrousd: cap, chargedMicrousd: 0, dispatched: 0, priceVersion: PRICE_VERSION }; }
    if (ledger.capMicrousd !== cap || ledger.priceVersion !== PRICE_VERSION) throw new Error('Existing budget cap/price version cannot change on resume');
    if (!Number.isSafeInteger(ledger.chargedMicrousd) || ledger.chargedMicrousd < 0 || !Number.isSafeInteger(ledger.dispatched) || ledger.dispatched < 0) throw new Error('Invalid durable budget ledger');
    await atomicJson(ledgerPath, ledger);
  } catch (error) { await rm(lock, { recursive: true }); throw error; }
  let queue = Promise.resolve(), calls = 0, closed = false;
  const exclusive = (work) => { const next = queue.then(work); queue = next.catch(() => {}); return next; };
  return {
    async call(model, stage, instructions, input, options = {}) {
      const price = modelPrice(model);
      if (!price) throw new Error('Unknown model pricing: ' + model);
      const request = { model, store: false, instructions, input: [{ role: 'user', content: typeof input === 'string' ? input : JSON.stringify(input) }], max_output_tokens: 4000, ...(model.startsWith('gpt-5') ? { reasoning: { effort: 'none' } } : {}), ...options };
      if (request.model !== model || request.store !== false || request.tools || !Number.isSafeInteger(request.max_output_tokens) || request.max_output_tokens < 1 || request.max_output_tokens > 12000) throw new Error('Unsupported content request');
      const requestHash = digest({ stage, request }), path = resolve(directory, requestHash + '.json');
      // UTF-8 byte length plus headroom bounds tokenized input for these text-only
      // requests. Output includes any reasoning tokens; cached-token discounts
      // are deliberately ignored when reserving and reconciling.
      const reserved = Math.ceil((Buffer.byteLength(JSON.stringify(request)) + 4096) * price.input + request.max_output_tokens * price.output);
      const cached = await exclusive(async () => {
        if (closed) throw new Error('Content client is closed');
        let prior;
        try { prior = JSON.parse(await readFile(path, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        if (prior?.state === 'completed') return prior;
        if (prior) throw Object.assign(new Error('Uncertain dispatch requires reconciliation: ' + requestHash), { code: 'uncertain_dispatch' });
        if (calls >= maxCalls || ledger.chargedMicrousd + reserved > cap) throw Object.assign(new Error('Content budget exhausted before dispatch'), { code: 'budget_exhausted' });
        ledger.chargedMicrousd += reserved; ledger.dispatched++; calls++;
        await atomicJson(ledgerPath, ledger);
        await atomicJson(path, { state: 'dispatched', model, stage, executedAt: new Date().toISOString(), promptVersion: 'content-pipeline-v3', requestHash, reservedMicrousd: reserved, request });
        return null;
      });
      if (cached) return exportReceipt(cached);
      // Never replay a request after timeout, incomplete response or lost receipt.
      const response = await fetcher(url, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw new Error(`Provider HTTP ${response.status}; dispatch retained for reconciliation`);
      const result = await response.json();
      const output = (result.output || []).flatMap((item) => item.content || []).filter((part) => part.type === 'output_text').map((part) => part.text).join('');
      if (result.status !== 'completed' || !result.id || !result.model || !output.trim()) throw new Error('Incomplete provider response; dispatch retained for reconciliation');
      const usage = result.usage;
      const charged = usage && Number.isSafeInteger(usage.input_tokens) && usage.input_tokens >= 0 && Number.isSafeInteger(usage.output_tokens) && usage.output_tokens >= 0 ? actualCost(usage, price) : reserved;
      return exclusive(async () => {
        const receipt = { ...JSON.parse(await readFile(path, 'utf8')), state: 'completed', runId: result.id, resolvedModel: result.model, usage, output, chargedMicrousd: charged };
        await atomicJson(path, receipt);
        // A crash between these writes over-reserves; it never silently frees an
        // uncertain request's reservation or allows the same call to run twice.
        ledger.chargedMicrousd += charged - reserved;
        await atomicJson(ledgerPath, ledger);
        return exportReceipt(receipt);
      });
    },
    budget: () => ({ ...ledger, callsThisInvocation: calls }),
    async close() { await queue; closed = true; await rm(lock, { recursive: true }); },
  };
}
