## 2026-10-23 · feat(plans): plans price reach, never what earns a booking fee — and the top plan is Ultra

Owner ruling 2026-10-23: *"their price differences is based on their type of business reach and not their capability
to maximize the app features that return us income. We want everybody to be able to give us booking fee. let them
create at least 3 per category."* Phase 1 — logic and copy only, no new screens. `lib/vendor-tier-caps.ts` stays the
one source; every enforcement site follows it.

- **Bookings a day — no plan limit.** `slotsPerDay` is `Infinity` on every tier. The supplier's own setting governs:
  `vendor_schedule_pools.daily_booking_capacity` (already shipped, DEFAULT 1, CHECK 1..50) and the per-card
  `vendor_services.daily_capacity`. `calendar/actions.ts` clamps only to the database's 50 (`DAILY_CAPACITY_MAX`);
  `services/actions.ts` no longer refuses Free ("need a paid plan") or caps by plan; the card maker and the add form
  always show the field and never say "on your plan".
- **Answering couples — no weekly limit** on any tier (`inAppCustomersPerWeek = Infinity`). The inbox itself was
  already ungated (2026-07-24, `unlock_vendor_event_free`); the table and every comparison now say so.
- **Service cards — at least 3 per category** on every tier (Free 3 · Verified 3 · Solo 3 · Pro 5 · Ultra unlimited).
- **Couples per date — 5 on every tier** (was 1/2/3/5/10), in TypeScript and in the database gate: migration
  `20271285071117_every_plan_holds_five_couples_a_date.sql` re-creates `vendor_tier_limit` from its latest
  definition with the whitelist arm at 5. Grandfathered — the trigger counts at a NEW accept only. The Custom
  "no limit" axis is untouched.
- **Portfolio — 50 free on every tier** (was 30/50/50/100/300). Over 50 is refused out loud with the owner's words
  (*"Your first 50 portfolio photos are free. More photos with Papic credits is coming soon."*). GRANDFATHERED:
  `capPortfolioRefs` keeps every stored photo and refuses only a NEW one past the base — this also ends the old silent
  truncation, which would have cut a shop over its cap down on its next re-save.
- **Free** answers couples (`chat: 'chat'`), is searchable once verified, and shows its real name once verified (new
  `nameMode: 'verified'`; `isTrueNameTier('free')` stays false so an unverified shop is never exposed).
- **Solo reaches 30 km** (was 20).
- **"Enterprise" reads "Ultra"** wherever a person sees it (supplier pages, /for-suppliers, plan pages, admin, help,
  llms.txt). The key `enterprise` and every SKU id are unchanged; migration `20271286003218_the_top_plan_is_called_ultra.sql`
  renames the word in the display-only `vendor_billing_catalog.title` of the `enterprise_*` SKUs.
- Copy: /for-suppliers matrix drops the three rows that are now identical on every plan; the deltas say them once on
  Free; `vendor-benefits.ts` moves the selling caps to the Free spine; `/llms.txt` states the every-plan rules.

Guards: `apps/web/lib/plans-price-reach-not-income.test.ts` (no tier below 3 cards per category · no per-day or
weekly cap, and no shipped code reading either to refuse · portfolio base 50 everywhere, grandfathered, through
`capPortfolioRefs` · 5 couples a date in TS and in the latest SQL `vendor_tier_limit` · Free sells like every plan) and
`apps/web/lib/no-enterprise-plan-name.test.ts` (no user-facing "Enterprise").

SPEC IMPACT: `DECISION_LOG.md` — one 2026-10-23 row recording the plan-caps implementation (the rulings themselves are
in the same-day tracker row, corpus aedbf233). Owner questions left open in the PR body: the Free-tier 3-concurrent-
booking cap (`enforce_free_tier_booking_cap`, ship-dark), Custom's paid "extra event slots" dial, Pro/Ultra/Custom
dropping to the 50-photo and 5-couple base, and `tier_state='free'` shops reading 0 km while the marketed Free column
reads 20 km.
