import mapsRaw from '../data/maps.json';
import labRaw from '../data/maps_lab.json';
import { themes, allQuestions, u, themeUrl } from './data';

export const maps = mapsRaw as any;
export type Base = 'india' | 'world' | 'physical' | 'history' | 'drainage' | 'indiaplus';
export type LabCard = { id: string; base: Base; section?: string; groups: { label: string; items: string[] }[]; checklist: string[] };

// ---- Validate lab content against the map data and question bank (build fails on a typo) ----
const names: Record<Base, Set<string>> = {
  india: new Set(maps.india.states.map((s: any) => s.name)),
  world: new Set(maps.world.chokepoints.map((c: any) => c.name)),
  physical: new Set([...maps.physical.features, ...maps.physical.seas, ...maps.physical.rivers].map((f: any) => f.name)),
  history: new Set([...maps.history.countries.map((c: any) => c.name), ...maps.history.pins.map((p: any) => p.name),
    ...new Set(maps.history.countries.map((c: any) => '@' + c.cont))]),
  drainage: new Set([...maps.drainage.rivers.map((r: any) => r.name), ...maps.india.states.map((s: any) => s.name)]),
  indiaplus: new Set([...maps.india.states.map((s: any) => s.name),
    ...maps.layerModules.flatMap((m: any) => m.layers.filter((l: any) => l.kind !== 'states').flatMap((l: any) => l.items.map((i: any) => i.name)))]),
};
const qById = new Map(allQuestions.map((q) => [q.id, q]));
for (const c of labRaw as LabCard[]) {
  if (!qById.has(c.id)) throw new Error(`maps_lab.json: unknown PYQ ${c.id}`);
  if (!names[c.base]) throw new Error(`maps_lab.json: unknown base "${c.base}" in ${c.id}`);
  for (const g of c.groups) for (const it of g.items) if (!names[c.base].has(it)) throw new Error(`maps_lab.json: "${it}" is not on the ${c.base} map (${c.id})`);
}
export const lab = (labRaw as LabCard[]).map((c) => ({ ...c, q: qById.get(c.id)! }));

