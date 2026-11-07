import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createContentClient } from '../../tools/content/client.mjs';
import { compile } from '../../tools/content/compile.mjs';
import { executePlacement, mapBounded } from '../../tools/content/pipeline.mjs';
import { digest, validateApproval } from '../../tools/content/contract.mjs';
import { dimensions, teachingCategories, assessmentCategories } from '../../tools/content/evaluation.mjs';
import { executeReviewControls, validateReviewControls } from '../../tools/content/calibration.mjs';

test('content currency reservations serialize concurrent requests, survive uncertain dispatch and resume without replay', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'content-budget-')); t.after(() => rm(directory, { recursive: true, force: true }));
  let dispatched = 0;
  const fetcher = async () => { dispatched++; throw new Error('Uncertain network result'); };
  const client = await createContentClient({ directory, budgetUsd: .006, maxCalls: 10, apiKey: 'synthetic', fetcher });
  await assert.rejects(createContentClient({ directory, budgetUsd: .006, maxCalls: 10, apiKey: 'synthetic', fetcher }), /locked/);
  const results = await Promise.allSettled([client.call('gpt-5.4-mini', 'one', 'test', 'test', { max_output_tokens: 128 }), client.call('gpt-5.4-mini', 'two', 'test', 'test', { max_output_tokens: 128 })]);
  assert.equal(dispatched, 1); assert(results.some(r => r.reason?.code === 'budget_exhausted'));
  const before = client.budget().chargedMicrousd; assert(before > 0); await client.close();
  await assert.rejects(createContentClient({ directory, budgetUsd: .1, maxCalls: 10, apiKey: 'synthetic', fetcher }), /cannot change/);
  const resumed = await createContentClient({ directory, budgetUsd: .006, maxCalls: 10, apiKey: 'synthetic', fetcher });
  await assert.rejects(resumed.call('gpt-5.4-mini', 'one', 'test', 'test', { max_output_tokens: 128 }), /Uncertain dispatch/);
  assert.equal(resumed.budget().chargedMicrousd, before); assert.equal(dispatched, 1); await resumed.close();
});

test('completed content receipts reconcile real usage once and reject model or budget bypasses', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'content-completed-')); t.after(() => rm(directory, { recursive: true, force: true }));
  let dispatched = 0;
  const fetcher = async () => { dispatched++; return Response.json({ id: 'synthetic-provider-id', model: 'gpt-5.4-mini-2026-03-17', status: 'completed', usage: { input_tokens: 10, output_tokens: 20 }, output: [{ content: [{ type: 'output_text', text: 'synthetic output' }] }] }); };
  const client = await createContentClient({ directory, budgetUsd: 1, maxCalls: 1, apiKey: 'synthetic', fetcher });
  const first = await client.call('gpt-5.4-mini', 'one', 'test', 'test');
  assert.equal(first.chargedMicrousd, 98);
  assert.equal(first.request, undefined);
  assert.deepEqual(await client.call('gpt-5.4-mini', 'one', 'test', 'test'), first); assert.equal(dispatched, 1);
  await assert.rejects(client.call('gpt-5.4-mini', 'two', 'test', 'test'), /budget/);
  await assert.rejects(client.call('unknown-model', 'one', '', ''), /Unknown model/);
  await assert.rejects(client.call('gpt-5.4-mini', 'one', '', '', { model: 'gpt-5.4' }), /Unsupported/);
  assert.equal(JSON.parse(await readFile(join(directory, 'budget.json'))).chargedMicrousd, 98);
  const files = await readdir(directory), receiptFile = files.find(f => /^[a-f0-9]{64}\.json$/.test(f)); assert(receiptFile);
  assert.equal(JSON.parse(await readFile(join(directory, receiptFile))).request.instructions, 'test'); await client.close();
});

