## 2026-07-26 · fix(pricing): the paid Live Studio SKU could never appear on /pricing

Found while reconciling the Live Studio corpus. `/pricing` renders
`ADDON_GROUPS.map(...)` and omits any item the catalog does not return, so **a SKU
listed in no group is invisible no matter what the catalog says.** The page already
records that trap in COUPLE_WEBSITE_PRO's comment ("must be LISTED here or the
reactivated umbrella never appears") — and Live Studio was walking into it.

The only Live Studio code in any group was `PANOOD_SYSTEM`, which migration
`20271005180040` (PR #3716) **retired**. `LIVE_STUDIO` — the unified ₱2,999/event
SKU — was in no group at all. So at the flag flip the Studio tile and the buy
drawer would light up while `/pricing` showed **no paid live-broadcast row**: the
public price page omitting the very product being launched.

- `{ code: 'LIVE_STUDIO' }` added to "Go live & interactive".
- **Safe to list while dark:** `fetchV2CustomerCatalog` name-excludes LIVE_STUDIO
  while `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED` is off, so the row is omitted today
  and appears the moment the owner flips the flag — one launch switch, no second
  code change. A test pins that the exclusion stays **inside** the flag gate;
  listing the SKU would be theatre if the exclusion were ever unconditional.
- `PANOOD_SYSTEM` stays listed with a comment naming its retirement migration and
  the ₱500 alias arbitrage it closed — same convention as `LIVE_BACKGROUND`, so the
  retirement reads as deliberate rather than as a lost line.

**Nothing is wrong on the live site today:** `fetchV2CustomerCatalog` filters
`is_active`, so the retired Cast row already drops out — verified, not assumed.
This is a launch-day defect, fixed before the launch rather than after.

3 new tests in their own file (a new file cannot conflict with a concurrent PR —
the same reason `changelog.d/` fragments are per-PR files). 4171/4171 unit green
with the flag OFF and ON, typecheck + lint + production build pass. No migration.

SPEC IMPACT: makes § 4i's claim "the paid row returns automatically at the flag
flip" actually true — it was not, and that is recorded in `DECISION_LOG.md`.
