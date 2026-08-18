## 2026-08-17 · fix(security): the second lock — batch 3, 16 tables reached only by the service role

**49 of 180 now closed** (batch 1: 16 · batch 2: 17 · batch 3: 16).
🟢 Nothing is leaking and no client's answer changes — RLS denies all of these
already. What goes is the spare key underneath.

**Measured in prod tonight, re-measured AFTER `3c0e6edab`** ("revoke on all THREE
rebuilt matviews") landed, because a rebuilt view is a privilege RESET and a count
taken before it would have been stale: 384 public tables · RLS on all 384 · **273**
grant `anon` SELECT, **275** grant it something · **180** with no policy that could
admit an anonymous reader. The prompt's numbers were confirmed, not contradicted.

## Gate 4 had to sharpen, because the easy set is gone

Batches 1 and 2 took every table with **no query at all**. That set is exhausted —
all 171 remaining candidates are queried by application code. So the question
became: *does any **anon-key** path query it, or only the service role?*

`lib/supabase/` ships three factories and only one is grant-independent:

| factory | acts as |
|---|---|
| `admin.ts` | **service role** — unaffected by an `anon` revoke |
| `server.ts` | the caller's session — **anon when signed out** |
| `client.ts` | the browser, i.e. the publishable key |

All 16 below are queried only by files importing the admin client and **neither**
of the other two.

🪤 **The injected-client trap is excluded explicitly.** A `lib/` helper taking
`supabase: SupabaseClient` as a parameter proves nothing — the caller picks the
privilege level, and this repo has been bitten by exactly that. Any such file
disqualified its table rather than being guessed at.

## The scan was not the verdict — three were read by hand

- `promo_free_windows` is named in `lib/sku-catalog.ts`, which feeds **public
  pricing**. Measured: that mention is a comment; `from('promo_free_windows')`
  appears there **zero** times.
- `demo_sessions` is named in two `'use client'` **homepage** overlays — both in
  docblocks. The only write is a server action importing `createAdminClient`.
- `guest_claims` looked guest-facing, which is where an anon path would be.
  `lib/guest-claim-core.ts` turns out to be **pure logic** (name normalisation,
  match scoring, zero queries); the real writes are `UPDATE public.guest_claims`
  inside a SECURITY DEFINER function, which ignores caller grants.

Gates 1·2·3·6 unchanged. All 16 confirmed present in the replay, so a plain REVOKE
is replay-safe — no `to_regclass` guard needed.

## Verification

Dry-run against production in a rolled-back transaction: anon SELECT **16→0**,
TRUNCATE **16→0**; controls `guests`, `vendor_ad_subscriptions`,
`vendor_tool_bundles` and `authenticated`-on-`seo_metrics` all unmoved; column-ACL
rows **376→376**; `vendor_market_stats` still returns its rows; batches 1 and 2
still closed. Then confirmed all 16 still granted after ROLLBACK.

Mutations, occurrence counts before → after: drop one REVOKE (`guest_claims`)
1→0 → red, naming it · add a view-backed table 0→1 → red on the gate-6 assertion ·
empty batch 3's list 16→0 → red on META (the floor added for it).

Exposure freeze 6/6 · guard 5/5 · typecheck clean.

⏭ The remaining ~131 are reached through the caller's own session or the browser.
That set needs a per-table reading, not a sweep.

SPEC IMPACT: None.
