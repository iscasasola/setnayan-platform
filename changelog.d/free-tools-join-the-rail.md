## 2026-09-03 · feat(rail): Planner / Builder / Together — the free-tool groups above Studio

Added three new signed-in rail groups (`apps/web/lib/free-tools-rail.ts`) sitting
between the existing "Browse by category" block and Studio in
`front-door-shell.tsx`:

- **Planner** (gated on `insideEvent`, same rule as Marketplace) — **Mood Board**
  only. A first draft listed Guest List, Seat Plan, Schedule and Budget too, but
  those four already exist as real, active rows in the event's own menu
  (`EventRailContext` / `customer-nav-config.ts`) — adding them again would have
  been the "same destination, two names" defect that file's own docblock warns
  against. Mood Board is the one genuine gap: it lives inside Studio → Branding,
  not the event's top-level menu.
- **Builder** (same gate) — **Compare** (`/explore/compare`) and **Contracts**
  (`/dashboard/[eventId]/contracts`). "Vendor ledger" was dropped from the
  original list for the same reason — `/vendors` already tracks
  `deposit_paid_php` per vendor, so a separate ledger card would have pointed at
  data Marketplace + Budget already surface.
- **Together** (NOT `insideEvent`-gated — Samahan is account-level, confirmed via
  `app/dashboard/(account)/samahan/`, never nested under `[eventId]`) — Samahan
  groups, Samahan Stories, Vendor chat, Event chat. The chat rows resolve to a
  real thread when exactly one event is known, `/dashboard` otherwise — never a
  guessed event.

All three groups reuse Studio's own row markup/CSS (`fd-row fd-row-2l`,
`fd-toolwrap`, `fd-toolline`) rather than introducing a new visual system, so no
CSS changes were needed.

Also added per-item anchors (`id="guest-list"`, `id="mood-board"`, etc.) to
`app/features/_sections/_PlanningToolkit.tsx` and `_VendorsLedger.tsx`, which
previously had only one shared section-level anchor each — a prerequisite so a
future public-facing link (or these rail rows, if desired later) can point at
one specific tool instead of the top of a whole section.

**Fixed before shipping: the three groups' rows were rendering but never
lighting up.** `rowProps(t.key)` marks a row "you are here" by checking its key
against `activeKey`, and `activeKey` is derived from exactly one list —
`matchRows` in `front-door-shell.tsx`. The three new prop arrays
(`plannerTools`/`builderTools`/`togetherTools`) were being rendered via
`rowProps` but never added to that list, so standing on e.g. `/…/studio/mood-board`
would never light the Mood Board row — a defect the existing test suite could
not catch (no test asserts a specific row lights on its own page for these new
items, only that `activeKey` resolves *something* reasonable for rows already
in the list). Fixed by spreading all three arrays into `matchRows` alongside
the Studio `tools` spread it already does this for. Two Together pairs (Samahan
groups/Stories; Vendor/Event chat) intentionally share one destination each
until they get their own sub-views, so `activeRailKey`'s position-based tie
means only the first of each pair can ever light — a real, disclosed gap in the
shared destination, not a bug in the matcher.

Test changes: `the-rail-moves.test.ts`'s hardcoded `.fd-rgroup` count moved from
3 to 6. `studio-follows-you-in.test.ts`'s two proximity-window assertions were
re-verified against the actual file (not just reasoned about) and needed no
change — both windows land clear of the new groups. New
`lib/free-tools-rail.test.ts` pins the three groups' outputs and explicitly
asserts neither Planner nor Builder ever points at one of the five hrefs the
event menu already owns, so a future edit can't silently reintroduce the
duplicate this pass avoided.

Verified against `origin/main` at the point this shipped (250 commits ahead of
where this branch was drafted, including a same-file rail de-dupe fix and the
Event Hub rename) — full targeted suite re-run clean (189/189), typecheck
clean, lint clean, live-checked signed-out in the dev server.

Scope note: this was Phase A of a larger front-door redesign discussed at
length this session (prototypes: `~/Documents/Claude/Projects/Setnayan/06_Prototypes/`).
Phase B (the front door's own content — anchor + New uploads/Trending/Shops)
ships separately.

SPEC IMPACT: None — additive rail IA surfacing existing routes, not a new
product decision or a reversal of anything already speced in the iteration
corpus.
