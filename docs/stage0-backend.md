# Stage 0 backend and AI tutor

The repository now contains the live-tutor implementation alongside the original
static preview. Live activation requires an AI API key and a deployed backend with
persistent storage. A GitHub Pages deployment alone cannot run the service.

## What is implemented

- Username/password accounts, scrypt password hashing, HttpOnly sessions, CSRF
  protection, sign-out, one-use recovery-code rotation, data export and deletion.
  No email address or email delivery service is required. Recovery codes are shown
  once; losing both password and recovery code means the account cannot be recovered.
- SQLite storage for account-owned conversations, check answers and drafts, progress
  and revisit reminders. The live client does not import browser prototype progress
  or store account conversations in localStorage. Bookmarking preserves check results.
- Server-to-server OpenAI Responses requests, actual streamed text, aborts/timeouts,
  explicit incomplete-response handling and idempotency keys. Only completed replies
  become conversation history. No model key is included in the static site.
- Three-step checks for meaning, distinction and application. Each answer uses
  structured output and requires a supporting quote from the learner. The server
  validates feedback and derives status; callers cannot assign themselves a grade.
- Daily allowances per account, hashed client IP and the whole service, including
  preflight token reservations. Calls that might have incurred provider cost retain
  their reservation even when a connection fails. Retrieving a completed idempotent
  request does not consume another allowance. Daily windows use midnight IST.
- Account isolation, stale-revision detection, one active AI operation per account,
  session expiry, sign-out cancellation, browser-tab account-change notifications,
  and private-view clearing before back/forward caching.
- Deployment image, optional static-file hosting, a local Compose definition,
  Railway deployment configuration, consistent SQLite backup utility, test suite
  and an opt-in live output collection tool.

The initial live pilot is exactly the twelve featured subject placements:
Sovereignty, State, Constitution, Inflation, Opportunity Cost, GDP, Weather,
Climate, Latitude, Diplomacy, United Nations and Bilateral Relations. Other
placements retain free prompts and bookmarking. Identical terms in different
subjects are not silently enabled without their own lesson context.

## Local setup

Use Node 24. The backend uses Node's built-in SQLite, cryptography, HTTP and fetch
APIs; there is no separate database or backend dependency installation.

```sh
npm ci
cp backend/.env.example backend/.env
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Put the generated value in `SESSION_SECRET` and your own API key in
`OPENAI_API_KEY`, inside the ignored `backend/.env` file. Do not place them in a
`PUBLIC_` variable or commit them. The default configurable model is
`gpt-4.1-mini`; changing models requires running the teaching evaluations again.

For a single-origin local production build:

```sh
PUBLIC_STAGE0_API_URL=/api npm run build
SERVE_STATIC=true npm run backend
```

Open `http://127.0.0.1:8787/stage-0/`. For development with Astro on port 4321,
run `PUBLIC_STAGE0_API_URL=http://127.0.0.1:8787/api npm run dev` in a second terminal
and use the same hostname for both services. Add that exact frontend origin to
`ALLOWED_ORIGINS`. Do not mix `localhost` and `127.0.0.1` for cookie-based sessions.

Without a key, `/api/health` returns `ready: false`, accounts and bookmarking can
work, and chat/assessment calls return an explicit unavailable response without
charging an application allowance. There is no production mock-AI mode.

## Deployment

Keep the existing `upscthemes.live` GitHub Pages site. Deploy this repository's
Dockerfile to a single backend service with one persistent volume mounted at
`/data`. Railway configuration is included, but no Railway account connection or
AI key is assumed by the code. Hosting and provider billing are separate from the
free experience offered to learners.

Required runtime environment:

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=8787
DATABASE_PATH=/data/stage0.sqlite
SESSION_SECRET=<persistent random secret, at least 32 characters>
OPENAI_API_KEY=<server-side provider key>
OPENAI_MODEL=gpt-4.1-mini
ALLOWED_ORIGINS=https://upscthemes.live
SERVE_STATIC=true
TRUST_PROXY_HOPS=0
```

Use the platform's assigned port if it supplies `PORT`. The runtime user has UID
1000; the volume must be writable by that user. Railway mounts its volumes as root:
set `RAILWAY_RUN_UID=0` there as described in its
[volume permissions documentation](https://docs.railway.com/volumes#permissions).
The image entrypoint prepares the database directory and drops to UID/GID 1000
before starting HTTP, so the serving process still runs without root privileges.
The Railway configuration requires a `/data` mount and a single replica.
Set up HTTPS using the hosting
platform or a reverse proxy. The production service refuses missing secrets,
HTTP frontend origins and an HTTP model endpoint.

For the Pages frontend, attach a backend custom domain such as
`api.upscthemes.live`. Set the repository **variable** `PUBLIC_STAGE0_API_URL` to
`https://api.upscthemes.live/api`, then redeploy Pages. This is a public service
address, not a secret. Keep the backend on a subdomain of the frontend's domain
so HttpOnly `SameSite=Lax` cookies work without third-party-cookie dependence.
Cross-origin access alone does not solve cross-site cookie restrictions.

Alternatively, serve the whole static site and API from the container on the same
origin. The Docker build defaults to `PUBLIC_STAGE0_API_URL=/api`; supply the correct
`SITE_URL` build argument for canonical links and include that frontend origin in
`ALLOWED_ORIGINS`. Existing Pages publishing need not be changed for this option.

