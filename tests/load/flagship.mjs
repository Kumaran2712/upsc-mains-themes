import assert from 'node:assert/strict';
import { fixture, client } from '../../backend/test/helpers.mjs';
import { PostgresDatabase } from '../../backend/postgres.mjs';
import { PostgresStore } from '../../backend/postgres-store.mjs';
import { readEvents } from '../../src/lib/stage0/sse.ts';

// Isolated synthetic learners and a local provider fixture. Never contacts a paid
// provider or the public product, and never writes to an existing database schema.
let admin, schema, store;
if (process.env.TEST_DATABASE_URL) {
  admin = new PostgresDatabase(process.env.TEST_DATABASE_URL);
  schema = 'load_' + crypto.randomUUID().replaceAll('-', '');
  await admin.query(`CREATE SCHEMA ${schema}`);
  const url = new URL(process.env.TEST_DATABASE_URL); url.searchParams.set('options', '-csearch_path=' + schema);
  const database = new PostgresDatabase(url.href); await database.migrate(); store = new PostgresStore(database);
}
const f = await fixture({ SERVE_STATIC: 'true', MAX_CONCURRENT_AI: '10' }, store ? { store } : {});
const learners = Array.from({ length: 20 }, () => client(f.base));
const streams = [], report = { storage: store ? 'PostgreSQL' : 'SQLite', provider: 'local protocol fixture', publicReaders: 100, authenticatedLearners: 20, concurrentStreams: 10 };
const summarize = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return { count: values.length, p50Ms: Math.round(sorted[Math.ceil(sorted.length * .5) - 1]), p95Ms: Math.round(sorted[Math.ceil(sorted.length * .95) - 1]), maxMs: Math.round(sorted.at(-1)) };
};
async function timed(action) { const start = performance.now(); await action(); return performance.now() - start; }
try {
  for (let i = 0; i < learners.length; i++) assert.equal((await learners[i].signup('load_learner_' + i)).status, 201);
  const arrivals = [];
  for (const learner of learners.slice(0, 10)) {
    let arrived;
    arrivals.push(new Promise((resolve) => { arrived = resolve; }));
    const id = crypto.randomUUID();
    const response = await learner.request('/chat', { conceptId: 'polity/sovereignty', revision: 0, message: 'slow-reply load fixture', requestId: id });
    assert.equal(response.status, 200);
    const consumed = (async () => {
      const events = [];
      for await (const event of readEvents(response.body)) {
        events.push(event.event);
        if (event.event === 'delta') arrived();
      }
      return events;
    })();
    streams.push({ learner, id, consumed });
  }
  await Promise.race([Promise.all(arrivals), new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Ten streams did not reach the fixture')), 15000); timer.unref(); })]);
  const overflow = await learners[10].json('/chat', { conceptId: 'polity/sovereignty', revision: 0, message: 'excess request', requestId: crypto.randomUUID() });
  assert.equal(overflow.status, 429); assert.equal(overflow.body.error.code, 'tutor_busy');
  const [readers, activities] = await Promise.all([
    Promise.all(Array.from({ length: 100 }, (_, i) => timed(async () => {
      const response = await fetch(f.base + ['/stage-0/', '/themes/', '/questions/', '/maps/'][i % 4]);
      assert.equal(response.status, 200); assert.match(await response.text(), /<!doctype html>/i);
    }))),
    Promise.all(learners.map((learner) => timed(async () => {
      assert.equal((await learner.json('/activity/roadmap', { themeId: 1, completed: true, revision: 0 })).status, 200);
      const snapshot = await learner.json('/activity'); assert.equal(snapshot.body.roadmap[0].completed, true);
    }))),
  ]);
  report.publicReadLatency = summarize(readers); report.saveAndReadLatency = summarize(activities);
  await Promise.all(streams.map(async ({ learner, id, consumed }) => {
    assert.equal((await learner.json('/operation/cancel', { id })).body.state, 'cancelled');
    const events = await consumed; assert(!events.includes('done'));
    assert.equal((await learner.json('/operation?id=' + id)).body.state, 'cancelled');
    assert.equal((await learner.json('/conversation?conceptId=polity%2Fsovereignty')).body.conversation.messages.length, 0);
  }));
  assert.equal(f.model.calls.length, 10, 'Excess demand must never reach the provider');
  report.excessDemand = '429 tutor_busy before provider dispatch'; report.cancelledStreams = 10;
  console.log(JSON.stringify(report, null, 2));
} finally {
  await f.close();
  if (admin) { await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.close(); }
}
