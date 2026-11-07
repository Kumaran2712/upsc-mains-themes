import { createHash } from 'node:crypto';
import { concepts } from '../../src/lib/stage0/curriculum.ts';
import { PROMPT_VERSION } from '../../src/lib/stage0/version.ts';
import { dimensions, bindCases, evaluationPassed, outputBinding } from './evaluation.mjs';
import { validateAssessment } from '../../backend/provider.mjs';
export { dimensions };

export const catalogue = new Map(concepts.map((c) => [c.id, c]));
export const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Bind the review to both the exact guide already live and its proposed public replacement. */
export function guideBinding(lesson, originalGuide) {
  return digest({ id: lesson.id, originalGuide, proposedGuide: { explanation: lesson.explanation, example: lesson.example, distinction: lesson.confusion }, sources: lesson.sources.map(s => s.sha256) });
}
export function validateGuideReview(lesson, originalGuide, decision) {
  if (originalGuide?.id !== lesson.id || !['explanation', 'example', 'distinction'].every(key => typeof originalGuide[key] === 'string' && originalGuide[key].trim())) throw new Error('Exact original introductory guide required');
  if (decision?.binding !== guideBinding(lesson, originalGuide) || !['approved', 'corrections-needed'].includes(decision.originalDecision) || decision.proposedApproved !== true || !decision.rationale?.trim() || !Array.isArray(decision.findings)) throw new Error('Bound independent introductory guide review required');
  for (const finding of decision.findings) {
    if (!['explanation', 'example', 'distinction'].includes(finding.field) || !finding.issue?.trim() || !finding.resolution?.trim()) throw new Error('Guide finding requires a specific issue and resolution');
  }
  if (decision.originalDecision === 'corrections-needed' && (!decision.findings.length || digest({ explanation: originalGuide.explanation, example: originalGuide.example, distinction: originalGuide.distinction }) === digest({ explanation: lesson.explanation, example: lesson.example, distinction: lesson.confusion }))) throw new Error('Guide corrections must be resolved in the proposed public text');
  return decision;
}

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
  if (review.schemaVersion !== undefined && ![1, 2].includes(review.schemaVersion)) throw new Error('Unsupported approval schema');
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
  if (review.originalGuide) validateGuideReview(lesson, review.originalGuide, originalReview.guideReview);
  if (digest(parse(review.author).lesson) !== digest(lesson)) throw new Error('Author receipt does not match lesson');
  if (review.author.resolvedModel === review.reviewer.resolvedModel) throw new Error('Resolved author and reviewer models must differ');
  if (originalReview.decision !== 'approved' || !dimensions.every((d) => originalReview.scores?.[d] === 2)) throw new Error('Provider review does not approve content');
  const firstRuns = evidence.filter((entry) => entry.repeat === 0);
  const bound = bindCases(lesson, firstRuns.map((entry) => entry.scenario));
  if (review.schemaVersion === 2) {
    if (digest(bindCases(lesson, parse(review.author).tests)) !== digest(bound)) throw new Error('Evaluated cases do not match authored cases');
    if (originalReview.sourceChecks?.length !== lesson.sources.length || !lesson.sources.every((s, i) => originalReview.sourceChecks[i].sha256 === s.sha256 && originalReview.sourceChecks[i].supportsClaims === true && originalReview.sourceChecks[i].rationale?.trim())) throw new Error('Provider source review missing');
  }
  if (!Array.isArray(originalReview.caseLabels) || originalReview.caseLabels.length !== bound.length || !bound.every((_, index) => originalReview.caseLabels.filter((label) => label.index === index && label.valid === true).length === 1)) throw new Error('Independent reference-label review required');
  if (firstRuns.some((entry, i) => digest(entry.scenario.question) !== digest(bound[i].question))) throw new Error('Evaluation question does not match lesson');
  const receipts = new Set([review.author.runId, review.reviewer.runId]);
  const batchReceipts = new Map();
  for (const scenario of bound) {
    const repeats = evidence.filter((entry) => digest(entry.scenario) === digest(scenario));
    if (repeats.length !== 2 || ![0, 1].every((repeat) => repeats.some((entry) => entry.repeat === repeat))) throw new Error('Every case requires two independent runs');
    for (const entry of repeats) {
      const evaluation = parse(entry.evaluation);
      let verdict = evaluation;
      if (review.schemaVersion === 2) {
        const binding = outputBinding(entry);
        if (entry.evaluationBinding !== binding || !Array.isArray(evaluation.decisions) || evaluation.decisions.filter(d => d.binding === binding).length !== 1) throw new Error('Runtime review binding mismatch');
        verdict = evaluation.decisions.find(d => d.binding === binding);
        const prior = batchReceipts.get(entry.evaluation.runId);
        if (prior && prior !== digest(entry.evaluation)) throw new Error('Conflicting batch receipt');
        batchReceipts.set(entry.evaluation.runId, digest(entry.evaluation));
        if (entry.adjudication) {
          if (evaluationPassed(verdict)) throw new Error('Adjudication requires a disputed judgement');
          const adjudicated = parse(entry.adjudication);
          if (adjudicated.binding !== binding || [review.author.resolvedModel, review.reviewer.resolvedModel, entry.output.resolvedModel].includes(entry.adjudication.resolvedModel)) throw new Error('Independent bound adjudication required');
          if (receipts.has(entry.adjudication.runId)) throw new Error('Distinct adjudication run required');
          receipts.add(entry.adjudication.runId); verdict = adjudicated;
        }
        const actual = scenario.kind === 'assessment' ? validateAssessment(parse(entry.output), scenario.input) : entry.output.output;
        if (digest(entry.validatedOutput) !== digest(actual)) throw new Error('Reviewed output differs from provider output');
      }
      if (!evaluationPassed(verdict)) throw new Error('Actual output evaluation failed');
      if (entry.output?.state !== 'completed' || entry.output.resolvedModel !== review.tutorModel || !entry.output.output?.trim() || !Number.isFinite(Date.parse(entry.output.executedAt))) throw new Error('Runtime model/receipt mismatch');
      if (entry.evaluation.resolvedModel !== review.reviewer.resolvedModel) throw new Error('Runtime evaluation reviewer mismatch');
      for (const receipt of review.schemaVersion === 2 ? [entry.output] : [entry.output, entry.evaluation]) {
        if (!receipt.runId || receipts.has(receipt.runId)) throw new Error('Distinct provider runs required');
        receipts.add(receipt.runId);
      }
    }
  }
  for (const entry of evidence) if (review.schemaVersion === 2) {
    if (receipts.has(entry.evaluation.runId)) throw new Error('Review receipt reused as another provider run');
    const decisions = parse(entry.evaluation).decisions;
    const grouped = evidence.filter(e => e.evaluation.runId === entry.evaluation.runId);
    if (decisions.length !== grouped.length || !decisions.every(d => grouped.filter(e => e.evaluationBinding === d.binding).length === 1)) throw new Error('Batch review contains unbound or duplicate decisions');
  }
  return review;
}

export function toPublicLesson(lesson) {
  return { id: lesson.id, version: lesson.version, objective: lesson.objective, explanation: lesson.explanation, example: lesson.example, differently: lesson.differently, confusion: lesson.confusion, sources: lesson.sources.map(({ title, url, locator }) => ({ title, url, locator })) };
}
