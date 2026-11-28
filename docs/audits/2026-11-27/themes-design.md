# Audit: themes and design consistency (27 Nov 2026)

> **Read-only audit. No app code was changed.** Measured on `main` @ `068460f`, which is also what
> `www.setnayan.com/api/health` served on 27 Nov 2026 (14:22 UTC).
> Scope: every route under `apps/web/app/**`. Tests, `app/dev/**` and `*.lab.tsx` are excluded (the house rule D-17 exemptions).
> Seat-plan findings are marked **SEAT** and kept short; the seat plan is being redesigned separately.
>
> **Sources read:** `CLAUDE.md` §3 (the one-of-each table), `.claude/rules/design-and-wiring.md`, `DESIGN.md`,
> `docs/design-token-map.md`, `app/globals.css` ("THE ONE COLOUR SET, BY JOB" plus the `html.dark` blocks),
> `tailwind.config.ts`, `lib/appearance.ts` (the dark ready-list) and `app/_components/theme-bootstrap-script.ts`.
> ⚠ **The specs corpus (`HOUSE_DESIGN_STANDARD_2026-11-20.md`, `DARK_MODE_STANDARD_2026-11-20.md`,
> `MOTION_STANDARD_2026-11-18.md`) could not be read from this session**, because adding the `Setnayan-specs` repo was refused.
> The values below come from `CLAUDE.md` §3, which summarises the corpus. Where the corpus is stricter, it wins.

## How the numbers were made

The numbers come from a regex scan of every `.tsx`, `.ts` and `.css` file under `app/` (4,459 files), with comments removed.
Files are grouped by route (dashboard event tabs, supplier tabs and admin tabs one level deeper). These are **flags, not proven defects.**
Each count is a place to look, and a ratchet guard may already hold it from rising.
Per-file counts are reproducible: the scanner is described in § "Method" at the end.

| Flag | What it matches | App-wide count (award art and 3D kit excluded) |
|---|---|---:|
| hex | a raw `#rgb` / `#rrggbb` colour after a quote, space, `(`, `:` or `[` | 2,119 |
| rgb | an `rgb(`/`rgba(`/`hsl(` **literal** (`rgb(var(--token))` is not counted) | 1,033 |
| white/black | `bg-white`, `text-white`, `bg-black` … | 914 |
| palette | a numbered Tailwind palette class (`bg-amber-50`, `text-emerald-700`) | 446 |
| `dark:` | a Tailwind `dark:` patch (a second dark mechanism beside the tokens) | 302 |
| text-[px] | `text-[Npx]` (the house scale is `text-sn-*`) | 7,475 |
| ½px | the subset on half pixels (`text-[12.5px]`, `text-[13.5px]` …), banned outright | 1,110 in 380 files |
| radius | `rounded-[..]`, `rounded-tile`, `rounded-card`, `--sn-r-*` (legacy) | 226 |
| arb-space | `p-[..]`, `gap-[..]`, `m-[..]` … | 559 |
| off-scale step | `p-5`, `gap-1.5`, `px-3.5`, `p-10` … (20 · 6 · 14 · 40 px; not 4·8·12·16·24) | 7,908 (indicative only) |
| hand btn | `<button className="… rounded … bg-…">` (not `ActionButton`) | 298 |
| legacy btn | `.button-primary`, `.button-secondary`, `.btn*` | 284 |
| hand modal | a file with `aria-modal` that uses none of `Sheet`, `RiseScreen`, `OverlayBackdrop` or `side-panel` | 28 files |
| pulse/spin | `animate-pulse`, `animate-spin`, `Loader2` | 350 in 129 files |
| 'Loading…' | the plain word as the loading state | 47 |
| motion | `cubic-bezier(`, `duration-[..]`, `ease-[..]`, Tailwind `duration-75/150/300/500/1000`, raw `ms` in CSS transitions | 549 |

**Dark status column:**
- `🌙 dark-ready` means the route is on `DARK_READY` (`lib/appearance.ts`) and really paints dark for a person who picks Dark.
- `light-only` means it is not on that list yet. It stays Light by design (owner call 3, 13 Oct: nobody meets a half-dark screen), so its dark work is still ahead.
- `hub theme` means the guest Event Hub, which is self-styled from the couple's picked theme.

**Severity:**
- **High:** a dark-ready route with light-only colours, or more than 300 flags, or 2 or more hand modals, or 3 or more plain "Loading…".
- **Med:** 80 or more flags.
- **Low:** everything else, plus exempt art and data.
- **SEAT:** seat plan.

---

## 1 · Per-route table

