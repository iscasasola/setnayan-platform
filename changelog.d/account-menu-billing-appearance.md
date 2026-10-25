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

SPEC IMPACT: DECISION_LOG.md row 2026-10-25 "ACCOUNT MENU: BILLING & RECEIPTS + APPEARANCE MOVES INTO IT"
(owner quote, the move, the page's scope).
