## 2026-11-10 · fix(booking): the booking gate reads admin hide, fraud suspend and fraud ban; an ended Solo plan lapses

Build 5 · Lane G item 1 (audit C1, `plans/audit_supplier_admin_events_2026-11-10/00-AUDIT.md`) and Step 0 rows 14–15.

**The booking gate.** `isMarketplaceVendorBookable` and the DB trigger `enforce_booking_requires_verified_vendor` read
only `verification_state`. Admin hide/archive (`public_visibility`), the fraud auto-suspend (`fraud_suspended_at`) and
the fraud wipe+ban (`fraud_banned_at`) leave that column `verified`, so a shop gone from Find could still be locked by
a couple who had it shortlisted — and the couple was charged the booking fee.
- One rule, `shopBookingRefusal` / `isShopBookable` (`lib/vendor-visibility.ts`): `isShopLive` (verified + listed) AND
  no fraud stamp; an absent column refuses. `SHOP_BOOKABLE_COLUMNS` names the four columns.
- `marketplaceVendorBookingRefusal` (`lib/vendor-verification.ts`) returns the reason; `isMarketplaceVendorBookable`
  is its boolean form, so all five app doors (and the Locked-QR issue check) get the fix with no call-site change.
- Migration `20271335513615_the_booking_gate_reads_hide_suspend_and_ban.sql` re-creates the trigger function: it now
  refuses fraud-suspended, fraud-banned and archived shops. Scope, transition-only check, grandfathering and the
  `vendor_not_verified:` message prefix (four app paths match on it) are unchanged; the reason is named after the
  prefix. Not applied anywhere — the pipeline pushes it. Prod measured read-only 10 Nov: both verified shops are
  listed and unstamped, so nothing bookable today stops being bookable.
- ⚠ Known gap, pinned by a DB test: the trigger does NOT yet refuse `public_visibility='hidden'` (admin hide). It is
  the column default, and refusing it turned 41 of the first 48 booking DB test files red — all on fixtures that seed
  "a verified shop" at the default. Every app door refuses a hidden shop today; closing it in the DB needs one shared
  verified-shop fixture across ~90 DB tests first (its own PR).
- `executeFraudWipeBan` now also sets `verification_state='demoted'` (+ `last_demoted_at`) on a verified shop — it
  already bumped `demotion_count`.

**The ended Solo plan (SetnaProd, gift ended 19 Oct, still Solo on 10 Nov).** The SQL sweep has lapsed Solo since
20271286893359, but its only caller (`app/vendor-dashboard/layout.tsx`) fired it for an inline `['pro','enterprise']`.
- `lib/vendor-tier-lapse.ts`: `LAPSING_TIERS` (= the SQL list), `tierMayLapse`, `tierHasLapsed`. The layout asks
  `tierMayLapse`.
- The Plan screen (`subscription/_components/plan-screen.tsx`) runs the same sweep BEFORE it reads the plan when the
  row's day has passed, so it never prints an ended plan's day as the future. No visual change.

Tests: `lib/the-booking-gate-reads-hide-suspend-and-ban.test.ts` (new), `lib/vendor-verification.test.ts` (gate cases),
`tests/db/booking-requires-verified.db.test.ts` (+5 DB cases: archived, suspend INSERT+UPDATE, ban, grandfathered
suspend, and the pinned hidden gap), `lib/a-solo-plan-is-asked-to-lapse.test.ts` (new). Each was sabotaged once and went red.

Waits for a look (not built): the couple and supplier sentences for a hidden / suspended / banned shop — today they
reach the existing "completing verification" / "send your papers" copy, which is wrong for a banned shop.

SPEC IMPACT: None — implements audit C1 and Build 5 Lane G item 1 / rows 14–15 as written in the corpus.
