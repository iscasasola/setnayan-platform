## 2026-07-31 · fix(seo): generate llms.txt from the catalog, and repair the guard that never checked it

The AI-crawler surface `public/llms.txt` was hand-maintained and had drifted. The
guard meant to prevent that — `llms-price-drift.test.ts` — compared the file
against a hand-typed allow-list (`llms-price-fixture.ts`, snapshotted
2026-07-10). Both sides were typed by a human and **neither was ever compared to
the database**, so they drifted together and CI stayed green for three weeks
while the live SEO audit reported `2 FAIL` every day into a surface with no
button on it.

The old check tested **set membership** — "does ₱2,499 appear anywhere in the
catalog?" — which structurally cannot catch a price attached to the *wrong
product*, nor a *retired* product still being advertised. Both had happened:

- Live Studio sold as "Mobile ₱1,299/day · Desktop ₱2,499/day". That device split
  is retired (`PANOOD_SYSTEM_MOBILE` / `PANOOD_SYSTEM`, `is_active=false`); it is
  one SKU now, `LIVE_STUDIO` ₱2,999. Both quoted figures exist elsewhere in the
  catalog, so the check passed.
- Camera Bridge advertised at ₱500/day — `CAMERA_BRIDGE` is `is_active=false`.
- Papic Pool quoted ₱999 / ₱1,999 / ₱2,999 — live rows are ₱1,000 / ₱2,000 / ₱3,000.
- Setnayan AI quoted as a flat ₱1,499, omitting the per-event-type ladder
  (₱1,499 / ₱899 / ₱499 / ₱99) shipped in #3949.

**Changes**

- **`lib/llms-txt.ts` (new)** — pure, I/O-free renderer. Prose is hand-written
  (it's positioning, not data); every peso figure and the SKU listing resolve
  from `platform_retail_catalog_v2` + `vendor_billing_catalog`. Missing a named
  SKU throws `MissingSkuError` listing *all* missing codes at once.
- **`app/llms.txt/route.ts` (new)** — serves `/llms.txt` from the live catalog,
  `revalidate = 3600`. Fail-safe: on a missing SKU or unreadable catalog it
  serves a short pointer file carrying **no** peso figures. Publishing less beats
  publishing a number we cannot retract from a model's cache.
- **`public/llms.txt` (deleted)** — Next serves `public/` ahead of route
  handlers, so leaving it would silently shadow the route.
- **`lib/llms-price-{fixture,drift.test}.ts` (deleted)**, replaced by
  `lib/llms-txt.test.ts` — 8 tests over the *renderer*: every active price is
  quoted, every quoted figure traces to a row, retired products never surface
  (guarding **structure**, not just numbers), the AI ladder renders all four
  tiers, every link is in `KNOWN_PUBLIC_ROUTES`, and a reprice propagates with no
  code change.
- **`lib/seo/health-checks.ts`** — fixed `normalizeRoutePath`. It stripped the
  trailing slash *before* testing `startsWith('/v/')`, so the bare directory link
  `/v/` normalised to `/v` and failed the allow-list — the one form the `/v/`
  entry exists for was the only form that could never match. This produced a
  standing daily FAIL against valid content.
- **`lib/seo/seo-cron-jobs.ts`** — the audit's retail query no longer filters
  `is_active` in SQL. The Setnayan AI tier ladder prices live on B/C/D rows that
  are `is_active=false` **by design** (price-source only), so an active-only
  catalog would have reported ₱899 / ₱499 / ₱99 as orphan figures — a permanent
  false warn introduced by this very fix.

**Verified** against the real audit with live prod rows: `fail: 0` (was 2),
`ok: 2` (was 0). The three remaining warns are ₱0 (the genuinely free Custom QR
SKU) and two owner actions that no code can close — Google Search Console + Bing
tokens in Vercel env (`seo_metrics` has 0 rows, ever), and creating the FB Page +
LinkedIn to populate `Organization.sameAs`.

SPEC IMPACT: None. No pricing, SKU, or product decision changed — this makes the
crawler surface report what the catalog already says. The corrections listed
above are the file catching up to decisions already logged (#3949 per-type AI
pricing, the Live Studio single-SKU lock 2026-07-25, the Papic charm→round
reprice, Camera Bridge retirement).
