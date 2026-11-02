## 2026-07-15 · fix(seating): serpentine segments join end-to-end — no overlap

Owner-reported (2026-07-15 screenshots of the "Arrange the room" 2D editor): serpentine
(S-curve) segments rendered OVERLAPPING mid-curve instead of meeting tip-to-tip; two round
tables stacked with chair rings interpenetrating; new tables all named "Table 5".

Root cause of the overlap = **(d)-adjacent**: the serpentine tangent-join math was already
correct (`serpentineChainSnap` produces exactly-coincident tips — the existing e2e endGap
test passes at <1e-6), but `overlapsAny` **blanket-exempted every same-family pair**
(serpentine↔serpentine, banquet↔banquet) from collision. So when a drag DIDN'T land inside
the magnetic snap tolerance, two serpentines free-overlapped with nothing pushing them
apart — the snap was opt-in, and a near-miss persisted the overlap the owner saw. Rounds
weren't exempt but the same footprint AABB (which already spans the chair ring) governs them.

- `lib/seating.ts`:
  - New pure, unit-pinned collision primitives: `boxesOverlap` (chair-inclusive AABB — a
    table's `tableGeometry().box` already spans its seat ring, so a box overlap IS a
    "chairs touch" collision) + `boxOverlapsRect` (footprint vs a zone rect: dance floor /
    cocktail room / booth).
  - New sanctioned-contact predicates: `serpentinesJoined` (tips coincide within
    `SERP_JOIN_TOL_PX`) reusing `serpentineEndsWorld`, and `rectEndsWorld` + `rectRunsJoined`
    (run ends flush within `RECT_JOIN_TOL_PX`). These define the ONE legal overlap — a chain
    join — so everything else collides.
  - `nextTableName(existing)` — smallest free "Table N" over existing labels (fills gaps,
    ignores custom names). Fix for "six tables all Table 5".
  - `SIDE_COLORS` retinted to the atelier/glass side identity (bride → `--sn-gold-500`
    `#A9834B`, groom → `--sn-info` `#4E6C82`, both → `--sn-gold-300` `#CBA766`), matching the
    Guests roster RowAvatar (`guest-list-multiselect.tsx`). Retires the old rose/sky/amethyst
    seat-map avatars. `SIDE_COLORS` is consumed only by the seating editor.
- `app/dashboard/[eventId]/seating/_components/seating-editor.tsx`:
  - `overlapsAny` now routes every footprint test through `boxesOverlap`/`boxOverlapsRect`
    and replaces the blanket family exemption with `chainJoined` — a pair is exempt ONLY when
    it's a sanctioned tip/flush contact OR an explicit linked unit (shared `link_group_id`).
    A loose serpentine/banquet near another now collides → the existing axis-slide keeps it
    apart → a DROP can never persist an overlap. Legit snapped chains + linked units stay
    exempt (survive remounts). Saved layouts are unaffected: the mount resolver already
    anchors any table with `x_pos`/`y_pos` and never re-places it (no surprise re-arrangement
    of existing overlapping rooms; enforcement is forward-only). Pre-existing overlaps also
    drag FREE (the "already stuck" clause), so they're never boxed in.
  - `AddTablePanel` seeds its name field with `nextTableName(...)` (was blank+required) so
    rapid adds increment. Shape-change already preserves the name (`changeTableType` keeps the
    label) — no collision there.
  - Component-scope `halfLenOf` (deduped the inner copy in the drag handler).
- Auto-layout paths were already correct and are left intact: `computeAutoLayout` spaces by
  real footprint (chairs included) and treats dance floor + cocktail room as no-table zones;
  the STAGE is deliberately a platform tables may sit on (owner rule), not an obstacle. The
  role-tier ring auto-fill is seat ASSIGNMENT to existing tables (no placement), so footprints
  don't apply.
- `lib/seating.test.ts`: +11 node:test cases — `nextTableName` (gaps/custom/whitespace),
  `boxesOverlap`/`boxOverlapsRect` (incl. a chair-ring interpenetration case), and
  `serpentinesJoined`/`rectRunsJoined` (snapped tip/flush join → joined & tips coincide to
  <1e-6; body-overlap → not joined). Full lib suite green (1823 passing), typecheck + lint +
  production build clean.

Manual verification for the owner: add two serpentines → drag one end-to-end onto the other
(it snaps tip-to-tip, no overlap; rotate the anchor first and it still meets cleanly) → drop
one NEAR but not snapped (it now slides to clear instead of stacking) → Save → reload (the
chain holds; nothing re-arranges). Add several tables in a row (names increment Table 1, 2,
3…). Seat map avatars show gold (bride) / slate (groom) chips.

SPEC IMPACT: None
