import prelimsRaw from '../../data/prelims.json';
import dailyRaw from '../data/daily.json';
import { allQuestions, themeUrl, shortTitle } from './data';

export type Block = { p?: string; li?: string; table?: string[][] };
export type Prelims = { id: string; year: number | null; subject: string; stem: Block[]; options: string[]; answer: string; dropped: boolean };
export const prelims = (prelimsRaw as { questions: Prelims[] }).questions;
export const daily = dailyRaw as { epoch: string; prelims: string[][]; mains: string[][] };

const pById = new Map(prelims.map((q) => [q.id, q]));
const mById = new Map(allQuestions.map((q) => [q.id, q]));
for (const s of daily.prelims) for (const id of s) if (!pById.has(id)) throw new Error(`daily.json: unknown Prelims id ${id}`);
for (const s of daily.mains) for (const id of s) if (!mById.has(id)) throw new Error(`daily.json: unknown Mains id ${id}`);

/** The latest year whose official UPSC Prelims key is out. Later years show a note. */
export const OFFICIAL_KEY_UPTO = 2025;

export const prelimsSet = (i: number) => daily.prelims[i].map((id) => {
  const q = pById.get(id)!;
  return { id: q.id, y: q.year, s: q.subject, st: q.stem, o: q.options, a: q.answer };
});
export const mainsSet = (i: number) => daily.mains[i].map((id) => {
  const q = mById.get(id)!, t = q.theme;
  return { id: q.id, p: q.paper, y: q.year, m: q.marks, w: q.words, t: q.text,
    th: { n: t.n, title: shortTitle(t), url: themeUrl(t), asks: t.asks, checklist: t.checklist, answer: t.answer } };
});
