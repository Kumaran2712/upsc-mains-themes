import { createHash } from 'node:crypto';
import { concepts } from '../../src/lib/stage0/curriculum.ts';
import { PROMPT_VERSION } from '../../src/lib/stage0/version.ts';
import { dimensions, bindCases, evaluationPassed } from './evaluation.mjs';
export { dimensions };

export const catalogue = new Map(concepts.map((c) => [c.id, c]));
export const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function validateLesson(lesson) {
  const errors = [], requireText = (value, field) => {
    if (typeof value !== 'string' || !value.trim()) errors.push(`${field}: required text`);
  };
  if (!catalogue.has(lesson.id)) errors.push('Unknown placement ID');
  if (lesson.schemaVersion !== 1) errors.push('Unsupported schemaVersion');
  for (const key of ['version', 'objective', 'core', 'distinction', 'application', 'explanation', 'example', 'differently', 'confusion', 'analogyLimit']) requireText(lesson[key], key);
  if (!lesson.prerequisites || typeof lesson.prerequisites !== 'object' || Array.isArray(lesson.prerequisites)) errors.push('prerequisites: expected object');
  if (!Array.isArray(lesson.questions) || lesson.questions.length !== 2) errors.push('Two meaning/distinction questions required');
  else lesson.questions.forEach((q, i) => requireText(q, `questions.${i}`));
  if (!Array.isArray(lesson.scenarios) || lesson.scenarios.length < 3) errors.push('Three application scenarios required');
  else {
    const seen = new Set();
    lesson.scenarios.forEach((s, i) => { requireText(s.question, `scenarios.${i}.question`); requireText(s.expected, `scenarios.${i}.expected`); if (seen.has(s.question)) errors.push('Duplicate scenario'); seen.add(s.question); });
  }
  if (!Array.isArray(lesson.sources) || !lesson.sources.length) errors.push('Sources required');
  else lesson.sources.forEach((source, i) => {
    for (const key of ['title', 'locator', 'excerpt', 'retrievedAt', 'sha256']) requireText(source[key], `sources.${i}.${key}`);
    try { if (new URL(source.url).protocol !== 'https:') errors.push('HTTPS source required'); } catch { errors.push('Invalid source URL'); }
    if (!/^[a-f0-9]{64}$/.test(source.sha256 || '')) errors.push('Invalid source hash');
    if (!Number.isFinite(Date.parse(source.retrievedAt))) errors.push('Invalid source date');
  });
  if (errors.length) throw new Error(`${lesson.id || 'lesson'}: ${errors.join('; ')}`);
  return lesson;
}

export function validateApproval(lesson, review) {
  if (review.lessonHash !== digest(lesson)) throw new Error('Review does not match lesson');
  if (!review.authorModel || !review.reviewerModel || review.authorModel === review.reviewerModel) throw new Error('Independent reviewer model required');
  if (!review.tutorModel) throw new Error('Actual runtime tutor model evaluation required');
  if (!review.sourceVerified || !review.evaluationPassed || review.decision !== 'approved') throw new Error('Publication evidence incomplete');
  for (const role of ['author', 'reviewer', 'evaluation']) {
    const receipt = review[role];
    if (!receipt?.runId || !receipt.promptVersion || !Number.isFinite(Date.parse(receipt.executedAt))) throw new Error(`${role}: missing execution receipt`);
  }
  if (!dimensions.every((d) => review.scores?.[d] === 2)) throw new Error('Every applicable rubric dimension must score 2');
  if (!Array.isArray(review.sourceChecks) || review.sourceChecks.length !== lesson.sources.length || !review.sourceChecks.every((c, i) => c.sha256 === lesson.sources[i].sha256 && c.excerptMatched && c.supportsClaims)) throw new Error('Source evidence incomplete');
  if (review.evaluation.promptVersion !== PROMPT_VERSION) throw new Error('Runtime prompt changed; reevaluation required');
  const evidence = review.evaluation.evidence;
  if (!Array.isArray(evidence) || evidence.length !== 40 || review.evaluation.cases !== 40 || review.evaluation.runId !== digest(evidence)) throw new Error('Forty repeated actual-output evaluations required');
  const parse = (receipt) => {
    if (receipt?.state !== 'completed' || !receipt.runId || !receipt.resolvedModel || typeof receipt.output !== 'string' || !Number.isFinite(Date.parse(receipt.executedAt))) throw new Error('Completed provider receipt required');
    return JSON.parse(receipt.output.replace(/^```json\s*|\s*```$/g, ''));
  };
  const originalReview = parse(review.reviewer);
  if (digest(parse(review.author).lesson) !== digest(lesson)) throw new Error('Author receipt does not match lesson');
  if (review.author.resolvedModel === review.reviewer.resolvedModel) throw new Error('Resolved author and reviewer models must differ');
  if (originalReview.decision !== 'approved' || !dimensions.every((d) => originalReview.scores?.[d] === 2)) throw new Error('Provider review does not approve content');
  const firstRuns = evidence.filter((entry) => entry.repeat === 0);
  const bound = bindCases(lesson, firstRuns.map((entry) => entry.scenario));
  if (!Array.isArray(originalReview.caseLabels) || originalReview.caseLabels.length !== bound.length || !bound.every((_, index) => originalReview.caseLabels.filter((label) => label.index === index && label.valid === true).length === 1)) throw new Error('Independent reference-label review required');
  if (firstRuns.some((entry, i) => digest(entry.scenario.question) !== digest(bound[i].question))) throw new Error('Evaluation question does not match lesson');
  const receipts = new Set([review.author.runId, review.reviewer.runId]);
  for (const scenario of bound) {
    const repeats = evidence.filter((entry) => digest(entry.scenario) === digest(scenario));
    if (repeats.length !== 2 || ![0, 1].every((repeat) => repeats.some((entry) => entry.repeat === repeat))) throw new Error('Every case requires two independent runs');
    for (const entry of repeats) {
      const verdict = parse(entry.evaluation);
      if (!evaluationPassed(verdict)) throw new Error('Actual output evaluation failed');
      if (entry.output?.state !== 'completed' || entry.output.resolvedModel !== review.tutorModel || !entry.output.output?.trim() || !Number.isFinite(Date.parse(entry.output.executedAt))) throw new Error('Runtime model/receipt mismatch');
      if (entry.evaluation.resolvedModel !== review.reviewer.resolvedModel) throw new Error('Runtime evaluation reviewer mismatch');
      for (const receipt of [entry.output, entry.evaluation]) {
        if (!receipt.runId || receipts.has(receipt.runId)) throw new Error('Distinct provider runs required');
        receipts.add(receipt.runId);
      }
    }
  }
  return review;
}

export function toPublicLesson(lesson) {
  return { id: lesson.id, version: lesson.version, objective: lesson.objective, explanation: lesson.explanation, example: lesson.example, differently: lesson.differently, confusion: lesson.confusion, sources: lesson.sources.map(({ title, url, locator }) => ({ title, url, locator })) };
}
