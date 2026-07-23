## 2026-07-24 · fix(privacy): seat-finder is exact-match (own seat only) + durable rate limit

Open-browse PR5 privacy hardening, part (a) — closes a live roster-enumeration
leak on the public `/[slug]/find-seat` page.

- **Anti-enumeration (owner decision 2026-07-23 — "exact/prefix, own seat only").**
  `public.public_seat_lookup()` matched the typed query as a SUBSTRING
  (`display_name ILIKE '%q%'`) and returned up to 25 rows, so a 2-char probe on
  the session-less finder page dumped up to 25 guests' names + tables — the
  couple's roster, months early. Migration `20270920040000` rewrites the RPC to
  EXACT full-name match (case-insensitive, whitespace-collapsed), returning only
  that guest's own seat; a partial/common query now returns nothing. New db test
  `seat-lookup-exact-match.db.test.ts` (4/4 on full replay) proves a substring
  shared by two seated guests yields zero rows, while the exact name returns the
  seat. Accepted tradeoff: a name stored differently (nickname/middle name) may
  "no match" — the empty state already asks for the name as on the invite.
- **Durable rate limit.** The route's per-instance in-memory `Map` throttle
  (reset on every cold start / scale-out) is replaced with `enforceRateLimit`
  (`@/lib/with-rate-limit` — L1 in-memory + L2 Postgres sliding window, fails
  open), keyed on `clientIp`, same 20-per-10s budget.
- `SEAT_LOOKUP_MAX_MATCHES` 25 → 5 to mirror the new RPC LIMIT.

SPEC IMPACT: None — hardens an existing shipped endpoint; no SKU/schema/feature
change. Deferred (separate): the per-couple seat-lookup on/off toggle and the
date-window gate (both add scope; exact-match already closes the enumeration).
