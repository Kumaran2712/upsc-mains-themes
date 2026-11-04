import { dailyMeta } from '../../lib/daily';
export function GET() {
  return new Response(JSON.stringify(dailyMeta()), { headers: { 'Content-Type': 'application/json' } });
}