| Route | Files | Theme issues | Design issues | Severity |
|---|---:|---|---|---|
| `app/_components` (shared) | 275 | hex 129 · rgb 57 · white/black 103 · palette 5 · `dark:` 21 · light-only | text-[px] 494 (½px 78) · radius 12 · arb-space 67 · hand btn 41 · legacy btn 6 · hand modal 2 · pulse/spin 46 · 'Loading…' 2 · motion 63 | **High** |
| `/dashboard/[eventId]/launch` | 150 | hex 39 · rgb 27 · white/black 59 · `dark:` 11 · light-only | text-[px] 438 (½px 122) · radius 1 · arb-space 59 · hand btn 10 · legacy btn 11 · hand modal 2 · pulse/spin 14 · motion 16 | **High** |
| `/dashboard/[eventId]/vendors` | 130 | hex 44 · rgb 116 · white/black 14 · `dark:` 23 · light-only | text-[px] 394 (½px 57) · radius 5 · arb-space 31 · hand btn 1 · legacy btn 9 · hand modal 2 · pulse/spin 3 · 'Loading…' 3 · motion 63 | **High** |
| `/dashboard/[eventId]/studio` | 198 | hex 29 · rgb 18 · white/black 12 · palette 13 · `dark:` 14 · light-only | text-[px] 374 (½px 28) · radius 10 · arb-space 8 · hand btn 27 · pulse/spin 53 · 'Loading…' 5 · motion 1 | **High** |
| `/dashboard/[eventId]/website` | 129 | hex 32 · rgb 10 · white/black 38 · palette 16 · `dark:` 28 · light-only | text-[px] 371 (½px 52) · radius 4 · arb-space 12 · hand btn 38 · legacy btn 11 · hand modal 2 · pulse/spin 8 · motion 11 | **High** |
| `/[slug]/_components` (Event Hub) | 272 | hex 89 · rgb 102 · white/black 63 · palette 4 · hub theme | text-[px] 78 (½px 17) · radius 3 · arb-space 40 · hand btn 15 · legacy btn 31 · hand modal 6 · pulse/spin 25 · 'Loading…' 2 · motion 28 | **High** |
| `/onboarding/wedding` | 21 | hex 199 · rgb 162 · white/black 1 · light-only | radius 3 · legacy btn 5 · 'Loading…' 1 · motion 137 | **High** |
| `/dashboard/[eventId]/_components` | 118 | hex 21 · rgb 16 · white/black 15 · palette 19 · `dark:` 32 · 🌙 dark-ready | text-[px] 345 (½px 77) · radius 10 · arb-space 21 · hand btn 8 · legacy btn 1 · pulse/spin 8 · 'Loading…' 4 · motion 9 | **High** |
| `app/_components/home` (shared) | 7 | hex 266 · rgb 94 · light-only | hand modal 1 · pulse/spin 11 · motion 36 | **High** |
| `app/_components/chat` (shared) | 86 | hex 18 · rgb 7 · white/black 18 · `dark:` 15 · light-only | text-[px] 305 (½px 7) · radius 1 · arb-space 17 · hand btn 5 · hand modal 2 · 'Loading…' 4 · motion 11 | **High** |
| `app/_components/app-store` (shared) | 5 | hex 48 · rgb 10 · white/black 32 · palette 43 · light-only | text-[px] 202 · hand btn 17 · pulse/spin 3 | **High** |
| `/vendor-dashboard/clients` | 103 | white/black 9 · `dark:` 5 · 🌙 dark-ready | text-[px] 276 (½px 14) · radius 13 · arb-space 11 · hand btn 2 · legacy btn 5 · 'Loading…' 7 | **High** |
| `/vendor-dashboard/_components` | 86 | hex 70 · rgb 21 · white/black 19 · `dark:` 3 · light-only | text-[px] 199 (½px 43) · radius 7 · arb-space 4 · hand btn 3 · legacy btn 5 · 'Loading…' 1 · motion 4 | **High** |
| `/tour` | 14 | hex 261 · rgb 11 · white/black 12 · palette 11 · light-only | text-[px] 28 · hand btn 3 · pulse/spin 4 · motion 4 | **High** |
| `/papic` | 48 | hex 36 · rgb 11 · white/black 17 · palette 12 · light-only | text-[px] 42 (½px 9) · arb-space 11 · hand btn 27 · legacy btn 11 · pulse/spin 47 · motion 6 | **High** |
| `/dashboard/[eventId]/schedule` | 47 | hex 12 · rgb 2 · white/black 2 · palette 10 · `dark:` 15 · 🌙 dark-ready | text-[px] 209 (½px 41) · radius 2 · arb-space 14 · hand btn 9 · legacy btn 2 · pulse/spin 3 · 'Loading…' 1 | **High** |
| `/dashboard/[eventId]/guests` | 147 | hex 7 · rgb 3 · white/black 11 · `dark:` 13 · 🌙 dark-ready | text-[px] 75 (½px 12) · radius 4 · arb-space 13 · hand btn 5 · legacy btn 11 · pulse/spin 3 · 'Loading…' 1 · motion 25 | **High** |
| `/dashboard/samahan` | 14 | white/black 23 · `dark:` 4 · 🌙 dark-ready | text-[px] 41 (½px 2) · arb-space 5 · hand btn 2 · legacy btn 1 · hand modal 1 · pulse/spin 6 | **High** |
| `/dashboard/life-flash` | 8 | hex 15 · rgb 23 · white/black 6 · `dark:` 1 · 🌙 dark-ready | text-[px] 3 · hand modal 1 · motion 1 | **High** |
| `/dashboard/create-event` | 12 | hex 1 · rgb 2 · white/black 10 · `dark:` 4 · 🌙 dark-ready | text-[px] 5 · radius 2 · legacy btn 1 | **High** |
| `/v` | 61 | hex 26 · rgb 10 · white/black 17 · palette 3 · light-only | text-[px] 163 (½px 22) · radius 4 · arb-space 19 · hand btn 1 · legacy btn 12 · hand modal 1 · pulse/spin 1 · 'Loading…' 1 · motion 3 | **Med** |
| `/vendor-dashboard/services` | 51 | white/black 13 · light-only | text-[px] 218 (½px 17) · radius 13 · arb-space 3 · legacy btn 3 | **Med** |
| `/vendor-dashboard/shop` | 97 | hex 1 · rgb 11 · white/black 5 · light-only | text-[px] 196 (½px 88) · radius 5 · arb-space 11 · hand btn 2 · legacy btn 7 · 'Loading…' 1 | **Med** |
| `/panood` | 23 | hex 11 · rgb 2 · white/black 48 · palette 3 · light-only | text-[px] 87 (½px 40) · radius 2 · arb-space 4 · hand btn 4 · legacy btn 2 · pulse/spin 9 | **Med** |
| `/admin/categories` | 58 | rgb 4 · white/black 18 · palette 4 · `dark:` 1 · light-only | text-[px] 110 (½px 39) · arb-space 5 · hand btn 9 · 'Loading…' 1 · motion 1 | **Med** |
| `/admin/ugat` | 10 | hex 102 · rgb 17 · palette 2 · light-only | text-[px] 21 · radius 1 · hand btn 1 · legacy btn 1 · 'Loading…' 1 · motion 8 | **Med** |
| `/admin/_components` | 34 | hex 44 · rgb 25 · white/black 1 · palette 1 · `dark:` 3 · light-only | text-[px] 83 (½px 21) · radius 2 · arb-space 1 | **Med** |
| `/vendor-dashboard/customers` | 46 | rgb 1 · white/black 1 · `dark:` 1 · 🌙 dark-ready | text-[px] 140 (½px 11) · arb-space 2 · hand btn 1 · motion 1 | **Med** |
| `/admin/app-performance` | 31 | hex 4 · light-only | text-[px] 109 (½px 2) · radius 2 · legacy btn 6 · pulse/spin 3 · motion 5 | **Med** |
| `/admin/studio` | 16 | hex 2 · white/black 19 · palette 2 · light-only | text-[px] 70 · radius 1 · legacy btn 13 · pulse/spin 4 | **Med** |
| `/vendor-dashboard/on-the-day` | 61 | hex 6 · rgb 7 · white/black 23 · `dark:` 6 · light-only | text-[px] 71 (½px 12) · radius 3 · hand modal 1 · pulse/spin 1 · 'Loading…' 2 | **Med** |
| `/explore` | 20 | white/black 2 · palette 34 · light-only | text-[px] 50 · radius 3 · arb-space 2 · hand btn 2 · legacy btn 8 | **Med** |
| `/admin/pricing` | 23 | white/black 1 · palette 6 · light-only | text-[px] 99 (½px 23) · radius 1 · arb-space 1 | **Med** |
| `/open-shop` | 23 | hex 2 · rgb 8 · white/black 2 · light-only | text-[px] 59 (½px 29) · radius 4 · arb-space 17 · legacy btn 5 · motion 1 | **Med** |
| `/pricing` | 7 | white/black 1 · light-only | text-[px] 59 (½px 18) · arb-space 36 | **Med** |
| `/admin/settings` | 17 | hex 2 · white/black 7 · palette 4 · light-only | text-[px] 50 (½px 2) · arb-space 2 · hand btn 1 · legacy btn 6 · pulse/spin 3 · 'Loading…' 2 | **Med** |
| `/admin/integrations` | 8 | white/black 12 · palette 51 · light-only | text-[px] 25 · radius 1 · arb-space 1 | **Med** |
| `/admin/connection-logs` | 3 | hex 55 · white/black 7 · palette 7 · light-only | text-[px] 10 · hand btn 4 · pulse/spin 1 | **Med** |
| `/u` | 12 | hex 36 · rgb 39 · light-only | motion 13 | **Med** |
| `/dashboard/[eventId]/story` | 19 | hex 16 · rgb 13 · white/black 8 · palette 3 · `dark:` 3 · light-only | text-[px] 14 (½px 1) · radius 8 · hand btn 3 · legacy btn 1 · motion 12 | **Med** |
| `/dashboard/[eventId]/seating` | 46 | hex 37 · rgb 16 · white/black 21 · palette 3 · `dark:` 2 · light-only | text-[px] 74 (½px 18) · arb-space 14 · hand btn 26 · pulse/spin 5 · motion 2 | **SEAT** |
| `/[slug]/find-seat` (Event Hub) | 8 | white/black 2 · hub theme | radius 16 · arb-space 10 · hand modal 1 | **SEAT** |
| `/3d_plan` | 2 | hex 9 · rgb 3 · light-only | — | **SEAT** |
| `/[slug]/seat` (Event Hub) | 5 | hub theme | motion 2 | **SEAT** |
| `app/_components/award` (shared) | 26 | hex 1670 · rgb 216 · light-only | motion 76 · generated award art (exempt) | **Low** |
| `app/_components/plan3d` (shared) | 42 | hex 275 · rgb 19 · white/black 7 · light-only | text-[px] 4 · hand btn 1 · 'Loading…' 1 · 3D scene materials (data) | **Low** |
| `app/_components/frontdoor` (shared) | 41 | hex 39 · rgb 10 · light-only | text-[px] 3 · arb-space 1 · 'Loading…' 1 · motion 21 | **Low** |
| `/vendor-dashboard/collections` | 14 | rgb 2 · white/black 9 · light-only | text-[px] 51 (½px 13) · radius 4 · arb-space 4 · hand modal 1 · motion 1 | **Low** |
| `/admin/colours` | 5 | hex 36 · rgb 10 · white/black 4 · light-only | text-[px] 20 · motion 4 | **Low** |
| `/admin/website-media` | 4 | white/black 3 · palette 45 · light-only | text-[px] 25 | **Low** |
| `/dashboard/[eventId]/monogram` | 16 | hex 36 · rgb 4 · white/black 10 · light-only | text-[px] 5 · radius 7 · hand btn 2 · legacy btn 1 · motion 2 | **Low** |
| `/dashboard/[eventId]/details` | 24 | hex 1 · white/black 2 · palette 8 · `dark:` 10 · light-only | text-[px] 50 (½px 10) · radius 1 · arb-space 2 · hand btn 1 | **Low** |
| `/admin/verify` | 7 | white/black 9 · palette 6 · light-only | text-[px] 38 · radius 2 · legacy btn 5 | **Low** |
| `/vendor-dashboard/messages` | 30 | white/black 2 · `dark:` 2 · light-only | text-[px] 53 (½px 3) · radius 4 · 'Loading…' 1 | **Low** |
| `/onboarding/_shared` | 9 | hex 14 · rgb 5 · white/black 1 · palette 4 · `dark:` 2 · light-only | text-[px] 18 (½px 4) · radius 10 · arb-space 3 · hand btn 1 · motion 4 | **Low** |
| `/admin/accounts` | 11 | white/black 7 · palette 3 · light-only | text-[px] 39 (½px 1) · arb-space 3 · legacy btn 4 | **Low** |
| `app/_components/memories` (shared) | 5 | hex 1 · rgb 3 · white/black 10 · light-only | text-[px] 39 (½px 18) · radius 1 · arb-space 4 · motion 2 | **Low** |
| `app/_components/account-switcher` (shared) | 3 | hex 8 · rgb 6 · palette 4 · `dark:` 3 · light-only | text-[px] 20 (½px 6) · radius 6 · arb-space 10 · hand btn 1 · motion 2 | **Low** |
| `/admin/payments` | 19 | light-only | text-[px] 56 | **Low** |
| `/[slug]/invite` (Event Hub) | 22 | hex 11 · rgb 24 · white/black 1 · hub theme | text-[px] 4 · arb-space 3 · legacy btn 4 · 'Loading…' 1 | **Low** |
| `app/_components/gallery` (shared) | 4 | rgb 7 · white/black 4 · light-only | text-[px] 20 (½px 14) · radius 2 · arb-space 6 · hand btn 1 · pulse/spin 6 · motion 1 | **Low** |
| `/pay` | 12 | white/black 7 · light-only | text-[px] 14 · radius 6 · arb-space 8 · legacy btn 5 · pulse/spin 3 | **Low** |
| `/features` | 19 | hex 28 · rgb 17 · light-only | text-[px] 2 · radius 3 · motion 1 | **Low** |
| `/dashboard/[eventId]/invitation` | 8 | hex 8 · rgb 5 · white/black 4 · `dark:` 1 · light-only | text-[px] 19 (½px 1) · hand btn 1 · legacy btn 3 · pulse/spin 3 | **Low** |
| `/(root files)` | 10 | hex 40 · rgb 8 · light-only | text-[px] 1 · root layout/error | **Low** |
| `/admin/reveal-studio` | 4 | hex 8 · white/black 5 · light-only | text-[px] 35 · radius 1 | **Low** |
| `/receipts` | 7 | hex 18 · rgb 5 · white/black 1 · `dark:` 1 · light-only | text-[px] 17 (½px 8) · arb-space 8 | **Low** |
| `/vendor-dashboard/packages` | 8 | light-only | text-[px] 46 (½px 8) · arb-space 1 | **Low** |
| `/monogram` | 2 | hex 29 · white/black 5 · light-only | text-[px] 1 (½px 1) · hand btn 2 · pulse/spin 3 | **Low** |
| `/vendor` | 10 | light-only | text-[px] 36 (½px 7) · radius 3 · pulse/spin 3 | **Low** |
| `/vendor-dashboard/invite` | 10 | white/black 1 · light-only | text-[px] 42 (½px 11) · arb-space 1 | **Low** |
| `/admin/moodboard-library` | 6 | hex 7 · white/black 5 · light-only | text-[px] 31 | **Low** |
| `/[slug]/venue` (Event Hub) | 5 | hex 5 · white/black 33 · hub theme | text-[px] 1 · 'Loading…' 1 | **Low** |
| `app/_components/site-stage` (shared) | 2 | hex 12 · rgb 5 · white/black 2 · light-only | text-[px] 17 (½px 6) · motion 6 | **Low** |
| `/dashboard` | 28 | rgb 4 · white/black 6 · `dark:` 1 · light-only | text-[px] 23 · arb-space 2 · hand btn 2 · motion 3 | **Low** |
| `/admin/secrets` | 6 | white/black 2 · palette 2 · light-only | text-[px] 31 · pulse/spin 3 | **Low** |
| `/[slug]/avatar` (Event Hub) | 3 | hex 6 · white/black 25 · hub theme | hand btn 3 · 'Loading…' 1 | **Low** |
| `app/_components/marketing` (shared) | 20 | hex 13 · rgb 15 · white/black 2 · light-only | text-[px] 1 · hand modal 1 · motion 4 | **Low** |
| `/live` | 7 | hex 30 · white/black 6 · light-only | arb-space 2 · hand btn 1 | **Low** |
| `/vendor-dashboard/team` | 16 | light-only | text-[px] 39 (½px 9) · arb-space 1 | **Low** |
| `/admin/budget-planner` | 3 | white/black 2 · light-only | text-[px] 34 · radius 1 | **Low** |
| `/dashboard/[eventId]/manpower` | 4 | palette 37 · `dark:` 37 · light-only | — | **Low** |
| `/dashboard/[eventId]/messages` | 17 | light-only | text-[px] 23 · arb-space 1 · legacy btn 1 · pulse/spin 5 · motion 1 | **Low** |
| `/admin/disputes` | 8 | white/black 2 · light-only | text-[px] 28 · legacy btn 3 | **Low** |
| `/dashboard/people` | 24 | hex 7 · 🌙 dark-ready | text-[px] 29 | **Low** |
| `app/_components/cake-maker` (shared) | 6 | hex 23 · rgb 7 · light-only | hand modal 1 | **Low** |
| `/vendor-dashboard/subscription` | 18 | rgb 1 · light-only | text-[px] 31 (½px 15) · legacy btn 1 | **Low** |
| `/admin/vendors` | 15 | palette 9 · light-only | text-[px] 14 (½px 1) · legacy btn 5 | **Low** |
| `/admin/demo-vendors` | 8 | palette 7 · light-only | text-[px] 7 · pulse/spin 9 · motion 1 | **Low** |
| `app/_components/payment` (shared) | 5 | hex 2 · white/black 4 · light-only | text-[px] 24 (½px 2) · hand btn 1 | **Low** |
| `/dashboard/[eventId]/memories` | 8 | 🌙 dark-ready | text-[px] 20 (½px 2) · pulse/spin 6 | **Low** |
| `/vendor-dashboard/offers` | 3 | light-only | text-[px] 24 (½px 12) · radius 1 · arb-space 6 | **Low** |
| `/dashboard/[eventId]/date-selection` | 7 | palette 15 · `dark:` 15 · light-only | text-[px] 13 · hand btn 1 | **Low** |
| `/join` | 19 | rgb 2 · white/black 1 · `dark:` 1 · light-only | text-[px] 13 (½px 6) · legacy btn 7 | **Low** |
| `/admin/queues` | 8 | hex 15 · light-only | text-[px] 12 · radius 1 | **Low** |
| `/[slug]/pabuya` (Event Hub) | 7 | hub theme | text-[px] 27 (½px 3) · arb-space 1 | **Low** |
| `app/_components/gift-moment` (shared) | 12 | rgb 6 · light-only | text-[px] 19 · arb-space 2 | **Low** |
| `/vendor-dashboard/website` | 9 | rgb 1 · white/black 1 · light-only | text-[px] 24 (½px 2) · radius 1 | **Low** |
| `/vendor-dashboard/forms` | 4 | light-only | text-[px] 25 · arb-space 2 | **Low** |
| `/dashboard/[eventId]/alaala` | 6 | hex 3 · rgb 1 · light-only | text-[px] 22 (½px 2) | **Low** |
| `app/_components/nav` (shared) | 12 | hex 6 · palette 4 · light-only | text-[px] 7 · hand btn 2 · motion 4 | **Low** |
| `/vendor-dashboard/moodboard-library` | 5 | hex 7 · light-only | text-[px] 17 · arb-space 1 | **Low** |

