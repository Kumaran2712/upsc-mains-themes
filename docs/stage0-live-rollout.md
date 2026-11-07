# Stage 0 live tutoring rollout

Release candidate, 7 November 2026. In response to the user's instruction to make every concept live now, separate live conversation availability from independently reviewed authored lesson publication. All 253 placements receive a real tutoring workspace; the 241 newly enabled concepts use source-guided AI conversations. Their source packets are reference candidates, not independently approved lessons. Twelve existing pilot concepts retain their authored introductions and understanding checks.

The public domain, authentication, provider model, daily monetary/call/token limits and learner database remain the existing production configuration. There is no upfront offline generation spend for this rollout; actual learner interactions use the existing metered tutor allowance. The separate content batch and its spending-cap question do not block conversation availability.

## Behavior

- All concepts have live chat, streaming, account-backed conversation history and revisit reminders, including Multilateral Relations.
- New contexts preserve subject/category meaning and provide actual retrieved passages to the tutor as untrusted reference data. The tutor must not stretch unrelated evidence, invent citations, assert unverified current facts or promise understanding status.
- Source-guided pages link original references and identify the AI tutor. They do not masquerade as reviewed authored lessons.
- The capability manifest distinguishes tutoring placements from assessment placements. Unprepared checks are absent in the UI and rejected by the server before model dispatch. Existing check flows remain available for the twelve pilot placements; progress meters count only available checks.
- The complete-curriculum gate still requires 253 independently reviewed authored lessons and repeated runtime evidence. This deployment must not be described as completion of that editorial gate.

## Validation before promotion

All 26 backend checks pass against PostgreSQL 18, including new concepts in all four subjects, correct subject/source context, actual HTTP streaming through the provider fixture, restored history, account isolation, saved reminders and rejection of unprepared checks without provider calls. All 253 generated pages contain a live input and no unavailable-lesson placeholder. Public metadata excludes source passages, hashes and private assessment anchors. Existing tutor/check/recovery browser journeys and new Erosion/Multilateral Relations conversations pass at desktop, 390px and 320px with no runtime exceptions. Typecheck and the 1,419-page production build pass.

Production deployment and smoke results will be recorded after the tested artifact is promoted. No learner schema migration is part of this release. Rollback uses the previous healthy Railway deployment and retains the existing persistent volume.
