import { themes, themeUrl } from '../lib/data';
export function GET() {
  const items = themes.map((t) => ({ n: t.n, t: t.title, u: themeUrl(t), c: t.count,
    q: t.questions.map((q) => [q.id, q.paper, q.year, q.text]) }));
  return new Response(JSON.stringify(items), { headers: { 'Content-Type': 'application/json' } });
}
