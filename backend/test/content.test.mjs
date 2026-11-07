import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogue, digest, dimensions, validateLesson, validateApproval, toPublicLesson } from '../../tools/content/contract.mjs';
import { bindCases, evaluationPassed, teachingCategories, assessmentCategories } from '../../tools/content/evaluation.mjs';

test('evaluation binds the exact application question and rejects missing, duplicate or invalid test labels', () => {
  const lesson = { core: 'Meaning anchor', distinction: 'Distinction anchor', questions: ['Meaning?', 'Distinction?'], scenarios: [{ question: 'First scenario?', expected: 'First anchor' }, { question: 'Different scenario?', expected: 'Different anchor' }] };
  const tests = [...teachingCategories.map((category) => ({ kind: 'teaching', category, input: 'Explain this idea' })), ...[0, 1, 2].flatMap((dimension) => assessmentCategories.map((category) => ({ kind: 'assessment', category, dimension, scenarioIndex: 1, input: 'A learner answer' })))];
  const bound = bindCases(lesson, tests);
  assert.equal(bound[15].question.question, 'Different scenario?');
  assert.equal(bound[5].question.expected, 'Meaning anchor');
  assert.equal(bound[10].question.expected, 'Distinction anchor');
  assert.throws(() => bindCases(lesson, tests.slice(1)), /20/);
  assert.throws(() => bindCases(lesson, tests.map((t, i) => i === 15 ? { ...t, scenarioIndex: undefined } : t)), /scenarioIndex/);
  assert.throws(() => bindCases(lesson, tests.map((t, i) => i === 15 ? { ...t, scenarioIndex: 99 } : t)), /scenarioIndex/);
  assert.throws(() => bindCases(lesson, tests.map((t, i) => i === 16 ? tests[15] : t)), /Duplicate/);
  const decision = { pass: true, labelValid: true, rationale: 'Accurate evidence for the exact question.', scores: Object.fromEntries(dimensions.map((d) => [d, 2])) };
  assert.equal(evaluationPassed(decision), true);
  assert.equal(evaluationPassed({ ...decision, labelValid: false }), false);
  assert.equal(evaluationPassed({ ...decision, scores: { ...decision.scores, assessmentIntegrity: 1 } }), false);
});

test('publication blocks missing evidence, same-model review, stale reviews and private answer leaks', () => {
  assert.equal(catalogue.size, 253);
  const source = { title: 'Reference', url: 'https://example.org/reference', locator: 'Section 1', excerpt: 'Reference excerpt', retrievedAt: '2026-11-07', sha256: digest('source') };
  const lesson = { id: 'polity/state', schemaVersion: 1, version: 'v1', prerequisites: {}, questions: ['Meaning?', 'Distinction?'], scenarios: [1, 2, 3].map((n) => ({ question: 'Case ' + n, expected: 'private anchor ' + n })), sources: [source] };
  for (const key of ['objective', 'core', 'distinction', 'application', 'explanation', 'example', 'differently', 'confusion', 'analogyLimit']) lesson[key] = 'Specific authored text';
  validateLesson(lesson);
  const receipt = { runId: 'actual-provider-id', executedAt: '2026-11-07', promptVersion: 'v1' };
  const review = { tutorModel: 'runtime-tutor', lessonHash: digest(lesson), authorModel: 'author', reviewerModel: 'reviewer', sourceVerified: true, evaluationPassed: true, decision: 'approved', author: receipt, reviewer: receipt, evaluation: receipt, scores: Object.fromEntries(dimensions.map((d) => [d, 2])), sourceChecks: [{ sha256: source.sha256, excerptMatched: true, supportsClaims: true }] };
  validateApproval(lesson, review);
  assert.throws(() => validateApproval(lesson, { ...review, reviewerModel: 'author' }));
  assert.throws(() => validateApproval({ ...lesson, core: 'Changed claim' }, review));
  assert.throws(() => validateApproval(lesson, { ...review, scores: { ...review.scores, accuracy: 1 } }));
  assert.throws(() => validateApproval(lesson, { ...review, evaluationPassed: false }));
  assert.throws(() => validateLesson({ ...lesson, scenarios: [lesson.scenarios[0]] }));
  const publicJson = JSON.stringify(toPublicLesson(lesson));
  assert(!publicJson.includes('private anchor')); assert(!publicJson.includes('expected')); assert(!publicJson.includes('core'));
});
