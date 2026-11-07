# upscthemes.live domain cutover

Status on 7 November 2026, 08:05 UTC: `https://upscthemes.live` serves the Railway application through Cloudflare. Registry delegation and the Cloudflare zone are active, Railway ownership and its origin certificate are verified, and Railway reports the routing record propagated. Public readiness, capabilities and a real account/tutor browser journey pass. The full curriculum and PostgreSQL migration remain separate, unfinished launch requirements.

## Deployment and routing

- Foundation merge: `738a9b6cb9e506748943699f3447b56334a30952`.
- Public build configuration: PR #2, tested commit `a3d1331ce53e478148a3431e8ab4d95a2ad2683a`, merged as `f18d0c8bfca8fa2a6bf2e48d9e74b160674d5e93`. CI run `42352750705` passed backend, browser, PostgreSQL, load and Docker checks.
- Current Railway deployment: `6d5435b5-c7ef-4d71-a07b-2b181283c153`, successful. Analytics, Google verification tags and report links were checked in the deployed HTML.
- Railway project `1d930850-209f-4e0d-a51c-ceb5400f3475`, environment `4d596c61-a173-4c6c-92a3-888303fb99de`, web service `6792094b-9126-4dd0-9385-d42e4062d9e1`, port 8787.
- Custom-domain attachment `089a463b-383b-4000-be0f-848bf0b7cd2d`. The earlier unverified attachment and its `4xr67il7` target were replaced; do not reuse that target.
- Cloudflare account `cb61b41cfd3c16f670abad139415db6d`, zone `d9f9db0a00c8e67da90016fbadc61f36`, Free Website plan.
- GoDaddy remains the registrar. Domain-level nameservers are `gene.ns.cloudflare.com` and `pete.ns.cloudflare.com`; the `.live` parent delegation was checked directly. Adding NS records to the former GoDaddy zone alone did not change delegation.

| Type | Name | Value | Proxy |
| --- | --- | --- | --- |
| CNAME | `@` | `cs5pvt98.up.railway.app` | On |
| CNAME | `www` | `upscthemes.live` | On |
| TXT | `_railway-verify` | `railway-verify=8a5a22dd3cd595836b7a82f3ffc1d13aeb3b841e3cc65a4b9cd892197602f330` | DNS-only |
| CNAME | `_domainconnect` | `_domainconnect.gd.domaincontrol.com` | DNS-only |
| TXT | `_dmarc` | Original GoDaddy policy, preserved | DNS-only |

The TXT value is public ownership-verification data, not an API credential. Apex CNAME record ID: `16253e44a5adab37ee3c0d9c8b691790`.

## HTTPS and edge behavior

- Cloudflare Universal SSL certificate pack `49613db3-1505-4822-9670-3b80f2344fd7` is active for the root and wildcard. A backup certificate is issued. TLS mode is Full, following Railway's Cloudflare guidance. DNSSEC is disabled; no parent DS was observed.
- Railway's origin certificate reports `VALID` / `COMPLETE`, expires 5 February 2027, and covers `upscthemes.live`. Public HTTPS and direct custom-host routing work. Full (strict) has not been configured or tested; the current mode follows Railway's documented Cloudflare setup.
- A Cloudflare Single Redirect sends `www` to the root with HTTP 308, preserving path and query. Ruleset `fa5c70c8d2c541aa9830d9b1f7f2ddd5`, rule `26847e5544b64b1895ef36bff7a3ee2c`.
- Cache bypass covers root `/api` and `/api/*`. Ruleset `543c5f119a1d43b99ff9f046fd7868c1`, rule `bf428d4226844f188c5e35c1b45bbe08`. Application responses also mark private data `no-store`.
- A temporary fixed-origin Worker carried requests while Railway verified ownership. It was removed after direct custom-host readiness succeeded. Both Worker routes and the script were deleted; no Worker routes or workers.dev product endpoints remain.
- Automatic GitHub Pages publishing is retired. The manual workflow remains a deliberate static fallback; it cannot provide account/tutor APIs.

## Verification

- Public `/api/health/ready`: 200, `{"ready":true}`. Public `/api/capabilities`: 200 with the 12 legacy pilot placements and prompt version `stage0-tutor-2026-11-07-v2`.
- Public sovereignty lesson: 200. `www.upscthemes.live/learn/?test=cutover` redirects to `https://upscthemes.live/learn/?test=cutover` with 308.
- Plain HTTP at the current Cloudflare edge redirects to HTTPS with 301, preserving path and query.
- Checks through a current Cloudflare edge address and through the system resolver passed. Direct Railway requests carrying the custom Host returned readiness 200 before the Worker was removed.
- Production browser check passed at 390px: account creation, Secure/HttpOnly host-only cookie on the public domain, one real tutor stream, conversation restored after reload, account theme progress saved, private export with two messages and one theme, no horizontal overflow, and no runtime exceptions. The synthetic account was deleted through its own authenticated account flow.
- Initial browser attempts encountered local QUIC/DNS transition errors. The successful fresh browser run disabled QUIC and resolved the public host to the active Cloudflare edge, retaining normal certificate verification. This establishes the learner journey through the new edge, not propagation through every client resolver.

Fresh sign-in is required on the public host: host-only preview cookies do not move between hosts. Existing device-only work requires the application's explicit import flow.

## Rollback and follow-up

The pre-change seven-record Cloudflare snapshot is saved locally at `/private/tmp/upscthemes-cloudflare-before-cutover.json`. Original root records were A records for `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`; `www` previously targeted `kumaran2712.github.io`. GoDaddy nameservers were `ns59.domaincontrol.com` and `ns60.domaincontrol.com`. Preserve unrelated DNS records during rollback.

An early direct Railway attempt returned 404 before ownership propagated, so the root was restored temporarily to GitHub while validation continued. The final CNAME above was published with the temporary bridge active; direct service readiness was confirmed before deleting the bridge. A future application regression should first use a known healthy Railway deployment. DNS rollback to GitHub restores only the static site, not account or tutor functionality; treat it as degraded service and communicate that limitation.

The current artifact was uploaded explicitly with the authenticated Railway CLI. The service's GitHub source remains pinned to the earlier foundation commit; do not assume the latest main commit deploys automatically. Choose and verify the next application deployment deliberately. Frequent bot-only subscriber commits should not trigger application rebuilds.

References: [Cloudflare domain onboarding](https://developers.cloudflare.com/fundamentals/manage-domains/add-site/), [Railway root domains and Cloudflare configuration](https://docs.railway.com/networking/domains/working-with-domains#adding-a-root-domain).
