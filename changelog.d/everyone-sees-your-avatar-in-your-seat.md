## 2026-09-06 · feat(3d-plan): the avatar a guest makes is seen by everyone else — seated, as their chibi

Owner 2026-09-06: *"build what is not done."* A guest who built a chibi at
`/[slug]/avatar` walked in as one and was **still a neutral mannequin in every
other guest's room** — C5 shipped only the viewer's own config, and its own
header said the seated block belongs in the RPC "when the seated rig lands".

**The seated rig is not new geometry.** The rig spec (owner-locked 2026-07-19,
§ 9.1) says: *"sit = hips to seat, legs dangle (charming, intended)"* — the
standing chibi lowered onto the chair. `lib/chibi-sit.ts` does exactly that:
the outfit's hem lands on the seat top (`CHAIR_SEAT_Y` + half the seat box,
pinned to the chair's own constants), the figure sits 0.16 m forward so the
legs hang off the front edge, and every part buffer is the one the maker draws.

- **Migration `20271208425259`** (`public_venue_scene` v12): the body copied out
  of production with `pg_get_functiondef`, not the last migration, and edited
  in two places — a new `avatars` block `[{table, seatNumber, config}]` under
  the **same `venue_photo_visibility` gate as photos** (`table` → own table with
  a token · `all` → everyone · `none` → nobody), listing only guests with a
  non-null config (the server never invents an avatar), and the return key.
  Grants untouched; exposure-freeze sees no new capability.
- **`kit/instanced-chibi-crowd.tsx`**: one `InstancedMesh` per distinct part
  buffer over a white material, per-instance colour from the same
  `resolveChibiPaint` the individual figure uses, DoubleSide (the solid-figure
  law), statically baked — the BATCHING CONTRACT chibi-geometry was written for.
  Batch count is bounded by the catalog, not the crowd (40 guests of two
  variants cost the same draws as 2).
- **The walk splits**: a seat whose guest made an avatar goes to the chibi
  crowd; every other occupied seat stays a mannequin; the mannequin loop skips
  chibi seats (no doubles); each config is re-validated by the ONE fallback
  rule (`selfFigureAvatar`) so junk declines to the mannequin; the whole thing
  collapses to today's room while `NEXT_PUBLIC_FIGURE_CHIBI` is off.
- `tests/db/an-avatar-reaches-only-its-owner.db.test.ts` — claim 2 amended
  (others receive avatars **through `avatars`, under the gate**; C5's "your own
  is ungated" survives) and three new end-to-end claims against the replayed
  function. `lib/chibi-sit.test.ts` pins the seat constants, the hem-on-seat
  invariant for every outfit, the batch bound, paint parity, the renderer, the
  split and the migration.

Still not done after this: walking remotes carry no config (the `greet`
broadcast is name + colour), so a guest's chibi is seen seated, not while they
cross the room; and the four other avatar styles.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-06 row.
