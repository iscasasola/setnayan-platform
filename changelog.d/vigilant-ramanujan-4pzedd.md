## 2026-11-09 · feat(taxonomy): one-source taxonomy — a guard so no new hard-coded copy lands, and the first rows moved

Owner, 9 Nov: *"make sure the services are not hard coded and other codes that should live based on the
taxonomy."* Admin › Categories is the one source (owner 26 Oct: *"the foundation of all suppliers"*).

- **New guard `lib/no-taxonomy-literals.test.ts`** (scanner `lib/taxonomy-literal-scan.ts`). Parses every
  product file under `app/`, `lib/`, `components/` with the TypeScript compiler and fails on a NEW
  hard-coded copy of the taxonomy: a list naming 3+ taxonomy slugs, a `=== 'slug'` / `case 'slug':` /
  `.includes('slug')` behaviour switch, or a value import of the seed constants (`TAXONOMY_MAP`,
  `TILE_PARENT`, `WEDDING_*`, `ADMIN_ONLY_TILES`). The vocabulary is the seed itself, so it grows with it.
  Comments never trip it; role/phase words (`coordinator`, `reception`, `editorial`, `venue`, …) are not
  read as categories in a comparison.
- **Shrink-only baseline `lib/no-taxonomy-literals.baseline.txt`** — 110 rows across 95 files, each with a
  reason (DELIBERATE · PRIVACY GATE · GUARDED · FAIL-CLOSED · CHANGED BY #7416/#7413 · UNREVIEWED). Regenerate
  with `pnpm exec tsx scripts/gen-taxonomy-literals-baseline.ts`, which can only lower counts.
  Supplier Builds 3/4 (#7416/#7413) landed while this was open; their one new copy
  (`lib/supplier-hero.server.ts`) left with them, so its pre-registered row is struck.
- **Moved to the live taxonomy (no look or behaviour change on the seed):**
  - Find a supplier's search words (`lib/supplier-find-read.ts`) — built from `taxonomy.map` per read
    instead of `TAXONOMY_MAP` once per process, so a service an admin adds or moves is found under its new
    category, at once.
  - The supplier sheet's "also does" chips (`lib/supplier-sheet-read.ts`) — `getTaxonomy()` map + labels.
  - The front door's "What you run" group word (`app/_components/frontdoor/data.ts`) — `getTaxonomy()`
    `folderLabel` instead of `WEDDING_FOLDER_LABEL` / `TAXONOMY_MAP` (held back until #7416 landed, since
    it regenerates `lib/ugat/screens.generated.json`, regenerated here).
  - `/explore` — the ItemList JSON-LD group list and the `?folder=` filter read `getTaxonomy().folderOrder`
    / labels / slugs, so a new or renamed group is filterable and published without a deploy.
- **Left on purpose** (reasons in the baseline): the seat-plan / guest-list / meal-count access gate
  (`lib/supplier-access-by-category.ts`, a privacy gate mirrored in SQL that fails closed), `ADMIN_ONLY_TILES`
  (owner ruling 2026-08-27), and every row that needs a NEW admin column (Find groups, Popular, plan groups,
  maker profiles, tools, console kinds) — each needs owner sign-off on the field first.

SPEC IMPACT: None — no schema, no copy change. Plan of record: corpus
`plans/one_source_taxonomy_2026-11-09/00-AUDIT-AND-PLAN.md`.
