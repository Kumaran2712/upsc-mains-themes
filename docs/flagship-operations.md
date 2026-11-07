# Flagship operations and promotion

The flagship feature remains a draft. This runbook describes promotion requirements; it does not authorize bypassing the content gate or claim that backup scheduling/alerts are active.

## Current resource boundary

- `intuitive-analysis / production / upsc-mains-themes` serves the existing SQLite pilot. Preserve its `/data` volume and session secret.
- The added `Postgres` service is PostgreSQL 18. It is not yet the learner database. The private content worker uses its own budget/receipt tables there.
- `stage0-content-worker` has no public listener or domain. Provider/database credentials are Railway reference variables. Keep `CONTENT_JOBS` and `CONTENT_JOBS_GZIP` empty between intentional bounded runs.
- `upscthemes.live` remains the sole intended public product host. A staging service should use private networking or authenticated access; do not introduce a second public product address.

## Before promotion

1. Require all 253 approved placements using `npm run content:complete`. Confirm the evaluated tutor snapshot and prompt version match the runtime configuration. Reevaluation is required after changing either; the v1 calibration does not approve v2.
2. Require a successful PR workflow: content compile, type check, real PostgreSQL tests and encrypted restore, build, browser journeys, synthetic load profile and container smoke check.
3. Rehearse a production-size migration/restore in isolated storage. Record database size, dump duration, restore duration and application checks. Small synthetic tests do not establish the one-hour RPO/four-hour RTO targets.
4. Activate encrypted hourly backups to off-service storage, separate key custody, retention/deletion handling and freshness/failure alerts. Keep an operator-accessible restore copy and key outside the application/database. These operations are not configured yet.
5. Resolve the launch AI/infrastructure budget, supported-language expectations and monitoring ownership. The runtime defaults are a $5 shared daily ceiling, 500 global calls/day and 30 calls/user/day; with 100 active users the shared call cap averages five calls, not thirty each. Limits include conservative reservations for uncertain requests.
6. Complete assistive-technology/device checks and first-time learner tasks. Automated layout and keyboard checks do not establish screen-reader usability or product-market understanding.

## Migration sequence

Use a dedicated maintenance window and a consistent backup. Do not point the new web build at a live SQLite file while importing it elsewhere.

1. Record the current deployed commit/configuration, volume identity, DNS records, credential variable names and a rollback owner. Keep secret values in the secret manager.
2. Pause new writes and drain/cancel in-flight provider operations. The import refuses unresolved `running` receipts. Stop the old web process after draining; record the final write timestamp.
3. Create a consistent SQLite backup with the existing backup command while SQLite is still the active store. Preserve the original read-only copy. Import the backed-up file into an empty learner target; the content worker's separate tables are not learner tables.
4. Run the verified migration from an operator environment with private database access:

   ```sh
   # DATABASE_URL comes from protected environment configuration.
   node tools/migrate-sqlite-to-postgres.mjs /restricted/pilot-backup.sqlite --write-paused
   ```

   The tool verifies counts and canonical hashes of every imported row, preserves password/recovery hashes, advances message sequences and drops old sessions. It refuses to merge existing learner databases. Keep its verification output with the deployment record.

5. Start one new web replica with `DATABASE_URL`, the existing session secret, `SITE_URL=https://upscthemes.live`, `PUBLIC_STAGE0_API_URL=/api` and the approved provider/model/budget configuration. Confirm readiness, routes, history, activity progress, cookie flags and a bounded actual-provider smoke test.
6. Move the public domain only after staging checks pass. Require fresh sign-in; host-only preview cookies do not move between hosts. Device-only work on the old origin needs explicit export/import. Retire automatic GitHub Pages production publishing at this cutover so it cannot overwrite the product origin.
7. Verify canonical links, sitemap, same-origin `/api`, account recovery, export/deletion and resumed work on `upscthemes.live`. Monitor errors, pending operations, spend and backup freshness before reopening general writes.

## Rollback boundary

Before new PostgreSQL writes are accepted, rollback can restore the previous deployment/configuration against the preserved SQLite copy. After new learner writes exist in PostgreSQL, switching to the old copy would lose those writes. Enter maintenance and forward-fix or perform a separately verified data reconciliation; do not blindly redeploy the SQLite configuration. Preserve cancellation/receipt state so uncertain provider calls are not replayed.

## Backup and restore rehearsal

`backend/pg-backup.mjs` uses PostgreSQL 18 client utilities and AES-256-GCM authenticated encryption. `BACKUP_ENCRYPTION_KEY` is a separately retained 32-byte base64 key. It must be available to recovery operators outside the failed service. Credentials are passed to PostgreSQL utilities through environment variables rather than command arguments.

```sh
# Run in restricted job storage; use a new output path for every copy.
npm run backup:postgres -- /restricted/backups/new-copy.dump.enc
```

Restore only into an isolated, empty database using the exported `restorePostgres` function and matched PostgreSQL client version. Authentication must succeed before `pg_restore` runs; restoration uses a single transaction and exits on errors. Verify credential hashes, Unicode conversation history, activity attempts and account isolation. Reapply all account deletions after the backup timestamp from an independently retained deletion journal before exposing the restored service. That off-service journal and scheduling remain release blockers.

## Incidents

| Signal | Immediate response | Verification |
| --- | --- | --- |
| Provider failure / invalid feedback | Suspend new tutor requests; keep public reading/practice available. Preserve uncertain operation reservations. | Recovery smoke call, failure rate, no duplicate dispatch or partial saved answer. |
| Spend near ceiling | Keep the enforced cap; inspect aggregate usage and conservative pending reservations. | Reconcile actual receipts before changing caps; never clear receipts to retry. |
| Database unavailable | Keep public static pages available. Enter maintenance for writes; inspect connection/lock metrics. | Readiness, account isolation, saved history and write recovery. |
| Backup stale / restore failure | Treat as a release-blocking incident; repair the copy path/key custody and perform an isolated restore. | Age of last successfully recoverable off-service copy, measured restore time. |
| Incorrect published concept | Suspend the affected placement in the publication manifest and deploy a verified content release. | Independent correction/review and fresh runtime evaluation; preserve old attempt versions. |
| Account recovery support | Use the supported recovery-code flow; never request a password, cookie or recovery code in logs/chat. | Rotated recovery code, revoked old sessions and cancellation of pending operations. |

External health monitoring should check public pages plus dependency readiness; provider configuration alone is not proof of provider health. Alert on sustained core errors, DB availability, backup freshness, pending-lease growth and budget thresholds. Alert destinations and on-call ownership have not been configured.

## Reproducible synthetic launch profile

After a production build, run `node tests/load/flagship.mjs`. With `TEST_DATABASE_URL`, it creates and removes a uniquely named PostgreSQL schema; otherwise it uses an isolated SQLite fixture. It starts only local HTTP/provider fixtures and makes no paid provider requests.

The profile holds ten slow streams open while 100 public readers and 20 authenticated learners save/read progress. It checks that an eleventh stream is rejected before provider dispatch, explicit cancellation reaches durable terminal states, and partial answers never become saved conversations.

Local PostgreSQL 18 result on 7 November 2026: public-read p95 60ms; save-and-read p95 140ms; ten cancelled streams; excess demand returned `429 tutor_busy`. These are one-machine synthetic measurements, not Railway/India network performance, real model latency, sustained-load capacity or an availability SLO. Repeat against isolated staging with the intended limits before launch.
