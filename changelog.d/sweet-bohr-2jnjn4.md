## 2026-11-27 · fix(crashes + auth): Batch 0 · L1: the Plan page draws one way, a non-admin goes Home, parked accounts come back on /login

MASTER-PLAN 27 Nov, Batch 0, lane L1 (items L2, L5, L6, A8, D6; walk 27 Nov 12a, 12e, W2-7).

- **Supplier Plan page (`/vendor-dashboard/subscription`).**
  - The badge-upgrade row printed its day with `toLocaleDateString('en-PH')` while hydrating in the browser. A runtime's own locale data can answer differently from the server's, which React reports as #418 and repairs by re-drawing the page. The streamed boundaries then land in a page that is gone, and Problems logs "uncaught … Cannot read properties of null". The row now prints the Manila day by arithmetic, in the page's one phrasing (RW-30, "4 Dec 2026").
  - Held by `the-plan-page-draws-one-way.test.ts`: no client piece on the page formats by locale or reads the clock while drawing, and a plan read with no row reads Free without throwing.
- **One failure screen, never two.** The "This page did not finish loading · Reload" bar no longer stacks over an error screen. Every boundary already calls `reportCrash`, which now stands the bar down (`standDownLoadBar`), and the bar's script checks the same flag before drawing.
- **A non-admin who opens `/admin` goes Home** (`requireAdmin` → `/`), not to a 404, and is no longer logged as not_found (D6). A sign-in whose `next` the account cannot open (`/admin`) therefore lands Home too (A8). Signed out still goes to sign-in, and a server action still refuses.
- **Parked accounts on `/login`.** "Add another account" parks the session and opens `/login`, which now lists the parked accounts under "Switch to". It uses the avatar sheet's own row (`OtherAccountRow`, now the one copy both draw) and the same switch route. One tap returns, carrying `/login`'s `next`. No new server action.
- **Malformed query strings.** Already fixed on main by A1-058 (`decodeParamSafely`); the guard now also covers `%E0%A4%A` and every page on `/login` and `/help`.

SPEC IMPACT: None. This applies the MASTER-PLAN rows as written; A8 and D6 say a non-admin goes Home.