const scores = () => Object.fromEntries(dimensions.map(d => [d, 2]));
function fixture({ rejectContent = false, dispute = false } = {}) {
  const source = { title: 'Synthetic test source', url: 'https://example.org/test', locator: 'Test', excerpt: 'Synthetic source', retrievedAt: '2026-11-07', sha256: digest('synthetic'), file: digest('synthetic') + '.txt' };
  const lesson = { id: 'polity/state', schemaVersion: 1, version: 'synthetic-v1', prerequisites: {}, questions: ['Meaning?', 'Distinction?'], scenarios: [0, 1, 2].map(n => ({ question: 'Synthetic question ' + n, expected: 'Synthetic anchor ' + n })), sources: [source] };
  for (const key of ['objective', 'core', 'distinction', 'application', 'explanation', 'example', 'differently', 'confusion', 'analogyLimit']) lesson[key] = 'Synthetic test text';
  const tests = [...teachingCategories.map(category => ({ kind: 'teaching', category, input: 'Synthetic teaching input' })), ...[0, 1, 2].flatMap(dimension => assessmentCategories.map(category => ({ kind: 'assessment', category, dimension, scenarioIndex: 1, input: 'Synthetic learner input' })))];
  const stages = []; let runs = 0, disputed = false;
  const call = async (model, stage, instructions, input) => {
    stages.push(stage); let output;
    if (stage.includes(':author:')) output = { lesson, tests };
    else if (stage.includes(':content-review')) output = { decision: rejectContent ? 'revise' : 'approved', scores: scores(), sourceChecks: [{ sha256: source.sha256, supportsClaims: true, rationale: 'Synthetic test review' }], caseLabels: tests.map((_, index) => ({ index, valid: true, rationale: 'Synthetic reference label' })) };
    else if (stage.includes(':runtime-review:')) output = { decisions: input.outputs.map(item => {
      const fail = dispute && !disputed; if (fail) disputed = true;
      return { binding: item.binding, pass: !fail, labelValid: true, rationale: 'Synthetic review decision', scores: { ...scores(), ...(fail ? { accuracy: 1 } : {}) } };
    }) };
    else if (stage.includes(':adjudication:')) output = { binding: input.binding, pass: true, labelValid: true, rationale: 'Synthetic independent adjudication', scores: scores() };
    else output = typeof input === 'object' ? { score: 1, misconception: false, evidence: 'Synthetic', gap: 'Synthetic gap', feedback: 'Synthetic feedback' } : 'Synthetic tutor output';
    return { state: 'completed', runId: 'synthetic-run-' + ++runs, model, resolvedModel: model, executedAt: '2026-11-07', promptVersion: 'content-pipeline-v3', output: typeof output === 'string' ? output : JSON.stringify(output) };
  };
  return { id: lesson.id, packet: { sources: [source] }, call, rubric: 'Synthetic rubric', authorModel: 'synthetic-author', reviewerModel: 'synthetic-reviewer', tutorModel: 'synthetic-tutor', stages };
}

test('batched review keeps forty distinct runtime outputs and blocks forged bindings, grades and reference cases', async () => {
  const options = fixture(); const result = await executePlacement(options); validateApproval(result.lesson, result.approval);
  const evidence = result.approval.evaluation.evidence;
  assert.equal(evidence.length, 40); assert.equal(new Set(evidence.map(e => e.output.runId)).size, 40);
  assert.equal(new Set(evidence.map(e => e.evaluation.runId)).size, 4);
  const tamper = mutate => { const approval = structuredClone(result.approval); mutate(approval); approval.evaluation.runId = digest(approval.evaluation.evidence); return approval; };
  assert.throws(() => validateApproval(result.lesson, tamper(a => { a.evaluation.evidence[0].evaluationBinding = 'forged'; })), /binding/);
  assert.throws(() => validateApproval(result.lesson, tamper(a => { a.evaluation.evidence[10].validatedOutput.score = 2; })), /differs/);
  assert.throws(() => validateApproval(result.lesson, tamper(a => { a.evaluation.evidence[1].output.runId = a.evaluation.evidence[0].output.runId; })), /binding|Distinct/);
  assert.throws(() => validateApproval(result.lesson, tamper(a => { const author = JSON.parse(a.author.output); author.tests[0].input = 'Different reference'; a.author.output = JSON.stringify(author); })), /authored cases/);
  assert.throws(() => validateApproval(result.lesson, tamper(a => { a.evaluation.evidence[0].evaluation.output = JSON.stringify({ decisions: [] }); })), /binding/);
});

test('rejected references stop before runtime and bounded revision ends in a held placement', async () => {
  const options = fixture({ rejectContent: true }); const result = await executePlacement(options);
  assert.equal(result.held, true); assert.equal(result.cycles, 3);
  assert.equal(options.stages.filter(s => s.includes(':author:')).length, 3);
  assert.equal(options.stages.filter(s => s.includes(':runtime:')).length, 0);
});

