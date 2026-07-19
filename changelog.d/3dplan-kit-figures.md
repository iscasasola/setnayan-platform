# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-08 · feat(plan3d): articulated figure kit — rig math, outfits, hair, faces

Core of the shared "Sims-like" 3D figure kit for the 3D Plan surfaces (owner-locked
direction). New, not yet wired into any surface — the cylinder+sphere tokens in
`plan3d-scene.tsx` / the lab's `SeatedAvatar` are replaced in a later integration stage
that codes against `app/_components/plan3d/kit/index.ts`.

- `lib/figure-rig.ts` — PURE pose math (stand / walk-cycle / sit / idle-sway as plain
  `{ joint: radians }` records) + `resolveFigureLook` deterministic per-guest looks
  (6-tone Filipino skin ramp, 6 hairstyles, dark hair ramp, 3 face variants — stable
  id hash, same guest always looks the same). Unit-tested (`lib/figure-rig.test.ts`:
  determinism, gait antiphase symmetry, sit-pose sanity, sway envelopes, damp
  frame-rate independence).
- `app/_components/plan3d/kit/outfits.ts` — shared shell geometries at module scope
  (lab GOWN/SUIT proportions reused verbatim) + barong (near-white, procedural
  vertical-embroidery bump, slight sheen) + filipiniana (gown shell + butterfly
  sleeves) + keyed material caches.
- `kit/hair.ts` — 6 procedural hairstyles (crop / bun / ponytail / side-part /
  short-spike / long-fall) as 1–2 placed shared primitives each.
- `kit/face.ts` — 3 drawn face decal variants (CanvasTexture on a polar-capped sphere
  segment); selfies keep going through the EXISTING `GuestPhotoAvatar` refcounted
  texture cache (not re-implemented).
- `kit/figure.tsx` — the articulated rig (`pelvis → torso → head`, 2-segment arms +
  legs), pose blending frame-rate-independent via the shared `damp` pattern, reduced
  motion → static pose (flows still complete), `quality='low'` → baked pose with no
  per-frame joint updates. `SeatedFigure` / `WalkingFigure` wrappers.

SPEC IMPACT: None (rendering-only kit; no schema, no actions, no PII; guest surface
data stays name/seat/side).

## 2026-07-08 · feat(plan3d): demo scene renders kit figures

`plan3d-scene.tsx` (homepage 3D Plan demo + phone guest walk) swaps its
cylinder+sphere tokens for the articulated kit figures — integration slice 1
of the kit above. Public component API unchanged (`Plan3DSceneLoader`
consumers untouched).

