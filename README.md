# UPSC Themes

A free, non-commercial site that regroups 810 UPSC GS1–GS3 Mains PYQs (2013–2026) into 171 cross-paper themes, with what UPSC asks, what to prepare, answer-writing pointers, syllabus lines and every question.

Static site built with [Astro](https://astro.build). 291 pages: home, a beginner roadmap, 171 theme pages, 18 area pages, paper and paper-year pages, 52 syllabus-line pages, search, about.

## Launch checklist

Live address once deployed: **https://kumaran2712.github.io/upsc-mains-themes/**. The site has its own data and does not depend on any other repo.

1. **Repo.** This repo, `Kumaran2712/upsc-mains-themes`.
2. **Turn on Pages.** Settings → Pages → Source: **GitHub Actions**.
3. **Variables (optional now).** The workflow already defaults to this repo's address, so the site deploys without any variables. Add these under Settings → Secrets and variables → Actions → **Variables** only to override them or to switch on analytics and Search Console:
   | Name | Value |
   | --- | --- |
   | `SITE_URL` | `https://kumaran2712.github.io` (or your custom domain; required — the build stops without it) |
   | `BASE_PATH` | `/upsc-mains-themes` (delete this variable if you move to a custom domain) |
   | `PUBLIC_REPO_URL` | `https://github.com/Kumaran2712/upsc-mains-themes` — where "Report a typo" opens issues; leave unset to hide those links |
   | `PUBLIC_UMAMI_WEBSITE_ID` | from step 5 |
   | `PUBLIC_GOOGLE_SITE_VERIFICATION` | from step 6 |
4. **Deploy.** Actions → "Deploy to GitHub Pages" → Run workflow. Every push to `main` redeploys.
5. **Analytics (visits, views, clicks).** Sign up at [Umami Cloud](https://cloud.umami.is) (free Hobby plan), add the website, copy its Website ID into `PUBLIC_UMAMI_WEBSITE_ID`, redeploy.
6. **SEO dashboard.** In [Google Search Console](https://search.google.com/search-console), add the site as a URL-prefix property, choose the HTML tag method, put the `content` value in `PUBLIC_GOOGLE_SITE_VERIFICATION`, redeploy, click Verify, then submit `sitemap-index.xml`. Do the same in [Bing Webmaster Tools](https://www.bing.com/webmasters) (it can import from Search Console).

### Custom domain (recommended for SEO)

A domain of your own builds search ranking you keep if you ever move hosts. Buy one, add it under Settings → Pages → Custom domain, set `SITE_URL` to it, delete `BASE_PATH`, redeploy.

## What the dashboards show

**Umami** (no cookies, no personal data): visitors, page views, bounce rate, time on site, top pages, referrers, countries, devices, and these tracked actions:

| Event | When it fires | Extra data |
| --- | --- | --- |
| `home-cta` | A start button on the home page | `target`: roadmap / themes / search / syllabus |
| `roadmap-continue` | Start / Continue button on the roadmap page | — |
| `roadmap-next`, `roadmap-prev` | Step navigation on a theme page | — |
| `roadmap-done`, `roadmap-undone` | Mark as done toggled on a theme page | `theme` |
| `linked-theme-click` | A "Linked themes" chip on a theme page | `from`, `to` theme numbers |
| `also-needs-click` | An "Also needs" chip on a question | `from` question ID, `to` theme |
| `search` | A search settles or is submitted | `term` (first 40 chars), `results` |
| `copy-question` | Copy button on a question | `id` |
| `share` | Share this theme | `page` |
| `report-error` | Report a typo / error link | `where` |
| `outbound-upsc` | Footer link to UPSC's question papers | — |

Search terms with zero results tell you which themes or words to add.

**Google Search Console**: which searches show your pages, impressions, clicks, average position, indexing status per page, Core Web Vitals.

## Updating the data

All data lives in this repo:

- `data/questions.yaml` — the 810 questions, each with paper, year, marks, text, a `verified` flag and the syllabus lines it falls under
- `data/syllabus.yaml` — the 52 GS1–GS3 syllabus lines
- `tools/theme_map.json` — the 171 themes, each listing its questions by ID, plus per-question "also needs" links
- `tools/guide*.py` — the prep notes for each theme
- `tools/roadmap.json` — the beginner roadmap: 12 stages, each listing its themes in study order (every theme exactly once)

```bash
pip install pyyaml
python3 tools/build_site_data.py                     # writes src/data/site.json
npm install
npm run dev                                          # http://localhost:4321
```

The script stops and names the IDs if any question is in no theme, in two themes, or missing from `questions.yaml`. To fix a typo, edit `data/questions.yaml` (set `verified: true` once checked against the official PDF), rerun the script and push; the site redeploys. When you add questions (say 2019), add their IDs to a theme in `tools/theme_map.json` first.

## Licence

Theme analysis, prep notes and code: choose a licence before launch (CC BY-NC 4.0 suits a non-commercial project). Question text is from UPSC's published papers and is not covered by this licence.
