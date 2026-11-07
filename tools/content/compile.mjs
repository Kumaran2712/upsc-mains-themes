import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { catalogue, validateLesson, validateApproval, toPublicLesson, digest } from './contract.mjs';
import { validateReviewControls } from './calibration.mjs';

export async function compile(root = resolve('content/stage0')) {
  const published = [], privateLessons = [];
  const introductions = new Map();
  for (const subject of new Set([...catalogue.values()].map(c => c.subject.id))) {
    const file = JSON.parse(await readFile(resolve(root, 'introductions', subject + '.json'), 'utf8'));
    for (const entry of file.entries) {
      if (!catalogue.has(entry.id) || introductions.has(entry.id) || ['explanation', 'example', 'distinction'].some(key => typeof entry[key] !== 'string' || entry[key].trim().length < 40)) throw new Error('Incomplete or duplicated introduction: ' + entry.id);
      introductions.set(entry.id, { explanation: entry.explanation, example: entry.example, distinction: entry.distinction });
    }
  }
  if (introductions.size !== catalogue.size) throw new Error('All 253 introductory guides are required');
  const walk = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true }).catch((error) => { if (error.code === 'ENOENT') return []; throw error; });
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.name.endsWith('.json')) {
        const lesson = validateLesson(JSON.parse(await readFile(path, 'utf8')));
        const review = JSON.parse(await readFile(resolve(root, 'reviews', lesson.id.replace('/', '--') + '.json'), 'utf8'));
        validateApproval(lesson, review);
        if (review.schemaVersion === 2) {
          const controls = JSON.parse(await readFile(resolve(root, 'calibration', 'current-controls.json'), 'utf8'));
          const inflation = JSON.parse(await readFile(resolve(root, 'lessons', 'economics/inflation.json'), 'utf8'));
          const rubric = await readFile('docs/stage0-teaching-rubric.md', 'utf8');
          validateReviewControls(controls, { lesson: inflation, reviewerModel: review.reviewer.resolvedModel, rubric });
        }
        if (privateLessons.some((l) => l.id === lesson.id)) throw new Error('Duplicate lesson placement');
        privateLessons.push({ ...lesson, evaluatedModel: review.tutorModel, evaluatedPromptVersion: review.evaluation.promptVersion }); published.push(toPublicLesson(lesson));
      }
    }
  };
  await walk(resolve(root, 'lessons'));
  published.sort((a, b) => a.id.localeCompare(b.id));
  const current = JSON.parse(await readFile('src/lib/stage0/release.json', 'utf8'));
  const pilotPlacements = current.pilotPlacements.filter((id) => !published.some(l => l.id === id));
  const guided = [], guidedPrivate = [];
  for (const placement of catalogue.values()) {
    if (pilotPlacements.includes(placement.id) || published.some(l => l.id === placement.id)) continue;
    const packet = JSON.parse(await readFile(resolve(root, 'sources', placement.id.replace('/', '--') + '.json'), 'utf8'));
    if (!packet.sources?.length) throw new Error('Source packet required for guided tutoring: ' + placement.id);
    for (const source of packet.sources) {
      if (!source.excerpt?.trim() || !/^[a-f0-9]{64}$/.test(source.sha256 || '') || new URL(source.url).protocol !== 'https:') throw new Error('Invalid guided source: ' + placement.id);
    }
    const context = { id: placement.id, name: placement.name, subject: placement.subject.name, category: placement.category.name, objective: placement.objective, introduction: introductions.get(placement.id), kind: 'source-guided', assessmentAvailable: false,
      sources: packet.sources.map(({ title, url, locator, excerpt, sha256 }) => ({ title, url, locator, excerpt, sha256 })) };
    context.version = 'guided-' + digest(context);
    guidedPrivate.push(context);
    guided.push({ id: context.id, version: context.version, sources: context.sources.map(({ title, url, locator }) => ({ title, url, locator })) });
  }
  const release = { version: digest({ published, pilotPlacements, guided }), pilotPlacements, guided, published };
  if (process.argv.includes('--require-complete') && published.length !== catalogue.size) throw new Error(`Incomplete curriculum: ${published.length}/${catalogue.size}`);
  await mkdir('content/stage0/generated', { recursive: true });
  await writeFile('src/lib/stage0/release.json', JSON.stringify(release, null, 2) + '\n');
  await writeFile('content/stage0/generated/lessons.json', JSON.stringify(privateLessons, null, 2) + '\n');
  await writeFile('content/stage0/generated/guided.json', JSON.stringify(guidedPrivate, null, 2) + '\n');
  console.log(`Content release compiled: ${published.length}/${catalogue.size} approved; ${pilotPlacements.length} legacy pilots; ${guided.length} source-guided tutors.`);
}
if (process.argv[1] === new URL(import.meta.url).pathname) await compile();