- Seated guests: `GuestToken` now mounts a kit `<Figure pose="stand">` at the
  exact seat position the old token occupied (animated sit is slice 2), facing
  its table. Outfits derive from the existing `Plan3DGuest` fields only —
  bride side alternates gown/filipiniana, groom side suit/barong, 'both'
  cycles all four, deterministic by id hash (high bit window, decorrelated
  from the kit's look hash). Motif colours follow the lab's mood-board attire
  chain (wedding-party → bride for gowns, groom for suits) with a NULL
  fallthrough so the kit's default cloth dresses the un-themed demo.
- Click parity: QR-minting clicks land on an invisible hit cylinder
  (r 0.22 × 1.5 m) covering more than the old token's whole body+head volume;
  hover shows a faint status-coloured shell on that volume (the kit's shared
  materials can't take the old per-mesh emissive tint).
- Walker: now a `<Figure pose="walk">` phased by the SAME bobRef clock
  (~9 rad/s, frozen on arrival) — limbs swing while moving, freeze on arrival;
  the rig's pelvisY bob replaces the old group-level hop. Chase-cam anchors,
  roam, gold my-seat ring, shadows config all untouched.
- Quality: the seated crowd inherits the scene `quality` knob (phone walk =
  'low' → static baked poses); the single player figure always runs 'high'.
  Reduced motion: static poses, walker relocates without animation — every
  flow still completes.

SPEC IMPACT: None (pure rendering swap inside the existing demo surface).

## 2026-07-08 · feat(plan3d): lab renders kit figures with attire + selfies on movers

`seating-lab-3d.tsx` (the couple's flag-gated 3D seating editor) swaps its
whole avatar family to the articulated kit figures — integration slice 2.

- Seated guests: `SeatedAvatar` mounts a kit `<Figure pose="stand">` at the
  exact seat spot the old token occupied (idle stand-at-seat; animated sit is
  the next slice), rotated π so the rig faces the table. Outfit = the resolved
  `resolveGuestAttire` class with barong/filipiniana derived inside the
  suit/gown classes by id hash (code-only — no schema change); motif colour =
  the existing mood-board gownColor/suitColor chain; selfie heads ride the
  kit's shared GuestPhotoAvatar path; statusColor keeps the RSVP/side
  semantics. The "+1 reserved" ghost keeps the legacy translucent token.
- Walker / Crowd / MoverToken now CARRY the same per-guest spec as their
  seated figure (they were bare capsules) — the person who walks is the
  person who sits. Each reuses its existing motion clock as the gait phase
  (walker/mover t×9 rad/s; crowd (elapsed+i)×8, frozen on arrival); the old
  parent-group y-bobs are retired in favour of the rig's pelvis bob. The
  single walk-in eases walk→stand on arrival via the kit's damp blend.
- PERF heuristic (documented in TableMesh): seated figures drop to kit
  quality 'low' (static baked pose, no per-frame joint writes) when total
  guests > 60 (event-wide flag) OR their table is > 8 m from the camera
  (per-table check at ~4 Hz with ±0.75 m hysteresis so orbiting doesn't
  thrash state). Crowds > 60 agents also walk at 'low' (baked stride).
- Preserved exactly: selection rings, drag/rotate/delete raycast flow,
  single-editor lock, InstancedChairs, monogram medallion + bloom,
  walk-everyone-in timing, swap animations, reduced-motion completion,
  all HTML overlays. Verified in the dev preview against a 28-guest event
  (an entrance-pinch crowd scrum on that floor plan reproduces identically
  on the pre-change lab — pre-existing steering dynamics, not this slice).

SPEC IMPACT: None (pure rendering swap inside the existing lab surface).

## 2026-07-08 · fix(plan3d): figure-kit slice-1 review fixes — selfie heads, arrival stand, crowd perf

Adversarial-review pass over the three slices above (articulated Sims-like
figure kit: rig math + gown/suit/barong/filipiniana outfits + hair + faces +
selfie heads; demo scene + couple lab rendering kit figures; movers carrying
attire/selfies). Two majors + four cheap minors, all verified against the code:

- **Selfie heads were blanked by the skull (major)** — `kit/figure.tsx`
  mounted the transparent `GuestPhotoAvatar` billboard disc (r 0.13) OVER the
  always-rendered opaque head sphere (r 0.12), which won the depth test across
  essentially the whole disc: guests with a `photo_url` showed as a blank skin
  ball with a floating ring on every kit surface. The photo path now REPLACES
  the skull/face/hair (the pre-kit token treatment) — the disc, its status
  ring, and the initials fallback all render again.
- **Demo walker froze mid-stride on arrival (major)** — `plan3d-scene.tsx`'s
  Walker froze the gait clock at the seat but kept `pose="walk"`, holding an
  arbitrary scissored stride forever (worst in roam: every stop between floor
  taps). It now eases walk → 'stand' on arrival via the kit's ~⅓ s damp blend
  — the same `atSeat` treatment the lab Walker shipped with — resetting per
  walk state so each roam tap restarts the gait (this also unsticks the
  one-shot `onComplete` guard across consecutive scripted walks).
- **Crowd render cost (major, mitigated)** — quality `'low'` (the >60-guest
  crowd / phone-walk knob) previously only skipped joint writes. Now it also
  (a) stops casting shadows (~12 casters/figure out of the shadow depth pass)
  and (b) freezes local-matrix composition on the figure's ~26 nodes while
  statically baked (billboard subtree exempt — it must keep facing the
  camera), un-freezing the moment the figure animates. Instancing the shared
  limb/head/shell geometries remains the documented longer-term lever.
- **Per-frame GC churn (minor)** — `lib/figure-rig.ts`'s `walkCyclePose` /
  `overlayPose` / `idleSway` take an optional caller-owned `out` buffer
  (allocation-free hot path; API unchanged for existing callers) and
  `idleSway`'s per-id FNV phase offset is cached instead of re-hashing the id
  string every frame. `kit/figure.tsx` feeds reusable per-figure buffers.
- **Invisible hit cylinders cost a draw call each (minor)** — the demo's
  per-guest opacity-0 hit volume was a real alpha-blended draw with
  full-figure overdraw. It's now `visible={hovered}` (three's Raycaster never
  tests visibility, so QR-mint clicks + hover keep working) and doubles as
  the hover shell; the zero-opacity material is deleted.
- **Lab spec identity churn (minor)** — `seating-lab-3d.tsx` now memoises one
  `SeatToken`/`FigureSpec` per guest on the guest rows only (`tokenByGuest`),
  shared by seated figures, the walk-in, the crowd and swap movers; `Figure`
  is wrapped in `React.memo`, so walker/mover/crowd state changes no longer
  re-reconcile ~26 R3F elements for every seated figure.

SPEC IMPACT: 0008_seating_chart_editor/0008_3DPlan_Fable_Design_2026-07-08.md (slice 1 shipped)
