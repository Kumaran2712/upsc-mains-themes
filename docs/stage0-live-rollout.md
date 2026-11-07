# Stage 0 live tutoring rollout

Live on 7 November 2026. In response to the user's instruction to make every concept live now, separate live conversation availability from independently reviewed authored lesson publication. All 253 placements receive a real tutoring workspace; the 241 newly enabled concepts use source-guided AI conversations. Their source packets are reference candidates, not independently approved lessons. Twelve existing pilot concepts retain their authored introductions and understanding checks.

The public domain, authentication, provider model, daily monetary/call/token limits and learner database remain the existing production configuration. There is no upfront offline generation spend for this rollout; actual learner interactions use the existing metered tutor allowance. The separate content batch and its spending-cap question do not block conversation availability.

## Behavior

- All concepts have live chat, streaming, account-backed conversation history and revisit reminders, including Multilateral Relations.
- New contexts preserve subject/category meaning and provide actual retrieved passages to the tutor as untrusted reference data. The tutor must not stretch unrelated evidence, invent citations, assert unverified current facts or promise understanding status.
- Source-guided pages link original references and identify the AI tutor. They do not masquerade as reviewed authored lessons.
- The capability manifest distinguishes tutoring placements from assessment placements. Unprepared checks are absent in the UI and rejected by the server before model dispatch. Existing check flows remain available for the twelve pilot placements; progress meters count only available checks.
- The complete-curriculum gate still requires 253 independently reviewed authored lessons and repeated runtime evidence. This deployment must not be described as completion of that editorial gate.

## Validation before promotion

All 26 backend checks pass against PostgreSQL 18, including new concepts in all four subjects, correct subject/source context, actual HTTP streaming through the provider fixture, restored history, account isolation, saved reminders and rejection of unprepared checks without provider calls. All 253 generated pages contain a live input and no unavailable-lesson placeholder. Public metadata excludes source passages, hashes and private assessment anchors. Existing tutor/check/recovery browser journeys and new Erosion/Multilateral Relations conversations pass at desktop, 390px and 320px with no runtime exceptions. Typecheck and the 1,419-page production build pass.

## Production promotion

- PR #5 merged as `1f89ce7a46b4bd8003d0e375413fa6a20016b611`; tested artifact commit `25d019be6f7f1a2ea1b49857d537d48c86f20304`.
- CI run `42360944069` succeeded, including backend, browser, load, Docker build and container smoke checks.
- Railway deployment `cd4325c1-5dab-48ae-9f89-c6a6541d2309` succeeded for the existing web service. The artifact was uploaded explicitly through the authenticated CLI; source pin behavior is unchanged.
- The public capability endpoint reports exactly all 253 catalogue IDs and 12 assessment placements.
- Every one of the 253 public concept pages returned HTTP 200, contained a live chat input and enabled workspace, and omitted the unavailable-lesson placeholder. Four bounded concurrent readers performed this public-host audit with no failures.
- At 390px, a fresh synthetic account completed a real Multilateral Relations provider stream, restored its two-message conversation after reload, saved theme progress and exported private data with `no-store` / Cloudflare `DYNAMIC`. The session used the public domain's Secure/HttpOnly cookie. No horizontal overflow or runtime exceptions occurred. The account was deleted through its own authenticated deletion endpoint.
- This browser run used the ordinary public-host resolver with certificate verification and QUIC disabled in the QA browser. One live learner-style model request was made for the deployment smoke test; no offline batch generation was run.

No learner schema migration is part of this release. Rollback uses the previous healthy Railway deployment `6d5435b5-c7ef-4d71-a07b-2b181283c153` and retains the existing persistent volume. That previous artifact supports only the twelve original pilots, so rollback reduces tutoring availability and should be reported as degraded service.

## Introductory reading for every concept

The next update addresses the separate reading gap: all 253 concepts now have an authored central idea, example and useful distinction before the chat workspace, including for anonymous readers. Four versioned subject files under `content/stage0/introductions/` contain the actual text. The twelve existing pilot introductions are preserved. New guides are AI-assisted editorial drafts; they do not claim independent model-review approval and do not create private assessment anchors or mastery results.

The compiler requires complete, non-duplicated coverage, and CI verifies the actual three text sections on every generated concept page. The same guide is supplied to the source-guided tutor so follow-ups can refer to what the learner has read. The diplomatic High Commissioner reference was corrected to the Australian foreign affairs department's explanation, replacing unrelated UN-office passages. No offline provider generation batch is needed for this directly authored reading update. Deployment verification will follow CI.