**Clean or near-clean (fewer than 25 flags each, Low):** `/(hub)`, `/[slug]/_lib` (Event Hub), `/[slug]/everyone` (Event Hub), `/[slug]/find-my-table` (Event Hub), `/[slug]/print` (Event Hub), `/[slug]/recap` (Event Hub), `/[slug]/request` (Event Hub), `/[slug]/welcome` (Event Hub), `/[slug]` (Event Hub), `/_actions`, `/about`, `/acceptable-use`, `/admin/account-deletions`, `/admin/admin-log`, `/admin/approvals`, `/admin/ask`, `/admin/background-videos`, `/admin/booking-fees`, `/admin/business`, `/admin/chat-flags`, `/admin/completions`, `/admin/compliance`, `/admin/corrections`, `/admin/data-privacy`, `/admin/demand`, `/admin/discount-codes`, `/admin/editorial-review`, `/admin/email-delivery`, `/admin/event-deletions`, `/admin/events`, `/admin/force-majeure`, `/admin/founder-seats`, `/admin/fraud`, `/admin/gifts`, `/admin/help`, `/admin/hub-music`, `/admin/integrity-watch`, `/admin/launch-offer`, `/admin/live-studio-channels`, `/admin/menus`, `/admin/money`, `/admin/offers`, `/admin/offline`, `/admin/operations-hiring`, `/admin/pakanta`, `/admin/papic-storage`, `/admin/pax-changes`, `/admin/payment-options`, `/admin/payouts`, `/admin/receipts`, `/admin/repost-watch`, `/admin/reviews`, `/admin/search-memory`, `/admin/spotlight-awards`, `/admin/subscriptions`, `/admin/switches`, `/admin/team`, `/admin/user-reports`, `/admin/users`, `/admin/vendor-partnerships`, `/admin/vendor-recommendations`, `/admin/venues`, `/admin/verification-docs`, `/admin/website`, `/admin/work`, `/admin`, `/alaala`, `/api/admin`, `/api/crew`, `/api/download`, `/api/hub-print`, `/api/social`, `/api/vendor`, `/articles`, `/claim`, `/cookies`, `/creators`, `/dashboard/[eventId]/access-requests`, `/dashboard/[eventId]/activity`, `/dashboard/[eventId]/budget`, `/dashboard/[eventId]/clearance`, `/dashboard/[eventId]/contracts`, `/dashboard/[eventId]/disputes`, `/dashboard/[eventId]/documents`, `/dashboard/[eventId]/event-qr`, `/dashboard/[eventId]/find-date`, `/dashboard/[eventId]/galleries`, `/dashboard/[eventId]/hosts`, `/dashboard/[eventId]/live`, `/dashboard/[eventId]/orders`, `/dashboard/[eventId]/pabuya`, `/dashboard/[eventId]/paperwork`, `/dashboard/[eventId]/people`, `/dashboard/[eventId]/progress`, `/dashboard/[eventId]/refer`, `/dashboard/[eventId]/sponsors`, `/dashboard/[eventId]`, `/dashboard/_components`, `/dashboard/billing`, `/dashboard/creator`, `/dashboard/library`, `/dashboard/notifications`, `/dashboard/profile`, `/dashboard` (hub), `/demo-capture`, `/download`, `/download`, `/for-coordinators`, `/for-suppliers`, `/forgot-password`, `/help`, `/help`, `/host`, `/i`, `/login`, `/monogram`, `/mood-board`, `/onboarding/[type]`, `/onboarding/simple`, `/our-story`, `/our-story`, `/pa3d`, `/panood`, `/papic`, `/pawebsite`, `/privacy`, `/proposals`, `/realstories`, `/refunds`, `/reset-password`, `/samahan`, `/sample`, `/schedule`, `/seat-plan`, `/setnayan-ai`, `/signup`, `/start`, `/suppliers`, `/terms`, `/tl`, `/vendor-dashboard/activities`, `/vendor-dashboard/attributes`, `/vendor-dashboard/booking-fees`, `/vendor-dashboard/bookings`, `/vendor-dashboard/contracts`, `/vendor-dashboard/creators`, `/vendor-dashboard/deep-search`, `/vendor-dashboard/demand`, `/vendor-dashboard/disputes`, `/vendor-dashboard/lines`, `/vendor-dashboard/manpower`, `/vendor-dashboard/notifications`, `/vendor-dashboard/partnerships`, `/vendor-dashboard/payment-options`, `/vendor-dashboard/performance`, `/vendor-dashboard/profile`, `/vendor-dashboard/proposals`, `/vendor-dashboard/recommendations`, `/vendor-dashboard/repertoire`, `/vendor-dashboard/settings`, `/vendor-dashboard/spaces`, `/vendor-dashboard/theft-watch`, `/vendor-dashboard/track-record`, `/vendor-dashboard`, `/vendor-invite`, `/waitlist`, `/wall`, `app/_components/alaala` (shared), `app/_components/anon-gate` (shared), `app/_components/auth` (shared), `app/_components/card-badges` (shared), `app/_components/change-requests` (shared), `app/_components/contracts` (shared), `app/_components/demo-session` (shared), `app/_components/door` (shared), `app/_components/help-ask` (shared), `app/_components/how-search` (shared), `app/_components/iap` (shared), `app/_components/inspector` (shared), `app/_components/last-seen` (shared), `app/_components/live-studio` (shared), `app/_components/lock` (shared), `app/_components/notices` (shared), `app/_components/notifications` (shared), `app/_components/offline-ready` (shared), `app/_components/pabuya` (shared), `app/_components/picked` (shared), `app/_components/pinned-row` (shared), `app/_components/rise` (shared), `app/_components/settings` (shared), `app/_components/states` (shared), `app/_components/terms-reaccept` (shared), `app/_components/toast` (shared), `app/_components/vendor-packages` (shared), `app/_components/verification` (shared)

