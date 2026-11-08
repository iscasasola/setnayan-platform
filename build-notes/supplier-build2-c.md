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

## Generated-file needs (none edited — list for the controller)
- **`apps/web/lib/ugat/screens.generated.json`** — `screens-are-generated.test.ts` is red on the merged head. A fresh scan
  (run, diffed, then restored byte-for-byte — not committed) changes TWO rows:
  - `/dashboard/billing` — **this lane**: the page now reads the shop's gift/stock/reward/payment tables, so its
    `nodes`/`tables` grow (TYPE-GALLERY, TYPE-P…). Regenerate with `pnpm --filter @setnayan/web ugat:screens`.
  - `/vendor-dashboard/shop` — **not this lane** (nothing under `app/vendor-dashboard/shop` changed here); it came with
    the `origin/claude/supplier-1build` merge.

## Where I stopped
- All five scope items: done or listed, as above.
- `origin/claude/supplier-1build` was merged at `cb79313a3a` (20 commits, clean).
- **Typecheck** on the merged head (heavy lock): **clean** — no errors, no OOM (10 GB heap).
- **`pnpm test:unit`** on the merged head: 30,992 tests · 30,977 pass · **11 fail**. Of those:
  - **3 were this lane's and are fixed** (15c5dbedfd + the FK commit; each re-run green):
    - `every-back-goes-home` raw-hex 1 → 2: the stamp's exported paper constant is gone, and the ink test now reads the paper from
      `.sn-slip`'s own background (sabotaged: grey paper → PAID 2.12:1, red).
    - `numbers-carry-commas` T4: `BillingRow`'s `{amount}` gets a reasoned TEXT row (every caller passes formatPhp/manilaDay).
    - **`the-cure-was-already-written-down` (a real bug)**: my bookings read embedded a bare `events(` from `event_vendors`.
      PostgREST refuses that with PGRST201, so in production "Payments received" would always have said "didn't load".
      Now `events!event_vendors_event_id_fkey(…)`, and the gift-client embed names `events!vendor_proposals_event_id_fkey(…)`.
  - **1 is a generated file:** the screens map (above).
  - **7 are not this lane's** (no file of theirs is touched here; they arrived with the supplier-1build merge):
    `the-skeleton-promises-only-what-the-page-draws` (clients/[eventId] intercept borrows vendor-dashboard/loading) ·
    `canvas-field-parity` (giftLimitPct) · `couple-face-choice` THE HANDLE · `forms-send-on-booking-from-every-door`
    (lib/ugat/graph.ts) · `papic-pool-buyable` · `the-badge-has-a-deadline` (lib/shop-permit-line.ts) ·
    `the-hub-settings-sheet-holds-the-rest`.
- No PR opened, nothing merged or deployed, no migration applied, `.env.local` never read.