// ---- The module ladder (basic → advanced). `slug` set = built. ----
export type Module = { n: number; name: string; covers: string; papers: string; slug?: string; themes?: string[]; also?: { label: string; slug: string } };
export const modules: Module[] = [
  { n: 0, name: 'India outline & map grammar', covers: 'Drawing India in 60 seconds: latitude–longitude frame, Tropic of Cancer, standard meridian, extreme points, states and island groups.', papers: 'Used in every GS1–GS3 sketch', slug: 'india-outline', themes: ['tectonics', 'statesreorg', 'specialprov', 'regionalism', 'coopfed'] },
  { n: 1, name: 'Physical India', covers: 'Mountains and hills, plateaus, plains and desert, coasts and deltas, passes, peaks and islands.', papers: 'GS1', slug: 'physical-india' },
  { n: 2, name: 'Drainage & water bodies', covers: 'Himalayan and peninsular rivers, east- and west-flowing rivers, the Indus system, inter-state and transboundary river issues.', papers: 'GS1 · GS2 · GS3', slug: 'drainage' },
  { n: 3, name: 'Climate, monsoon & soils', covers: 'The two monsoon branches, rainfall extremes, the north-east monsoon, and the main soil regions.', papers: 'GS1 · GS3', slug: 'climate' },
  { n: 4, name: 'World physical framework', covers: 'Mountain ranges, hot and cold deserts, plateaus and plains, cyclone seas, great rivers, Equator and Tropics.', papers: 'GS1', slug: 'world-physical' },
  { n: 5, name: 'Hazard zones', covers: 'Seismic zone V; cyclone-, flood-, drought- and landslide-prone states; major disasters since 1984.', papers: 'GS1 · GS3', slug: 'hazards' },
  { n: 6, name: 'Resources & agriculture', covers: 'Coal, iron ore, bauxite, oil and gas; rice, wheat, sugarcane, cotton, tea, coffee and jute states.', papers: 'GS1 · GS3', slug: 'resources' },
  { n: 7, name: 'Industry & infrastructure', covers: 'Steel plants, refineries, the 12 major ports, freight corridors and industrial corridors.', papers: 'GS1 · GS3', slug: 'industry' },
  { n: 8, name: 'History on the map', covers: 'World: revolutions, industrialisation, the World Wars, decolonisation, Suez. India: Harappan and Buddhist sites, temples, 1857, Gandhian movements, tribal revolts.', papers: 'GS1', slug: 'history', also: { label: 'India places', slug: 'india-history' } },
  { n: 9, name: 'Society & polity on the map', covers: 'Fifth and Sixth Schedules, Article 371 states, states formed after 1956, Union Territories, sex-ratio extremes.', papers: 'GS1 · GS2', slug: 'society-polity' },
  { n: 10, name: 'Neighbourhood & sea routes', covers: 'India’s land neighbours and border lengths; straits, channels and chokepoints on India’s trade routes.', papers: 'GS1 · GS2 · GS3', slug: 'neighbourhood-and-sea-routes' },
  { n: 11, name: 'Borders & internal security', covers: 'States on each border and the force guarding it, the LWE belt, coastal states and security hotspots.', papers: 'GS3', slug: 'borders-security' },
  { n: 12, name: 'Environment overlays', covers: 'Selected Ramsar sites, tiger reserves, UNESCO biosphere reserves, mangroves and coral reefs.', papers: 'GS1 · GS3', slug: 'environment' },
  { n: 13, name: 'PYQ sketch lab', covers: 'Pick a PYQ, sketch the map against the clock, reveal the answer, score yourself.', papers: 'GS1 · GS2 · GS3', slug: 'lab' },
];
// Theme links for data-driven modules come from their map data.
const collect = (...lists: any[][]) => [...new Set(lists.flat().flatMap((x: any) => x.themes))];
modules[2].themes = collect(maps.drainage.rivers);
modules[4].themes = collect(maps.physical.features, maps.physical.seas, maps.physical.rivers);
modules[8].themes = collect(maps.history.pins);
for (const lm of maps.layerModules) {
  const mod = modules.find((m) => m.slug === lm.slug || m.also?.slug === lm.slug)!;
  mod.themes = [...new Set([...(mod.themes || []), ...lm.layers.flatMap((l: any) => l.themes || [])])];
}
// Module 10's themes come from its map data.
const m10 = new Set<string>();
for (const n of maps.region.neighbours) n.themes.forEach((t: string) => m10.add(t));
for (const c of maps.world.chokepoints) c.themes.forEach((t: string) => m10.add(t));
modules[10].themes = [...m10];

export const moduleUrl = (m: Module) => u(`/maps/${m.slug}/`);
export const layerModule = (slug: string) => maps.layerModules.find((m: any) => m.slug === slug);
const themeByKey = new Map(themes.map((t) => [t.key, t]));
export const themeKey = (k: string) => themeByKey.get(k);
/** Map links for a theme page: built modules that use it, and lab cards whose PYQ sits in it. */
export function mapLinksFor(themeKeyName: string) {
  const mods = modules.filter((m) => m.slug && m.slug !== 'lab' && (m.themes || []).includes(themeKeyName)).map((m) => {
    const alt = m.also && layerModule(m.also.slug);
    const useAlt = alt && alt.layers.some((l: any) => (l.themes || []).includes(themeKeyName));
    return { n: m.n, name: useAlt ? alt.name : m.name, url: u(`/maps/${useAlt ? m.also!.slug : m.slug}/`) };
  });
  const cards = lab.filter((c) => c.q.theme.key === themeKeyName);
  return { mods, cards };
}
export const ATTRIBUTION = 'India’s external and state boundaries: Survey of India–based data via DataMeet (CC BY-SA 2.5 / ODbL), generalised for teaching. World land: Natural Earth (public domain).';

/** Theme chips for map items: keys → { n, title, url }. */
export const themeChips = (keys: string[]) => keys.map((k) => themeByKey.get(k)).filter(Boolean).map((t) => ({ n: t!.n, title: t!.title, url: themeUrl(t!) }));
