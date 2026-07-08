/**
 * figure-rig — PURE pose math + deterministic look resolution for the shared
 * 3D figure kit (`app/_components/plan3d/kit/`), the owner-locked "Sims-like"
 * direction for every seat-plan surface (proportioned stylized characters,
 * hair, simple faces, varied outfits — reference: Sims 4).
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
 *     Walker faces via `rotation.y = heading`). The renderer negates onto
 *     `rotation.x` because three's +X rotation swings a hanging limb backward.
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
    | 'uniform';
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

// Walk-cycle tuning. Amplitudes picked for a relaxed indoor stroll — big
// enough to read at seat-plan camera distances, small enough not to cartoon.
const HIP_SWING = 0.55; // rad — thigh forward/back
const KNEE_FLEX = 0.55; // rad — max swing-through knee bend
const ARM_SWING = 0.35; // rad — arms counter-swing the legs
const ELBOW_REST = 0.22; // rad — arms never hang piston-straight
const WALK_BOB_M = 0.035; // m — two bobs per stride (each footfall)

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
 * One walk-cycle sample at `phase` (radians — the demo Walker's existing
 * ~9 rad/s bob clock plugs straight in; one full stride per 2π). Left and
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
  o.torsoSway = 0;
  o.headYaw = 0;
  o.headPitch = 0;
  o.pelvisY = -0.01 + Math.abs(Math.sin(phase)) * WALK_BOB_M;
  o.torsoLean = 0.06 + Math.sin(phase * 2) * 0.015;
  o.leftHip = HIP_SWING * swing;
  o.rightHip = HIP_SWING * counter;
  o.leftKnee = -KNEE_FLEX * Math.max(0, Math.cos(phase));
  o.rightKnee = -KNEE_FLEX * Math.max(0, Math.cos(phase + Math.PI));
  // Arms oppose their legs (left arm forward with the RIGHT leg).
  o.leftShoulder = ARM_SWING * counter;
  o.rightShoulder = ARM_SWING * swing;
  o.leftElbow = ELBOW_REST + 0.16 * Math.max(0, counter);
  o.rightElbow = ELBOW_REST + 0.16 * Math.max(0, swing);
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

/** The 10 staff idle clips the booth catalog assigns. `bowDraw` ships now for
 *  the catalog's orchestra template (next PR) — built + tested with the set. */
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
