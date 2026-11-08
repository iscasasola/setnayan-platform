# B2-C · Billing & receipts + small rows — build notes (Build 2, 8 Nov 2026)

Branch `claude/supplier-build2-c` (from `origin/claude/supplier-1build`, merged forward, never rebased). No PR, no merge, no deploy.
Contract: prototype v118 `supplier-menu-r2.v118.html` at 375 px, `?tab=billing`.

## Done

### #39 · Billing & receipts holds every supplier list
- **What exists, what is new.** The shipped `/dashboard/billing` (`page.tsx` + `_components/billing-list.tsx` + `lib/billing.ts`) is kept. A login with no shop sees it byte-for-byte unchanged. A login standing in a shop (`resolveActiveShop`) gets the shipped Purchases list plus **Gifts given · Payments received · Refunds · Rewards earned**.
- **ONE dropdown.** `_components/billing-filter.tsx` puts the shipped `PickMenu` in the pinned row, with All plus the five sections. Picking a section hides the others with no refetch and writes `?show=` via `history.replaceState`; `?show=` also works as a deep link (`billingShowOf`).
- **Section headings stick.** Each heading (`supplier-billing-sections.tsx` › `Heading`) sticks under the pinned row and shows a title, one summary line, and the details inside the ⓘ.
- **Rows are the shipped row.** `BillingRow` was extracted from `billing-list.tsx` with identical markup, and the shipped `Row` now calls it.
- **Doors:**
  - Booking-fee and Pro rows → their receipt (shipped).
  - A gift → that client on **Quotation**: `customerCardHref(eventId,'quote')`.
  - A payment → that client on **Payment**: `customerCardHref(eventId,'payments')`, where "Their receipt" and Confirm / Not received already live.
  - A refund → the slip it reverses.
  - A reward → `/vendor-dashboard/shop#badges`.
