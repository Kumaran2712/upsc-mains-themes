import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { catalogue, validateLesson, validateApproval, toPublicLesson, digest } from './contract.mjs';

export async function compile(root = resolve('content/stage0')) {
  const published = [], privateLessons = [];
  const walk = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true }).catch((error) => { if (error.code === 'ENOENT') return []; throw error; });
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.name.endsWith('.json')) {
        const lesson = validateLesson(JSON.parse(await readFile(path, 'utf8')));
        const review = JSON.parse(await readFile(resolve(root, 'reviews', lesson.id.replace('/', '--') + '.json'), 'utf8'));
        validateApproval(lesson, review);
        if (privateLessons.some((l) => l.id === lesson.id)) throw new Error('Duplicate lesson placement');
        privateLessons.push({ ...lesson, evaluatedModel: review.tutorModel, evaluatedPromptVersion: review.evaluation.promptVersion }); published.push(toPublicLesson(lesson));
      }
    }
  };
  await walk(resolve(root, 'lessons'));
  published.sort((a, b) => a.id.localeCompare(b.id));
  const current = JSON.parse(await readFile('src/lib/stage0/release.json', 'utf8'));
  const release = { version: digest(published), pilotPlacements: current.pilotPlacements.filter((id) => !published.some((l) => l.id === id)), published };
  if (process.argv.includes('--require-complete') && published.length !== catalogue.size) throw new Error(`Incomplete curriculum: ${published.length}/${catalogue.size}`);
  await mkdir('content/stage0/generated', { recursive: true });
  await writeFile('src/lib/stage0/release.json', JSON.stringify(release, null, 2) + '\n');
  await writeFile('content/stage0/generated/lessons.json', JSON.stringify(privateLessons, null, 2) + '\n');
  console.log(`Content release compiled: ${published.length}/${catalogue.size} approved; ${release.pilotPlacements.length} legacy pilots retained.`);
}
if (process.argv[1] === new URL(import.meta.url).pathname) await compile();
