## 2026-07-09 · feat(plan3d): tap the dance floor to walk on and dance

Tapping the dance floor now sends the roaming/self character walking onto it and,
on arrival, playing a looping DANCE animation; tapping anywhere else walks them
off and the dance stops (walk → stand). Lives entirely in the shared 3D figure
kit + walk pieces, so it applies wherever a tap-steered self character exists.

**New dance clip (pure, unit-tested).** `dancePose(id, t, out?)` in
`lib/figure-rig.ts` is the `staffIdle`/`idleSway` pattern turned up: a pure
additive overlay in `(id, t)`, wall-clock time, per-id phase offset (reusing the
cached `idlePhaseOffset`), composed over `standPose`. Raised swaying arms, a
hip/torso sway, a ~1 Hz vertical bounce with a synced knee flex, and a head bob —
energetic but bounded (`|shoulder| ≤ 3.0`, everything else `≤ 1.6`, `|pelvisY| ≤
0.06`, knees flex-only and never past `−0.3`). 3 id-hashed style variants
(`sway` / `pump` / `raise-the-roof`) so a crowd never dances in unison beyond
phase. It is a SEPARATE export — deliberately NOT a `StaffIdleKind` — because it
bends knees + bounces, which the staff envelope forbids; it carries its own
knee/bounce-aware unit block. `t=0` is a stable held pose (a paused dancer) — the
reduced-motion / quality-'low' bake.

**Renderer.** `FigurePoseName` gains `'dance'` (`kit/figure.tsx`); the animated
path drives joints from `dancePose` each frame, the static-bake path holds the
`t=0` pose. The kit's generic preset blend eases walk↔dance exactly like
walk↔stand — no frozen stride on arrival or departure.

**Dance floor becomes walkable for the dance walk only.** `floorObstacles`
(`lib/seating-3d.ts`) gains an `opts.skipDanceFloor` flag — mirroring
`skipTableIds` for a seat-destined walk — that drops the dance-floor avoidance
disc so a dance-destined walk can steer onto (and stay on) the floor; ordinary
roam keeps the disc and rounds it. All existing callers are unchanged (the option
defaults off). New pure helpers `danceFloorRect` / `pointInZone` /
`clampPointToZone` give the tap hit-test + the on-floor clamp target the SAME rect
the mural draws.

**State machine (both self-walk surfaces).** On a floor tap whose point is inside
the dance-floor rect, both `plan3d-scene.tsx` (homepage demo / shared roam) and
`guest-venue-3d.tsx` (public guest walk) route a dance-destined walk with the
dance-skipped obstacle set to the tapped point (clamped a body-radius inside the
floor edge) and flag it dancing; on arrival the pose becomes the looping dance.
In `plan3d-scene` the flag rides the per-walk `WalkState.dance`; in `guest-venue`
it's a `danceTarget` React state. Any other destination — seat walk, booth
walk-to, a non-dance floor tap — clears dancing (fresh walk → `dance=false`), so
walking away stops the dance. The find-my-seat gold ring, seat walk, booth
walk-to and the per-frame obstacle clamp are all preserved. Reduced motion still
walks on and holds the static dance pose. `seating-lab-3d.tsx` is intentionally
OUT of scope: its "Walk around" is a first-person camera walker (no avatar body,
joystick-driven, no floor-tap-to-point) — nothing to dance and no tap to route
(flagged for owner sign-off if that surface ever wants it).

Unit tests: `dancePose` envelope sweep / determinism / de-sync across ids /
arms-raised / stable-held-t=0 / not-a-staff-kind (`figure-rig.test.ts`);
`skipDanceFloor` drops exactly the dance disc + `danceFloorRect`/`pointInZone`/
`clampPointToZone` hit-test (`seating-3d.test.ts`). `pnpm typecheck` +
`pnpm test:unit` (1256) + `pnpm lint` all green.

SPEC IMPACT: None. Iteration 0008 (Seating Chart Editor) / 0020 (interaction
prototype) — a new interaction on the existing shared 3D roam surfaces, no
locked-decision change and no schema touch.
