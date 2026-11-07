import { readFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { catalogue, digest, validateApproval } from './contract.mjs';
import { createContentClient, atomicJson } from './client.mjs';
import { executePlacement, mapBounded, calibrationIds } from './pipeline.mjs';
import { executeReviewControls, validateReviewControls } from './calibration.mjs';

const { values } = parseArgs({ options: {
  id: { type: 'string' }, subject: { type: 'string' }, all: { type: 'boolean' }, calibration: { type: 'boolean' }, live: { type: 'boolean' },
  'budget-usd': { type: 'string' }, 'budget-id': { type: 'string' }, 'max-calls': { type: 'string' },
  concurrency: { type: 'string', default: '2' }, 'max-revisions': { type: 'string', default: '3' },
} });
if ([values.id, values.subject, values.all, values.calibration].filter(Boolean).length !== 1) throw new Error('Choose one of --id, --subject, --all, --calibration');
const selected = [...catalogue.values()].filter(p => values.all || (values.calibration && calibrationIds.includes(p.id)) || p.id === values.id || p.subject.id === values.subject);
if (!selected.length) throw new Error('Unknown placement or subject');
const authorModel = process.env.CONTENT_AUTHOR_MODEL, reviewerModel = process.env.CONTENT_REVIEWER_MODEL, tutorModel = process.env.CONTENT_TUTOR_MODEL || process.env.OPENAI_MODEL;
const root = resolve('content/stage0'), ready = [], missing = [], alreadyApproved = [];
for (const placement of selected) {
  const id = placement.id, key = id.replace('/', '--');
  let packet;
  try { packet = JSON.parse(await readFile(resolve(root, 'sources', key + '.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; missing.push(id); continue; }
  if (!Array.isArray(packet.sources) || !packet.sources.length) throw new Error('Empty source packet: ' + id);
  for (const source of packet.sources) {
    if (!/^[a-f0-9]{64}\.txt$/.test(source.file || '')) throw new Error('Unsafe source file: ' + id);
    const text = await readFile(resolve(root, 'sources', source.file), 'utf8');
    const normal = s => s.replace(/\s+/g, ' ').trim();
    if (digest(text) !== source.sha256 || !source.excerpt?.trim() || !normal(text).includes(normal(source.excerpt))) throw new Error('Source integrity failed: ' + id);
  }
  let previous = null;
  try {
    const lesson = JSON.parse(await readFile(resolve(root, 'lessons', placement.subject.id, placement.slug + '.json'), 'utf8'));
    const approval = JSON.parse(await readFile(resolve(root, 'reviews', key + '.json'), 'utf8'));
    let stalePrompt = false;
    try { validateApproval(lesson, approval); }
    catch (error) { if (!error.message.includes('Runtime prompt changed')) throw error; stalePrompt = true; }
    const modelsMatch = (!tutorModel || approval.tutorModel === tutorModel) && (!authorModel || approval.author.resolvedModel === authorModel) && (!reviewerModel || approval.reviewer.resolvedModel === reviewerModel);
    if (!stalePrompt && modelsMatch && (!values.live || approval.schemaVersion === 2)) { alreadyApproved.push(id); continue; }
    previous = { lesson, approval };
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  ready.push({ id, packet, previous });
}
console.log(JSON.stringify({ event: 'content_plan', selected: selected.length, approved: alreadyApproved.length, ready: ready.length, sourceNeeded: missing.length, missing }));
if (!values.live) { console.log('Dry run: no provider calls. --live also requires explicit --budget-usd, --budget-id and --max-calls.'); process.exit(0); }
if (!values['budget-id'] || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(values['budget-id'])) throw new Error('Explicit safe --budget-id required');
const concurrency = Number(values.concurrency), maxRevisions = Number(values['max-revisions']);
if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new Error('Placement concurrency must be 1–4');
if (!authorModel || !reviewerModel || !tutorModel || authorModel === reviewerModel) throw new Error('Set distinct CONTENT_AUTHOR_MODEL, CONTENT_REVIEWER_MODEL and runtime CONTENT_TUTOR_MODEL');
const rubric = await readFile('docs/stage0-teaching-rubric.md', 'utf8');
if (values.all || values.subject) {
  for (const id of calibrationIds) {
    try {
      const lesson = JSON.parse(await readFile(resolve(root, 'lessons', id + '.json'), 'utf8'));
      const approval = JSON.parse(await readFile(resolve(root, 'reviews', id.replace('/', '--') + '.json'), 'utf8'));
      validateApproval(lesson, approval);
      if (approval.schemaVersion !== 2 || approval.tutorModel !== tutorModel || approval.author.resolvedModel !== authorModel || approval.reviewer.resolvedModel !== reviewerModel) throw new Error('Model or pipeline changed');
    } catch { throw new Error('Bulk generation requires current-model calibration approval for ' + id + '; run --calibration first using pinned snapshots'); }
  }
  const controls = JSON.parse(await readFile(resolve(root, 'calibration', 'current-controls.json'), 'utf8'));
  const inflation = JSON.parse(await readFile(resolve(root, 'lessons', 'economics/inflation.json'), 'utf8'));
  validateReviewControls(controls, { lesson: inflation, reviewerModel, rubric });
}
const directory = resolve(root, 'runs', 'budgets', values['budget-id']);
const client = await createContentClient({ directory, budgetUsd: Number(values['budget-usd']), maxCalls: Number(values['max-calls']), apiKey: process.env.OPENAI_API_KEY });
try {
  const results = await mapBounded(ready, concurrency, async ({ id, packet, previous }) => {
    const key = id.replace('/', '--');
    try {
      const result = await executePlacement({ id, packet, call: client.call, rubric, authorModel, reviewerModel, tutorModel, adjudicatorModel: process.env.CONTENT_ADJUDICATOR_MODEL, maxRevisions, concurrency: 2,
        checkpoint: async state => { await atomicJson(resolve(directory, key + '-state.json'), state); console.log(JSON.stringify({ event: 'content_state', id, state: state.state, cycle: state.cycle })); },
      });
      if (!result.held) {
        const placement = catalogue.get(id);
        await mkdir(resolve(root, 'lessons', placement.subject.id), { recursive: true });
        await mkdir(resolve(root, 'reviews'), { recursive: true });
        if (previous) {
          const archive = resolve(root, 'archives', key); await mkdir(archive, { recursive: true });
          await atomicJson(resolve(archive, digest(previous) + '.json'), previous);
        }
        // Write evidence first. Interrupted writes cannot publish an unreviewed
        // lesson; compilation validates both artifacts before changing release.
        await atomicJson(resolve(root, 'reviews', key + '.json'), result.approval);
        await atomicJson(resolve(root, 'lessons', placement.subject.id, placement.slug + '.json'), result.lesson);
      }
      return { id, state: result.held ? 'held' : 'approved', reason: result.reason };
    } catch (error) {
      if (['budget_exhausted', 'uncertain_dispatch'].includes(error.code)) throw error;
      const result = { id, state: 'held', reason: error.message };
      await atomicJson(resolve(directory, key + '-state.json'), result); console.log(JSON.stringify({ event: 'content_state', ...result })); return result;
    }
  });
  if (values.calibration && !missing.length && results.every(r => r.state === 'approved')) {
    const lesson = JSON.parse(await readFile(resolve(root, 'lessons', 'economics/inflation.json'), 'utf8'));
    const report = await executeReviewControls({ lesson, reviewerModel, rubric, call: client.call });
    await atomicJson(resolve(root, 'calibration', 'current-controls.json'), report);
    console.log(JSON.stringify({ event: 'reviewer_controls', state: 'passed', runId: report.receipt.runId }));
  }
  await atomicJson(resolve(directory, 'summary.json'), { executedAt: new Date().toISOString(), results, sourceNeeded: missing, budget: client.budget() });
  console.log(JSON.stringify({ event: 'content_summary', approved: results.filter(r => r.state === 'approved').length, held: results.filter(r => r.state === 'held').length, sourceNeeded: missing.length, budget: client.budget() }));
  if (missing.length || results.some(r => r.state !== 'approved')) process.exitCode = 2;
} finally { console.log(JSON.stringify({ event: 'content_budget', ...client.budget() })); await client.close(); }
