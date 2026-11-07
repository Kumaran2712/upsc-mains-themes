# Stage 0 model publishing

Checkpoint: 7 November 2026. All 253 placements have local source packets; the source report records 109 captured primary educational/institutional documents. A packet is provenance and candidate evidence, not factual approval. The source collector uses lexical matches to propose passages; the independent reviewer must check support for every lesson claim. The strategic-interest packet uses explicitly selected contextual passages rather than pretending a lexical match establishes its meaning.

The live application now supports conversations for all 253 concepts: 12 legacy pilots with understanding checks and 241 source-guided concepts. There are still **0/253 newly approved flagship authored lessons**. See [the live rollout](stage0-live-rollout.md). No new paid model calls have been made in this preparation step. The full-curriculum currency budget is awaiting the operator's choice; the previous $1 calibration ledger and its $0.782090 charge are unchanged.

## Source capture and preflight

```sh
# Requires curl, pdftotext and Node 24. Full captured texts remain ignored locally.
python3 tools/content/collect-sources.py --register-candidates
# Rebuild coverage from local captures without network requests:
python3 tools/content/collect-sources.py --register-candidates --offline
npm run content:run -- --all
npm run content:run -- --calibration
```

The collector preserves manually registered packets. `--reselect-candidates` can refresh automatically selected passages before authoring; it does not confer review approval. The local library cache verifies captured text hashes. Two sources were captured through the web text-extraction tool when direct HTTP retrieval was blocked; their capture metadata records that method. The versioned source coverage report lists unavailable library URLs separately from placement coverage. Do not replace missing text with generated quotations or report a live URL as claim verification.

## Bounded execution

Run outside the learner service, using its separately referenced provider key without printing the environment. The authenticated Railway CLI can inject the private content worker's variables into a local command with `railway run --service ... --no-local -- node ...`; do not use `env`, `printenv` or verbose variable dumps. These jobs do not use learner records or learner quotas.

Select pinned snapshots explicitly. The calibrated candidate author/tutor remains `gpt-5.4-mini-2026-03-17`, independent reviewer `gpt-5.4-2026-03-05`. A separately configured `CONTENT_ADJUDICATOR_MODEL`, for example `gpt-5.2-2025-12-11`, can resolve disputed review decisions and must differ from the author, reviewer and tutor. Its pricing is registered from the official model rate card. No production model change follows automatically from setting these job variables.

Set `CONTENT_AUTHOR_MODEL`, `CONTENT_REVIEWER_MODEL`, `CONTENT_TUTOR_MODEL` and optionally `CONTENT_ADJUDICATOR_MODEL` only in the offline job process. Set `STAGE0_RUN_CAP_USD` to the explicitly chosen currency ceiling before invoking the examples below; the example does not choose or authorize a budget.

```sh
# One stable budget ID covers calibration and the subsequent full run.
node tools/content/run.mjs --calibration --live --budget-id flagship-v2 --budget-usd "$STAGE0_RUN_CAP_USD" --max-calls 1000 --concurrency 2
# Refuses dispatch until all four current-model calibration lessons pass:
node tools/content/run.mjs --all --live --budget-id flagship-v2 --budget-usd "$STAGE0_RUN_CAP_USD" --max-calls 30000 --concurrency 2
```

The currency ceiling is cumulative for this budget ID, including retries/revisions. `--max-calls` is an additional bound for the current invocation, not a currency limit. Never change budget ID to bypass exhaustion. At most four placements execute concurrently, with two runtime requests per placement; default placement concurrency is two. Keep only one coordinator and preserve its workspace until receipts and release artifacts are archived.

The currency ledger and complete request/response receipts live under ignored `content/stage0/runs/budgets/<budget-id>/` with restrictive file permissions. An exclusive directory lock prevents competing coordinators for that budget. Every request reserves its conservative cost before network dispatch. Completed requests are reused. Timeout, incomplete response and uncertain dispatch keep their reservation; no automatic network retry occurs. A crash can over-reserve, never silently free uncertain spend. After a crash, reconcile the lock owner's process and provider receipts before removing `.lock`; do not delete the ledger to resume. Unknown model pricing and a changed cap/price version fail closed. This ledger covers these content jobs, not hosting or unrelated consumers of the provider account. The older private Railway worker has a separate calibration ledger and remains idle.

## Review and publication gates

1. Author one placement-specific lesson, exact source metadata, three application scenarios and 20 bound reference cases.
2. A different model independently reviews all eight rubric dimensions, source support and every reference category. Mismatched or mislabeled cases return to revision before runtime spending.
3. Execute all 20 cases twice against the pinned tutor/assessor: **40 distinct provider runs per placement**. Validate actual assessment structure and exact learner evidence spans.
4. Review actual outputs in groups of ten. Each decision binds the exact scenario, repeat, provider run ID and raw output hash. Sharing transport context does not replace or reduce repeated runtime evidence. A minimal passing placement uses 46 calls rather than the previous 82: author, content review, 40 runtime executions and four review calls.
5. A failed judgement can receive one source-grounded adjudication by a third model. Preserve the original failed verdict and independently bound adjudication receipt. A false reference label, material error or unresolved disagreement blocks approval. The compiler checks bindings and reviewed output content, rejects forged/reused runtime receipts and verifies independent model identities.
6. Revision is bounded to at most three cycles. Exhausted or malformed placements remain held with explicit reasons. Failures never fabricate approval. Existing approved versions are archived before replacements; model/prompt changes require fresh evidence.
7. Calibration automatically sends blinded synthetic controls through the same reviewer instructions: a wrong inflation definition, unsupported full credit and a correct informal explanation. The reviewer must reject both deliberate errors and accept the accurate informal answer. Actual review receipts are bound to the lesson, prompt, rubric and reviewer snapshot. Both bulk dispatch and compilation require the current control report. These controls are explicitly synthetic and never count as real tutor executions. Synthetic pipeline tests exercise mechanics only; they do not establish teaching quality.

```sh
npm run content:compile
npm run content:complete
npm run check:stage0
# TEST_DATABASE_URL must point to an isolated PostgreSQL test database:
npm run test:backend
SITE_URL=https://upscthemes.live PUBLIC_STAGE0_API_URL=/api npm run build
```

`content:complete` must keep failing until all 253 placements pass. A compiled public lesson excludes private assessment anchors and review context. Before deployment verify the evaluated tutor snapshot and shared prompt match the production configuration; preserve archived lessons and learner history. Update calibration and coverage reports from actual receipts, then deploy the tested artifact to the existing single-origin Railway service. Never describe model review as human review or full curriculum completion as exam readiness.

Official model rate cards: [GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini), [GPT-5.4](https://developers.openai.com/api/docs/models/gpt-5.4), [GPT-5.2](https://developers.openai.com/api/docs/models/gpt-5.2).
