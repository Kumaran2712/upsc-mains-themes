// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// SITE_URL: the public address, e.g. https://gsmainsthemes.in (needed for canonical URLs and the sitemap).
// BASE_PATH: only for a GitHub Pages project site, e.g. /gs-mains-theme-atlas. Leave unset on a custom domain.
if (process.env.CI && !process.env.SITE_URL) throw new Error('Set the SITE_URL repository variable (e.g. https://your-domain.in) before deploying.');
const site = process.env.SITE_URL || 'http://localhost:4321';
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  integrations: [sitemap()],
  build: { format: 'directory' },
});
