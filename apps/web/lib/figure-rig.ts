/**
 * figure-rig — PURE pose math for the shared 3D figure kit
 * (`app/_components/plan3d/kit/`), the owner-locked one-piece "blob" direction
 * for every seat-plan surface (a faceless, palette-tinted soft mannequin — no
 * neck, no feet, chunky fused limbs; reference: the Meccha one-piece white
 * character, 2026-07-09). `resolveFigureLook` + the SKIN/HAIR tables below are
 * DORMANT — the faceless blob consumes none of them; kept as pure, tested
 * look-resolution math for a possible future re-skin.
 *
 * NO three.js / React imports at runtime (type-only imports would be fine) —
 * same discipline as `lib/seating-3d.ts`, so every joint angle and every
 * deterministic-look rule can be unit-tested under `tsx --test` without a GPU
 * or a DOM. The renderer (`kit/figure.tsx`) consumes these records verbatim.
 *
 * WHY plain `{ joint: number }` records: the renderer applies a pose by
 * writing group rotations — keeping poses as data (not three.js Euler objects)
 * means presets can be composed (base pose + idle-sway overlay), blended
 * (pose-change transitions), and asserted in tests as plain numbers.
 *
 * Joint sign convention (load-bearing — the renderer depends on it):
 *   · Every rotation channel is RADIANS. Positive = the limb swings FORWARD
 *     (toward the figure's facing, local +Z — the same "forward" the demo
 *     Walker faces via `rotation.y = heading`). The renderer negates HANGING
 *     limbs onto `rotation.x` (three's +X rotation swings them backward);
 *     UP-pointing children — the torso and the head — apply UN-negated, or
 *     the same rotation would tip them the mirrored way (2026-07-09 fix:
 *     torsoLean used to be negated too, so every authored forward lean
 *     silently rendered backward — see figure-sit-bake's applyPose doc).
 *   · `torsoSway` is roll (lean left/right), `headYaw` turns the head.
 *   · `pelvisY` / `pelvisZ` are the ONLY translation channels (METRES, not
 *     radians) — sit needs "hips back + down" and walk needs a bob, and
 *     keeping them in the same record lets one applier pass cover the rig.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Spec + look
// ─────────────────────────────────────────────────────────────────────────────

/** What a figure IS — everything the renderer needs to dress + mark one guest.
 *  Superset of the guest attire vocabulary (`lib/guests.ts` resolveGuestAttire
 *  is 'gown' | 'suit' | 'neutral'); barong + filipiniana are the kit's
 *  Filipino-formalwear additions, mapped in by future call sites. */
export type FigureSpec = {
  /** Stable identity — the SAME id always resolves to the SAME look. */
  id: string;
  /** Guest formalwear plus the booth-kit STAFF variants (2026-07-08 booth
   *  chassis slice). Staff kinds reuse the suit / neutral shell profiles
   *  recoloured + detail-textured in kit/outfits.ts — append-only so every
   *  existing consumer keeps compiling. */
  outfit:
    | 'gown'
    | 'suit'
    | 'barong'
    | 'filipiniana'
    | 'neutral'
    | 'chef_whites'
    | 'apron'
    | 'vest'
    | 'uniform'
    | 'robe';
  /** Motif colour for the outfit shell (mood-board attire palette); null →
   *  the outfit's own default cloth colour. */
  outfitColor: string | null;
  /** Explicit overrides — when absent, resolveFigureLook derives them
   *  deterministically from `id` so a guest never changes appearance. */
  skinTone?: string;
  hairStyle?: number;
  hairColor?: string;
  /** Guest selfie (consent-gated upstream, `guests.photo_url` only) — when
   *  present the renderer billboards the EXISTING GuestPhotoAvatar disc as
   *  the face instead of a drawn face decal. */
  photoUrl?: string | null;
  /** RSVP/side status colour — rendered via the existing ring convention. */
  statusColor: string;
  /** Uniform scale (1 = adult). Kids/principal-sponsor variation later. */
  scale?: number;
};

/**
 * Six-tone Filipino-range skin ramp, light → deep morena. Deterministically
 * indexed by the id hash so a crowd reads varied without any stored field.
 */
export const SKIN_TONES: readonly string[] = [
  '#f2d6bc',
  '#e8c19e',
  '#d8a982',
  '#c08a5f',
  '#a06c46',
  '#7f5334',
];

/** Small dark-brown/black hair ramp (the realistic PH range for a stylized
 *  crowd — bright dyed colours can arrive later as explicit overrides). */
export const HAIR_COLORS: readonly string[] = [
  '#17110c',
  '#241a12',
  '#33241a',
  '#402c1e',
];

/** How many procedural hairstyles `kit/hair.ts` ships (indices 0..5). */
export const HAIR_STYLE_COUNT = 6;

/** How many drawn face variants `kit/face.ts` ships (indices 0..2). */
export const FACE_VARIANT_COUNT = 3;

export type FigureLook = {
  skinTone: string;
  /** 0..HAIR_STYLE_COUNT-1 — index into kit/hair.ts's style table. */
  hairStyle: number;
  hairColor: string;
  /** 0..FACE_VARIANT_COUNT-1 — index into kit/face.ts's decal variants.
   *  Always hash-derived (no explicit override field yet — nobody picks a
   *  smile; it just needs to be stable per guest). */
  faceVariant: number;
};

