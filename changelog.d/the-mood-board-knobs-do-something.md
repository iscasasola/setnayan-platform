# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-09-03 · fix(mood-board): the Chairs and Florals knobs now dress the room

The palette editor offers four room-dressing overrides — **Linens, Chairs,
Florals, Lighting warmth**. All four are saved. All four survive
`sanitizeRolePalette`. `resolveRoomDressing` resolves all four.

**The 3D room read exactly two of them.**

A couple picked a chair colour and a floral colour, saw them persist, came back
to them later — and the room never changed. Nothing errored, nothing was
missing, nothing looked broken. Their work simply had no effect. Half of a
four-field editor was decoration.

### The fix

`Lab3DPalette` gains optional `chairs` and `florals`; `resolvePaletteFromRoles`
passes the overrides through; all three `<InstancedChairs>` mounts read
`palette.chairs ?? palette.wall`, and `bloomColor` reads
`palette.florals ?? mix(accent, white, 0.35)`.

### ⚠ The trap on the way past — wiring the obvious helper restyles every wedding

`resolveRoomDressing` looks like the thing to call, and it is not.

It does not only pass overrides through — it also **derives** a colour when the
couple set none, **from different slots than the scene renders**:

| surface | `resolveRoomDressing` derives | the room actually renders |
|---|---|---|
| chairs | `reception[2]` | `wall` — `reception[3]` |
| florals | raw `reception[0]` | `mix(accent, white, 0.35)` |

Calling it would have silently changed the chairs and deepened the blooms in
**every existing room**, while looking like a tidy consolidation. So the two new
fields are **optional and carry overrides only** — absent means "they set none",
and each consumer falls back to exactly what it rendered before. "No override
changes nothing" is structural, not a promise.

That divergence is now pinned by a test rather than left to be rediscovered.
Reconciling the two derivations changes how every room looks, so it is an owner
call; the test says which one to delete if that call is ever made.

### The guard, and the case sabotage caught

`lib/the-room-dressing-knobs-dress-the-room.test.ts` — 8 tests, both directions.

| Sabotage | Caught |
|---|---|
| revert to reading only linens + lighting (the original bug) | ✅ 2 tests |
| derive chairs when unset (the restyle-everyone trap) | ✅ — *see below* |
| swap the bloom fallback for the raw accent | ✅ |

🔑 **The second one passed the first version of this file.** "No `room_dressing`
at all" returns early, so it stays clean even when the code derives. The real
trap is a couple who set ONE knob: the object exists, the branch runs, and
`chairs: rd.chairs ?? …` hands them a colour nobody chose. A fixture with
`room_dressing: { linens }` and nothing else is what actually catches it — added
after the sabotage passed, and the reason it is in the file.

### Still open from the same audit

Two knobs remain inert and are **not** fixed here: the "Palette source" upload
writes `role_palette.wizard_default`, which `sanitizeRolePalette` drops and
nothing reads (verified again on main: written in `wizard-actions.ts`, read
nowhere); and the Bridesmaids/Groomsmen cards still show the pre-taxonomy-v2
`wedding_party` palette while the 3D resolves the split keys. Both are separate
changes with their own decisions.

Verified: typecheck ✅ · lint ✅ · 12,077 unit tests ✅ · all 29 CI guards ✅

SPEC IMPACT: None — no new field, no schema change; two existing columns are
read where they were already written.