---

## 2 · The structural findings (read these before the table)

### 2.1 Dark mode is an allow-list, and only ~20 routes are on it

`DARK_READY` in `lib/appearance.ts` holds these routes:
- the account spokes (`/dashboard/{people,library,life-flash,profile,notifications,create-event,samahan}`);
- **four event screens, each exactly**: Home `/dashboard/*$`, `/budget$`, `/guests$`, `/schedule$`, plus `/memories$`;
- two supplier screens: `/vendor-dashboard/clients$` and `/customers$`;
- the four sign-in pages.

**Every other signed-in route stays Light** even when the person picked Dark. That includes Suppliers, Launch, Website, Studio and Seating; every other supplier tab; and all of admin.
This is honest (no half-dark screens), but it means "every surface in light and dark" is **about 10 % done by route count**.
The supplier dark is its own navy (`supplier-look.css`), and admin has no dark at all.

Signed-out public pages are always Light (call 4), except `/login` and `/signup`, which follow the phone. The live check (§4) confirmed both rules hold on production.

### 2.2 Three ways to detect dark, not one

1. **The one switch:** `html.dark`, set by the `<head>` script (`theme-bootstrap-script.ts`) from the `sn-theme` cookie plus the ready-list.
2. **Its own detector:** `app/_components/auth/sign-in-here-panel.tsx` (`PHONE_DARK`, `phoneDarkNow`) runs its own `matchMedia('(prefers-color-scheme: dark)')` for the pop-up sign-in card. This is documented and intentional (owner, 24 Nov), but it is a second detector.
3. **The OS, not the page:** `app/[slug]/_components/apple-wallet-button.tsx` picks the Apple Wallet badge with `<source media="(prefers-color-scheme: dark)">`.
   - It follows the phone, not the Hub's own ground.
   - A guest with a dark phone on a light Hub theme gets the on-dark badge on a light page, and the reverse.

