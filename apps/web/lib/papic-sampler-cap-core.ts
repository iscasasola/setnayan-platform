/**
 * Pure decision core for the free-Papic-sampler per-seat cap.
 *
 * This mirrors, in dependency-free TypeScript, the EXACT decision the atomic
 * `papic_sampler_insert_capture` / `papic_sampler_remaining` RPCs make in the DB
 * (migration 20270222212676): a sampler seat is capped at 8 photos + 2 clips
 * (current, non-superseded). The DB functions are the AUTHORITATIVE guard — the
 * cap + insert run under a `SELECT … FOR UPDATE` seat lock so it is atomic and
 * leak-proof. This module exists so the cap SEMANTICS (which kind is capped at
 * what, where the boundary is, the presign-layer "remaining" probe) are unit-
 * testable in `pnpm test:unit` without a live database, and so the app constants
 * and the SQL stay provably in lockstep.
 *
 * Kept caps in lockstep with lib/papic-seats.ts (PAPIC_SAMPLER_PHOTO_CAP = 8 ·
 * PAPIC_SAMPLER_CLIP_CAP = 2) and the SQL (inlined 8 / 2 there).
 */

export const SAMPLER_PHOTO_CAP = 8;
export const SAMPLER_CLIP_CAP = 2;

export type SamplerKind = 'photo' | 'clip';

/** The per-kind cap for a sampler seat. */
export function samplerCapForKind(kind: SamplerKind): number {
  return kind === 'clip' ? SAMPLER_CLIP_CAP : SAMPLER_PHOTO_CAP;
}

/**
 * Remaining capacity for a kind given how many CURRENT (non-superseded) captures
 * of that kind already exist. Never negative. This is what the presign route's
 * `papic_sampler_remaining` probe returns; the route refuses to mint a presigned
 * PUT URL (→ no bytes reach R2) when this is <= 0.
 */
export function samplerRemaining(kind: SamplerKind, usedOfKind: number): number {
  const cap = samplerCapForKind(kind);
  const used = Number.isFinite(usedOfKind) && usedOfKind > 0 ? Math.floor(usedOfKind) : 0;
  return Math.max(cap - used, 0);
}

export type SamplerCapVerdict =
  | { allowed: true }
  | { allowed: false; error: 'sampler_photo_cap' | 'sampler_clip_cap' };

/**
 * The record-layer cap decision: may a sampler seat record one more capture of
 * `kind`, given the current (non-superseded) used count? This is the JS twin of
 * the atomic check inside `papic_sampler_insert_capture`: under cap → allowed;
 * at/over cap → rejected with the exact error string the capture UI special-
 * cases as the celebratory "all used up" state.
 */
export function samplerCapDecision(
  kind: SamplerKind,
  usedOfKind: number,
): SamplerCapVerdict {
  if (samplerRemaining(kind, usedOfKind) <= 0) {
    return {
      allowed: false,
      error: kind === 'clip' ? 'sampler_clip_cap' : 'sampler_photo_cap',
    };
  }
  return { allowed: true };
}