/**
 * FNV-1a 32-bit over the id string. Chosen over fancier hashes because it is
 * tiny, dependency-free, and — the actual requirement — STABLE: the same id
 * yields the same bits on every device, every session, forever. Different
 * look fields read different bit windows so they vary independently.
 */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Deterministic defaults from the figure's stable id: same id → same skin
 * tone / hairstyle / hair colour / face, forever (the crowd must not
 * re-shuffle between visits). Explicit spec fields always win; out-of-range
 * explicit hairStyle indices are wrapped, not thrown, so a stale stored value
 * can never crash a render.
 */
export function resolveFigureLook(
  spec: Pick<FigureSpec, 'id' | 'skinTone' | 'hairStyle' | 'hairColor'>,
): FigureLook {
  const h = hashId(spec.id);
  const style =
    spec.hairStyle != null && Number.isFinite(spec.hairStyle)
      ? Math.abs(Math.trunc(spec.hairStyle)) % HAIR_STYLE_COUNT
      : (h >>> 3) % HAIR_STYLE_COUNT;
  return {
    skinTone: spec.skinTone ?? SKIN_TONES[h % SKIN_TONES.length]!,
    hairStyle: style,
    hairColor: spec.hairColor ?? HAIR_COLORS[(h >>> 8) % HAIR_COLORS.length]!,
    faceVariant: (h >>> 13) % FACE_VARIANT_COUNT,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Joints + poses
// ─────────────────────────────────────────────────────────────────────────────

/** Every channel the rig understands. Order is stable (iterated by appliers). */
export const JOINTS = [
  // Translation channels — METRES (see the header note). Everything below is radians.
  'pelvisY',
  'pelvisZ',
  'torsoLean', // pitch: + = lean forward
  'torsoSway', // roll:  + = lean toward the figure's left
  'headYaw', //   + = look toward the figure's left
  'headPitch', // + = look down
  'leftShoulder', // + = arm swings forward
  'rightShoulder',
  'leftElbow', // + = forearm bends forward (flexion; never hyper-extends)
  'rightElbow',
  'leftHip', // + = thigh swings forward
  'rightHip',
  'leftKnee', // + would be forward; knees only flex, so values are ≤ 0
  'rightKnee',
] as const;

export type Joint = (typeof JOINTS)[number];
export type Pose = Record<Joint, number>;

/** All-zero pose — the T-neutral base every preset starts from. */
export const ZERO_POSE: Pose = Object.freeze(
  Object.fromEntries(JOINTS.map((j) => [j, 0])) as Pose,
);

/** Merge an overlay (e.g. idleSway) onto a base pose ADDITIVELY. Pure — the
 *  renderer composes `overlayPose(sitPose(), idleSway(id, t))` per frame.
 *  Pass `out` to write into a caller-owned buffer instead of allocating (the
 *  renderer runs this per figure per frame — see kit/figure.tsx's useFrame). */
export function overlayPose(base: Pose, overlay: Partial<Pose>, out?: Pose): Pose {
  const o = out ?? ({ ...base } as Pose);
  for (const j of JOINTS) {
    const v = overlay[j];
    o[j] = base[j] + (v ?? 0);
  }
  return o;
}

// Walk-cycle tuning — the "Meccha-style" cute/adorable gait (owner direction
// 2026-07-09: the white-mannequin game character's springy toy walk, NOT the
// old realistic stroll). The cuteness comes from FIVE levers, all named here so
// a live-tuning note ("more bounce / less waddle") maps to one number:
//   1. a real whole-body BOUNCE (WALK_BOB_M) — the biggest lever,
//   2. a side-to-side WADDLE rock toward the stance foot (WALK_WADDLE),
//   3. a high, peppy KNEE lift (KNEE_FLEX),
//   4. loose, happy ARM_SWING with a livelier elbow pump,
//   5. squash-&-stretch on the body (in kit/figure.tsx — synced to this bounce).
// Amplitudes stay big enough to read as toy-cute yet inside the unit-suite caps
// (|pelvisY| ≤ 0.06, knees ≤ 0, antiphase legs, arms counter-swing).
const HIP_SWING = 0.62; // rad — thigh forward/back (a touch bigger, eager stride)
const KNEE_FLEX = 0.72; // rad — high cute knee lift on the swing-through
const ARM_SWING = 0.52; // rad — big loose happy arm swing
const ELBOW_REST = 0.22; // rad — arms never hang piston-straight
const WALK_BOB_M = 0.06; // m — springy double-bounce (one per footfall); base −0.012 → apex +0.048, under the 0.06 cap
const WALK_WADDLE = 0.06; // rad (~3.4°) — side-to-side rock toward the planted foot

// Run-cycle tuning — the sprint flavour of the same toy gait (the
// ChameleonMovement prototype port, 2026-07-09). Everything the walk does,
// amplified — EXCEPT the waddle, which TIGHTENS as the body pitches forward
// and leans into the sprint (the prototype's runWaddleMult 0.6 < 1). Used by
// the fast movers (roam taps, the guest seat beeline, lab swap/dancer glides)
// whose 1.7–2.6 m/s translation foot-slides under the walk cycle.
const RUN_HIP_SWING = 0.85; // rad — frantic stride (the prototype's legSwing, verbatim)
const RUN_KNEE_FLEX = 0.95; // rad — knees pump high
const RUN_ARM_SWING = 0.8; // rad — arms driving
const RUN_ELBOW_REST = 0.5; // rad — arms carried bent while running, never hanging
const RUN_BOB_M = 0.095; // m — base −0.015 → apex +0.08, under the run suite's 0.1 cap
const RUN_WADDLE = 0.04; // rad — tighter than the walk's 0.06 (leans in, doesn't rock)
const RUN_LEAN = 0.22; // rad (~13°) — body pitches forward for momentum

// Gait clocks (rad/s of wall-clock) — single-sourced here so every surface
// steps at the same cadence and a stride length stays speed ÷ (clock/2π).
// Callers advance their phase ref by `delta * <clock>` while translating and
// freeze it on arrival (the shared freeze-on-arrival convention).
export const WALK_CLOCK_RAD_S = 11; // the Meccha-cute quick steps (2026-07-09)
export const RUN_CLOCK_RAD_S = 16; // scurry — 2.2 m/s ÷ (16/2π) ≈ 0.86 m strides

/** Relaxed standing: arms hang with a natural elbow soft-bend, the barest
 *  forward settle in the torso. The base under idleSway. */
export function standPose(): Pose {
  return {
    ...ZERO_POSE,
    torsoLean: 0.02,
    leftElbow: ELBOW_REST * 0.6,
    rightElbow: ELBOW_REST * 0.6,
  };
}

/**
 * One walk-cycle sample at `phase` (radians — advance the caller's clock by
 * `WALK_CLOCK_RAD_S` while translating; one full stride per 2π). Left and
 * right limbs run in antiphase (sin(phase) vs sin(phase + π)) and arms
 * counter-swing their legs — the two symmetries the unit suite locks down.
 * Knees flex on the swing-through (a cos lobe leading the hip by 90°), and
 * `pelvisY` carries the subtle double-bob (one dip per footfall), so a
 * renderer gets the whole gait from this single record.
 */
export function walkCyclePose(phase: number, out?: Pose): Pose {
  const swing = Math.sin(phase);
  const counter = Math.sin(phase + Math.PI); // ≡ -swing; spelled out for intent
  // `out` lets the per-frame renderer reuse one buffer instead of allocating
  // a fresh 15-key record per figure per frame (kit/figure.tsx's useFrame).
  const o = out ?? ({ ...ZERO_POSE } as Pose);
  o.pelvisZ = 0;
  o.headYaw = 0;
  // Springy double-bounce: one dip per footfall (|sin| → two lifts per stride),
  // the toy-walk's signature. Apex +0.048 m sits just under the 0.06 cap.
  o.pelvisY = -0.012 + Math.abs(Math.sin(phase)) * WALK_BOB_M;
  // Waddle: rock toward the PLANTED foot. When the left thigh swings forward
  // (swing > 0) the RIGHT foot is planted → the body leans right (torsoSway < 0,
  // since + leans toward the figure's left). One rock per step.
  o.torsoSway = -WALK_WADDLE * swing;
  // A happy little head bob rides the bounce (nose dips a hair at each apex).
  o.headPitch = 0.04 * Math.abs(Math.sin(phase));
  o.torsoLean = 0.05 + Math.sin(phase * 2) * 0.015;
  o.leftHip = HIP_SWING * swing;
  o.rightHip = HIP_SWING * counter;
  o.leftKnee = -KNEE_FLEX * Math.max(0, Math.cos(phase));
  o.rightKnee = -KNEE_FLEX * Math.max(0, Math.cos(phase + Math.PI));
  // Arms oppose their legs (left arm forward with the RIGHT leg) — bigger, looser
  // swing with a livelier elbow pump so they read as gleeful, not marching.
  o.leftShoulder = ARM_SWING * counter;
  o.rightShoulder = ARM_SWING * swing;
  o.leftElbow = ELBOW_REST + 0.22 * Math.max(0, counter);
  o.rightElbow = ELBOW_REST + 0.22 * Math.max(0, swing);
  return o;
}

/**
 * One run-cycle sample at `phase` — same skeleton math as walkCyclePose (the
 * two symmetries hold: antiphase legs, arms counter-swing), amplified into the
 * frantic sprint of the ChameleonMovement prototype: higher bounce, forward
 * torso pitch (RUN_LEAN) for momentum, knees pumping, arms carried bent and
 * driving, waddle TIGHTER than the walk. Callers advance phase by
 * `RUN_CLOCK_RAD_S` (not the walk clock) so the quicker cadence matches the
 * faster translation — that pairing is what kills the foot-slide on the
 * 1.7–2.6 m/s movers.
 */
export function runCyclePose(phase: number, out?: Pose): Pose {
  const swing = Math.sin(phase);
  const counter = Math.sin(phase + Math.PI); // ≡ -swing; spelled out for intent
  const o = out ?? ({ ...ZERO_POSE } as Pose);
  o.pelvisZ = 0;
  o.headYaw = 0;
  // Bigger springy double-bounce than the walk: apex +0.08 m.
  o.pelvisY = -0.015 + Math.abs(Math.sin(phase)) * RUN_BOB_M;
  // The sprint rocks LESS than the walk — the body is busy leaning forward.
  o.torsoSway = -RUN_WADDLE * swing;
  // Chin rides the bounce a touch harder than the walk (effort reads cute).
  o.headPitch = 0.05 * Math.abs(Math.sin(phase));
  // Forward pitch for momentum + the double-frequency jelly wobble on top.
  o.torsoLean = RUN_LEAN + Math.sin(phase * 2) * 0.025;
  o.leftHip = RUN_HIP_SWING * swing;
  o.rightHip = RUN_HIP_SWING * counter;
  o.leftKnee = -RUN_KNEE_FLEX * Math.max(0, Math.cos(phase));
  o.rightKnee = -RUN_KNEE_FLEX * Math.max(0, Math.cos(phase + Math.PI));
  // Arms oppose their legs, carried bent and pumping (never hanging).
  o.leftShoulder = RUN_ARM_SWING * counter;
  o.rightShoulder = RUN_ARM_SWING * swing;
  o.leftElbow = RUN_ELBOW_REST + 0.28 * Math.max(0, counter);
  o.rightElbow = RUN_ELBOW_REST + 0.28 * Math.max(0, swing);
  return o;
}

// ─────────────────────────────────────────────────────────────────────────────
// Jelly squash-&-stretch
// ─────────────────────────────────────────────────────────────────────────────

export type JellyScale = { y: number; xz: number };

/**
 * Impact-weighted squash-&-stretch for the gait bounce (the ChameleonMovement
 * prototype's jelly feel): the body squashes WIDE + SHORT at each footfall
 * (`impact = 1 − |sin|`, strongest exactly when pelvisY dips) and stretches
 * tall toward the bounce apex. Asymmetric on purpose — `squash` > `stretch`
 * reads as weight landing, where the old symmetric ±k read as breathing.
 * X/Z counter-scale at 0.6 of the Y deviation keeps the volume roughly
 * conserved (the toy is jelly, not a balloon).
 *
 * PURE — the renderer (kit/figure.tsx) applies the result to the torso group
 * scale, eased by its own pose-blend gate; `out` avoids per-frame allocation.
 */
export function jellySquash(phase: number, squash: number, stretch: number, out?: JellyScale): JellyScale {
  const up = Math.abs(Math.sin(phase)); // 0 at footfall → 1 at the bounce apex
  const impact = 1 - up;
  const o = out ?? { y: 1, xz: 1 };
  o.y = 1 + up * stretch - impact * squash;
  o.xz = 1 - up * stretch * 0.6 + impact * squash * 0.6;
  return o;
}

/**
 * Seated on a 0.46 m chair: hips drop + slide back, thighs fold to (near)
 * horizontal, shins hang vertical (knee flexed the thigh's full fold), a
 * slight social forward lean, hands settling toward the lap. The −0.30 m
 * drop lands the renderer's 0.80 m standing hip pivot at ≈0.50 m — just
 * above the product-true 0.46 m chair seat (kit/figure.tsx assumes exactly
 * this pairing; change the two together).
 */
export function sitPose(): Pose {
  const fold = 1.42; // just shy of π/2 — a fully square 90° reads robotic
  return {
    ...ZERO_POSE,
    pelvisY: -0.3,
    pelvisZ: -0.06,
    torsoLean: 0.1,
    leftHip: fold,
    rightHip: fold,
    leftKnee: -fold,
    rightKnee: -fold,
    leftShoulder: 0.18,
    rightShoulder: 0.18,
    leftElbow: 0.55,
    rightElbow: 0.55,
  };
}

// Idle-sway tuning: ±1.5° torso roll; head turns are rare-but-smooth (a
// sin⁵ lobe spends most of its time near zero and swells occasionally).
const SWAY_MAX = (1.5 * Math.PI) / 180;
const HEAD_TURN_MAX = 0.42; // rad, ~24° at the swell's peak
const SWAY_HZ = 0.6; // rad/s — a slow breathe
const HEAD_HZ = 0.23; // rad/s — head lobes swell every ~27 s

/**
 * Per-figure idle life: a gentle ±1.5° torso sway plus an OCCASIONAL smooth
 * head turn, phase-offset per id so a seated crowd never metronomes in
 * unison. Returns an additive overlay (compose via `overlayPose`). Bounded
 * for all t — the unit suite asserts the envelopes. Pure in (id, t), so
 * reduced-motion renderers simply never advance t.
 */
export function idleSway(id: string, t: number, out?: Partial<Pose>): Partial<Pose> {
  const off = idlePhaseOffset(id);
  const s = Math.sin(t * HEAD_HZ + off * 1.7);
  const o = out ?? {};
  o.torsoSway = SWAY_MAX * Math.sin(t * SWAY_HZ + off);
  // s⁵ keeps the sign but flattens small values → long stillness, brief turns.
  o.headYaw = HEAD_TURN_MAX * s * s * s * s * s;
  return o;
}

// idleSway runs per animated figure per FRAME, but its phase offset is a pure
// per-id constant — cache it so the hot loop doesn't re-hash the id string
// 60×/s. Bounded by the number of distinct figure ids seen on the page (a
// wedding guest list), so the map just lives for the session.
const idleOffsets = new Map<string, number>();
function idlePhaseOffset(id: string): number {
  let off = idleOffsets.get(id);
  if (off === undefined) {
    off = ((hashId(id) % 1000) / 1000) * Math.PI * 2;
    idleOffsets.set(id, off);
  }
  return off;
}

// ─────────────────────────────────────────────────────────────────────────────
// Staff idle clips (booth-template kit · 2026-07-08)
// ─────────────────────────────────────────────────────────────────────────────
//
// Tiny per-category 2-key loops for booth STAFF mascots — the idleSway pattern
// scaled up: each clip is a pure additive overlay in (kind, id, t), WALL-CLOCK
// time-based (t = elapsed seconds; never frame counts — the arrival-fix
// lesson), phase-offset per id so two neighbouring booths never metronome.
// A clip = a HELD pose (arms where the job puts them) + one small periodic
// motion on top; the renderer composes it over standPose exactly like
// idleSway. All channels stay inside the envelopes the unit suite asserts
// (|shoulder| ≤ 3.0 rad — a raised wave; everything else ≤ 1.6 rad).

/** The staff idle clips the booth catalog assigns. The first 10 shipped with
 *  the chassis slice (`bowDraw` pre-built for orchestra); the 11 below the
 *  marker land with the catalog-completion PR — every one of the remaining 37
 *  templates maps onto this set (fine handwork shares `strokeWork`, fitters
 *  share `measure`, etc. — reusable verbs, not 37 bespoke clips). */
export const STAFF_IDLE_KINDS = [
  'pipingSwirl', // pastry chef — piping a cake, wrist circles
  'shake', //       bartender / live station — two-hand rhythmic shake
  'tamp', //        barista / console op — pressing down in a beat
  'bowDraw', //     violinist — bow arm draws while the neck arm holds
  'headBob', //     band / DJ / singer — grooving to the set
  'cardFlip', //    MC / coordinator — flipping cue cards / clipboard pages
  'brushDab', //    MUA — small quick brush dabs at face height
  'wave', //        greeter — arm up, friendly hand waggle
  'snap', //        photographer / florist — raise-and-click (shutter / snips)
  'present', //     server / chef — an open palm-out presenting sweep
  // ── catalog completion (2026-07-08 · the 37-template PR) ──
  'typing', //      digital services — forearms at desk height, key patter
  'pourArc', //     mocktail mixologist — high tilting pour over a held glass
  'stretch', //     wellness trainer — slow overhead reach and settle
  'ribbonSwirl', // performer — raised arm circling the ribbon
  'countBeat', //   choreographer — the 5-6-7-8 count, arm beating time
  'swaySing', //    choir — hands folded at the chest, deep song sway
  'strokeWork', //  henna / nails / caricature / engraving — fine hand strokes
  'polishWipe', //  trophies / grooming — small circular buffing wipe
  'measure', //     tailors + fitters — tape pulled apart and re-gathered
  'boxPass', //     crew meals — two-hand crate carry swinging side to side
  'thumbsUp', //    pyrotech — held thumbs-up with a happy cheer bounce
] as const;

export type StaffIdleKind = (typeof STAFF_IDLE_KINDS)[number];

// Shared clip tuning. Motions stay small (mascots at booth distance) and every
// frequency is in rad/s of WALL-CLOCK time.
const CLIP_SWAY = SWAY_MAX; // staff keep the same breathing torso as guests

/** A smooth 0..1 pulse that spends most of its cycle near 0 and swells once
 *  per `period` seconds — the "occasionally do the thing" shape (cardFlip's
 *  flip, snap's click) without a keyframe table. Pure in (t, period, off). */
function pulse(t: number, period: number, off: number): number {
  const s = Math.max(0, Math.sin(((t + off) / period) * Math.PI * 2));
  return s * s * s; // sharpen: brief action, long hold
}

/**
 * One staff idle sample at wall-clock `t` (seconds) for a clip kind — an
 * additive overlay over standPose, exactly like idleSway (compose via
 * `overlayPose(standPose(), staffIdle(kind, id, t))`). Deterministic in
 * (kind, id, t); per-id phase offsets reuse idleSway's cached hash. Pass
 * `out` to reuse a caller-owned buffer in per-frame loops.
 */
export function staffIdle(
  kind: StaffIdleKind,
  id: string,
  t: number,
  out?: Partial<Pose>,
): Partial<Pose> {
  const off = idlePhaseOffset(id);
  const o = out ?? {};
  // Reset every channel a previous buffer reuse may have written — clips set
  // different channel subsets, so a stale value from another kind must not
  // leak through (the buffer-reuse contract idleSway never needed).
  o.pelvisY = 0;
  o.pelvisZ = 0;
  o.torsoLean = 0;
  o.headPitch = 0;
  o.leftShoulder = 0;
  o.rightShoulder = 0;
  o.leftElbow = 0;
  o.rightElbow = 0;
  o.leftHip = 0;
  o.rightHip = 0;
  o.leftKnee = 0;
  o.rightKnee = 0;
  // Every clip keeps the guests' gentle breathing sway underneath its action.
  o.torsoSway = CLIP_SWAY * Math.sin(t * SWAY_HZ + off);
  o.headYaw = 0;
  switch (kind) {
    case 'pipingSwirl': {
      // Right arm piping at counter height, wrist circling; eyes on the cake.
      o.rightShoulder = 0.85 + 0.07 * Math.sin(t * 4.2 + off);
      o.rightElbow = 1.15 + 0.07 * Math.cos(t * 4.2 + off);
      o.leftShoulder = 0.5;
      o.leftElbow = 1.0;
      o.headPitch = 0.22;
      break;
    }
    case 'shake': {
      // Both hands up on the shaker, a brisk two-beat vertical shake.
      const beat = Math.sin(t * 7 + off);
      o.leftShoulder = 0.7 + 0.12 * beat;
      o.rightShoulder = 0.7 + 0.12 * beat;
      o.leftElbow = 1.3 + 0.1 * beat;
      o.rightElbow = 1.3 + 0.1 * beat;
      o.torsoSway = (o.torsoSway ?? 0) + 0.02 * Math.sin(t * 3.5 + off);
      break;
    }
    case 'tamp': {
      // Right arm pressing down in a steady beat (tamper / cue button).
      const press = Math.max(0, Math.sin(t * 3.2 + off));
      o.rightShoulder = 0.55 + 0.18 * press;
      o.rightElbow = 1.05 - 0.25 * press;
      o.leftShoulder = 0.45;
      o.leftElbow = 1.1;
      o.headPitch = 0.18;
      break;
    }
    case 'bowDraw': {
      // Neck arm (left) holds high + still; bow arm (right) draws long
      // smooth strokes — elbow extends and folds while the shoulder rides.
      const draw = Math.sin(t * 2.2 + off);
      o.leftShoulder = 0.95;
      o.leftElbow = 1.35;
      o.rightShoulder = 0.7 + 0.1 * draw;
      o.rightElbow = 0.65 + 0.3 * draw;
      o.headYaw = (o.headYaw ?? 0) - 0.12; // cheek toward the violin
      o.headPitch = 0.1;
      break;
    }
    case 'headBob': {
      // The groove: head + torso ride the beat, arms keep a low bounce.
      const beat = Math.sin(t * 5.5 + off);
      o.headPitch = 0.1 + 0.09 * beat;
      o.torsoSway = (o.torsoSway ?? 0) + 0.035 * Math.sin(t * 2.75 + off);
      o.leftShoulder = 0.25 + 0.06 * beat;
      o.rightShoulder = 0.25 - 0.06 * beat;
      o.leftElbow = 0.9;
      o.rightElbow = 0.9;
      o.pelvisY = -0.008 + 0.008 * Math.sin(t * 5.5 + off);
      break;
    }
    case 'cardFlip': {
      // Left hand holds the cards/clipboard; the right flips a page every
      // few seconds (a pulse), eyes down between flips.
      const flip = pulse(t, 3.4, off);
      o.leftShoulder = 0.6;
      o.leftElbow = 1.25;
      o.rightShoulder = 0.35 + 0.3 * flip;
      o.rightElbow = 0.55 + 0.55 * flip;
      o.headPitch = 0.24 - 0.12 * flip; // glance up as the card turns
      break;
    }
    case 'brushDab': {
      // Brush arm at face height, small quick dabs; head tilts toward work.
      o.rightShoulder = 0.9;
      o.rightElbow = 0.95 + 0.09 * Math.sin(t * 6 + off);
      o.leftShoulder = 0.55;
      o.leftElbow = 1.15;
      o.headYaw = (o.headYaw ?? 0) + 0.14;
      o.headPitch = 0.08;
      break;
    }
    case 'wave': {
      // Arm straight up (shoulder ≈ π forward-over), hand waggling — the
      // elbow oscillation reads as the wave at booth distance.
      o.rightShoulder = 2.75;
      o.rightElbow = 0.35 + 0.25 * Math.sin(t * 4.5 + off);
      o.leftShoulder = 0.15;
      o.leftElbow = 0.5;
      o.headPitch = -0.06; // chin up, friendly
      break;
    }
    case 'snap': {
      // Hands raised to the face (camera / snips), a click-pulse every
      // couple of seconds.
      const click = pulse(t, 2.6, off);
      o.leftShoulder = 1.15;
      o.rightShoulder = 1.2 + 0.12 * click;
      o.leftElbow = 1.5;
      o.rightElbow = 1.45 - 0.2 * click;
      o.headPitch = 0.12;
      break;
    }
    case 'present': {
      // The open-palm presenting sweep — right arm out, slowly arcing across
      // the wares; the head follows the hand.
      const sweep = Math.sin(t * 1.2 + off);
      o.rightShoulder = 0.95 + 0.15 * sweep;
      o.rightElbow = 0.35;
      o.leftShoulder = 0.3;
      o.leftElbow = 0.9;
      o.headYaw = (o.headYaw ?? 0) + 0.18 * sweep;
      o.torsoLean = 0.05;
      break;
    }
    case 'typing': {
      // Both forearms up at desk height, a quick alternating key patter;
      // eyes on the screen.
      const patter = Math.sin(t * 8 + off);
      o.leftShoulder = 0.45;
      o.rightShoulder = 0.45;
      o.leftElbow = 1.2 + 0.05 * patter;
      o.rightElbow = 1.2 - 0.05 * patter;
      o.headPitch = 0.22;
      break;
    }
    case 'pourArc': {
      // The mixologist's high pour: right arm rides a slow tilt arc while the
      // left steadies the glass below.
      const arc = Math.sin(t * 1.8 + off);
      o.rightShoulder = 1.35 + 0.12 * arc;
      o.rightElbow = 0.5 + 0.18 * arc;
      o.leftShoulder = 0.65;
      o.leftElbow = 1.15;
      o.headPitch = 0.14;
      o.torsoLean = 0.04;
      break;
    }
    case 'stretch': {
      // Slow overhead reach and settle — both arms near-straight, chin
      // lifting with the reach.
      const reach = 0.5 + 0.5 * Math.sin(t * 0.9 + off);
      o.leftShoulder = 1.9 + 0.7 * reach;
      o.rightShoulder = 1.9 + 0.7 * reach;
      o.leftElbow = 0.15;
      o.rightElbow = 0.15;
      o.torsoLean = -0.04 * reach;
      o.headPitch = -0.1 * reach;
      break;
    }
    case 'ribbonSwirl': {
      // Performing arm raised overhead circling the ribbon; the torso rides
      // a gentle extra sway underneath.
      o.rightShoulder = 2.1 + 0.25 * Math.sin(t * 3 + off);
      o.rightElbow = 0.4 + 0.3 * Math.cos(t * 3 + off);
      o.leftShoulder = 0.3;
      o.leftElbow = 0.7;
      o.torsoSway = (o.torsoSway ?? 0) + 0.03 * Math.sin(t * 1.5 + off);
      o.headPitch = -0.06;
      break;
    }
    case 'countBeat': {
      // The 5-6-7-8: the counting arm beats time in crisp pulses while the
      // other hand sits on the hip; the head nods each beat.
      const beat = pulse(t, 1.6, off);
      o.rightShoulder = 0.85 + 0.35 * beat;
      o.rightElbow = 0.6 + 0.25 * beat;
      o.leftShoulder = 0.3;
      o.leftElbow = 1.25;
      o.headPitch = 0.05 + 0.08 * beat;
      break;
    }
    case 'swaySing': {
      // Choir: hands folded at the chest, a deeper-than-breathing song sway,
      // chin lifted, head riding the same slow curve.
      o.leftShoulder = 0.55;
      o.rightShoulder = 0.55;
      o.leftElbow = 1.35;
      o.rightElbow = 1.35;
      o.torsoSway = (o.torsoSway ?? 0) + 0.05 * Math.sin(t * 1.4 + off);
      o.headYaw = (o.headYaw ?? 0) + 0.1 * Math.sin(t * 1.4 + off);
      o.headPitch = -0.05;
      break;
    }
    case 'strokeWork': {
      // Fine handwork (henna / nail polish / pen / stitch): leaning over the
      // work, eyes down, the working hand tracing small quick strokes.
      o.torsoLean = 0.16;
      o.headPitch = 0.3;
      o.rightShoulder = 0.75 + 0.05 * Math.sin(t * 5.5 + off);
      o.rightElbow = 1.0 + 0.08 * Math.sin(t * 5.5 + off + 0.8);
      o.leftShoulder = 0.6;
      o.leftElbow = 1.05;
      break;
    }
    case 'polishWipe': {
      // Small circular buffing wipe at chest height — shoulder + elbow trace
      // a 90°-offset circle; the left hand holds the piece.
      o.rightShoulder = 0.8 + 0.09 * Math.sin(t * 4.6 + off);
      o.rightElbow = 0.9 + 0.09 * Math.cos(t * 4.6 + off);
      o.leftShoulder = 0.7;
      o.leftElbow = 1.1;
      o.headPitch = 0.18;
      break;
    }
    case 'measure': {
      // The tape measure: both hands pull apart (elbows unfold) and gather
      // back in phase — the fitter's read at booth distance.
      const pull = 0.5 + 0.5 * Math.sin(t * 1.6 + off);
      o.leftShoulder = 0.7;
      o.rightShoulder = 0.7;
      o.leftElbow = 0.35 + 0.75 * pull;
      o.rightElbow = 0.35 + 0.75 * pull;
      o.headPitch = 0.16;
      break;
    }
    case 'boxPass': {
      // Two-hand crate carry swinging side to side down the pass line; the
      // head leads the swing.
      const swing = Math.sin(t * 2 + off);
      o.leftShoulder = 0.6;
      o.rightShoulder = 0.6;
      o.leftElbow = 1.15;
      o.rightElbow = 1.15;
      o.torsoSway = (o.torsoSway ?? 0) + 0.045 * swing;
      o.headYaw = (o.headYaw ?? 0) + 0.16 * swing;
      o.pelvisY = -0.006 + 0.006 * Math.sin(t * 4 + off);
      break;
    }
    case 'thumbsUp': {
      // Pyrotech's held thumbs-up: arm parked high, a happy cheer-pulse
      // punches it a little higher every few seconds. Chin up, proud.
      const cheer = pulse(t, 2.8, off);
      o.rightShoulder = 1.5 + 0.2 * cheer;
      o.rightElbow = 0.85 - 0.15 * cheer;
      o.leftShoulder = 0.2;
      o.leftElbow = 0.55;
      o.headPitch = -0.08;
      break;
    }
  }
  return o;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dance clip (tap-the-dance-floor · looping)
// ─────────────────────────────────────────────────────────────────────────────
//
// A DANCE is the staffIdle pattern turned up: a pure additive overlay in
// (id, t), WALL-CLOCK time-based, phase-offset per id (the same cached
// idlePhaseOffset), composed over standPose exactly like idleSway/staffIdle.
// The one thing every staff clip is forbidden — bending knees + bouncing the
// pelvis — is the whole point here, so dancePose is a SEPARATE export with its
// OWN (knee-aware, bounce-aware) unit envelope; it is NOT a StaffIdleKind and
// must never be registered in STAFF_IDLE_KINDS (the staff suite asserts knees
// < 1e-9 for every kind, which a dance would fail).
//
// Envelope (its own test block asserts it): |shoulder| ≤ 3.0 (raised arms) ·
// elbow/head*/torso* ≤ 1.6 · |pelvisY| ≤ 0.06 (a few-cm bounce) · knees flex
// only (≤ 0) and never hyperflex (≥ −0.3). Energetic but tasteful, and every
// channel stays well inside those bounds for all t.

/** Beat clock rate (rad/s of wall-clock time). ~0.54 Hz primary sway, with the
 *  2b harmonic giving a ~1.08 Hz bounce/head-bob. */
const DANCE_HZ = 3.4;

/**
 * One dance sample at wall-clock `t` (seconds) for a figure id — an additive
 * overlay over standPose (compose via `overlayPose(standPose(), dancePose(id,
 * t))`), same convention as idleSway/staffIdle. Deterministic in (id, t);
 * per-id phase offset reuses idleSway's cached hash so a small crowd never
 * dances in unison. 2–3 id-hashed style variants keep neighbours distinct
 * beyond phase alone. Pass `out` to reuse a caller-owned buffer in the
 * per-frame render loop. Every channel stays inside the dance envelope for all
 * t (the unit suite asserts it); at t=0 it yields a stable, off-asymmetric
 * held pose — a paused dancer, the reduced-motion / quality-'low' bake.
 */
export function dancePose(id: string, t: number, out?: Partial<Pose>): Partial<Pose> {
  const off = idlePhaseOffset(id);
  const b = t * DANCE_HZ + off;
  const sb = Math.sin(b);
  const s2 = Math.sin(2 * b);
  const bounce = Math.abs(sb); // 0 at the low point, 1 at the top of the bounce
  // Knee flex synced to the DOWN-beat: fully bent (−) when 2b crosses so the
  // bounce reads as a spring, straight at the top. (0.5 − 0.5·sin2b) ∈ [0, 1].
  const kneeCurve = 0.5 - 0.5 * s2;
  const o = out ?? {};
  // Buffer-reuse contract (a reused buffer may carry another clip's channels —
  // reset every one before writing this clip's subset), same as staffIdle.
  o.pelvisY = 0;
  o.pelvisZ = 0;
  o.torsoLean = 0;
  o.torsoSway = 0;
  o.headYaw = 0;
  o.headPitch = 0;
  o.leftShoulder = 0;
  o.rightShoulder = 0;
  o.leftElbow = 0;
  o.rightElbow = 0;
  o.leftHip = 0;
  o.rightHip = 0;
  o.leftKnee = 0;
  o.rightKnee = 0;

  // Fresh bit-window off the id hash (independent of look / idlePhaseOffset) so
  // two ids don't just share one silhouette shifted in phase. Only the single
  // self figure dances per surface, so re-hashing per frame is negligible.
  const v = (hashId(id) >> 5) % 3;
  switch (v) {
    case 1: {
      // "pump" — arms lower and driving, a stronger bounce, deeper head bob.
      o.pelvisY = -0.01 + 0.04 * bounce; //           [-0.01, +0.03]
      o.torsoSway = 0.14 * sb; //                     ±0.14
      o.torsoLean = 0.05 + 0.03 * s2; //              [0.02, 0.08]
      o.headPitch = 0.09 + 0.08 * s2; //              [0.01, 0.17]
      o.headYaw = 0.08 * sb; //                       ±0.08
      o.leftShoulder = 1.2 + 0.4 * sb; //             [0.8, 1.6]
      o.rightShoulder = 1.2 - 0.4 * sb; //            [0.8, 1.6] (anti-phase)
      o.leftElbow = 1.3 + 0.2 * sb; //                [1.1, 1.5]
      o.rightElbow = 1.3 - 0.2 * sb; //               [1.1, 1.5]
      o.leftKnee = -0.14 * kneeCurve; //              [-0.14, 0]
      o.rightKnee = -0.14 * kneeCurve;
      break;
    }
    case 2: {
      // "raise-the-roof" — both arms punch UP together on the beat, calmer hips.
      const raise = Math.max(0, s2); //               [0, 1] on the up-beat
      o.pelvisY = -0.01 + 0.03 * bounce; //           [-0.01, +0.02]
      o.torsoSway = 0.1 * sb; //                      ±0.10
      o.torsoLean = 0.05 + 0.03 * s2; //              [0.02, 0.08]
      o.headPitch = 0.05 + 0.05 * s2; //              [0, 0.10]
      o.headYaw = 0.06 * sb; //                       ±0.06
      o.leftShoulder = 2.0 + 0.4 * raise; //          [2.0, 2.4] (both together)
      o.rightShoulder = 2.0 + 0.4 * raise; //         [2.0, 2.4]
      o.leftElbow = 0.9; //                           held bent
      o.rightElbow = 0.9;
      o.leftKnee = -0.1 * kneeCurve; //               [-0.10, 0]
      o.rightKnee = -0.1 * kneeCurve;
      break;
    }
    default: {
      // v0 "sway" — raised arms alternately pumping, hips/torso swaying.
      o.pelvisY = -0.01 + 0.035 * bounce; //          [-0.01, +0.025]
      o.torsoSway = 0.18 * sb; //                     ±0.18
      o.torsoLean = 0.05 + 0.03 * s2; //              [0.02, 0.08]
      o.headPitch = 0.06 + 0.06 * s2; //              [0, 0.12]
      o.headYaw = 0.1 * sb; //                        ±0.10
      o.leftShoulder = 1.7 + 0.5 * sb; //             [1.2, 2.2]
      o.rightShoulder = 1.7 - 0.5 * sb; //            [1.2, 2.2] (anti-phase)
      o.leftElbow = 1.1 + 0.25 * sb; //               [0.85, 1.35]
      o.rightElbow = 1.1 - 0.25 * sb; //              [0.85, 1.35]
      o.leftKnee = -0.12 * kneeCurve; //              [-0.12, 0]
      o.rightKnee = -0.12 * kneeCurve;
      break;
    }
  }
  return o;
}

/**
 * Frame-rate-independent damping factor — the SAME `damp(base, delta)`
 * pattern the demo Walker uses (plan3d-scene.tsx): the fraction to move
 * toward a target this frame so an ease reads identically at 30 or 120 fps.
 * `base` = fraction of distance REMAINING after one second. Re-exported here
 * (pure math) so the figure renderer and future kit consumers share one
 * definition instead of each re-deriving it.
 */
export function damp(base: number, delta: number): number {
  return 1 - Math.pow(base, delta);
}
