## 2026-09-18 · fix(seo): health check trusts DNS-TXT Google verification, not only the env var

`runSeoHealthChecks` (`apps/web/lib/seo/health-checks.ts`) Check 3 warned
"Google Search Console not configured" purely from the absence of
`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`, even though Search Console also
accepts domain ownership proven by a `google-site-verification=…` TXT record
on setnayan.com's DNS — a route that needs no env var at all. Added an
optional `googleDnsTxtVerified` flag to the pure check's input, and a real
(best-effort, non-fatal) DNS TXT lookup in the cron caller
(`apps/web/lib/seo/seo-cron-jobs.ts`) that resolves it.

SPEC IMPACT: None.
