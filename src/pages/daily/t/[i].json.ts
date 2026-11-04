import { themeOfDay } from '../../../lib/daily';
import { roadmap } from '../../../lib/data';
export function getStaticPaths() { return roadmap.map((_, i) => ({ params: { i: String(i) } })); }
export function GET({ params }: { params: { i: string } }) {
  return new Response(JSON.stringify(themeOfDay(Number(params.i))), { headers: { 'Content-Type': 'application/json' } });
}
