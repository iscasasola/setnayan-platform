## 2026-10-21 · feat(nav): the account bar is Events · Discover · Memories · People — anchored, no floating ＋, Shop for an owner, the mark goes to Events

Owner, verbatim, **"yes to all"** to the controller's four recommendations on the approved prototype
`Setnayan/prototypes/account_bottom_bar_2026-10-21.html`.

- **The bar.** `HomePillNav` (a hand-rolled floating pill: Home · Memories · ＋ · People · Spaces) is replaced by
  `AccountBottomNav` — the canonical `<BottomNav>` inside `<BottomDock>`, anchored edge to edge like the event,
  supplier and HQ bars (the 2026-09-25 ruling, finally applied here). Tabs come from one rule,
  `lib/account-bar.ts`: **Events · Discover · Memories · People** for everyone; **+ Shop** (fifth, last) only for an
  account that OWNS a shop (`hasVendor && !canOpenShop`); **Admin never**; **no ＋ Create** (it stays on the board).
  In the app shell, while `/` is bounced by `APP_EXCLUDED_MARKETING_PATHS`, Discover is dropped — **Events ·
  Memories · People**. Events goes to `/dashboard?hub=1` so the board never auto-jumps a one-event couple back
  into their wedding.
- **The rail's dead Discover row** in the app shell (it bounced to the board) is hidden on exactly the requests
  middleware bounces — `discoverOpensHere()` (lib/request-platform.ts) → a server-rendered marker → CSS
  `display:none`.
- **The mark goes to Events** (app variant, `/dashboard?hub=1`) — supersedes the 2026-08-13 "the wordmark is the way
  out of the app" lock for the app variant; front door and doorways (the signed-out world) still go to `/`.
- **"SETNAYAN" beside the mark** on the account-level screens, every width (CSS keyed on the account bar's
  `data-account-bar`).
- **Avatar sheet:** the HQ tile reads **Admin** (sub-line "Setnayan HQ").
- **Maker first load: +0 B of JavaScript** — every shell-side change is server-rendered or CSS; the only shell JS
  edit is one href string.
- Guards: `the-account-bar-is-the-ruling.test.ts` (new: renders the real bar for all 16 account/shell combinations),
  `seam-invariants.test.ts` + `rail-active.test.ts` (changed on purpose, citing the ruling),
  `the-bottom-bar-stays.test.ts` (re-pointed at the new bar).

SPEC IMPACT: `Setnayan/DECISION_LOG.md` 2026-10-21 row "THE ACCOUNT BAR — EVENTS · DISCOVER · MEMORIES · PEOPLE"
(pushed as corpus commit 755f5718) — records the owner's "yes to all" and the rulings it supersedes (2026-08-13
wordmark lock for the app variant; 2026-07-29/30 raised Create knob; the "Spaces" slot).
