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
// This module is intentionally ISOMORPHIC: the pure resolvers (`resolveFaceMode`) and the type are imported by client capture components
// to gate `embedFaces`, while the async DB resolver is used server-side. It must
// NOT be marked `server-only` — do not import a server client at module scope;
// `resolvePapicFaceMode` takes the client as a parameter.

export type PapicFaceMode = 'mode_a' | 'mode_b';

/*
 * ⚖ EVERY EVENT TYPE, CHRISTENING AND DEBUT INCLUDED (owner 2026-10-01,
 * DECISION_LOG "ELEVEN OWNER ANSWERS" #8): *"Face Tagging is on by default but
 * they can always turn it off."* The minor-heavy list that kept christening and
 * debut OFF until an admin turned them on (2026-08-05 → 2026-10-01) is RETIRED,
 * together with its helpers. What protects a guest is unchanged: per-guest
 * opt-in consent, the 18+ attestation, the host's per-guest
 * `face_recognition_excluded` flag, selfie erasure — and the host's own
 * off-switch, `face_tagging_declined_by_couple`, which still wins.
 */

/**
 * Per-event face-consent copy version. The account-face path already pins
 * `ACCOUNT_FACE_CONSENT_VERSION` (lib/account-face-profile.ts); this is the
 * per-event equivalent, stamped on every enrollment (RSVP / day-of / custom-QR)
 * as informed-consent EVIDENCE. Bump on any material change to the consent
 * disclosure wording to force re-consent (DPO-gated).
 */
export const FACE_CONSENT_COPY_VERSION = 'v1';

/**
 * Pure resolver: given the stored `papic_face_mode` and the event type, decide
 * the EFFECTIVE mode. Fail-closed to mode_b (no embedding) on anything that
 * isn't an explicit mode_a or an active Papic.
 */
export function resolveFaceMode(
  storedMode: string | null | undefined,
  /** Kept for positional callers; no event type changes the answer since
   *  2026-10-01 (#8). */
  _eventType: string | null | undefined,
  /**
   * The couple declined face tagging on their own event.
   *
   * ⚠ NARROWS ONLY, and the parameter order says so: this is the LAST word and
   * it can only ever say no.
   */
  coupleDeclined?: boolean | null,
  /**
   * ⚖ THE EVENT'S PAPIC IS ACTIVE (owner 2026-09-30, answering PR #6195:
   * *"automatic"*). Face tagging is ON by itself for any event whose Papic
   * service is active — no admin step. Server callers pass
   * `eventPapicGuestActive` (lib/face-tagging-gate.ts does it once for every
   * server surface); omitted = `false`, i.e. "what did the ADMIN set".
   *
   * EVERY event type — christening and debut included (owner 2026-10-01,
   * "ELEVEN OWNER ANSWERS" #8: on by default, the host can always turn it off).
   */
  papicActive?: boolean | null,
): PapicFaceMode {
  // The couple's decline is still the last word — it can only ever say no.
  if (coupleDeclined === true) return 'mode_b';
  // The admin's explicit mode_a — the override.
  if (storedMode === 'mode_a') return 'mode_a';
  // Automatic: Papic active turns it on for every event type (owner 2026-09-30
  // "automatic"; 2026-10-01 #8 — christening and debut included).
  if (papicActive === true) return 'mode_a';
  return 'mode_b';
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
 * mode_b HARD-NULLS the vector AND
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
 * admin/RLS client and return the admin-stored mode. Fail-closed to mode_b on any error or missing row — no event ever
 * embeds faces by accident. `client` is injected so this stays isomorphic-safe
 * and unit-testable (no `server-only` module-scope import).
 */
/**
 * @deprecated SINCE 2026-09-30 THIS IS THE ADMIN-STORED MODE ONLY — it cannot
 * see whether the event's Papic is active, and Papic-active now turns face
 * tagging on by itself. Every server surface asks `resolveFaceTagging`
 * (lib/face-tagging-gate.ts) for the EFFECTIVE mode; `face-tagging-rules.test.ts`
 * fails if app code calls this again.
 */
export async function resolvePapicFaceMode(
  client: Pick<SupabaseClient, 'from'>,
  eventId: string,
): Promise<PapicFaceMode> {
  try {
    if (!eventId) return 'mode_b';
    const { data, error } = await client
      .from('events')
      .select('papic_face_mode, event_type, face_tagging_declined_by_couple')
      .eq('event_id', eventId)
      .maybeSingle();
    if (error) console.error('[supabase-error] lib/papic-face-mode.ts · from:events.select', error);
    if (error || !data) return 'mode_b';
    const row = data as {
      papic_face_mode?: string | null;
      event_type?: string | null;
      face_tagging_declined_by_couple?: boolean | null;
    };
    // The couple's decline is passed here and NOWHERE ELSE derived — this is the
    // one function that answers "what actually runs on this event", so every
    // caller of it inherits the couple's choice without having to know about it.
    return resolveFaceMode(row.papic_face_mode, row.event_type, row.face_tagging_declined_by_couple);
  } catch {
    return 'mode_b';
  }
}

/*
 * ⚠ `resolveFaceTagging` — "may a guest be ASKED at all" — LIVES IN
 * `lib/face-tagging-gate.ts` since 2026-09-30. It now asks whether the event's
 * Papic is ACTIVE and whether Papic has CLOSED, which are server reads; this
 * module is imported by browser capture components and must stay isomorphic.
 */
