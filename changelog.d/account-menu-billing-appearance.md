## 2026-10-25 · feat(account-menu): Billing & receipts page + Appearance moves into the account menu

Owner, 25 Oct, on a competitor's avatar menu (name/email · New event · Account settings · Billing & receipts ·
Appearance · Sign out): *"on the upper right, i think the billings&receipts looks nice as well"* — read as yes to
the controller's two recommendations.

- **Account menu (`SwitcherPanelBody`)** gains one card under "Your shop": **Billing & receipts** (→
  `/dashboard/billing`) and **Appearance** (Light · Dark · Automatic). Signed-in accounts only.
- **Appearance MOVED, not copied.** `appearance-choice.tsx` moved from `profile/_components/` to
  `app/_components/account-switcher/`; same PickMenu, same `updateThemePreference` action (+0 server actions).
  Profile & settings › Preferences no longer draws it (its now-empty first tile is drawn only while Display
  language has something to show). The cross-device bring-in reads `users.theme_preference` with the switcher
  data and is latched once per page load, so a stale layout prop can never undo a pick; a refused read
  (`themePreference: undefined`) reconciles nothing.
- **New `/dashboard/billing`** (server component): every `orders` row this login paid for (`user_id` = them,
  not drafts) — event orders, a supplier's own `vendor_…` billing, Papic top-ups, App Store purchases — joined to
  `receipts` and (for the person's own event orders) the event's name. Shape (controller direction after the owner
  asked for "a better presentation for receipts", pending his OK of the designer's prototype): one summary line ·
  "Waiting for payment" pinned on top with a gold Pay door · then one group per event and "Your shop" · one-line
  rows (name left, amount right, "date · status" under it), hairline dividers, no boxes, the whole row opens its
  receipt (an unpaid event order opens where it is paid; never in the store shell, never a supplier's own bill).
  Reference numbers and "incl. VAT" stay on the receipt page. Reads are honest (`lib/billing.ts`): a refused read
  says "Your purchases didn't load", never "No purchases yet"; a refused receipts read says so; an unreadable event
  name is "An event". Held by `lib/billing-read-is-honest.test.ts` (seen to fail on a lib and a render sabotage).
- Registered: `lib/ugat/screens.generated.json`, `scripts/port-control-baseline.json` (regenerated — the Profile
  route's lost `<AppearanceChoice>`/`<PickMenu>` is the deliberate move), `no-door.baseline.txt` (+ the dev lab).
  Lab: `/dev/billing-lab?state=rows|empty|unread|noreceipts`.

- **The receipt is a paper slip** (owner approved the prototype 2026-10-25, "the rest on the receipts"):
  `app/receipts/[receiptId]/page.tsx` now draws `app/receipts/_components/receipt-slip.tsx` — narrow centred slip,
  SETNAYAN wordmark, "Transaction receipt" + No., amount big in mono, date · time · method, dashed tear, line items
  (what · ×qty · amount) + a VAT line ONLY when the row carries VAT (same `vatWasCharged` rule), Total + "VAT included"
  (also only with VAT), paid by / method / logged / confirmed, the references small at the foot, "Transaction receipt —
  not a BIR Official Receipt", zigzag bottom edge; Save as PDF (print) · Share (the owner-only link — no public token)
  under it. Dark: the slip stays light paper on the dark page. Same data + RLS: receipt row, plus its order and
  payments on the person's own client (a refused read leaves those lines out).
- **New `/receipts/order/[orderId]`** — the same slip before the money moves (payer-only; forwards to the receipt once
  one exists): "Order · awaiting payment", Pay to (masked) + Reference, and a gold "Pay ₱X" to the event's order page
  — never for a supplier's own bill, never in the App Store shell. Billing rows without a receipt now open it.
- **`ReceiptStamp`** (`app/receipts/_components/receipt-stamp.tsx`) — ONE component, `status: 'paid' | 'awaiting'`,
  neutral placeholder look until the owner picks one of the designer's three stamp pairs.
- Lab: `/dev/receipt-lab?state=paid|novat|awaiting`.

SPEC IMPACT: DECISION_LOG.md row 2026-10-25 "ACCOUNT MENU: BILLING & RECEIPTS + APPEARANCE MOVES INTO IT"
(owner quote, the move, the page's scope).
