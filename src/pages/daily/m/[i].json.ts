import { daily, mainsSet } from '../../../lib/daily';
export function getStaticPaths() { return daily.mains.map((_, i) => ({ params: { i: String(i) } })); }
export function GET({ params }: { params: { i: string } }) {
  return new Response(JSON.stringify(mainsSet(Number(params.i))), { headers: { 'Content-Type': 'application/json' } });
}
