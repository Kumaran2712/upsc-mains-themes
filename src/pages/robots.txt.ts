import type { APIRoute } from 'astro';
export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const sm = new URL(`${base}/sitemap-index.xml`, site).href;
  return new Response(`User-agent: *\nAllow: /\nDisallow: ${base}/search-index.json\n\nSitemap: ${sm}\n`, { headers: { 'Content-Type': 'text/plain' } });
};
