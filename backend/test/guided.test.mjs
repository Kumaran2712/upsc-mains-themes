import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, client } from './helpers.mjs';
import { lessons, tutorInstructions } from '../lessons.mjs';
import { concepts } from '../../src/lib/stage0/curriculum.ts';
import { readEvents } from '../../src/lib/stage0/sse.ts';

test('all 253 concepts support owned streaming conversations while unprepared assessment endpoints fail before provider dispatch', async t => {
  const f = await fixture(); t.after(() => f.close()); const learner = client(f.base); await learner.signup('guided_learner');
  const capabilities = (await learner.json('/capabilities')).body;
  assert.deepEqual(new Set(capabilities.placements), new Set(concepts.map(c => c.id)));
  assert.equal(capabilities.assessmentPlacements.length, 12);
  for (const id of ['polity/law', 'economics/bank', 'geography/erosion', 'international-relations/multilateral-relations']) {
    const lesson = lessons.get(id); assert.equal(lesson.kind, 'source-guided');
    const before = f.model.calls.length;
    const check = await learner.json('/assessment/start', { conceptId: id, revision: 0 });
    assert.equal(check.status, 409); assert.equal(check.body.error.code, 'assessment_not_ready'); assert.equal(f.model.calls.length, before);
    const response = await learner.request('/chat', { conceptId: id, revision: 0, message: 'Explain this concept with a simple example.', requestId: crypto.randomUUID() });
    assert.equal(response.status, 200);
    const events = []; for await (const event of readEvents(response.body)) events.push({ type: event.event, data: JSON.parse(event.data) });
    const done = events.find(e => e.type === 'done').data;
    assert.equal(done.conversation.conceptId, id); assert.equal(done.conversation.status, 'Exploring'); assert.equal(done.conversation.assessment, null); assert.equal(done.conversation.messages.length, 2);
    assert(f.model.calls.at(-1).instructions.includes(lesson.name)); assert(f.model.calls.at(-1).instructions.includes(lesson.subject));
    assert(f.model.calls.at(-1).instructions.includes(lesson.sources[0].sha256));
    assert.equal((await learner.json('/conversation?conceptId=' + encodeURIComponent(id))).body.conversation.messages.length, 2);
    const saved = await learner.json('/conversation/bookmark', { conceptId: id, revision: done.conversation.revision, revisit: true }); assert.equal(saved.body.conversation.revisit, true);
  }
  const other = client(f.base); await other.signup('guided_other');
  assert.equal((await other.json('/conversation?conceptId=international-relations%2Fmultilateral-relations')).body.conversation.messages.length, 0);
  const instructions = tutorInstructions(lessons.get('international-relations/state'));
  assert.match(instructions, /sovereign country/); assert.match(instructions, /not have an automated understanding check/);
  assert(!instructions.includes('Invite the learner to use Check understanding.'));
});
