# Flagship implementation status

Approved architecture: [flagship-architecture.md](flagship-architecture.md). Implementation started 2026-11-07. This is an implementation record, not a production release declaration.

## Implemented locally

- Learn/Questions navigation and entry pages; stable existing routes; earlier subject selection; anonymous reading for authored lessons.
- Daily submission persistence and semantic answer selection; map lab hidden/retry fixes; keyboard activation for layer-map features; readable account inputs and visible credential rules.
- Theme filtering/sorting, grouped search across six resource types, short terms such as IR, direct question links, retained query/filter URLs, recoverable search failures.
- Honest progress loading/errors with Retry, available-lesson denominators and one public capability manifest shared by lesson availability and progress.
- Public/private lesson compiler, 253-placement validation, source registration, independent author/reviewer pipeline, repeated real tutor/assessor output review, run receipts, explicit per-run call caps, full-curriculum release gate. Model/prompt changes invalidate new published lesson tutoring until reevaluation.
- Asynchronous HTTP storage operations, PostgreSQL driver/repository and ordered migrations; serialized SQLite compatibility transactions for the existing pilot. Short PostgreSQL write transactions currently use a database advisory lock to preserve quotas/revisions across connections. Provider work occurs outside transactions.
- Operation lesson/prompt/model attribution, bounded execution leases, global concurrency limit, database cancellation on logout/recovery, preserved message history and full-history account export.
- Versioned API aliases, separate liveness/dependency readiness/capability endpoints, HTML frontend 404s, an explicit SQLite-to-PostgreSQL import tool and a guard against backing up inactive SQLite after PostgreSQL cutover.
- Docker packaging for the driver/content artifacts, and PostgreSQL integration coverage configured in CI.

## Verification and limitations

All 18 backend checks pass locally against real PostgreSQL 18 (and the earlier integration set passed on PostgreSQL 17). The suite includes cross-connection quota/auth races, a consistent SQLite import with per-row hash checks and legacy receipt defaults, pinned assessment versions, private attempt history, lease expiry/fencing, cancellation and spend reconciliation. An actual encrypted pg_dump/pg_restore rehearsal restored credential hashes and Unicode history, rejected a wrong key and preserved an existing backup. Docker remains unavailable locally; CI provisions PostgreSQL 18 and runs container packaging checks plus the restore rehearsal through matched client utilities. These synthetic-data checks do not claim production-size recovery timing.

The production Astro build and Stage 0 type check pass. Browser checks against a local provider fixture passed account creation/recovery display, safe UTF-8 streaming, restored history, drafts, three-part checks, bookmarks, cancellation, account isolation and 320/390px layouts. Additional browser checks cover daily completion after reload, map retry, theme filters, concept/IR search, subject visibility and 18 responsive page/width combinations. They do not establish actual model teaching accuracy or replace screen-reader/device research.

Shared account progress now covers roadmap completion, immutable daily submissions, map sketch attempts and reported map-quiz scores. Guest import is explicit, repeat-safe and preserves existing account decisions. Scores and question snapshots are recomputed from the immutable versioned bank; account switches clear private views. Two isolated browser sessions verified restoration and failed-save retry, plus keyboard quiz completion, rapid-tap protection, cross-device best scores and explicit guest import. Shared primary actions now use the same color tokens, corner radius and 44px minimum target in light/dark themes.

Four calibration lessons have model-authored drafts and independent content approval: Constitution, Inflation, Weather and Diplomacy. A blinded deliberate factual error was caught, and an actual nation/state confusion was corrected through revision. All 160 planned real tutor/assessor runs completed with distinct provider receipts. Semantic review has found teaching/reference-case issues, so those lessons are **not yet approved for flagship publication**. Source-span validation now resolves quote wrappers/ASCII casing only when it can return an exact learner-input substring.

`npm run content:complete` deliberately fails: **0/253 flagship lessons have completed the new independent review gate**. The twelve existing pilots remain available as pilots. No approvals or provider results have been invented.

## Work still required before flagship promotion

1. Complete calibration/reference adjudication, then author/review/evaluate all 253 placements. The Railway one-shot worker holds credentials by reference, durable dispatch receipts and an independent $1 calibration ceiling. Candidate author/tutor: gpt-5.4-mini; reviewer: gpt-5.4. Final confirmed calibration charge is $0.782090. All four semantic reviews completed and the worker job inputs were cleared. See [calibration findings](stage0-calibration.md). The full-curriculum batch budget question remains pending. Railway OAuth refresh repeatedly loses scope and requires reauthentication; already completed requests remain recoverable. Automatic bounded revision/adjudication scheduling remains to be implemented.
2. Rehearse deployment/container behavior and production-sized migration/restore before cutover. Real PostgreSQL integration and small-data migration/encrypted-restore rehearsals now pass. Import requires an empty target, a consistent backup and a declared write pause; existing production data has not been migrated.
3. Extract remaining direct SQL from HTTP handlers; activity contracts are now separated into a domain service. Map quiz/import/account recovery browser checks pass, with guest storage retained alongside account sync.
4. Configure spend/health/backup alerts, off-service backup scheduling, retention/deletion journals and measured production recovery targets. Monetary ceilings, versioned prices, conservative reservations/reconciliation, explicit cancelled/indeterminate states, fencing, message pagination and preserved assessment history are implemented. Encrypted local backup/restore is tested; no off-service schedule is yet active.
5. Complete all audited mobile/assistive-technology cases, learner task research, provider fault/load tests and monitoring/runbooks. The proposed 100-learner benchmark is not yet a measured capacity claim.
6. Stage the release, preserve account/recovery data, move the only public host `upscthemes.live` to the single-origin service, retire automatic Pages production publishing at cutover, and verify authentication/canonical URLs and bounded real-provider smoke checks. The original web service and DNS remain unchanged. A Postgres 18 service and private one-shot content worker were added to intuitive-analysis; learner records still use the original SQLite service until deliberate cutover.

## Operator commands

```sh
npm run content:compile
npm run check:stage0
npm run test:backend
SITE_URL=https://upscthemes.live PUBLIC_STAGE0_API_URL=/api npm run build
# Requires running local fixture server and Chrome CDP on port 9222:
node tests/browser/flagship.mjs
# Real PostgreSQL, isolated generated test schema:
TEST_DATABASE_URL=postgresql://user:password@localhost/flagship_test npm run test:backend
# Refuses release until all 253 placements pass:
npm run content:complete
```

Register a source using `node tools/content/source.mjs subject/slug metadata.json source.txt`; metadata contains title, HTTPS URL, locator, exact excerpt and actual retrieval date. Text hashes establish integrity, not factual correctness. Keep excerpts within permitted source use.

Set `OPENAI_API_KEY`, `OPENAI_MODEL`, `CONTENT_AUTHOR_MODEL` and a distinct `CONTENT_REVIEWER_MODEL` in the offline job environment. Run `npm run content:run -- --id polity/state --live --max-calls 82`. A complete minimal placement evaluation uses 20 cases repeated twice plus author/reviewer calls (82 calls). Completed receipts are reused; uncertain dispatches require reconciliation rather than automatic paid retries. The per-run cap is a call bound, not a currency budget; runtime and evaluation spending must be monitored separately in the local CLI; the Railway worker separately enforces a durable currency ceiling.
