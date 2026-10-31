import raw from '../data/site.json';

export type Question = { id: string; paper: string; year: number; marks: number | null; words: number | null; text: string; verified: boolean; also: number[] };
export type Theme = { n: number; key: string; slug: string; title: string; cluster: string; clusterSlug: string;
  papers: Record<string, number>; cross: boolean; count: number; years: number[]; recent: number;
  syllabus: string[]; links: number[]; directives: [string, number][]; asks: string; checklist: string[]; answer: string[]; questions: Question[] };

export const themes = raw.themes as Theme[];
export const clusters = raw.clusters as { name: string; slug: string }[];
export const syllabus = raw.syllabus as { id: string; text: string; paper: string }[];
export const source = raw.source;
// This site's own GitHub repo (for typo reports). Unset → report links are hidden.
export const repoUrl = (import.meta.env.PUBLIC_REPO_URL || '').replace(/\/$/, '');
export const issueUrl = (title = '', body = '') => repoUrl ? `${repoUrl}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}` : '';
export const byN = new Map(themes.map((t) => [t.n, t]));
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
export const yearSpan = (t: Theme) => (t.years.length > 1 ? `${t.years[0]}–${t.years[t.years.length - 1]}` : `${t.years[0]}`);
export const allQuestions = themes.flatMap((t) => t.questions.map((q) => ({ ...q, theme: t })));
export const syllabusThemes = (id: string) => themes.filter((t) => t.syllabus.includes(id));
export const clip = (s: string, n = 155) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)) + '…');
export const shortTitle = (t: Theme) => t.title.split(':')[0];
