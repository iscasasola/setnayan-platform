/**
 * emote-schedule — PURE wall-clock rotation policy for the 3D emote bubbles
 * (Fable dossier §3.6). The kit's `plan3d/kit/emotes.tsx` owns the sprites +
 * the CanvasTexture glyph atlas; this module owns WHICH bubble shows WHERE and
 * WHEN, as pure functions of wall-clock time — unit-testable under the repo's
 * `tsx --test` runner (node, no DOM/three), the figure-rig split (pure math in
 * lib, applying in kit).
 *
 * POLICY — six LANES, one visible bubble each (the ≤6 cap by construction):
 *   · Every emitter (a seated guest, a table's ambient chatter, the dance
 *     floor) is assigned a lane by FNV-1a id hash — stable across visits, so
 *     the same guest always pops on the same beat (the "id-hash phase").
 *   · Each lane cycles its emitters round-robin on a fixed SLOT cadence:
 *     bubble pops in, holds, pops out, and the lane moves to its next emitter
 *     next slot. A guest in a lane of k emitters therefore reappears every
 *     k·SLOT seconds — the per-guest cooldown that keeps a 150-guest room
 *     alive but never noisy.
 *   · Lanes are phase-staggered by the golden ratio so six pops never sync
 *     into a metronome.
 *   · Per-emitter glyph rotation: an emitter's glyph list advances once per
 *     ITS OWN appearance (`appearance % glyphs.length`) — a guest with
 *     [rsvp, meal] shows the plate exactly once per rotation.
 *
 * WALL-CLOCK LAW (the arrival fix): every sample is a closed-form function of
 * elapsed seconds `t` — no per-frame accumulation, no frame-count-bound
 * completion. A starved rAF frame that arrives 40 s late computes the exact
 * state 40 s of rotation owes it.
 *
 * Reduced motion: `sampleLane(…, reduced=true)` pins each lane to its first
 * emitter's first glyph at full scale — static bubbles, no tweens, still ≤6.
 */

/** Atlas glyph names — drawn (canvas paths), never emoji fonts (kit/emotes). */
export type EmoteGlyph = 'check' | 'pending' | 'maybe' | 'meal' | 'music' | 'chat';

/** One bubble source: a world anchor + the glyphs it rotates through. */
export type EmoteEmitter = {
  id: string;
  x: number;
  /** Bubble CENTRE height (m) — callers pick the head-clearance constant. */
  y: number;
  z: number;
  /** Rotation ring; must be non-empty. Advances once per appearance. */
  glyphs: readonly EmoteGlyph[];
};

/** Hard cap on simultaneous bubbles — one per lane (dossier: "≤6 visible"). */
export const EMOTE_MAX_VISIBLE = 6;
/** One lane appearance every slot (s). */
export const EMOTE_SLOT_S = 6.4;
/** Bubble on-screen window within a slot (s) — the rest of the slot is rest. */
export const EMOTE_VISIBLE_S = 3.6;
/** Pop-in tween length (s) — back-out overshoot. */
export const EMOTE_POP_IN_S = 0.3;
/** Pop-out tween length (s) — smooth shrink at the window's end. */
export const EMOTE_POP_OUT_S = 0.26;

/**
 * FNV-1a 32-bit — the plan3d surfaces' stable-hash recipe (deliberately
 * re-stated per the demo scene's precedent: which bits a consumer reads is
 * that consumer's policy). Drives lane assignment + within-lane order.
 */
export function emoteHash(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Partition emitters into the six lanes. Deterministic: lane = hash % 6,
 * within-lane order by hash (id tiebreak) — the same crowd always rotates in
 * the same sequence. Sparse rooms simply leave some lanes empty (< 6 bubbles).
 */
export function emoteLanes(emitters: readonly EmoteEmitter[]): EmoteEmitter[][] {
  const lanes: EmoteEmitter[][] = Array.from({ length: EMOTE_MAX_VISIBLE }, () => []);
  const hashed = emitters.map((e) => ({ e, h: emoteHash(e.id) }));
  hashed.sort((a, b) => a.h - b.h || (a.e.id < b.e.id ? -1 : a.e.id > b.e.id ? 1 : 0));
  for (const { e, h } of hashed) lanes[h % EMOTE_MAX_VISIBLE]!.push(e);
  return lanes;
}

/** Golden-ratio lane stagger (s) — six lanes spread across the slot, never a
 *  metronome. Pure derivation so tests + the kit agree exactly. */
export function lanePhase(lane: number): number {
  return ((lane * 0.6180339887) % 1) * EMOTE_SLOT_S;
}

/** Back-out overshoot ease (Penner) — the bubble's friendly pop-in. */
function backOut(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const u = x - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

/**
 * Bubble scale at `local` seconds into its visible window: back-out pop-in,
 * full hold, smoothstep pop-out. Pure — a starved frame lands mid-curve
 * exactly where the elapsed time says.
 */
export function emotePopScale(local: number): number {
  if (local <= 0) return 0;
  if (local < EMOTE_POP_IN_S) return backOut(local / EMOTE_POP_IN_S);
  const outStart = EMOTE_VISIBLE_S - EMOTE_POP_OUT_S;
  if (local >= EMOTE_VISIBLE_S) return 0;
  if (local > outStart) {
    const k = (local - outStart) / EMOTE_POP_OUT_S;
    return Math.max(0, 1 - k * k * (3 - 2 * k)); // smoothstep down
  }
  return 1;
}

/** A lane's live state: which emitter, its appearance count (drives glyph
 *  rotation), and the tweened scale. `null` = this lane shows nothing now. */
export type LaneSample = { emitterIndex: number; appearance: number; scale: number };

/**
 * Sample one lane at wall-clock `t` (s). Closed-form: slot index → emitter
 * (round-robin) + appearance count; local time inside the slot → visibility +
 * pop scale. `reduced` (prefers-reduced-motion) pins the lane's first emitter
 * at full scale — a static bubble, no tweens, the flow trivially complete.
 */
export function sampleLane(t: number, lane: number, laneSize: number, reduced = false): LaneSample | null {
  if (laneSize <= 0) return null;
  if (reduced) return { emitterIndex: 0, appearance: 0, scale: 1 };
  const tt = Math.max(0, t) + lanePhase(lane);
  const n = Math.floor(tt / EMOTE_SLOT_S);
  const local = tt - n * EMOTE_SLOT_S;
  if (local >= EMOTE_VISIBLE_S) return null;
  return {
    emitterIndex: n % laneSize,
    appearance: Math.floor(n / laneSize),
    scale: emotePopScale(local),
  };
}
