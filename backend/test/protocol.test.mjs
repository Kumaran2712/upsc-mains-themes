import test from 'node:test';
import assert from 'node:assert/strict';
import { readEvents } from '../../src/lib/stage0/sse.ts';
import { validateAssessment } from '../provider.mjs';
import { lessons, questionsFor } from '../lessons.mjs';
import { readFileSync } from 'node:fs';

test('SSE parser preserves multibyte text, CRLF frames, comments and multiline data', async () => {
  const input = ': heartbeat\r\n\r\nevent: delta\r\ndata: தமிழ் ₹100\r\n\r\nevent: done\ndata: first\ndata: second\n\n';
  const bytes = new TextEncoder().encode(input);
  const stream = new ReadableStream({ start(controller) { for (const byte of bytes) controller.enqueue(new Uint8Array([byte])); controller.close(); } });
  const events = []; for await (const event of readEvents(stream)) events.push(event);
  assert.deepEqual(events, [{ event: 'delta', data: 'தமிழ் ₹100' }, { event: 'done', data: 'first\nsecond' }]);
});
test('assessment validation rejects ungrounded evidence and contradictory perfect scores', () => {
  const good = { score: 2, misconception: false, evidence: 'my words', gap: '', feedback: 'Accurate reasoning.' };
  assert.equal(validateAssessment(good, 'In my words, this means governing authority.').score, 2);
  assert.throws(() => validateAssessment({ ...good, evidence: 'invented quote' }, 'my words'));
  assert.throws(() => validateAssessment({ ...good, misconception: true }, 'my words'));
  assert.throws(() => validateAssessment({ ...good, score: 1 }, 'my words'));
  assert.throws(() => validateAssessment({ ...good, score: 5 }, 'my words'));
  assert.equal(validateAssessment({ ...good, evidence: '"my words"' }, 'In my words, this means governing authority.').evidence, 'my words');
  assert.equal(validateAssessment({ ...good, evidence: 'my words' }, 'My words show independent reasoning.').evidence, 'My words');
  assert.throws(() => validateAssessment({ ...good, evidence: '"invented words"' }, 'My words show independent reasoning.'));
});
test('published and pilot placements have bounded subject contexts and fresh applications', () => {
  const release = JSON.parse(readFileSync(new URL('../../src/lib/stage0/release.json', import.meta.url), 'utf8'));
  assert.equal(lessons.size, new Set([...release.pilotPlacements, ...release.published.map(lesson => lesson.id), ...release.guided.map(c => c.id)]).size);
  assert.equal(lessons.size, 253);
  assert.equal(lessons.get('polity/state').subject, 'Polity');
  if (lessons.has('international-relations/state')) assert.equal(lessons.get('international-relations/state').subject, 'International Relations');
  for (const lesson of lessons.values()) {
    if (lesson.kind === 'source-guided') {
      assert.equal(lesson.assessmentAvailable, false); assert(lesson.sources.every(s => s.excerpt && s.sha256 && s.url.startsWith('https://')));
      assert.throws(() => questionsFor(lesson, 12345), /not available/); continue;
    }
    assert(lesson.core && lesson.distinction && lesson.sources.length);
    const questions = questionsFor(lesson, 12345); assert.equal(questions.length, 3);
    assert(questions.every((q) => q.question && q.expected));
    assert.notEqual(questions[2].question, questionsFor(lesson, 12346)[2].question);
  }
});
