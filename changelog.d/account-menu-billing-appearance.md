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
  not drafts) — event orders, a supplier's own `vendor_…` billing, Papic top-ups, App Store purchases — newest
  first, joined to `receipts`. A receipted row opens `/receipts/<id>`; an unpaid event order opens its order page
  (not in the store shell, not for a supplier's own bill). Reads are honest (`lib/billing.ts`): a refused read
  says "Your purchases didn't load", never "No purchases yet"; a refused receipts read says so. Held by
  `lib/billing-read-is-honest.test.ts` (seen to fail on both a lib and a render sabotage).
- The event Orders ledger's row is now the shared `app/_components/orders/order-line.tsx`, drawn by both pages.
- Registered: `lib/ugat/screens.generated.json`, `scripts/port-control-baseline.json` (regenerated — the Profile
  route's lost `<AppearanceChoice>`/`<PickMenu>` is the deliberate move). Lab: `/dev/billing-lab`.

SPEC IMPACT: DECISION_LOG.md row 2026-10-25 "ACCOUNT MENU: BILLING & RECEIPTS + APPEARANCE MOVES INTO IT"
(owner quote, the move, the page's scope).
