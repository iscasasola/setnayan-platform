import type { SupabaseClient } from '@supabase/supabase-js';

// Papic face-tag consent gate — the per-event switch that decides whether faces
// are embedded AT ALL (One-Pool spec §3.3–§3.5).
//
// mode_b (the fail-closed DEFAULT): NO face descriptor is computed, transmitted,
//   or stored for any capture on the event. Generic/shared-QR events, opt-out
//   guests, minors, and bystanders are never face-printed. This is the state a
//   fresh `events.papic_face_mode` column defaults to.
// mode_a: a per-guest custom-QR opt-in roster exists; only then may the on-device
//   embedder run and only consented faces are ever embedded.
//
// This module is intentionally ISOMORPHIC: the pure resolvers (`resolveFaceMode`,
// `eventTypeForcesModeB`) and the type are imported by client capture components
// to gate `embedFaces`, while the async DB resolver is used server-side. It must
// NOT be marked `server-only` — do not import a server client at module scope;
// `resolvePapicFaceMode` takes the client as a parameter.

export type PapicFaceMode = 'mode_a' | 'mode_b';

/**
 * Event types whose honoree/guests skew toward minors (christening) or a
 * minor-adjacent milestone (debut). These are FORCED to mode_b (no embedding)
 * regardless of the stored column, until a guardian-consent workflow exists —
 * a ship blocker for these types, not an open item (spec §3.5 / DPIA BV-8).
 */
export const FORCE_MODE_B_EVENT_TYPES = ['christening', 'debut'] as const;

/**
 * Per-event face-consent copy version. The account-face path already pins
 * `ACCOUNT_FACE_CONSENT_VERSION` (lib/account-face-profile.ts); this is the
 * per-event equivalent, stamped on every enrollment (RSVP / day-of / custom-QR)
 * as informed-consent EVIDENCE. Bump on any material change to the consent
 * disclosure wording to force re-consent (DPO-gated).
 */
export const FACE_CONSENT_COPY_VERSION = 'v1';

/** True when the event type is forced to mode_b regardless of the stored value. */
export function eventTypeForcesModeB(eventType: string | null | undefined): boolean {
  if (!eventType) return false;
  return (FORCE_MODE_B_EVENT_TYPES as readonly string[]).includes(eventType);
}

/**
 * Pure resolver: given the stored `papic_face_mode` and the event type, decide
 * the EFFECTIVE mode. Fail-closed to mode_b (no embedding) on anything that
 * isn't an explicit, non-forced mode_a.
 */
export function resolveFaceMode(
  storedMode: string | null | undefined,
  eventType: string | null | undefined,
): PapicFaceMode {
  if (eventTypeForcesModeB(eventType)) return 'mode_b';
  return storedMode === 'mode_a' ? 'mode_a' : 'mode_b';
}

/** Convenience predicate for capture call sites: may this mode run the embedder? */
export function faceModeAllowsEmbedding(mode: PapicFaceMode): boolean {
  return mode === 'mode_a';
}

/**
 * SERVER-SIDE biometric write guard. Given the EFFECTIVE face mode and whatever
 * descriptor a client POSTed, return the (face_vector, vector_model) pair that
 * may actually be persisted to `guest_face_enrollments`.
 *
 * mode_a: the descriptor is stored (model stamped only when a vector is present).
 * mode_b — including christening/debut FORCED mode_b — HARD-NULLS the vector AND
 * the model: no biometric descriptor is ever written, even if the payload carried
 * one (a crafted/replayed POST cannot bypass). This is the write that makes the
 * migration's "no face descriptor … stored" guarantee literally TRUE at the DB
 * boundary; the client-side embed skip is defense-in-depth on top of it.
 *
 * The selfie image + consent record are written separately by the caller and are
 * NOT affected — the only thing this drops in mode_b is the biometric vector.
 *
 * `vectorModel` is injected (not imported) so this stays isomorphic + dependency-
 * free; call sites pass their VECTOR_MODEL constant.
 */
export function faceVectorForMode(
  mode: PapicFaceMode,
  candidate: number[] | null | undefined,
  vectorModel: string,
): { face_vector: number[] | null; vector_model: string | null } {
  const vec = mode === 'mode_a' && candidate && candidate.length > 0 ? candidate : null;
  return { face_vector: vec, vector_model: vec ? vectorModel : null };
}

/**
 * Server resolver: read `events.papic_face_mode` + `event_type` through an
 * admin/RLS client and return the EFFECTIVE mode (christening/debut forced to
 * mode_b). Fail-closed to mode_b on any error or missing row — no event ever
 * embeds faces by accident. `client` is injected so this stays isomorphic-safe
 * and unit-testable (no `server-only` module-scope import).
 */
export async function resolvePapicFaceMode(
  client: Pick<SupabaseClient, 'from'>,
  eventId: string,
): Promise<PapicFaceMode> {
  try {
    if (!eventId) return 'mode_b';
    const { data, error } = await client
      .from('events')
      .select('papic_face_mode, event_type')
      .eq('event_id', eventId)
      .maybeSingle();
    if (error || !data) return 'mode_b';
    const row = data as { papic_face_mode?: string | null; event_type?: string | null };
    return resolveFaceMode(row.papic_face_mode, row.event_type);
  } catch {
    return 'mode_b';
  }
}
