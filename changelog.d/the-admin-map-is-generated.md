## 2026-08-26 · feat(admin): the admin map is scanned, not typed

The owner asked for an assistant that can be told *"take me to the pricing for
papic services"* and, before that, for the assistant to **hold a map** of the
admin — where things live, what to open (2026-08-26). This is the map's first
half: the inventory.

**What shipped**

- `scripts/gen-admin-map.ts` → `lib/admin-map/admin-routes.generated.ts` — every
  place inside `/admin` a person can land, scanned from the route tree.
  **96 destinations: 55 real pages and 41 redirect stubs**, each stub carrying
  the address it forwards to (37 of the 41 resolve to their exact tab).
- `app/admin/_components/admin-destinations.ts` joins that map with the curated
  menu, and the ⌘K palette now searches the join instead of the menu alone.

**What it fixes, measured**

- The palette's own docblock claimed it *"indexes all 108 admin surfaces"*. It
  indexed the **78 menu items**. **Seven real pages** were in no menu at all —
  reachable only by knowing the URL, which is the same as unreachable.
- **~40 admin routes are stubs** forwarding into a tab (`/admin/songs` →
  `/admin/studio?tab=songs`). The old address is still what a person types and
  matched nothing. Each stub's address is now a search word on the destination
  it forwards to — landing on the **tab**, not the top of a 13-tab page.

**Decisions worth keeping**

- 🔑 **Generated, never authored.** `admin-map-is-generated.test.ts` re-scans the
  tree and refuses any difference, so adding an admin page without running
  `pnpm --filter @setnayan/web admin:map` fails by name. This repo has paid three
  times for hand-maintained lists that drifted while CI stayed green.
- 🔑 **The menu always wins.** Map-only destinations score in a halved band, so a
  folder name can never outrank a curated menu item.
- 🔑 **The map does not resurrect what a flag hides.** Live Studio channels sits
  behind a feature flag; comparing against the RUNTIME menu would have read it as
  "nobody listed this" and offered it anyway. The scan records whether the menu
  *source* mentions an address, which tells a deliberate hide from an omission.
- 🪤 **A page that calls `redirect()` is not a redirect stub.** Three real pages
  (`subscriptions`, `integrations`, the compliance data sheet) redirect a
  signed-out caller to `/login`; a first cut read all three as stubs and would
  have deleted three destinations and pointed anyone searching for them at the
  sign-in screen. A stub renders **nothing** — that is the honest difference.
- 🪤 **Nearly every stub ends `…?${out}`.** Testing for a bare `?` claimed a
  literal query that was really the seam before the interpolation: **24 of 41
  stubs silently lost their tab.** And the receiving variable is `out`, not
  `params`, on the pricing and app-performance stubs — match the CALL, never a
  remembered variable name.

**Guards** — 12 new assertions across two files, plus one existing guard taught
to follow the new indirection. **13 mutations, every one measured by occurrence
count before → after, all RED.** 🪤 **Rev 1 of "the palette actually uses the
map" was DECORATION** and only the mutation run saw it: it matched the bare word
`buildDestinations` anywhere in the file, so replacing the call with an empty
list left the *import* standing and the guard reported a clean pass while the
palette rendered nothing. It now matches the call site on comment-stripped
source, and refuses a second local destination list.

SPEC IMPACT: None. No schema, no pricing, no product surface changes — the same
menu, the same pages, reachable by more of the words people actually type.
