# upscthemes.live domain cutover

Status on 7 November 2026: the foundation is merged at `738a9b6cb9e506748943699f3447b56334a30952`. Railway deployment `e91f4af3-8c29-4424-8209-88cf8b09b887` succeeded, including a real tutor/account smoke check. The public host still serves GitHub Pages through GoDaddy's authoritative DNS. Its Railway custom-domain attachment exists but is awaiting DNS/ownership verification. Cloudflare's pending zone is prepared below; registrar delegation has not changed.

## Cloudflare preparation completed

- OAuth and account/zone access verified. Zone `d9f9db0a00c8e67da90016fbadc61f36` is pending on the Free Website plan.
- Assigned nameservers: `gene.ns.cloudflare.com` and `pete.ns.cloudflare.com`.
- Imported records were checked against the observed public records. A seven-record pre-change snapshot is saved locally at `/private/tmp/upscthemes-cloudflare-before-cutover.json`.
- Added the Railway verification TXT record. Kept the DMARC policy and Domain Connect target; Domain Connect is DNS-only.
- Root GitHub A records and the existing www CNAME remain in place, DNS-only with a 300-second TTL. This preserves direct GitHub HTTPS while delegation and Cloudflare edge certificates activate.
- TLS mode is Full; Universal SSL is enabled. There are no edge certificate packs yet. Cloudflare DNSSEC is disabled and the current public DS lookup returned no records.
- After delegation becomes active and edge TLS is ready, replace the root GitHub A records with the proxied Railway CNAME, then verify the public API and account flows. The Railway target is prepared, not yet published through Cloudflare.

## Observed DNS before cutover

| Name | Type | Value |
| --- | --- | --- |
| `@` | NS | `ns59.domaincontrol.com`, `ns60.domaincontrol.com` |
| `@` | A | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` |
| `www` | CNAME | `kumaran2712.github.io` |
| `_dmarc` | TXT | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` |
| `_domainconnect` | CNAME | `_domainconnect.gd.domaincontrol.com` |

The queried apex AAAA, MX, TXT, CAA and DS records returned no answers. This is a targeted public lookup, not a complete zone export. Compare the full GoDaddy zone with Cloudflare's imported records; scans can miss subdomains and mail/verification records.

## Sequence

1. Completed: existing domain added to Cloudflare; imported records reviewed and the zone's assigned nameservers verified.
2. Update GoDaddy's domain nameservers to that assigned pair after checking the complete zone and current DNSSEC state. The registration can remain at GoDaddy. Confirm Cloudflare is authoritative and the current site still works.
3. Configure the Railway routing and verification records below. The root CNAME replaces the four root GitHub A records. Preserve unrelated records. Follow Railway's current Cloudflare guidance for proxy and TLS settings.
4. Verify ownership/TLS, then test `https://upscthemes.live/api/health/ready`, `/api/capabilities`, sign-in/recovery, saved progress, streaming and export through the public host. A configured provider key alone does not establish provider health.
5. Retire automatic Pages publishing after the public-host checks pass. Configure `www` to redirect to the root host while preserving paths/query strings. Keep the previous DNS values with the deployment record.

## Prepared Railway records

| Type | Name | Value |
| --- | --- | --- |
| CNAME | `@` | `4xr67il7.up.railway.app` |
| TXT | `_railway-verify` | `railway-verify=8a5a22dd3cd595836b7a82f3ffc1d13aeb3b841e3cc65a4b9cd892197602f330` |

The TXT value is public ownership-verification data, not an API credential. Railway target port is 8787. Recheck the attachment if its verification attempt expires before cutover.

References: [Cloudflare domain onboarding](https://developers.cloudflare.com/fundamentals/manage-domains/add-site/), [Railway root domains and Cloudflare configuration](https://docs.railway.com/networking/domains/working-with-domains#adding-a-root-domain).

## Current dependency

The next action is at GoDaddy: replace `ns59.domaincontrol.com` and `ns60.domaincontrol.com` with `gene.ns.cloudflare.com` and `pete.ns.cloudflare.com`. Cloudflare MCP can configure the pending zone but cannot change delegation at the external registrar. Once the registrar change is saved, verify public delegation and Cloudflare activation before publishing the Railway route. DNS migration is not complete.

Latest diagnostic: GoDaddy's authoritative zone now returns all four nameservers, including the Cloudflare pair. However, querying the `.live` registry at `v0n0.nic.live` still returns only `ns59.domaincontrol.com` and `ns60.domaincontrol.com`. Cloudflare still reports `pending`. Change the domain-level Nameservers setting at GoDaddy to the assigned Cloudflare pair; adding NS records inside the old DNS zone has not changed registry delegation. Direct queries to `gene.ns.cloudflare.com` confirm the Railway verification TXT is present.