`password-field.tsx` listens to the media query too, but only to re-read its own ink. That is harmless.

### 2.3 Dark-ready screens reach dark by `dark:` patches over palette classes

The event Home's cards write `text-emerald-700 dark:text-[rgb(var(--color-ok))]` and `bg-amber-50/60 dark:bg-[rgb(var(--color-warn)/…)]`. Examples: `nikah-essentials-card.tsx`, `payment-under-review.tsx`, `supplier-connect-panel.tsx`.
- The light half is an off-token palette class. The dark half is the token.
- That is two colours for one job, and the light one drifts from `--color-ok` / `--color-warn`.
- 302 `dark:` uses app-wide. On light-only routes (e.g. `manpower`: 37, `date-selection`: 15) they are dead code today.

**Fix:** the token in both modes (`text-[rgb(var(--color-ok))]`, or the `ok`/`warn` Tailwind keys), with no `dark:`.

### 2.4 Tokens without a dark value

The scan compared every `--color-*`, `--m-*` and `--sn-*` property declared on `:root` against `html.dark`.
**Only 3 colour tokens have a literal light value and no `html.dark` pair:** `--color-gild`, `--color-veil` and `--color-paper-deep`.
- They are Event Hub theme tokens: their only dark value lives under `[data-art='candlelight']`.
- They are also used **outside the Hub**: `text-gild` / `bg-paper-deep` in 12 files under `app/dashboard/[eventId]/` and 11 under `app/vendor-dashboard/on-the-day/`, plus `veil` in `map-card-chrome.tsx` and `frame-step.tsx`.
- Harmless while those routes are light-only. **The day either area joins `DARK_READY`, `bg-paper-deep` paints a near-white slab on the dark page.**

`--sn-ob-*` and `--sn-glass-dark-*` are always-dark surfaces by design (the onboarding and gallery pages), so they are not a finding.

### 2.5 One scrim token, sixteen scrims

`OverlayBackdrop` with `--sn-scrim` / `--sn-scrim-solid` (light `ink/0.42`, dark `black/0.55`) is the one backdrop, and 58 files use it.
Hand-made scrims still paint `bg-black/20 · /35 · /40 · /50 · /85`, `bg-ink/20 · /25 · /40 · /50 · /55 · /80 · /85 · /90` and `bg-[var(--m-ink)]/30`: **about 14 different backdrop looks**. They are in:
- **Event Hub:** `story-suppliers.tsx`, `maker-scene-samples.tsx`, `selfie-capture.tsx`;
- **Papic:** `papic-guest-capture.tsx`;
- **shared:** `card-portfolio-section.tsx`, `plan3d/phone-gpu-budget.tsx`;
- **Panood:** `panood/control/[eventId]/page.tsx`;
- **couple:** `vendors/_components/supplier-sheet.tsx`, `website/editor/_components/background-cards.tsx`, `studio/panood/broadcast/_components/setnayan-overlay.tsx`, `studio/patiktok/_components/booth-capture.tsx`, `samahan/[communityId]/_components/group-collage.tsx`;
- **supplier:** `services/their-work/their-work-list.tsx`, `clients/[eventId]/challenge-photos/challenge-photos-body.tsx`.

Camera and full-bleed photo screens (booth capture, selfie, Papic capture) may want a darker scrim on purpose. If so, that is `--sn-scrim-solid`, not a new value.

### 2.6 Hand-rolled modals (28 files)

