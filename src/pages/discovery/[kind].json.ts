import { themes, allQuestions, themeUrl, qUrl, syllabus, u } from '../../lib/data';
import { concepts, conceptPath } from '../../lib/stage0/curriculum';
import { prelims } from '../../lib/daily';
import { modules, moduleUrl } from '../../lib/maps';
export function getStaticPaths() { return ['concepts', 'themes', 'mains', 'prelims', 'maps', 'syllabus'].map((kind) => ({ params: { kind } })); }
export function GET({ params }: { params: { kind: string } }) {
  const entries = {
    concepts: concepts.map((c) => ({ title: c.name, text: `${c.subject.name} · ${c.category.name}`, url: u(conceptPath(c)), aliases: c.subject.id === 'international-relations' ? 'IR' : '' })),
    themes: themes.map((t) => ({ title: t.title, text: `${t.cluster} · ${t.count} Mains questions`, url: themeUrl(t) })),
    mains: allQuestions.map((q) => ({ title: `${q.paper} ${q.year}`, text: q.text, url: qUrl(q) })),
    prelims: prelims.filter((q) => q.year).map((q) => ({ title: `Prelims ${q.year} · ${q.subject}`, text: q.stem.map((b) => b.p || b.li || b.table?.flat().join(' ') || '').join(' '), url: u(`/prelims/${q.year}/#${q.id}`) })),
    maps: modules.filter((m) => m.slug).map((m) => ({ title: m.name, text: m.covers, url: moduleUrl(m) })),
    syllabus: syllabus.map((s) => ({ title: s.paper + ' syllabus', text: s.text, url: u(`/syllabus/${s.id}/`) })),
  };
  return new Response(JSON.stringify(entries[params.kind as keyof typeof entries]), { headers: { 'Content-Type': 'application/json' } });
}
