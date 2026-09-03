## 2026-09-03 · fix(plan3d): the 3D room draws the design the couple already saved

The 3D Seat Plan silently ignored three things a couple had already chosen and
saved, with nothing on screen to say anything had been dropped — the same
disease as the guest list that told a couple with 180 names "No guests yet".

- **The fifth major colour reaches the room.** `role_palette.reception[4]` —
  the slot `PALETTE_LIMITS.reception.slotLabels` calls "Accent 2", owner-locked
  2026-09-03 ("themes must be 5 colors") and present in all 2,600 seeded themes
  — was read by nothing. `Lab3DPalette` gains an OPTIONAL `accent2`, set from
  `reception[4]` verbatim or absent, and it now paints the second tone of every
  two-tone floral (`bloomSecondary`), the step-and-repeat monogram, the balloon
  garland, the neon tube and the seating-chart frame.
- **The three zones render.** `walls` · `photo_wall` · `welcome_signage` were
  stored, offered in the reception-design editor and printed in the concept PDF
  while reaching no geometry at all. All of their treatments now build in
  `apps/web/app/_components/plan3d/venue-decor.tsx`. Each mounts a named group
  (`decor-walls-*` / `decor-photo-wall-*` / `decor-welcome-*`) so "did it reach
  the render?" is answerable without trusting the resolver.
- **Multi-select is handled honestly.** Per the widening decision the room still
  draws the PRIMARY treatment only — there is one physical ceiling band, one
  panel, one welcome table — and now it *says so*. `primaryOnlyNotice()` names
  what is on screen and what is not, and appears in the room's legend only when
  the couple actually selected more than one thing. It is handed
  `ROOM_DRAWN_ATTRIBUTES` — the seven part+attributes `VenueDecor` actually
  reads — because a first cut that walked all ten parts told a couple
  *"Stage (showing Arch)"* about a stage this room does not draw at all, a new
  false claim inside the fix for false claims. That list is pinned to the
  room's own `sel()` calls by a guard, so it cannot drift.

🛑 The room's chair/floral slots are still NOT fed from `resolveRoomDressing`.
That helper derives from different slots and wiring it in would restyle every
room already sold; resolving that boundary deliberately is MB15's job, with a
migration boundary and owner sign-off. `accent2` is `reception[4]` verbatim, and
`bloomSecondary`'s fallback is the exact pre-MB1 expression.

**Non-regression, measured, not asserted:** every one of the 2,600 seeded theme
configurations was rendered before and after, across two archetypes, as a
pre-MB1 live board holds it (≤4 reception colours, the three new zones at their
"nothing here" defaults, single-select) — **5,200 renders, byte-identical**. The
one hop a server render cannot observe (`InstancedMesh.setColorAt` runs in a
layout effect) is closed analytically instead: `accent2` resolves to `undefined`
for all 2,600 seeded palettes cut to four, so those rooms still get the old
expression. With the fifth colour and the real zone values in play, 5,000 of
5,200 renders change — that is the delivery.

Known gap, found and deliberately NOT expanded into: the 3D room renders no
stage florals, no aisle runner and no backdrop-floral overlay for anybody —
those live only in the 2D scene. That is a separate instance of the same class,
outside MB1's scope; the legend is simply forbidden from claiming otherwise.

New guard: `apps/web/app/_components/plan3d/the-room-draws-what-the-couple-saved.test.ts`
(17 tests). It mounts the room and reads the emitted tree rather than calling
resolvers, because a correct resolver is not evidence — it caught its own blind
spot mid-build, where five-colour and four-colour markup came back byte-identical
at 1397 chars while `accent2` resolved perfectly.

SPEC IMPACT: None. No schema, no new stored field, no price, no locked decision
touched — `reception_design` and `role_palette` already held all three inputs;
this is the room finally reading them.