test('disputed output needs a separately bound independent adjudicator, preserving the original failed judgement', async () => {
  const options = fixture({ dispute: true }); const result = await executePlacement({ ...options, adjudicatorModel: 'synthetic-adjudicator' });
  const entry = result.approval.evaluation.evidence.find(e => e.adjudication); assert(entry);
  assert.equal(JSON.parse(entry.evaluation.output).decisions.find(d => d.binding === entry.evaluationBinding).pass, false);
  validateApproval(result.lesson, result.approval);
  const approval = structuredClone(result.approval); approval.evaluation.evidence.find(e => e.adjudication).adjudication.resolvedModel = 'synthetic-reviewer'; approval.evaluation.runId = digest(approval.evaluation.evidence);
  assert.throws(() => validateApproval(result.lesson, approval), /Independent/);
});

test('bounded scheduling drains already-dispatched work before returning a failure', async () => {
  let drained = false;
  await assert.rejects(mapBounded([1, 2], 2, async item => { if (item === 1) throw new Error('held'); await new Promise(r => setTimeout(r, 10)); drained = true; }), /held/);
  assert(drained);
});

test('reviewer calibration rejects an always-approving judge and binds genuine control results to lesson, prompt and model', async () => {
  const lesson = { id: 'economics/inflation', core: 'Broad prices rise over time.', questions: ['What does inflation mean?', 'How does it differ from deflation?'] }, rubric = 'Synthetic test rubric';
  let approveEverything = true;
  const call = async (model, stage, instructions, input) => ({ state: 'completed', runId: 'synthetic-control-review', resolvedModel: model, executedAt: '2026-11-07', output: JSON.stringify({ decisions: input.outputs.map((e, i) => ({ binding: e.binding, pass: approveEverything || i === 2, labelValid: true, rationale: 'Synthetic decision', scores: { ...scores(), ...(!approveEverything && i < 2 ? { accuracy: 0 } : {}) } })) }) });
  await assert.rejects(executeReviewControls({ lesson, reviewerModel: 'synthetic-reviewer', rubric, call }), /failed control/);
  approveEverything = false;
  const report = await executeReviewControls({ lesson, reviewerModel: 'synthetic-reviewer', rubric, call });
  validateReviewControls(report, { lesson, reviewerModel: 'synthetic-reviewer', rubric });
  assert.throws(() => validateReviewControls(report, { lesson: { ...lesson, core: 'Changed' }, reviewerModel: 'synthetic-reviewer', rubric }), /bound/);
  assert.throws(() => validateReviewControls(report, { lesson, reviewerModel: 'other-model', rubric }), /receipt/);
  assert.throws(() => validateReviewControls(report, { lesson, reviewerModel: 'synthetic-reviewer', rubric: 'Changed' }), /bound/);
});

test('new lesson reviews bind the exact live guide and proposed public reading before runtime evaluation', async () => {
  const options = fixture();
  options.originalGuide = { id: options.id, explanation: 'Synthetic test text', example: 'Synthetic test text', distinction: 'Synthetic test text' };
  const call = options.call; let authorGuide, reviewedGuide;
  options.call = async (model, stage, instructions, input, settings) => {
    if (stage.includes(':author:')) authorGuide = input.existingPublicGuide;
    const receipt = await call(model, stage, instructions, input, settings);
    if (stage.includes(':content-review')) {
      reviewedGuide = input.guideReviewInput;
      const response = JSON.parse(receipt.output);
      response.guideReview = { binding: input.guideReviewInput.binding, originalDecision: 'approved', proposedApproved: true, rationale: 'Synthetic independent guide review', findings: [] };
      receipt.output = JSON.stringify(response);
    }
    return receipt;
  };
  const result = await executePlacement(options);
  assert.deepEqual(authorGuide, options.originalGuide);
  assert.deepEqual(reviewedGuide.originalGuide, options.originalGuide);
  assert.deepEqual(reviewedGuide.proposedGuide, { explanation: result.lesson.explanation, example: result.lesson.example, distinction: result.lesson.confusion });
  assert.deepEqual(result.approval.originalGuide, options.originalGuide);
  validateApproval(result.lesson, result.approval);
  const changedGuide = structuredClone(result.approval); changedGuide.originalGuide.explanation = 'An unreviewed replacement';
  assert.throws(() => validateApproval(result.lesson, changedGuide), /guide review/);
  const forgedReview = structuredClone(result.approval), response = JSON.parse(forgedReview.reviewer.output); response.guideReview.binding = 'different guide'; forgedReview.reviewer.output = JSON.stringify(response);
  assert.throws(() => validateApproval(result.lesson, forgedReview), /guide review/);
  const missingApproval = structuredClone(result.approval), missing = JSON.parse(missingApproval.reviewer.output); delete missing.guideReview; missingApproval.reviewer.output = JSON.stringify(missing);
  assert.throws(() => validateApproval(result.lesson, missingApproval), /guide review/);
});

