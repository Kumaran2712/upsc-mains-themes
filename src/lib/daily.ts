import prelimsRaw from '../../data/prelims.json';
import dailyRaw from '../data/daily.json';
import { allQuestions, themeUrl, shortTitle, qUrl, roadmap } from './data';

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
  return { id: q.id, p: q.paper, y: q.year, m: q.marks, w: q.words, t: q.text, u: qUrl(q),
    th: { n: t.n, title: shortTitle(t), url: themeUrl(t), asks: t.asks, checklist: t.checklist, answer: t.answer } };
});

// ---- Prelims browse pages ----
export const preYears = [...new Set(prelims.filter((q) => q.year).map((q) => q.year!))].sort((a, b) => b - a);
export const subjSlug = (s: string) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const preSubjects = [...new Set(prelims.map((q) => q.subject))].sort();
const SUBJECT_ORDER = ['Ancient India', 'Medieval India', 'Modern India', 'Art & Culture', 'World Geography', 'Indian Geography',
  'Polity & Governance', 'International Relations', 'Economy', 'Environment & Ecology', 'Science & Technology', 'Current Affairs & GK'];
export const subjRank = (s: string) => { const i = SUBJECT_ORDER.indexOf(s); return i < 0 ? 99 : i; };
/** Questions shown on browse pages: those with a known year. */
export const preByYear = (y: number) => prelims.filter((q) => q.year === y).sort((a, b) => subjRank(a.subject) - subjRank(b.subject) || a.id.localeCompare(b.id));
export const preBySubject = (s: string) => prelims.filter((q) => q.subject === s && q.year).sort((a, b) => b.year! - a.year! || a.id.localeCompare(b.id));

// ---- Theme of the day: themes in roadmap order, one a day ----
export const themeOfDay = (i: number) => {
  const t = roadmap[i];
  return { n: t.n, step: t.step, title: t.title, url: themeUrl(t), papers: t.papers, count: t.count, pcount: t.pre.length, asks: t.asks, checklist: t.checklist, answer: t.answer };
};
export const dailyMeta = () => ({ epoch: daily.epoch, P: daily.prelims.length, M: daily.mains.length, T: roadmap.length, officialKeyUpto: OFFICIAL_KEY_UPTO });
