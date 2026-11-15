## 2026-11-13 · feat(suppliers): after the claim, a per-guest price follows the guest list

The follow-up #7565 named ("guest-list follow after claim (own PR)"). DECISION_LOG 2026-11-13 "AFTER THE CLAIM, THE
SUPPLIER'S PRICE FOLLOWS THE GUEST LIST" · 2026-11-12 "WHEN A GUEST IS REMOVED, THE PRICE FALLS BACK — UNLESS THE
SUPPLIER LOCKED IT" · 2026-11-12 "A LOCKED QUOTATION STILL FOLLOWS THE GUEST LIST".

- **Repricer extended, not forked:** `quote_follow_guest_count` (20271341557835's body, unchanged) now also calls
  `quote_follow_claimed_per_guest` inside its own fault fence, so every guest-list trigger that moves a quote moves a
  claimed per-guest booking too. Same per-service count (`quote_guest_count`).
- **Which bookings:** `pricing_basis = 'per_pax'`, claimed (`marketplace_vendor_id`), not archived / packaged /
  delivered / complete, and no standing quote of that shop that follows the list (that quote stays the price).
- **Every figure is the booking's own:** the total agreed (T) for the guests agreed (G). Total = T × billed ÷ G to the
  centavo; G is the minimum. Unlocked: up and down, floored at G (exactly T again). Locked (booked or
  `lock_agreed_at`): rises, never falls. Paid stays: the total now never goes under what is paid, and the plan is
  re-plotted by the shipped `plan_replot_for_booking` (paid instalments untouched).
- **Anchor table `event_vendor_guest_follow`** (migration 20271343652941), not a sixth money column on `event_vendors`
  (20271342818285 is closing those to delegates). RLS at CREATE; hosts read the counts only (column grant); written
  only by the SECURITY DEFINER pass. Exposure baseline regenerated (+4 count columns, +1 hosts-only policy).
- **Couple:** the bench card and the workspace's Price show one line — "Follows your guest list · 130 guests counted,
  120 agreed" / "… never below the 120 guests agreed". **Supplier:** the quote follow's existing chat line ("Quote rose
  to N pax · +₱X" / "Quote fell to …"). No email.
- Tests: `tests/db/a-claimed-per-guest-price-follows-the-guest-list.db.test.ts` (6, three sabotages each seen red) ·
  `lib/claimed-per-guest-follow.test.ts` (6).

SPEC IMPACT: None — builds the already-logged 2026-11-13 ruling. One build reading is surfaced for the owner in the PR
(a locked per-guest price rises with the list and never falls, per the 2026-11-12 locked-quotation ruling).
