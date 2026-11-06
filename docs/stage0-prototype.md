# Stage 0: Concept Explorer interaction prototype

This milestone is a reviewable UI prototype, not the live AI tutor. Open `/stage-0/`.
The homepage and preparation roadmap link to it. Prototype routes use `noindex` and
are excluded from the sitemap.

The repository also includes an opt-in [backend and live-tutor implementation](stage0-backend.md).
Without `PUBLIC_STAGE0_API_URL`, the deployed site retains this browser-only
prototype. Setting that public API address switches Stage 0 to accounts, streamed
conversations and actual model-backed checks. Provider credentials and a backend
deployment are required; the switch does not make the existing authored replies live.

## Review journey

1. Open the dashboard and browse the four subject cards.
2. Open a subject; try category navigation, concept search and learning-status filters.
3. Try a featured sample lesson, such as Sovereignty, Inflation, Weather or Diplomacy.
4. Use the starter questions, or type an example request. Responses are authored samples.
5. Try an advanced or unrelated question to inspect the prepared boundary responses.
6. Open the understanding check. Typed answers are saved as drafts, never graded.
   “Preview feedback” offers explicit example attempts for Developing and Understood.
7. Save a concept to revisit; return to the dashboard and continue the conversation.
8. Try restart confirmation, reload restoration, and mobile navigation.

## Curriculum

All 253 supplied subject placements are preserved: Polity 68, Economics 60,
Geography 65 and International Relations 60. There are 248 distinct names.
State, Country, Nation, Territory and Sovereignty occur in both Polity and IR.

For this prototype, placements have separate progress IDs. Sharing progress across
subjects is a product decision for the next milestone. Twelve distinct concepts
have authored sample lessons; the remaining concept workspaces clearly direct
visitors to prepared lessons. Full teaching metadata is future work.

## Structure

- `src/lib/stage0/curriculum.ts`: subjects, categories and stable placement IDs.
- `src/lib/stage0/previews.ts`: authored sample explanations and assessment examples.
- `src/lib/stage0/progress.ts`: defensive browser storage parsing, status rendering.
- `src/lib/stage0/conversation.ts`: prototype interactions and simulated streaming.
- `src/components/stage0/`: shared prototype styles, icons and disclosure notice.
- `src/pages/stage-0/`: dashboard, subject and concept routes.

Uses Astro's existing build and design tokens; no runtime dependency was added.
An opt-in `focusMode` layout gives concept pages the full mobile viewport; the
existing navigation remains on every other page, with subject/dashboard links
inside the concept workspace.
State uses only `upscthemes-stage0-prototype-v1` in localStorage. Conversations retain
the most recent 60 messages. Existing roadmap/daily/map state is untouched.
Prototype input is rendered as text, and is not sent to an AI provider.

## Beginner rationale and teaching contract

The dashboard explains why these four subjects offer a conceptual bridge into
syllabus reading, PYQs and current affairs. It presents an optional study rhythm
and encourages integrated study as soon as the learner is ready. No newspaper
coverage percentage or mandatory completion gate is claimed.

The dashboard and every concept page provide a freely reusable learning prompt,
including concept-specific context on concept pages. The copy action falls back
to selecting the prompt when clipboard access is unavailable; it is also readable
without JavaScript. Other LLMs may have their own access limits.

See [the teaching rubric](stage0-teaching-rubric.md) for the live tutor’s required
lesson metadata, answering rules, evidence-based assessment, output review criteria
and acceptance scenarios. `src/lib/stage0/teaching.ts` is the shared source for the
public prompt and teaching summary. These are instructions and product criteria,
not a live model integration or a grading engine. The current authored feedback
remains explicitly labelled as sample feedback.

## Validation

- Production Astro build and focused TypeScript check.
- Browser checks for routing, search, filters, authored responses, advanced/unrelated
  examples, safe text rendering, conversation/draft restoration, sample assessment
  states, revisiting, restart confirmation and keyboard submission.
- Desktop and 390px/320px mobile layouts, separate browser contexts and malformed
  storage recovery. Desktop/mobile screenshots were visually reviewed.

These checks validate the prototype, not AI teaching accuracy, authenticated
cross-user isolation, real streaming recovery, or enforceable usage limits.

## Next milestone dependencies

Agree on the UI and the authenticated service architecture before connecting live
services. The intended service is free with server-enforced per-user limits; exact
allowances remain configurable and subject to confirmation. Authentication,
database persistence, live AI, real assessment, usage tracking and rate limits are
not implemented in this milestone. Payments are outside the initial scope.
