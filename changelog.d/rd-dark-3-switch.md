## 2026-10-13 · feat(theme): the Appearance switch is back — Light · Dark, and nobody sees dark yet (dark mode PR 3)

Owner, 2026-10-13, "approve all" (DECISION_LOG "HOW DARK MODE IS TURNED ON"), lifting the 2026-06-04
light lock: one setting, Appearance = Light · Dark, per person, no "follow the phone".

- **The lock is undone.** `theme-provider.tsx` holds the real choice (`mode`, from the `sn-theme`
  cookie) and what the screen paints (`resolvedTheme`); `setMode` writes the cookie in the browser and
  repaints at once. `theme-bootstrap-script.ts` reads the cookie in `<head>` and sets `.dark` BEFORE
  THE FIRST PAINT (no flash, no `cookies()` in the root layout) — only for a **signed-in** person
  (signed-out visitors are always Light, call 4), only on an **app route** (the couple's guest pages
  at `/[slug]` keep their design, call 5, read from the generated route list), and only under a prefix
  on the **READY-LIST `DARK_READY`, which starts EMPTY** (call 3) — so today nobody sees dark. Each
  area PR adds its prefix once its screens are swept. The rule is written once (`lib/appearance.ts`);
  the provider asks the head script's own `window.__snTheme` after a client navigation, so the route
  list is not shipped in the client bundle. Print is always Light (`beforeprint`, call 9).
- **Browser bar:** `layout.tsx` keeps the light `theme-color` (`#FBFBFA`, unchanged); in dark the head
  script swaps it for the dark page `#17160F` and restores the light value on the way back.
- **The switch:** account settings › Preferences (`/dashboard/profile?tab=preferences`), the first row,
  a two-way **PillSelector** (call 2 — supersedes "one dropdown"), "Appearance · Light | Dark". A tap
  changes the page at once; one request saves the column; a failed save is said out loud.
- **`updateThemePreference`** accepts Light or Dark only (refuses 'auto'), writes the column and
  returns — no `revalidatePath`, no server cookie (a `cookies().set` in a Server Action re-renders
  the route); the browser writes the cookie.
- **Migration `20271267769389_users_theme_preference_light_by_default.sql`** (via `pnpm
  migration:new`; NOT applied by hand): every `'auto'` row → `'light'` (prod: 20 of 20 are 'auto'),
  column default `'light'`. The enum keeps `'auto'` (dropping a value is churn).
- **Guard:** `lib/appearance.test.ts` — the rule on a table of people × paths; the REAL head script
  run against a fake page agrees with it in all 80 cases; as shipped (empty ready-list) it never adds
  `.dark` or touches the bar for anyone anywhere; a ready-list entry can only be an app route; no
  frozen lock, no server re-render on save, the control is the pill, the migration is there.
  Sabotaged 4 ways, each red.

SPEC IMPACT: `02_Specifications/Theme_System_Implementation_Spec.md` line 5 still says the app is
light-locked and the picker removed — the DECISION_LOG row says it is updated "when the switch
lands", so it is updated when this PR merges (not on a draft). `tests/db/handles-have-gates.baseline.txt`
reason for `users.theme_preference` rewritten (no longer dormant).