These files set `aria-modal` without `Sheet`, `RiseScreen` or `OverlayBackdrop`. The list is in § 3, by group. `side-panel.tsx` is itself a primitive, so check whether it should *be* `Sheet`'s desktop face before migrating its callers.

### 2.7 Loading states

- **Plain "Loading…" text** is still the loading state in 19 visible places (the list is under fixes 9, 13 and 15).
- **4 `loading.tsx` files hand-draw `animate-pulse` boxes** instead of `Sk`/`Ghost`: `signup/`, `vendor-invite/[slug]/`, `onboarding/wedding/` and `vendor/lock/[token]/`.
- **350 `animate-pulse` / `animate-spin` / `Loader2` uses in 129 files.** Most are button-pending spinners. The house rule is no spinners: a pending button says its verb (`pendingLabel`), and a loading area is a `Ghost`.
- **Not a finding:** 46 of the 58 `loading.tsx` files that skip `Sk` return `null` on purpose (shell-painted routes and empty rise slots; they explain why in their header comments). The other 12 are the 4 hand-pulse files above plus 8 that draw their own frame; give those 8 a look when their area is touched.

### 2.8 Type, spacing and radius

- **Type.** `text-[Npx]` is still in 7,475 places, with 1,110 on half pixels (`12.5` ×488, `13.5` ×293, `11.5` ×150, `14.5` ×69, `10.5` ×66, `9.5` ×35).
  - Half pixels are banned outright and are mechanical to fix: 12.5→12 or 13, 13.5→13 or 14, and so on, per the corpus type table.
  - Worst areas: `/dashboard/[eventId]/launch` (122 half-px), `/vendor-dashboard/shop` (88), the event `_components` (77) and the shared `_components` (78).
- **Spacing.** 559 arbitrary `p-[..]`/`gap-[..]` values; `/pricing` alone has 36. About 7.9 k off-scale Tailwind steps (`p-5`, `gap-1.5`, `px-3.5`). That second number is indicative only: some are inside the 44 px press or icon centring.
- **Radius.** 226 legacy forms, mostly `rounded-[..]` and `--sn-r-*`. Worst: `/[slug]/find-seat` (16, SEAT), `/vendor-dashboard/clients` (13) and `/vendor-dashboard/services` (13).

### 2.9 Motion

- **Off-token Tailwind durations:** 41 (`duration-300` ×25, `-500` ×11, `-150` ×3, `-75`, `-1000`). The house speeds are 100 · 200 · 280 · 320 · 700 ms.
- **Hand `cubic-bezier` / raw ms:** concentrated in a few files.
  - `onboarding/wedding/_styles/onboarding.css` (137);
  - `home/home-reskin.css` (33);
  - `vendors/_components/plan-budget-accordion.tsx` (30);
  - `vendors/_components/shortlist-categories.tsx` (29);
  - `guests/_components/guests-screen.module.css` (23);
  - `animated-monogram-hero.tsx` (28).
- The award CSS (59) is generated art and exempt.

### 2.10 Empty states

`EmptyState` is imported by only 26 files. `ReadFailed` is imported by 98, which is good.
At least 12 files hand-write a two-sentence "No … yet. <explanation>" instead of one line plus one action (a lower bound: multi-line JSX was not matched):
- **admin:** `admin/vendors/[vendorProfileId]/_components/service-cards-section.tsx`, `admin/categories/_components/map-panels.tsx`, `admin/payments/supplier-refunds/supplier-refunds-view.tsx`;
- **chat:** `_components/chat/decision-panel.tsx`;
- **couple:** `dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx`, `dashboard/[eventId]/_components/day-of-mode/supplier-updates-card.tsx`, `dashboard/(account)/library/_components/challenges-tab.tsx`;
- **supplier:** `vendor-dashboard/packages/_components/package-editor.tsx`, `attributes/_components/attributes-view.tsx`, `shop/store/_components/store-screens.tsx`, `website/_components/review-replies.tsx`, `forms/_components/forms-page-body.tsx`.

---

## 3 · Top 20 fixes, grouped so one builder takes each group with no file overlap

Each group owns the files it names. Nobody else touches them in this wave.
**`app/globals.css` belongs to Group A alone.**
Every group keeps the ratchets going down only and leaves `screens.generated.json` and `*.baseline.txt` to the ship controller.

### Group A: couple dark-ready screens (event Home, Schedule, Guests list, the account spokes) · **High**

Files: `app/dashboard/[eventId]/_components/**` (not `seating`), `app/dashboard/[eventId]/schedule/**`, `app/dashboard/[eventId]/guests/page.tsx` and its non-seat `_components`, `app/dashboard/(account)/**`, `app/globals.css`.

1. **Schedule chapter colours are light-only hex on a dark-ready screen.**
   - Where: `schedule/_components/day-ui.tsx` (the `pre_ceremony: '#D9CFBF'` … `tour: '#C7C2B8'` map, 12 hex).
   - Also hand `rgba(203,167,102,…)` hour lines and `shadow-[…rgba(…)]` in `day-rail.tsx`.
   - Fix: give them `--color-chapter-*` tokens with `html.dark` pairs, or read existing category tokens.
