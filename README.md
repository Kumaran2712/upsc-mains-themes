# UPSC Themes

A free, non-commercial site that regroups 810 UPSC GS1–GS3 Mains PYQs (2013–2026) into 171 cross-paper themes, with what UPSC asks, what to prepare, answer-writing pointers, syllabus lines and every question.

Static site built with [Astro](https://astro.build). 291 pages: home, a beginner roadmap, 171 theme pages, 18 area pages, paper and paper-year pages, 52 syllabus-line pages, search, about.

## Launch checklist

Live address: **https://upscthemes.live/** (custom domain on GitHub Pages; the old `kumaran2712.github.io/upsc-mains-themes/` links forward there). The site has its own data and does not depend on any other repo.

1. **Repo.** This repo, `Kumaran2712/upsc-mains-themes`.
2. **Turn on Pages.** Settings → Pages → Source: **GitHub Actions**.
3. **Variables (optional now).** The workflow already defaults to this repo's address, so the site deploys without any variables. Add these under Settings → Secrets and variables → Actions → **Variables** only to override them or to switch on analytics and Search Console:
   | Name | Value |
   | --- | --- |
   | `SITE_URL` | defaults to `https://upscthemes.live` in the workflow |
   | `BASE_PATH` | defaults to `/` (only needed for a github.io project address) |
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
| `maps-cta`, `theme-map-click` | Map buttons on the Maps hub and theme pages | `target` / `from`, `to` |
| `map-tap`, `map-layer`, `map-quiz-done` | Tapping a place, switching a map layer, finishing a map quiz | `map`, `name` / `layer` / `quiz`, `score` |
| `lab-open`, `lab-reveal`, `lab-save` | Sketch lab: open a question, reveal, save a score | `id`, `seconds`, `score` |
| `linked-theme-click` | A "Linked themes" chip on a theme page | `from`, `to` theme numbers |
| `also-needs-click` | An "Also needs" chip on a question | `from` question ID, `to` theme |
| `search` | A search settles or is submitted | `term` (first 40 chars), `results` |
| `copy-question` | Copy button on a question | `id` |
| `share` | Share this theme | `page` |
| `report-error` | Report a typo / error link | `where` |
| `outbound-upsc` | Footer link to UPSC's question papers | — |

Search terms with zero results tell you which themes or words to add.

**Google Search Console**: which searches show your pages, impressions, clicks, average position, indexing status per page, Core Web Vitals.

## Stage 0 live tutor

The concept catalogue and prompts remain free. An opt-in Node 24 service adds
accounts, saved learning, streamed AI conversations, understanding checks and
server-enforced free usage limits. The existing GitHub Pages site keeps its sample
preview until a backend is deployed and `PUBLIC_STAGE0_API_URL` is configured.
See [backend setup and deployment](docs/stage0-backend.md) and the
[teaching rubric](docs/stage0-teaching-rubric.md).

## Updating the data

All data lives in this repo:

- `data/questions.yaml` — the 810 questions, each with paper, year, marks, text, a `verified` flag and the syllabus lines it falls under
- `data/syllabus.yaml` — the 52 GS1–GS3 syllabus lines
- `tools/theme_map.json` — the 171 themes, each listing its questions by ID, plus per-question "also needs" links
- `tools/guide*.py` — the prep notes for each theme
- `tools/build_roadmap.py` — builds the beginner roadmap so every theme comes after the themes it relies on. It writes `tools/roadmap.json` (5 stages, themes in study order) and `tools/roadmap_prereqs.json`. Change a theme's tier or order there, then rerun it before `build_site_data.py`.

```bash
pip install pyyaml
python3 tools/build_site_data.py                     # writes src/data/site.json
npm install
npm run dev                                          # http://localhost:4321
```

The script stops and names the IDs if any question is in no theme, in two themes, or missing from `questions.yaml`. To fix a typo, edit `data/questions.yaml` (set `verified: true` once checked against the official PDF), rerun the script and push; the site redeploys. When you add questions (say 2019), add their IDs to a theme in `tools/theme_map.json` first.

## Maps tab

- `/maps/` — all 14 modules, basic to advanced: 0 India outline, 1 Physical India, 2 Drainage, 3 Climate, monsoon & soils, 4 World physical, 5 Hazard zones, 6 Resources & agriculture, 7 Industry & infrastructure, 8 History on the map (world and India), 9 Society & polity, 10 Neighbourhood & sea routes, 11 Borders & internal security, 12 Environment overlays, 13 PYQ sketch lab (76 PYQs).
- `src/data/maps.json` — pre-built SVG paths, generated by `tools/build_maps.py` (needs `pyproj`, `shapely`). Inputs, not stored here:
  - India states: [DataMeet `States/Admin2`](https://github.com/datameet/maps) (Survey of India–based; CC BY-SA 2.5 / ODbL), simplified with `mapshaper Admin2.shp -simplify 1.5% keep-shapes -o format=geojson precision=0.001 states.json`; the island groups are re-added at higher detail by the build.
  - World: Natural Earth (public domain): `ne_50m_admin_0_countries`, `ne_110m_land`, `ne_50m_land`, `ne_50m_geography_regions_polys`, `ne_50m_geography_marine_polys`, `ne_10m_rivers_lake_centerlines` and `ne_10m_admin_0_countries_ind` (India point-of-view edition, checked by the build for PoK, Gilgit, Aksai Chin and Tawang).
- `tools/maps_india_layers.json` — the nine layered India modules (1, 3, 5, 6, 7, 8-India, 9, 11, 12): each layer is a set of states (optionally in two groups, with per-state notes), approximate pins, Natural Earth features, or schematic routes, each with a note and linked themes. Rendered by `src/pages/maps/[slug].astro`. The build stops on an unknown state or feature name.
- `tools/maps_world.json` — curated world physical features, seas, rivers, world-history pins and India's rivers, each with a one-line explanation and linked themes.
- `/maps/base/<map>/` — bare base maps the lab fetches on demand (not indexed, not in the sitemap).
- **Boundary guard:** the build stops if the simplified outline fails any of 14 checks (PoK, Gilgit-Baltistan, Aksai Chin, Shaksgam, Siachen, Arunachal Pradesh and the island groups must be inside India; neighbouring capitals outside). Neighbouring countries are clipped so they never overlap India.
- `tools/maps_points.json` — neighbours (MHA border lengths) and chokepoints, with the themes each links to.
- `src/data/maps_lab.json` — sketch-lab questions: PYQ ID, the states or chokepoints to reveal, and the self-check list. The site build fails on an unknown PYQ ID, state or chokepoint name.
- Lab scores and quiz bests are saved in the visitor's browser only.

## Question and Prelims pages

- `/mains/<year>/<paper>/<slug>/` — one page per Mains PYQ (810): the question, its theme's notes, "also needs" themes, map modules, other PYQs in the theme, previous/next in the same paper. Slugs come from the first words of the question (`qPath` in `src/lib/data.ts`), so they stay stable as long as the question text does.
- `/prelims/` — hub; `/prelims/<year>/` (14 pages) and `/prelims/subject/<subject>/` (12 pages) list Prelims questions with a "Show answer" tap. Questions without a year are left out of these pages.
- WhatsApp share buttons on question pages and the daily page.

## PYQs of the day

`/daily/` shows 10 Prelims (GS Paper I) and 2 Mains questions a day, the same for everyone (day boundary: IST).

- `data/prelims.json` — 1,380 Prelims questions (2013–2026): question, options, answer letter, subject, and whether UPSC dropped it. Built by `tools/extract_prelims.py <pdf> data/prelims.json` from a topic-wise solved-papers PDF (not stored here); only questions and answer letters are kept. `tools/prelims_fixes.py` holds hand corrections for tables the PDF layout scrambled.
- `tools/build_daily.py` — writes `src/data/daily.json`: a fixed, seeded schedule. Prelims sets mix subjects (questions without a year, without an answer, or dropped by UPSC are left out); the two Mains questions come from different papers. Day 0 is 2026-11-01; after the last set the cycle repeats.
- Each day's questions are served as small JSON files (`/daily/p/<n>.json`, `/daily/m/<n>.json`). Answers and streaks are saved in the visitor's browser only.
- When UPSC publishes the official 2026 Prelims key, update the answers, then set `OFFICIAL_KEY_UPTO` in `src/lib/daily.ts` to 2026.

## Licence

Theme analysis, prep notes and code: choose a licence before launch (CC BY-NC 4.0 suits a non-commercial project). Question text is from UPSC's published papers and is not covered by this licence.

## Telegram bot (daily PYQs by direct message)

`@upscthemesdaily_bot` sends each subscriber the day's set around 06:00 IST: the 10 Prelims questions with answers under tap-to-reveal spoilers, the 2 Mains questions with what to cover, and the theme of the day (roadmap order).

- `tools/telegram_bot.py` — `sync` (answers /start, /stop, /today), `send` (sync + daily send, once per day), `preview --site-dir dist` (prints the messages). It reads the day's set from the live site (`/daily/meta.json`, `/daily/p|m|t/<n>.json`), so it always matches the Daily PYQs page.
- `.github/workflows/telegram.yml` — runs every 30 minutes, and sends the daily set at 06:00 IST (or on the first run after that if GitHub skipped the scheduled one).
- Repository **secrets**: `TELEGRAM_BOT_TOKEN` (from @BotFather) and `SUBSCRIBERS_KEY` (any long random string). Until both are set, the workflow does nothing.
- Subscribers are stored only as Telegram chat IDs, encrypted, in `data/telegram/subscribers.enc`; the workflow commits changes with `[skip ci]` so the site isn't rebuilt. Losing `SUBSCRIBERS_KEY` means losing the list.
