import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fail } from '../../errors.mjs';
import { dayKey } from '../../store.mjs';
const read = (path) => JSON.parse(readFileSync(new URL('../../../' + path, import.meta.url), 'utf8'));
const site = read('src/data/site.json'), daily = read('src/data/daily.json'), prelims = read('data/prelims.json');
const lab = read('src/data/maps_lab.json'), maps = read('src/data/maps.json');
export const quizSizes = new Map([['india-states', 10], ['chokepoints', 8], ...maps.layerModules.map((module) => {
  const places = module.layers.some((layer) => layer.kind !== 'states');
  const size = module.layers.reduce((sum, layer) => sum + (places ? layer.kind !== 'states' ? layer.items.length : 0 : layer.groups.length > 1 && layer.groups.every((g) => g.items.length > 1) ? layer.groups.length : 1), 0);
  return [module.slug, Math.min(8, size)];
})]);
export const themes = new Set(site.themes.map((t) => t.n));
const questions = new Map(prelims.questions.map((q) => [q.id, q]));
export const practiceVersion = createHash('sha256').update(JSON.stringify({ daily, questions: prelims.questions.map((q) => [q.id, q.stem, q.options, q.answer, q.dropped]) })).digest('hex');
export function validateDay(day, now = Date.now()) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0, 10) !== day || day < daily.epoch || day > dayKey(now)) fail(422, 'invalid_day', 'Choose an available practice date.');
  return day;
}
export function scorePractice(day, answers, now) {
  validateDay(day, now);
  const offset = Math.floor((Date.parse(day) - Date.parse(daily.epoch)) / 86400000);
  const ids = daily.prelims[((offset % daily.prelims.length) + daily.prelims.length) % daily.prelims.length];
  if (!Array.isArray(answers) || answers.length > ids.length || answers.some((a) => a !== null && !['a', 'b', 'c', 'd'].includes(a))) fail(422, 'invalid_answers', 'Select valid answers for this set.');
  const padded = ids.map((_, i) => answers[i] ?? null);
  let correct = 0, wrong = 0;
  ids.forEach((id, i) => { if (padded[i]) { if (padded[i] === questions.get(id).answer) correct++; else wrong++; } });
  return { version: practiceVersion, questionIds: ids, questions: ids.map((id) => { const q = questions.get(id); return { id, stem: q.stem, options: q.options, answer: q.answer }; }), answers: padded, correct, wrong, unanswered: ids.length - correct - wrong, score: Math.round((correct * 2 - wrong * 2 / 3) * 100) / 100 };
}
export function validateMap(value) {
  if (value.mode === 'quiz') {
    const total = quizSizes.get(value.mapId);
    if (!total || !Number.isInteger(value.score) || value.score < 0 || value.score > total) fail(422, 'invalid_quiz_score', 'Check the map quiz score.');
    return { mode: 'quiz', mapId: value.mapId, score: value.score, total, seconds: null, selfReported: true };
  }
  const card = value.mapId === 'free-india' ? { id: 'free-india', checklist: Array(5) } : lab.find((c) => c.id === value.mapId);
  if (!card || !Number.isInteger(value.score) || value.score < 0 || value.score > card.checklist.length || (value.seconds !== null && (!Number.isInteger(value.seconds) || value.seconds < 0 || value.seconds > 999))) fail(422, 'invalid_map_attempt', 'Check the map and self-assessment score.');
  return { mode: 'sketch', mapId: card.id, score: value.score, total: card.checklist.length, seconds: value.seconds, selfReported: true };
}