- **Reads.** `lib/supplier-billing.server.ts` › `fetchSupplierBillingMeasured`.
  - The **session** client reads `vendor_proposal_shop_gifts` (embedding the quote's status and event), `shop_gift_stock_entries` (kind `given`), `shop_badge_rewards` and `event_vendor_payments`. Each is filtered to the active shop.
  - The admin client reads only the shop's bookings and the client names (`event_vendors`, `vendor_proposals` → `events`), scoped by the shop the session resolved. A supplier has no RLS on those tables; that is the sanctioned shape. The reward catalogue names are read on the admin client too.
  - Payments come from `event_vendor_payments`. Refunds come from the shipped purchases read (`status = 'refunded'`, supplier billing only), never a second read.
  - A refused read sets `measured:false` and the list says "… didn't load", never "No … yet".
- **📡 Request count.**
  - Couple: 3–4 requests in up to 2 round trips, unchanged.
  - Supplier: those, plus the shop resolve (2, React-cached and shared with the layout), plus **7 in ONE `Promise.all`** run beside the purchases read. That is **2 round trips end to end**, about 13 requests, and never one per list.
- **RULE 0.**
  - Badge rewards already live in `shop_badge_rewards` (migration `20271323363853`), so no new table was needed.
  - RLS already admits a shop's own rows in all four tables. **No migration was added.**
- **Guards** (each sabotaged once, seen red, restored):
  - `lib/supplier-billing-is-honest.test.ts` (6 tests): one round trip · shop scoping · refused ≠ empty · states and words · doors · render.
  - `tests/db/a-supplier-reads-only-its-own-billing.db.test.ts` (2 tests, PGlite replay). A shop reads its own rows and none of another's; a stranger reads none. A login in two shops (owner plus an admin seat) reads both through RLS, so the reader's shop filter is load-bearing. Sabotage: `shop_badge_rewards_vendor_read USING (true)` turned both red.
- **Lab:** `/dev/billing-lab?supplier=1` (`&show=…`, `&supplier=unread`).

### #41 · Receipt stamp inks ≥ 4.5:1, still worn
- `app/receipts/_components/receipt-stamp.tsx`: PAID ink `rgba(28,92,56,.92)` at opacity .9 is **5.09:1** (was 2.47). AWAITING `rgba(133,88,10,.95)` is **5.45:1** (was 4.07). The worn mask and tilt are unchanged.
- `receipt-slip.tsx`: small text `#8A857B` → `#6E6A62` in all six places.
- Guard: `receipt-ink-is-readable.test.ts` computes both ratios from the exported constants and forbids `#8A857B` and `opacity-75`. Sabotage was red ("PAID reads 3.05:1").

### #26b · The chat host strip's green ring is never clipped
- `chat-host-strip.tsx`: the scrolling `<ul>` pads 4 px on every side (`-mx-1 … scroll-px-1 … p-1`). The ring is `ring-2` + `ring-offset-2` = 4 px.
- Guard: a new test in `the-host-strip-reuses-presence.test.ts` parses the ring width against the padding on each side. Sabotage (`pb-1`) was red.

### Parity
- **Money ledger from Payment.** "Every client's payments ›" sits in the client's Payment footer. It uses `customerLandingHref('payday')`, the same door as Today's Money stat, never a second ledger. It is asserted in `the-payment-page-reads-like-the-budget.test.ts`; sabotage was red.
- **More tools** is NOT built: v118 draws no place for it in the frame (see Needs).
- **Your Story tile** is NOT built: this is a conflict between rulings (see Needs).

### Data export
- `find_lock_lifted_by` exports as **"Setnayan staff"**, never a staff uid (the STAFF_ACTOR rule). The rule is applied by `VENDOR_PROFILE_EXPORT_STAFF_LABELS` + `vendorProfileForExport` in `lib/export-vendor-profile-columns.ts` and used by `personal-data-export.ts`. The column stays in the projection, so T12 is still complete.
- New guard T12b in `export-coverage-guardrail.test.ts`. Sabotage (no swap) was red.

## Proof — 375 px, light and dark, beside v118
In `build-notes/shots/b2c/` (force-added; the folder is gitignored). Taken with a dummy-env `next dev` under the `walk:` lock, with `env -i` and Supabase pointed at `127.0.0.1:1`. The dev overlay's "Issues" are those dummy settings reads failing, not lane code.

| Item | Side by side | Raw shots |
|---|---|---|
| #39 · All, light / dark vs v118 | `sbs-39-billing-light.png` · `sbs-39-billing-dark.png` | `39-billing-all-{app,v118}-{light,dark}.png` |
| #39 · dropdown open + refused list | `sbs-39-dropdown-unread-light.png` | `39-billing-dropdown-app-*.png` · `39-billing-unread-app-*.png` |
| #41 · slip PAID vs v118, light / dark | `sbs-41-slip-light.png` · `sbs-41-slip-dark.png` | `41-slip-{paid,awaiting}-app-*.png` · `41-slip-paid-v118-*.png` |
| #26b · host strip, light \| dark | `sbs-26b-host-strip-light-dark.png` | `26b-host-strip-app-*.png` |

Two caveats on the shots:
- The #26b ring is set by hand in the lab, because presence cannot connect without a backend.
- The lab's Purchases fixture differs from v118's sample rows (fewer rows); the order and shape match.

## Needs (controller / owner)
1. **Your Story tile on the supplier account sheet** (parity row, "ruling #30") **conflicts** with DECISION_LOG 2026-11-07 "Account sheet tiles" (Help · Show me around · Sign out on every sheet) and with ONE-BUILD-SPEC §0 item 5. It is pinned by the shipped guard `app/_components/account-switcher/the-supplier-sheet-order.test.ts`. Ruling #30 is about the sheet's design, not its content. **An owner word is needed; nothing was built.**
2. **More tools in the supplier frame.** v118 has no place for it, and the settings-menu registry has no supplier slot for it either. Listed, not built.
3. **Refunds you gave a client.** There is no data source for supplier → client refunds; `event_vendor_payments` has no refund state. The list shows Setnayan → you refunds only, and the ⓘ says so. A ruling is needed if suppliers should log refunds.
4. **Corpus.** The Build 2 plan's #39 row says "badge rewards (no table found yet)", but `shop_badge_rewards` exists. Flagged, not edited.

## Generated-file needs (none edited)
- None known to need regenerating: no new route (both `/dashboard/billing` and `/dev/billing-lab` already exist), no migration, and no new nav slot. If the controller's integrate run flags `lib/ugat/screens*` / port / admin-map / `design-rules.baseline.json` drift from these files, regenerate there.
- Result of the full `pnpm test:unit` and typecheck on the merged head: see "Where I stopped".

## Where I stopped
- All five scope items: done or listed, as above.
- `origin/claude/supplier-1build` was merged at `cb79313a3a` (20 commits, clean).
- Full typecheck + `pnpm test:unit` on the merged head under the heavy lock: RESULT_PENDING.
- No PR opened, nothing merged or deployed, no migration applied, `.env.local` never read.
