# MB6 — Port section 03: Reception

**Goal:** the redesigned Reception section, venue-type aware, in the real app.

**Model:** Sonnet · high effort.
**Size:** 1 day. **Depends on:** MB3, MB5, **and the prototype's 03 redesign being final** — do
not start until that reference is settled.

## Delivers

- Section 03 as redesigned: a palette-tinted room drawing as the primary selector, repainting live
  as colours change, with the zone rail beneath it carrying per-zone treatment text
- **Venue-type awareness** off the two venue columns from #5113 — hall, restaurant, heritage, tent,
  garden, beach, destination
- **Honest gating:** a beach has no ceiling to dress, so ceiling and walls read "not at this venue"
  — disabled, *said*, and excluded from 04's briefs. Not silently absent.
- Reception's venue moves **read-only** into 02's Venue group
- Drag-to-reorder the majors

## Verify

- `pnpm exec tsc --noEmit` from `apps/web`
- `node apps/web/scripts/port-controls.mjs`
- **`sanitizeReceptionDesign` round-trips unchanged on all 2,600 seeded template blobs** — the
  technique already proven in the multi-select widening
- the `selAll()[0] === sel()` invariant stays green
- gating guard: a disabled zone is excluded from the render brief, not just hidden — sabotage:
  include it, confirm red

## Owner decides first

Nothing.
