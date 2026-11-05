import raw from '../data/site.json';

export type Question = { id: string; paper: string; year: number; marks: number | null; words: number | null; text: string; verified: boolean; also: number[] };
export type Theme = { n: number; key: string; slug: string; title: string; step: number; stage: number; cluster: string; clusterSlug: string;
  papers: Record<string, number>; cross: boolean; count: number; years: number[]; recent: number;
  syllabus: string[]; links: number[]; prereqs: number[]; related: number[]; directives: [string, number][]; asks: string; checklist: string[]; answer: string[]; questions: Question[];
  cover: Cover | null; pre: string[] };
export type Cover = { ncert: { book: string; ch: string }[]; book: string[]; bare: { t: string; url: string }[];
  sections: { h: string; items: { t: string; p: number | null; m: number | null }[] }[] };

export const themes = raw.themes as Theme[];
export const clusters = raw.clusters as { name: string; slug: string }[];
export const syllabus = raw.syllabus as { id: string; text: string; paper: string }[];
export const source = raw.source;
// This site's own GitHub repo (for typo reports). Unset → report links are hidden.
export const repoUrl = (import.meta.env.PUBLIC_REPO_URL || '').replace(/\/$/, '');
export const issueUrl = (title = '', body = '') => repoUrl ? `${repoUrl}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}` : '';
export const byN = new Map(themes.map((t) => [t.n, t]));
export type Stage = { n: number; name: string; why: string; themes: number[] };
export const stages = raw.stages as Stage[];
export const roadmap = [...themes].sort((a, b) => a.step - b.step);
export const byStep = new Map(roadmap.map((t) => [t.step, t]));
export const totalQuestions = themes.reduce((s, t) => s + t.count, 0);
export const papers = ['GS1', 'GS2', 'GS3'] as const;
export const paperName: Record<string, string> = {
  GS1: 'Indian Heritage & Culture, History, Geography & Society',
  GS2: 'Governance, Constitution, Polity, Social Justice & International Relations',
  GS3: 'Technology, Economy, Environment, Security & Disaster Management',
};

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const u = (p: string) => base + p;
export const themeUrl = (t: Theme) => u(`/themes/${t.slug}/`);
export const yearSpan = (t: Theme) => (t.years.length > 1 ? `${t.years[0]}–${t.years[t.years.length - 1]}` : t.years.length ? `${t.years[0]}` : '');
/** "12 Mains · 18 Prelims PYQs" style count line for lists. */
export const pyqLine = (t: Theme) => [t.count ? `${t.count} Mains` : '', t.pre.length ? `${t.pre.length} Prelims` : ''].filter(Boolean).join(' · ') + ' PYQs' + (t.years.length ? ` · ${yearSpan(t)}` : '');
export const allQuestions = themes.flatMap((t) => t.questions.map((q) => ({ ...q, theme: t })));
export const syllabusThemes = (id: string) => themes.filter((t) => t.syllabus.includes(id));
export const clip = (s: string, n = 155) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)) + '…');
export const shortTitle = (t: Theme) => t.title.split(':')[0];

// ---- One page per Mains PYQ: /mains/<year>/<paper>/<slug>/ ----
const slugify = (t: string) => t.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[‘’'"“”]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const qSlugs = new Map<string, string>();
{
  const seen = new Set<string>();
  for (const q of [...allQuestions].sort((a, b) => a.id.localeCompare(b.id))) {
    const words = slugify(q.text).split('-').filter(Boolean);
    let s = '';
    for (const w of words.slice(0, 10)) { if (s && (s + '-' + w).length > 72) break; s = s ? s + '-' + w : w; }
    s = s || q.id.toLowerCase();
    const key = (x: string) => `${q.year}/${q.paper}/${x}`;
    let k = 2, base0 = s;
    while (seen.has(key(s))) s = `${base0}-${k++}`;
    seen.add(key(s)); qSlugs.set(q.id, s);
  }
}
export const qPath = (q: { id: string; year: number; paper: string }) => `/mains/${q.year}/${q.paper.toLowerCase()}/${qSlugs.get(q.id)}/`;
export const qUrl = (q: { id: string; year: number; paper: string }) => u(qPath(q));
export const qSlug = (id: string) => qSlugs.get(id)!;

// Daily PYQs by Telegram direct message (bot runs from .github/workflows/telegram.yml)
export const telegramBot = 'https://t.me/upscthemesdaily_bot';
