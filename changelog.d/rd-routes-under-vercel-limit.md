## 2026-10-02 · fix(deploy): back under Vercel's 2,048-route limit — and a guard on the sum

Production was refused at main `76c6ed1` (the 2026-10-01 night train, #6248):
`too_many_routes — Max is 2048, received 2057`.

🔑 **269 of those routes were for a URL family this app never serves.** Vercel's Next.js builder
decides whether an app has a Pages Router from `routes-manifest.json`'s `appType` — and when the
field is missing it assumes **yes**. Next 15.5 never writes it (Next 16 does: `'app'` when there is
no `pages/` dir). With middleware present, the builder therefore emitted the whole `/_next/data`
resolving set: one `/_next/data/<buildId>/….json` route per dynamic page (259) plus 10 fixed ones.
The App Router never requests `/_next/data`.

**The fix:** `apps/web/scripts/stamp-app-type.mjs` runs after `next build` (package.json `build`)
and writes the field exactly as Next 16 would (`pages/`+`app/` → hybrid · `pages/` → pages ·
`app/` → app; a manifest that already has it is left alone). Measured with a real `vercel build`
on the same `.next`, both builders (4.17.1 and 16.0.0):

```
                         before   after
server actions             1226    1226
dynamic routes (x2)         518     518
/_next/data resolving       269       0
headers+redirects+rewrites   21      21
builder fixed                20      20
Vercel platform               3       3
TOTAL                      2057    1788
```

The after-config is the before-config minus exactly the 269 `/_next/data` routes, in the same
order — no page, redirect, header or rewrite changed.

**The guard:** `apps/web/scripts/check-vercel-route-count.mjs`, in the required production-build
job, computes that total from the build and fails above 2,000. It reproduces Vercel's 2057 on
`76c6ed1`, refuses a build missing the `appType` stamp, and refuses to guess when PPR / segment
cache / a new Next major changes the per-route shape. Sabotage: `ROUTE_CEILING=1700` → exit 1;
213 fake actions → 2001 → exit 1.

**What the train added:** server actions did not move (1,225 at both `b02235d` and `76c6ed1`).
Dynamic routes went 256 → 259 (+`/features/[slug]`, `/tl/features/[slug]`,
`/admin/vendors/[id]`, `/admin/users/[id]/export`, −`studio/supplies-marketplace`), and each
dynamic route cost THREE routes (page · `.rsc` · `/_next/data`): +9. By the same formula the
accepted `b02235d` sat at exactly 2,048 — the limit itself.

**Why #6006's guard missed it:** it budgets ONE term (exported server actions, from source),
at a ceiling of 1,225 checked with `>`; the actions sat exactly on it and never moved, while the
term it does not see grew.

SPEC IMPACT: None.
