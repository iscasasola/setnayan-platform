## 2026-06-30 · feat(vendors): Date-open priority ranking + clear 3 stale "Soon" tags

For-vendors overlay (`vendor-benefits.ts`) honesty pass + the one buildable-now
feature behind a "Soon" tag.

**Date-open priority — built.** Wires the existing vendor calendar availability
(`vendor_calendar_blocks` via `lib/vendor-availability.ts`) into the couple-facing
Explore render order. Until now Explore only had the Task #45 *locked-vendor
intersection filter* (narrows candidates against the days that work across a
couple's already-confirmed vendors); there was no "free on MY date" signal.

- `app/explore/page.tsx` — after the intersection block, when the couple has an
  event date, a `getBatchVendorAvailableDays` (one batched read) drives a
  within-page partition: vendors **free in the couple's date window float above
  vendors already booked then**. It only DEMOTES, never hides — vendors with no
  declared calendar are treated as available (the lib's V1 default), so the sole
  effect is sinking a vendor whose calendar is explicitly blocked across the
  whole window (strongest at day precision). Fails to a no-op on a calendar read
  error (everyone reads as free → order untouched). Partition (not sort) keeps
  the SQL order verbatim within each group.
- Scope note in code: this is a within-page reorder (same shape as the existing
  intersection filter); a true cross-page availability rank needs a denormalized
  flag on `vendor_market_stats` — a V1.x SQL follow-up.

**3 stale "Soon" tags cleared** in `vendor-benefits.ts`:
- **Change-order trail** (shipped PR #2403) + **Day-of run-of-show** (shipped PR
  #2411) — both merged ~6h before the 2026-06-30 Soon-audit (#2446) but were
  missed by it; live surfaces confirmed in the couple↔vendor workspace + vendor
  clients page.
- **Date-open priority** — cleared as part of this PR (now wired, per above).

SPEC IMPACT: None (code-only; reads existing `vendor_calendar_blocks`). Logged in
DECISION_LOG.md (2026-06-30) + memory project_setnayan_vendor_overlay_soon_audit.
