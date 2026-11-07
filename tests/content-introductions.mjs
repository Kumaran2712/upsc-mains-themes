import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { concepts } from '../src/lib/stage0/curriculum.ts';

const guides = new Map();
for (const subject of new Set(concepts.map(c => c.subject.id))) {
  const file = JSON.parse(await readFile(`content/stage0/introductions/${subject}.json`, 'utf8'));
  for (const entry of file.entries) { assert(!guides.has(entry.id)); guides.set(entry.id, entry); }
}
assert.equal(guides.size, concepts.length);
const release = JSON.parse(await readFile('src/lib/stage0/release.json', 'utf8'));
const reviewed = new Map(release.published.map(entry => [entry.id, entry]));
const plain = html => html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
for (const concept of concepts) {
  const html = await readFile(`dist/stage-0/${concept.id}/index.html`, 'utf8');
  const section = html.match(/<section[^>]*aria-label="Introduction to [^"]+"[^>]*>([\s\S]*?)<\/section>/);
  assert(section, concept.id + ': missing anonymous introduction');
  const text = plain(section[1]), guide = reviewed.get(concept.id) || guides.get(concept.id);
  for (const heading of ['The central idea', 'An example', 'A useful distinction']) assert(text.includes(heading), concept.id + ': missing ' + heading);
  for (const field of [guide.explanation, guide.example, guide.confusion || guide.distinction]) assert(text.includes(plain(field)), concept.id + ': missing actual authored text');
  const workspace = html.indexOf('data-live-workspace');
  if (workspace >= 0) assert(html.indexOf(section[0]) < workspace, concept.id + ': reading must precede sign-in-dependent chat');
}
console.log(`PASS: all ${concepts.length} concept pages contain their actual central idea, example and distinction as anonymous HTML before chat.`);
