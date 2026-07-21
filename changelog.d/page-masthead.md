## 2026-07-21 · feat(dashboard): one PageMasthead component + a ratchet to stop the drift

Owner: *"is it possible to remove all of those on the dashboards so we can maximize the space?"*
First build off `Dashboard_Masthead_Density_Council_Verdict_2026-07-21.md`.

### Why the eyebrow can go without a brand argument

`.sn-eye`'s own spec comment in `globals.css:2559` reads **"*Tile* eyebrow"**, and `.sn-h1`'s at
`:2577` already records that *"m-serif is retired from dashboards"*. `.sn-eye` appears in just **2**
`.tsx` files outside the three authenticated trees. **It is a card token that drifted onto page
headers by copy-paste — not the atelier identity.** That identity lives on the public marketing
tree, guest sites and `/u/[slug]`, none of which this touches.

There was also **no shared page-header component anywhere** — all ~80 were hand-rolled. That
absence is precisely why it drifted.

### What ships

- **`app/_components/page-masthead.tsx`** — one row: `[back chevron] + title (+ actions)`, with a
  desktop-only lede. **No eyebrow prop exists**, by design. The title gains the responsive step it
  never had (`36px` was hardcoded with no media query): 22px on phones, 36px from `lg`.
  It keeps an **`actions` slot** because 20 of the old headers hold the *only* doorway to another
  surface — deleting them wholesale would delete navigation.
- **The title is never invisible.** Below `lg` there is no sidebar, no breadcrumb anywhere in the
  product, and no browser tab in the installed PWA — on a phone the h1 is the only thing saying
  which page you are on.
- **6 pages migrated** by codemod (clearance, indoor-blueprint, pabuya, living-hero, details,
  galleries).
- **`scripts/lint-page-masthead.mjs`** + a **115-file baseline**, wired into CI as its own job.

### Honest scope

A codemod cannot finish this. Of 48 candidates that looked mechanical, **41 were refused** — most
because the `<header>` is being used as a *content container* (e.g. `studio/led` has a three-item
feature list inside it), which is a different problem needing per-page judgement. One conversion
mangled a file whose lede contained JSX; it was reverted rather than patched. **6 migrated,
115 baselined.**

The lint is a **ratchet, not a wall**: it fails only on NEW drift. A lint that red-builds 115
existing files gets deleted in week two.

### Correction to the council record

The verdict claimed *"CI invokes none of the 10 custom lint scripts"*. **That is false** — all ten
run as their own jobs in `ci.yml`, invoking the script paths directly. The original grep searched
for the `pnpm lint:*` alias names, which CI does not use. This PR follows the real convention.

Typecheck + production build clean.

SPEC IMPACT: Implements § 3 and § 5 of the masthead verdict. The 115-file migration is § 4 and is
not attempted here.
