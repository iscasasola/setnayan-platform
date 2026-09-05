## 2026-09-05 · feat(admin): vendor cohort deals — all VERIFIED vendors, or vendors who register + get verified in a window

`/admin/gifts` grows a **Deals** section and its vendor list now carries
cohort rows beside the single-vendor comps. A deal is one
`promo_free_windows` row with a vendor audience, resolved **per vendor,
statelessly, at gate time** from three facts on `vendor_profiles`
(`verification_state` · `created_at` · `last_verified_at`). No per-vendor
row, no job, no trigger.

What changed underneath:

- **`all_vendors` now means all VERIFIED vendors** (owner ruling 2026-09-05).
  Before this, `resolveVendorTier` in `lib/vendor-feature-gate.ts` applied a
  live `all_vendors` window to every vendor, pending or unverified included.
  The global `getPromotedVendorTierNow()` is gone; `getPromotedVendorTierFor(facts)`
  replaces it and the gate's single-row read now selects the three facts
  alongside `tier_state`. The vendor dashboard banner takes the same facts and
  says nothing to a vendor the deal does not reach.
- **New audience `new_verified_vendors`** — qualifies when sign-up AND doc
  approval both fall inside `[starts_at, ends_at)`. Migration
  `20271207345427_promo_free_windows_cohort_deals`: the inline audience CHECK
  re-listed its vocabulary, so it is dropped by its auto-generated name (and
  by definition, defensively) and re-added; the tier rule is EXTENDED so both
  vendor audiences require `promoted_vendor_tier`.
- **`deal_length_days`** (nullable) — how long EACH qualifying vendor keeps the
  deal, counted from the moment they qualified; NULL keeps the old meaning,
  until `ends_at`. The window says who gets in; this says how long each of
  them keeps it. A vendor who qualifies on the last day of a 28-day deal keeps
  it 28 days past `ends_at`; the reader's horizon accounts for that.
- **`createFreeWindow` is extended, not forked.** It accepts the new audience,
  a `service_keys` pick from `vendor_billing_catalog` (only the plan rows —
  `solo|pro|enterprise_vendor_monthly|annual` — survive, highest wins, and the
  picked codes are kept in `covered_service_keys` so the deal records the
  price it waived), `deal_length_days`, a required `reason` for every vendor
  audience (audit-log metadata), and `return_to=/admin/gifts` so the flash
  lands where the form was. The Catalog Studio tab's vendor form gained the
  reason field and the verified wording.
- New reader `fetchVendorDealWindows` in `lib/vendor-tier-comps.ts` (throws on
  a refused read, per the console-table contract). Rows typed `window` sit in
  the same `ConsoleTable` as the named vendors; both reads must succeed or the
  whole list says "couldn't read".

What a deal cannot do yet: make an **add-on** free. Papic Challenges, 3D
Booth, AI Chatbot, Deep Search, Extra Team Seat, Additional Branch, the custom
line items and the Papic portfolio pack each have their own resolver with no
shared choke point, so the creator lists them with their catalog prices under
"can't be in a deal yet" rather than offering a checkbox nothing honours.

OPEN #3 measured: the `price_php > 0` CHECK on `vendor_billing_catalog` blocks
nothing here — a deal moves the resolved tier, never a price. The db test
asserts a ₱0 update is still refused.

Dark by construction: `PROMO_FREE_WINDOWS_ENABLED` is checked before any
window is read. `lib/promo-free-windows.test.ts` proves a live cohort window
grants nothing to a qualifying vendor while the flag is unset, and that the
window store is never consulted. Flipping the flag is an owner action in
Vercel.

Exposure baseline (`supabase/security/exposure-surface.baseline.txt`)
regenerated in this PR: +1 line, `col public.promo_free_windows.deal_length_days
anon=- authenticated=SIU` — the new column inherits the table's stock grant
exactly like its 14 siblings, and every row stays behind the table's
`is_admin()` policies in both directions. Nothing else moved.

Tests: `lib/promo-free-windows.test.ts` (19) ·
`tests/db/promo-free-windows-cohort-deals.db.test.ts` (7).
`admin:map` / `admin:jobs` regenerated (two new form fields on an existing
action; no new page, so `MODEL_CHOICE_CAP` does not move).

SPEC IMPACT: `DECISION_LOG.md` row added 2026-09-05 (vendor cohort deals;
"all vendors" = verified; deal length separate from window). No iteration
`.md` changed, so no `.docx` regenerated.