test('an unresolved public guide blocks paid runtime cases even when lesson and reference reviews otherwise pass', async () => {
  const options = fixture(); options.originalGuide = { id: options.id, explanation: 'Original central idea', example: 'Original example', distinction: 'Original distinction' };
  const result = await executePlacement(options); // The synthetic reviewer deliberately omits the requested guide verdict.
  assert.equal(result.held, true);
  assert.equal(result.reason, 'content-review');
  assert.equal(options.stages.filter(stage => stage.includes(':runtime:')).length, 0);
});


test('the compiler cannot publish a newly reviewed lesson without independent review of its original public guide', async t => {
  const root = await mkdtemp(join(tmpdir(), 'guide-publication-')); t.after(() => rm(root, { recursive: true, force: true }));
  const result = await executePlacement(fixture());
  await mkdir(join(root, 'introductions'), { recursive: true });
  await mkdir(join(root, 'lessons', 'polity'), { recursive: true });
  await mkdir(join(root, 'reviews'), { recursive: true });
  for (const subject of ['polity', 'economics', 'geography', 'international-relations']) await writeFile(join(root, 'introductions', subject + '.json'), await readFile('content/stage0/introductions/' + subject + '.json'));
  await writeFile(join(root, 'lessons', 'polity', 'state.json'), JSON.stringify(result.lesson));
  await writeFile(join(root, 'reviews', 'polity--state.json'), JSON.stringify(result.approval));
  await assert.rejects(compile(root), /original public guide required/);
});

test('guide edits invalidate publication evidence even when the earlier model review and runtime receipts remain valid', async t => {
  const root = await mkdtemp(join(tmpdir(), 'guide-staleness-')); t.after(() => rm(root, { recursive: true, force: true }));
  const originals = JSON.parse(await readFile('content/stage0/introductions/polity.json', 'utf8'));
  const { id, explanation, example, distinction } = originals.entries.find(e => e.id === 'polity/state');
  const options = fixture(); options.originalGuide = { id, explanation, example, distinction };
  const call = options.call;
  options.call = async (...args) => {
    const receipt = await call(...args);
    if (args[1].includes(':content-review')) {
      const response = JSON.parse(receipt.output);
      response.guideReview = { binding: args[3].guideReviewInput.binding, originalDecision: 'approved', proposedApproved: true, rationale: 'Synthetic review for staleness test', findings: [] };
      receipt.output = JSON.stringify(response);
    }
    return receipt;
  };
  const result = await executePlacement(options);
  await mkdir(join(root, 'introductions'), { recursive: true }); await mkdir(join(root, 'lessons', 'polity'), { recursive: true }); await mkdir(join(root, 'reviews'), { recursive: true });
  for (const subject of ['polity', 'economics', 'geography', 'international-relations']) await writeFile(join(root, 'introductions', subject + '.json'), await readFile('content/stage0/introductions/' + subject + '.json'));
  await writeFile(join(root, 'lessons', 'polity', 'state.json'), JSON.stringify(result.lesson));
  await writeFile(join(root, 'reviews', 'polity--state.json'), JSON.stringify(result.approval));
  // An exact guide passes its binding checks and still needs real calibration controls.
  await assert.rejects(compile(root), error => error.code === 'ENOENT' && error.path.endsWith('current-controls.json'));
  originals.entries.find(e => e.id === id).explanation += ' An additional unreviewed claim.';
  await writeFile(join(root, 'introductions', 'polity.json'), JSON.stringify(originals));
  await assert.rejects(compile(root), /Original public guide changed/);
});