Set `TRUST_PROXY_HOPS` only if direct ingress to the app is restricted to a trusted
proxy that appends the real client address. An arbitrary caller must not be able
to spoof `X-Forwarded-For` and bypass IP limits. Leave it at 0 otherwise; behind a
proxy, this conservatively shares an IP allowance. Do not horizontally scale this
SQLite deployment or use an ephemeral filesystem. A multi-instance deployment
needs a shared transactional database and distributed operation locks.

The health endpoint checks service availability and configured AI capability,
not provider billing or key validity. Verify a real reply after setting the key.
The Docker healthcheck uses liveness so a temporary provider issue does not erase
or repeatedly restart the learning service.

## Limits and data operations

`backend/.env.example` lists every allowance. The defaults are initial operator
settings, not a promise of a particular number of replies: both call and token
limits apply. The UI explains that replies and check answers share the allowance.
The catalogue and public prompts remain readable after exhaustion.

Preflight reservations use text byte length plus framing/output allowances as a
conservative token bound. Completed requests reconcile to the provider's reported
input/output token counts; request receipts record those counts, model and prompt
version. Uncertain or missing provider usage retains its reservation. This bounds
application-request volume; it is not a currency-denominated
provider account spending cap. Configure the provider's own billing limits too.

An account has at most one active AI request. A duplicate key with identical
content returns its saved result; reusing a key for another request fails. Unknown
completion after a network loss can be recovered through `/api/operation` or by
refreshing the conversation. Failed requests can be retried with a new request ID.
Request receipts are retained for seven days. Operational rate counters expire
after eight days. These use pseudonymous account identifiers or keyed IP hashes;
the app does not retain raw IP addresses or log passwords, prompts or answers.

Use the SQLite backup API, not a copy of the database file while WAL writes are
active:

```sh
npm run backup:backend -- /private/path/stage0-backup.sqlite
```

Store backups securely outside the public web root and off the service's volume.
To restore, stop the service, replace the SQLite database with a validated backup,
remove obsolete WAL/SHM files while stopped, set owner UID 1000 and mode 0600, then
restart. Keep `SESSION_SECRET` stable; rotate it deliberately if changing IP-hash
identity is desired. Application account deletion cascades conversations, messages,
sessions and request receipts. Operators must also manage backup retention.

## Verification and release

```sh
npm run check:stage0
npm run test:backend
npm run build
PUBLIC_STAGE0_API_URL=/api npm run build
```

The automated tests use a local HTTP provider fixture that exercises the actual
Responses request/stream/structured-output adapter. They cover ownership, CSRF,
origins, sessions, recovery, deletion, draft storage, independent evidence,
bookmarks, quota boundaries, idempotency, concurrent requests, interruption and
SQLite backup/persistence. Fixture results establish application behaviour, not
actual model teaching quality. Browser QA similarly uses a clearly separate test
fixture process under `backend/test/`; it is excluded from the deployment image.
CI additionally builds the Docker image and checks the actual container's health
and static learning page without supplying an API key.

Real model evaluation requires a configured key:

```sh
npm run eval:tutor                         # explains the tool; makes no calls
npm run eval:tutor -- --live --limit 8      # bounded paid API output collection
npm run eval:tutor -- --live --limit 40     # two runs of every included scenario
```

Review the saved outputs using [the teaching rubric](stage0-teaching-rubric.md).
Also review correct, partial, incorrect, informal-language and prompt-injection
assessment answers before opening the pilot publicly. A valid JSON schema and a
supporting quote do not prove that a model's semantic judgement is correct. An
“Understood” result is an AI-supported familiarity signal, never exam readiness.
Source links and authoring context are provided for the pilot; those lessons still
need the real-output release review. Do not advertise completed human review or a
validated learning outcome based solely on these tests.

OpenAI integration references:
[Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create),
[streaming](https://developers.openai.com/api/docs/guides/streaming-responses),
[structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## Endpoint contract

All mutations require JSON, an allowed `Origin` and `X-Stage0-Client: web`.
Authenticated mutations also require the session's `X-CSRF-Token`. The session is
an HttpOnly cookie; there is no browser-stored bearer token or client-supplied user ID.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Service/AI configuration and pilot placements |
| GET | `/api/session` | Current account, CSRF token and usage |
| POST | `/api/auth/signup`, `/login`, `/recover`, `/logout` | Account lifecycle (all paths have the `/api/auth` prefix) |
| GET | `/api/progress` | Account progress and usage |
| GET | `/api/conversation?conceptId=…` | Server-owned conversation and public check state |
| POST | `/api/conversation/bookmark`, `/reset` | Independent revisit reminder or concept reset |
| POST | `/api/chat` | SSE events: start, delta, done or error |
| GET | `/api/operation?id=…` | Account-owned receipt and completed result |
| POST | `/api/assessment/start`, `/answer`, `/draft` | Start, answer or save a draft for a three-question check |
| GET | `/api/account/export` | Learning-data JSON download |
| POST | `/api/account/delete` | Password-confirmed account deletion |

Chat and assessment answers require a unique request ID and the current conversation
revision. Assessment answers additionally require the current assessment ID. Model
instructions, history, questions and grading anchors are constructed on the server.
