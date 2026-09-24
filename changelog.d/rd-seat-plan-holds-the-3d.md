## 2026-09-24 · fix(nav): the 3D Plan row folds into Seat plan — its pages light Seat plan everywhere

Owner, on the new event menu (#5943): *"seat plan also show 3D plan? so i think we can remove the
3D Plan menu. since the 3D version is on the seatplan already. but make sure mapping stay
consistent"*.

Measured first: the 3D Plan ✦ row opened `/seating/lab` — the same page Seat plan's own
`List | 2D | 3D` segment (`SeatingViewSegment`) opens — and the lab links on to the 3D Plan control
centre (`/plan3d`, "3D Plan control centre →"). The menu never linked `/plan3d` directly. So the row
was a second door to a view of the seat plan; nothing becomes unreachable, and no link was added.

- `lib/customer-menu.ts` — new `STUDIO_ABSORBED` (`pa3d → seat`): the product row is not drawn;
  its pages (`/seating/lab`, `/plan3d`) become `alsoMatch` claims on the Seat plan row. A documented,
  tested outcome — not the unknown-key → end-of-list fallback and not a drop: if the host row were
  ever absent while the product is offered, the 3D Plan row stands in its own slot in The day.
  The `pa3d` key is unchanged everywhere (still in `railToolsSignedIn`, `SECTION_ORDER.day`,
  `STUDIO_PLACEMENT`).
- New pure helpers `eventMenuRowClaims` + `eventMomentChildren`; the phone moment strip now builds
  its chips through the latter, so `/plan3d` docks The day AND lights the Seat plan chip.
- `event-rail-match-rows.ts` emits each `alsoMatch` claim as a match row under the host key, so the
  one shipped resolver lights Seat plan on `/seating/lab` and `/plan3d` — no special case.
- `NavItem.alsoMatch` (optional) carries the claims through `buildCustomerNavGroups`.
- Gating unchanged: Seat plan (`seatingEnabled` = `surfaceEnabled(profile,'seating')`) and 3D Plan
  (catalogue `surface: 'seating'`) already rode the one surface. 3D Plan is free (#5185), so no
  store-shell change.

Tests: `the-event-menu-is-one-tree.test.ts` (rail is now 20 rows; new §6 — no 3D Plan row on rail /
☰ / phone bar / strip, the 3D pages light Seat plan on rail and strip, the `pa3d` key survives with
its fallback slot, the seat plan still opens the 3D view and the 3D view opens `/plan3d`);
`studio-rows-are-lit.test.ts` and `studio-follows-you-in.test.ts` repointed to the ruling.

SPEC IMPACT: None
