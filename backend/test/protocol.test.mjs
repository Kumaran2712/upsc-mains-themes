import test from 'node:test';
import assert from 'node:assert/strict';
import { readEvents } from '../../src/lib/stage0/sse.ts';
import { validateAssessment } from '../provider.mjs';
import { lessons, questionsFor } from '../lessons.mjs';

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
});
test('twelve pilot placements have bounded, source-linked subject contexts and fresh applications', () => {
  assert.equal(lessons.size, 12); assert(!lessons.has('international-relations/state'));
  for (const lesson of lessons.values()) {
    assert(lesson.core && lesson.distinction && lesson.sources.length);
    const questions = questionsFor(lesson, 12345); assert.equal(questions.length, 3);
    assert(questions.every((q) => q.question && q.expected));
    assert.notEqual(questions[2].question, questionsFor(lesson, 12346)[2].question);
  }
});
