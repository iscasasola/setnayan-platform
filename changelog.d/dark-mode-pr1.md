## 2026-11-18 · feat(theme): one colour set by job, and the couple's /dashboard opens to dark

Owner, 18 Nov 2026, on the drawing `prototypes/dark_mode_elite_2026-11-18_fable.html` (specs repo,
https://claude.ai/artifact/8R89PJzbJGvKsikcH5gJkV): **"dark mode. YES :D"** and **"all picks"** — supplier navy
kept · a darker page and card · a grey active tab · toggles in the decision colour · the couple's `/dashboard`
goes dark first.

**(a) One colour set.** Every Admin › Colours job now has ONE `--color-*` token, declared for Light at `:root`
and for Dark under `html.dark` (`apps/web/app/globals.css`, "THE ONE COLOUR SET, BY JOB"). The older families
POINT at it instead of holding a second copy: `--m-paper: rgb(var(--color-raised))`, `--sn-page-bg:
var(--color-page)`, `--fd-ink: rgb(var(--color-ink))`, `--sn-cat-*: var(--color-cat-*)` … New job tokens:
`--color-page` · `--color-raised-2` · `--color-wash` · `--color-ink-2` · `--color-ink-3` · `--color-on-accent` ·
`--color-toggle` · `--color-band-from/-to/-glow` · `--color-cat-*`. House names kept (14 Nov ruling): where a
`--color-*` token already held a job (`raised` = the frame, `mulberry` = the decision, `ok` = money) it is that
job's one token — no twin was added.

- **Light moves no pixel.** Measured, not argued: on the four couple screens (Home, Budget, Guests, Schedule) and
  the supplier customers list, before vs after at 390 px — see `build-sessions/shots-dark-mode-pr1/`; and every
  custom property on `<html>` resolves to the same colour before and after.
- **Dark is the approved set:** page `#121110` · frame `#1C1A16` · raised `#26231E` · wash `#302C26` · text
  `#F7F4EE` / `#D2CCC1` / `#A49E93` · decision `#EE8456` with `#1A120C` words · the hero band a dark card with a
  terracotta corner glow · the lift a 6 % top highlight plus a deep drop (no border) · the active bottom tab a
  grey pill. Every retired 13 Oct neutral (`#17160F`, `#232019`, `#FBFAF7` …) left the dark token blocks.
- New guard `lib/the-colour-set-is-one.test.ts` (one token per job · pointers, never copies · the ruled values ·
  every text/surface pair at AA in both themes · no retired neutral) and a shared reader
  `lib/css-colour-tokens.ts` that follows a pointer the way the browser does; the existing guards that read a
  token's literal value now read it through that.

**(b) Four event screens open to dark; the tokens are swept across the whole area.** `DARK_READY`
(`lib/appearance.ts`) keeps the account spokes B2 opened on 23 Oct and adds ONLY the four event screens that were
rendered in dark, each exactly: the event Home (`/dashboard/*$`), Budget, Guests and Schedule. `isDarkReady` (and
the inline head script) learned two marks for that: `*` = one segment that is an id (it must hold a digit; no
static `/dashboard` folder does) and a trailing `$` = this route exactly. Suppliers, the Hub door, the Maker, the
Studio, the website editor, seating and the Events board STAY LIGHT until they are swept and walked — they still
paint colours of their own (review of #7993, 19 Nov 2026). The sweep below ran across all of `app/dashboard`, so
those screens are closer, not done:

- solid `bg-white` → `bg-raised` and `text-white` on a token fill → `text-cream` / `text-sn-on-accent` across
  about 135 files (the same pixels in Light); translucent whites over photos and camera drawings kept;
- every stock-palette class got its dark partner; the two big embedded stylesheets (Suppliers bench, plan and
  budget) and the Story editor's own neutrals read the one set in dark; the Maker's stage panel got its dark
  thirteen (`STAGE_PANEL_VARS_DARK`), each reading a token;
- the dark-contrast record (`scripts/label-contrast-dark.baseline.json`) fell from 161 unreadable uses to 101,
  and to **zero** under `app/dashboard`;
- new down-only ratchet `app/dashboard/raw-hex-only-goes-down.test.ts` + `raw-hex.baseline.json`: raw hex per
  area, 438 → 336. What remains is the person's or the art's own colour (palettes, monogram and logo art,
  drawings of a phone / camera / seal, the seat-plan lab's stage, print and PDF routes that are always light).

`scripts/lint-label-on-fill-contrast.mjs` follows the new pointers for the families that were literals, and
no longer judges a token-reading `html.dark` rule with Light values.

**Not in this PR (said plainly):** the supplier dashboard's dark navy (its own batch — pick 1 keeps the navy) ·
admin dark · the terracotta ICON on the grey active tab (it needs `bottom-nav.tsx`, which the motion PRs are
editing; the pill, its word and its icon are the ink today) · a signed-in walk of every `/dashboard` route in
dark — only the screens with a lab were rendered here (Home, Budget, Guests, Schedule); the rest need a
signed-in walk before this ships.

SPEC IMPACT: None new — the approval and the drawing are already in the corpus (the controller logs the 18 Nov
row). `docs/design-token-map.md` carries the job → token table. One naming note for the corpus: the drawing's
table called the frame `--color-frame` and the decision `--color-decision`; the app already had `--color-raised`
and `--color-mulberry` for exactly those jobs, so those names stand (owner 14 Nov, "keep house names").

- 21 Nov: 22 pointer lines in `globals.css` lose a trailing comment that only repeated the colour they point at (−332 B; 705 B headroom under the 645,000 ceiling).