2. **The Schedule "add" pill turns unreadable on hover in dark.**
   - `day-rail.tsx` uses `bg-ink … text-cream hover:bg-black`.
   - In dark, `--color-cream` is the page (#121110), so hover paints #121110 words on black.
   - Fix: make it an `ActionButton`.
3. **Event Home cards: palette + `dark:` pairs → one token.** `nikah-essentials-card.tsx` (9), `payment-under-review.tsx`, `supplier-connect-panel.tsx`, `coordinating-line.tsx` (`bg-[#2a2622]`), `inline-checkout-drawer.tsx`, `device-frame.tsx`. See § 2.3.
4. **Give `--color-gild`, `--color-veil` and `--color-paper-deep` an `html.dark` value** in `globals.css` (see § 2.4) before any area that uses them joins `DARK_READY`.
5. **Plain "Loading…" on dark-ready screens → `Ghost`.** `_components/home-cards/hub-pick-body.tsx` and `home-whos-here-card.tsx` (button label → `pendingLabel`); `guests/page.tsx` (the Suspense fallback "Loading your guest settings…" → the guests skeleton).

### Group B1: couple Suppliers tab + Website editor (light-only) · **High**

Files: `app/dashboard/[eventId]/vendors/**`, `app/dashboard/[eventId]/website/**`.

6. **Hand modals → `Sheet`.** `vendors/_components/plan-budget-accordion.tsx`, `category-search-overlay.tsx`, `website/_components/apply-pro-sheet.tsx`, `hub-history-sheet.tsx`; the hand scrims in `supplier-sheet.tsx` and `website/editor/_components/background-cards.tsx` → `OverlayBackdrop`.
7. **Raw colour and motion in the shortlist.**
   - `shortlist-categories.tsx`: 72 `rgb()` literals and 29 hand motion values.
   - `plan-budget-accordion.tsx`: 41 `rgb()` and 30 motion values.
   - Fix: tokens plus the five house speeds.
   - This is the biggest light-only blocker to the Suppliers tab ever going dark.
8. **Hand buttons in the Website editor → `ActionButton`.** `website/editor/_components/sections-panel.tsx` (15 hand `<button>` looks); 11 legacy `.button-*` across `/website`.
9. **"Loading…" → `pendingLabel` / `Ghost`:** `vendors/_components/quote-fill.tsx`.

### Group B2: couple Launch (Maker) + Studio (light-only) · **High**

Files: `app/dashboard/[eventId]/launch/**`, `app/dashboard/[eventId]/studio/**`.

10. **Hand modals and scrims → `Sheet` / `OverlayBackdrop`.**
    - Modals: `launch/_components/stages-studio-parts.tsx`, `theme-preview-overlay.tsx`.
    - Scrims: `studio/panood/broadcast/_components/setnayan-overlay.tsx`, `studio/patiktok/_components/booth-capture.tsx`.
11. **Spinners → pending labels or `Ghost`.**
    - Studio has 53 `animate-spin`/`pulse`/`Loader2` (`patiktok/_components/booth-capture.tsx`, `patiktok/page.tsx`, `photo-delivery/_components/release-progress-poller.tsx`, `papic/_components/live-wall-controls.tsx`, `add-to-library.tsx`, `pakanta/_components/pakanta-music-form.tsx`). Launch has 14 (`studio-prints-carousel.tsx`).
    - "Loading…" in `studio/mood-board/_components/gallery-picker.tsx` and `template-gallery.tsx`.
12. **Half-pixel type:** 122 in `/launch` and 28 in `/studio`. Mechanical, onto the `text-sn-*` scale. Also: 27 hand buttons in `/studio`; 59 `bg-white`/`text-white` in `/launch` (`stage-panel/camera-face.tsx` 26: over a camera, so check before changing).

### Group C: shared `app/_components` (chat, auth, marketing chrome) · **High**

Files: `app/_components/**` except `award/`, `plan3d/` and `home/` (Group F owns `home/`).

13. **Chat loading and type.**
    - "Loading…" in `chat/cards/card-bits.tsx`, `chat/cards/schedule-time-ask-card.tsx`, `chat/file-to-decision-menu.tsx`, `chat/message-extras-menu.tsx` and `proposal-maker.tsx` (×2) → `Ghost` rows.
    - 305 `text-[px]` in `chat/`.
14. **Hand modals → `Sheet` / `RiseScreen`.**
    - Modals: `inspector/inspector-column.tsx`, `chat/decision-panel.tsx`, `chat/chat-blocker.tsx`, `frame-step.tsx`, `cake-maker/cake-designer.tsx`, `marketing/add-to-event.tsx`.
    - Scrims: `card-portfolio-section.tsx`, `plan3d/phone-gpu-budget.tsx` (a one-line scrim swap only).
    - Decide first whether `side-panel.tsx` is `Sheet`'s desktop face.
15. **The phone-app Apple glyph is hard-coded black.**
    - `native-oauth-buttons.tsx` (the Capacitor phone-app twin of the web row, used by `signup/page.tsx` and `login/_components/sign-in-card.tsx`) passes `<AppleIcon fill="#000000" />`.
    - The web row paints the glyph white on the dark card (live, § 4), but the phone-app row would draw black on the dark card's dark button. Not verified: the phone app was not run.
    - Fix: `currentColor`.
    - In the same pass, fold `sign-in-here-panel.tsx`'s own `matchMedia` into one exported helper in `lib/appearance.ts`.
    - `native-oauth-buttons.tsx` also has `Loader2` spinners (the no-spinner rule).
16. **`app-store/studio-card-demo.tsx` is the worst single file in the app:** 43 palette classes, 32 white/black, 183 `text-[px]` and 16 hand buttons. Move it to tokens and `ActionButton`. It is a demo card, so keep its look and change only the primitives.

### Group D: supplier dashboard · **High → Med**

Files: `app/vendor-dashboard/**`, `app/vendor/**`, `app/vendor-invite/**`.

17. **Supplier dark-ready and nearby screens.**
    - "Loading…" in `clients/[eventId]/_components/details-decisions.tsx`, `client-chat-strip.tsx`, `on-the-day/_components/shot-list.tsx` and `shop` → `Ghost` / `pendingLabel`.
    - The 4 empty-prose files (`packages/_components/package-editor.tsx`, `attributes/_components/attributes-view.tsx`, `shop/store/_components/store-screens.tsx`, `website/_components/review-replies.tsx`) plus `forms/_components/forms-page-body.tsx` → `EmptyState`.
    - Hand modals in `on-the-day/_components/guest-review-qr.tsx` and `collections/_components/portfolio-show.tsx`.
    - Scrims in `services/their-work/their-work-list.tsx` and `clients/[eventId]/challenge-photos/challenge-photos-body.tsx`.
    - `vendor-invite/[slug]/loading.tsx` and `vendor/lock/[token]/loading.tsx` hand-pulse → `Sk`.
    - `vendor-dashboard/_components` holds 70 raw hex.
    - `/shop` has 88 half-px.

### Group E: admin · **Med**

Files: `app/admin/**`.

18. **Palette classes → tokens.**
    - `integrations/page.tsx` (23), `website-media/media-table.tsx` (18) and `clear-folder-button.tsx` (15), `editorial-review/[editorialId]/page.tsx` (14), `connection-logs/connection-logs-client.tsx` (55 hex + a hand modal).
    - `ugat/_components/ugat-console.css` (101 hex) and `ugat-console.tsx` "Loading…".
    - Legacy `.button-*` in `studio/_surfaces/social-queue-surface.tsx` (10) and `verify/page.tsx` (5).
    - Empty prose in `vendors/[vendorProfileId]/_components/service-cards-section.tsx`, `categories/_components/map-panels.tsx` and `payments/supplier-refunds/supplier-refunds-view.tsx`.
    - Spinners in `demo-vendors/_components/demo-vendor-actions.tsx` (9).
    - Admin has no dark at all; that is a separate, owner-level call.

### Group F: public pages + onboarding (always Light by rule) · **High (hex mass), visible on prod**

Files: `app/(shell)/**`, `app/_components/home/**`, `app/onboarding/**`, `app/tour/**`, `app/signup/loading.tsx`, `app/features/**`.

19. **The marketing sheets carry their own palette.**
    - Raw colour: `home/home-reskin.css` (184 hex, 69 rgb, 33 motion), `onboarding/wedding/_styles/onboarding.css` (155 hex, 162 rgb, 137 motion), `tour/**` (261 hex; the tour cards are hand-bordered frames, not `.sn-frame`, see § 4).
    - Off-palette demo colours on `/for-suppliers`: bright-green calendar days and a saturated blue "Verified shop" chip (§ 4).
    - `(shell)/explore/_components/vendor-card.tsx` (16 palette).
    - `/pricing` (36 arbitrary spacings, 18 half-px).
    - `onboarding/wedding/loading.tsx` and `signup/loading.tsx` hand-pulse → `Sk`.
    - Swap the exact-equal hex for tokens first (no pixel change, per `design-token-map.md` §2).

### Group G: guest surfaces (Event Hub, `/v/[slug]`, Papic, Panood) · **Med**

Files: `app/[slug]/**` (not `find-seat`/`seat`), `app/v/**`, `app/papic/**`, `app/panood/**`.

20. **Guest primitives.**
    - The Apple Wallet badge follows the phone, not the Hub ground (`apple-wallet-button.tsx`, § 2.2). Pick the badge from the Hub's resolved ground instead.
    - Hand modals: `editorial/open-up-layer.tsx`, `story/find-in-this-day.tsx`, `story/relive.tsx`, `rsvp-sheet.tsx`, `v/[slug]/_components/service-details-sheet.tsx`.
    - Hand scrims: `story/story-suppliers.tsx`, `maker-scene-samples.tsx`, `selfie-capture.tsx`, `papic/guest/_components/papic-guest-capture.tsx`, `panood/control/[eventId]/page.tsx`.
    - Spinners: 47 in `/papic` (`papic-guest-capture.tsx` 14). 27 hand buttons in `/papic`.
    - "Loading…" in `[slug]/_components/invitation-skeleton.tsx` (a skeleton that also prints the word).
    - The Hub itself is self-styled by rule. Only the shared primitives move, not its theme colours.

### SEAT (short; redesign in flight)

- `/dashboard/[eventId]/guests?gview=seats` **is on the dark list.** `/guests$` matches the path and ignores the query, so the 2D/3D seat view paints in dark. The seating components still carry 37 hex, 16 `rgb()` and 21 white/black.
- `seating/_components/seating-editor.tsx` has 24 hand buttons.
- `[slug]/find-seat/_components/door-pass.tsx` is a hand modal.
- `/[slug]/find-seat` has 16 legacy radii.

---

## 4 · Live check on www.setnayan.com (signed out)

Playwright (Chromium) was run against production at `068460f`:
- **Routes:** `/`, `/for-suppliers`, `/explore`, `/pricing`, `/features`, `/articles`, `/help`, `/our-story`, `/login`, `/signup`, `/tour`, `/realstories`, `/open-shop`, `/papic`, `/palogo`, `/forgot-password` and a 404;
- **widths:** 375, 820 and 1440;
- **schemes:** OS light and OS dark.

**What held:**

- **Dark follows the rules.** With the OS in dark, only `/login` and `/signup` painted dark: `html.dark` was set and the page was `#121110` at every width. Every other public page stayed Light (`#F7F5F4`), as call 4 requires. No half-dark page was seen.
- **No sideways scroll** at 375, 820 or 1440 on any route (`scrollWidth − innerWidth = 0` for all 102 renders).
- **No plain "Loading…"** was visible after network idle on any public page.
- **The 404 page is honest:** HTTP 404, one heading and two doors.
- **The brand marks hold in dark.** The gold mark reads on the dark sign-in card. On the web row, the Google and Apple glyphs paint correctly on the dark buttons.

**What looked off (screenshots, 375 / 820 / 1440):**

1. **The sign-in family breaks on the way to "Forgot password".** On a dark phone, `/login` and `/signup` are dark photo cards with pill buttons. `/forgot-password` is a different design:
   - it stays Light (it is not in `SIGNED_OUT_FOLLOWS_PHONE`);
   - its card is a white frame with a terracotta top rule;
   - its main button is a full-width rounded rectangle, not the pill;
   - its header is the wordmark, not the forming logo.

   One tap moves the person from a dark card to a light page in another style. Owner call: add `/forgot-password` (and `/reset-password`) to `SIGNED_OUT_FOLLOWS_PHONE` and give them the same card.
2. **The 404 buttons are rectangles** (`rounded-md`, full width), not the house 40 px pill `ActionButton`.
3. **Public headlines use three display faces:**
   - a serif on `/` and `/pricing` ("The best place to build your event.");
   - a light sans on `/papic` and `/palogo`;
   - a bold sans on `/for-suppliers` and the `/explore` hero.

   Check this against the corpus type standard, which was not read here.
4. **Hand-bordered cards on public pages.** The `/tour` step cards and the `/palogo` "01 · 02 · 03" cards are bordered, rounded frames on a cream or white fill. The house frame is `.sn-frame` (white, shadow, no border).
5. **Off-palette demo colours on `/for-suppliers`:** bright-green available days in the calendar demo and a saturated blue "VERIFIED SHOP" chip. Neither is in the one colour set. At 820 px the "Rave Reviews" badge label overlaps a faded copy of itself on the supplier cards.
6. **Two "Sign in" buttons on every public page at 1440:** the top bar's outline pill and the rail's filled gold-brown pill. The gold-brown fill is not the decision colour (terracotta).
7. **`/pricing` opens a spotlight tour on first visit** ("STEP 1 OF 3 · Why Setnayan") and dims the page at every width. This is noted, not judged: it may be intended.
8. **`/open-shop` paints a blue-grey page (`#EEF2F8`) with blue controls.** This is the supplier look (owner-approved navy family), and it is the only public page that leaves `#F7F5F4`.
9. **Copy seen in passing (brand rules, not this audit's scope):** "Free to start. Free to stay." on `/for-suppliers` reads close to the banned "always free". "from ₱99" on the same page must come from the catalog; that was not verified.

---

## 5 · What this audit did NOT cover

- **Signed-in pages were checked in code only.** No session was used, so no dashboard, supplier, admin or Hub screen was rendered, in light or dark.
- **The specs corpus was not read** (repo access refused in this session). That covers `HOUSE_DESIGN_STANDARD`, `DARK_MODE_STANDARD`, `MOTION_STANDARD` and the approved drawings, so no screen was compared with its drawing.
- **`components/**` and `lib/**` were not scanned per route.** They are shared and not routes. Colour data in `lib/` (Hub themes, chart maps) is product data by rule.
- **The award art** (`_components/award`, generated, 1,670 hex) and **the 3D kit** (`_components/plan3d`, scene materials) were treated as data, not findings.
- **Emails, print sheets** (`[slug]/print`), **OG images** and **`app/api/**`.
- **Contrast was not measured.** Only the Schedule hover case was reasoned from token values. `lint:contrast` and `lint:legibility` already exist; run them for numbers.
- **The scan is regex**, not an AST:
  - counts are flags, not proven defects;
  - `bg-white` over a photo or camera is often correct;
  - `dark:bg-white` is counted as white;
  - empty-state prose split over JSX lines was not matched.
- **Off-scale spacing** is an aggregate only. It was not split per route, because many such steps sit inside the 44 px press rule.
- **Images or SVGs vanishing in dark** were checked only for hard-coded dark fills and the brand marks. The marks are gold (`#cb9e4b`) or `currentColor` and are safe. Photos and supplier logos were not inspected.
- **iPad** was approximated at 820 px wide in Chromium. No real Safari or WebKit was used.

## Method

- **Scanner:** a ~90-line Python regex pass with the patterns in the first table.
- **Route grouping:** one folder below `app/`; two below for `dashboard/[eventId]`, `dashboard/(account)`, `vendor-dashboard`, `admin`, `(shell)`, `[slug]`, `onboarding` and `_components`.
- **Dark-token check:** a brace-matching parse of `globals.css` that compares custom properties on `:root`/`html` with those on `html.dark`.
- **Hand-modal list:** `aria-modal` files minus importers of `sheet`, `rise-screen`, `overlay-backdrop` or `side-panel`.
- **Exact counts move daily.** Re-run before you quote one (CLAUDE.md rule 2: cite the symbol, not the count).
