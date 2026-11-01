import { daily, prelimsSet } from '../../../lib/daily';
export function getStaticPaths() { return daily.prelims.map((_, i) => ({ params: { i: String(i) } })); }
export function GET({ params }: { params: { i: string } }) {
  return new Response(JSON.stringify(prelimsSet(Number(params.i))), { headers: { 'Content-Type': 'application/json' } });
}
