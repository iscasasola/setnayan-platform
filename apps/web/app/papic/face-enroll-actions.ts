'use server';

import { readGuestSession } from '@/lib/guest-session';
import { guestSelfiePolicy, parseClientRef } from '@/lib/r2-client-ref';
import { createAdminClient } from '@/lib/supabase/admin';
import { VECTOR_MODEL } from '@/lib/face-embed-core';
import { FACE_CONSENT_COPY_VERSION, faceVectorForMode } from '@/lib/papic-face-mode';
import { resolveFaceTagging } from '@/lib/face-tagging-gate';
import { isKnownMinorGuest } from '@/lib/face-enrolment-age';
import { everyCopyIsNowStale } from '@/lib/a-withdrawal-reaches-every-copy.server';

// Day-of / camera face enrollment — THE ONLY PATH A FACE-TAGGING SELFIE IS
// TAKEN (owner 2026-09-30: the question is asked at RSVP, the selfie on the
// day; no reply card draws a camera any more). Cookie-authenticated
// (setnayan_guest_session), so it runs from the day-of landing card or the
// guest camera. Source 'guest_portal' (the guest self-enrolling from their own
// page); biometric consent is mandatory (RA 10173). The selfie it stores is
// erased when the guest signs out or the event's Papic closes
// (lib/face-selfie-erase.ts).
//
// Best-effort + non-fatal — a failure never blocks anything; the guest can
// always fall back to QR-scan tagging. The on-device face_vector is DORMANT
// until a model is hosted (NEXT_PUBLIC_FACE_MODEL_URL); image-only until then.

function clean(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Why an enrolment did not save — a CODE the face step turns into one short
 * sentence (lib/face-enroll-refusal.ts). A failure must never look like success
 * (owner 2026-09-30: a guest ticked, took the selfie, and nothing was saved).
 */
export type EnrollRefusal =
  | 'session'
  | 'consent'
  | 'not_on'
  | 'not_wanted'
  | 'excluded'
  | 'minor'
  | 'bad_photo'
  | 'save';

export async function enrollGuestFace(
  formData: FormData,
): Promise<{ ok: boolean; reason?: EnrollRefusal }> {
  try {
    const session = await readGuestSession();
    if (!session) return { ok: false, reason: 'session' };

    const selfieRef = clean(formData.get('selfie_ref'));
    const consent = clean(formData.get('biometric_consent')) === '1';
    // Adults-only gate (RA 10173 · NPC — minors scoped OUT of biometric
    // enrollment for V1). Server-side backstop for the client checkbox: a
    // crafted/replayed POST with biometric_consent=1 must not enrol a minor.
    // No age is stored — a boolean attestation only. Parity with submitRsvp;
    // this is ALSO the custom-QR enrol path (a guest who scanned their custom
    // QR carries the session this action reads).
    const ageAffirmed = clean(formData.get('age_affirmation')) === '1';
    if (!selfieRef || !consent || !ageAffirmed) return { ok: false, reason: 'consent' };

    const admin = createAdminClient();
    const guestId = session.guest_id;
    const eventId = session.event_id;

    // SEC-1: `selfie_ref` is a raw form field. It becomes `guests.photo_url`,
    // which is presigned by /api/venue-scene/[slug] (ANONYMOUS) and by the
    // couple's guest/seating surfaces — so an unvalidated ref parked here is a
    // cross-tenant read oracle with a public delivery channel. /api/guest-selfie
    // derives its key from the SESSION, so the legitimate shape is exactly this
    // guest's own folder.
    if (!parseClientRef(selfieRef, guestSelfiePolicy(eventId, guestId))) {
      return { ok: false, reason: 'bad_photo' };
    }

    // Minor safeguard (DPIA BV-8, 2026-07-05): never enrol a guest the host has
    // excluded from face recognition (typically a minor), regardless of consent.
    const [{ data: fx, error: fxErr }, faceTagging] = await Promise.all([
      admin
        .from('guests')
        .select('face_recognition_excluded, face_tagging_wanted')
        .eq('guest_id', guestId)
        .eq('event_id', eventId)
        .maybeSingle(),
      resolveFaceTagging(admin, eventId),
    ]);
    if (fxErr) console.error('[supabase-error] app/papic/face-enroll-actions.ts · from:guests.select', fxErr);
    const guestRow = fx as { face_recognition_excluded: boolean; face_tagging_wanted: boolean | null } | null;
    if (fxErr || !guestRow) return { ok: false, reason: 'save' };
    if (guestRow.face_recognition_excluded === true) return { ok: false, reason: 'excluded' };

    // 🔒 THE THREE OWNER GATES, SERVER-SIDE (owner 2026-09-30, DECISION_LOG
    // "FACE DATA: THREE OWNER ANSWERS"): *"server-side enrol must check
    // face_tagging_wanted = true, Papic active and the couple's switch"*.
    //   · the guest said "Yes, tag me" — a NULL (never answered) or a "No"
    //     enrols nothing; the day-of catch stores the Yes first
    //     (`recordFaceTaggingWish`), so an honest flow always arrives with it;
    //   · `askable` — the event's Papic is ACTIVE and not yet CLOSED, and face
    //     tagging runs there (`mode_a`, which carries the couple's switch).
    //     📵 A mode_b event therefore stores NO selfie image at all — no face
    //     is matched there, so there is nothing a selfie could be for.
    // The client hides the camera in every one of these cases; this is the
    // refusal a crafted or replayed post meets.
    if (!faceTagging.askable) return { ok: false, reason: 'not_on' };
    if (guestRow.face_tagging_wanted !== true) return { ok: false, reason: 'not_wanted' };

    // Owner 2026-08-05: "under 18 will not allow face tagging." The 18+ tickbox
    // above is the enabler; this is the refusal that does not depend on it —
    // where the guest list records a birth date showing a child, no tickbox
    // overrides it. Both enrolment writers apply it, because a guard on one path
    // is a guard on neither.
    if (await isKnownMinorGuest(admin, eventId, guestId)) {
      return { ok: false, reason: 'minor' };
    }

    // Provenance only (free-text consent_source) — defaults to the day-of card.
    const consentSource = clean(formData.get('enroll_context')) || 'day_of';

    // Advisory quality meta from the in-browser gate (may be absent).
    let qualityScore: number | null = null;
    let qualityMeta: Record<string, unknown> = {};
    const rawQuality = clean(formData.get('selfie_quality'));
    if (rawQuality) {
      try {
        const parsed = JSON.parse(rawQuality) as {
          score?: number | null;
        } & Record<string, unknown>;
        if (typeof parsed.score === 'number') qualityScore = parsed.score;
        qualityMeta = parsed;
      } catch {
        // malformed quality blob — enroll without it
      }
    }

    // Optional on-device face descriptor(s) (dlib via face-api.js). Absent
    // until the embedder + a hosted model are live → enroll image-only.
    const parseVector = (raw: string): number[] | null => {
      if (!raw) return null;
      try {
        const v = JSON.parse(raw) as unknown;
        if (
          Array.isArray(v) &&
          v.length > 0 &&
          v.every((n) => typeof n === 'number' && Number.isFinite(n))
        ) {
          return v as number[];
        }
      } catch {
        // malformed vector — enroll without it
      }
      return null;
    };
    const faceVector = parseVector(clean(formData.get('selfie_vector')));

    // 3-shot enrollment (owner 2026-06-28): the day-of capture can submit up to
    // three angles (center / slight-left / slight-right) so the matcher has
    // several reference descriptors per guest — materially better recall than a
    // single frontal frame. Each angle becomes its OWN non-revoked
    // guest_face_enrollments row; lib/face-match.ts already compares a photo
    // against EVERY non-revoked row per guest, so more angles = more chances to
    // match. Falls back to the single inputs (RSVP path + older clients).
    type Shot = {
      ref: string;
      vector: number[] | null;
      quality: number | null;
      meta: Record<string, unknown>;
    };
    const parseStrArray = (raw: string): string[] => {
      if (!raw) return [];
      try {
        const v = JSON.parse(raw) as unknown;
        return Array.isArray(v)
          ? v.filter((s): s is string => typeof s === 'string' && s.length > 0)
          : [];
      } catch {
        return [];
      }
    };
    const parseJsonArray = (raw: string): unknown[] => {
      if (!raw) return [];
      try {
        const v = JSON.parse(raw) as unknown;
        return Array.isArray(v) ? v : [];
      } catch {
        return [];
      }
    };
    // SEC-1: same gate as the single `selfie_ref` above — the multi-shot array
    // feeds the same guests.photo_url / face_enrollments rows, which are
    // presigned by the ANONYMOUS /api/venue-scene endpoint. Drop any ref that
    // isn't this guest's own selfie rather than enrolling it.
    const refsArr = parseStrArray(clean(formData.get('selfie_refs'))).filter(
      (ref) => parseClientRef(ref, guestSelfiePolicy(eventId, guestId)) !== null,
    );
    let shots: Shot[];
    if (refsArr.length > 0) {
      const vecArr = parseJsonArray(clean(formData.get('selfie_vectors')));
      const qualArr = parseJsonArray(clean(formData.get('selfie_qualities')));
      // Cap at 3 — UI enforces it too; this is the server-side backstop.
      shots = refsArr.slice(0, 3).map((ref, i) => {
        const rawVec = vecArr[i];
        const vector =
          Array.isArray(rawVec) &&
          rawVec.length > 0 &&
          rawVec.every((n) => typeof n === 'number' && Number.isFinite(n))
            ? (rawVec as number[])
            : null;
        const rawQ = qualArr[i] as
          | ({ score?: number } & Record<string, unknown>)
          | undefined;
        const quality =
          rawQ && typeof rawQ.score === 'number' ? rawQ.score : null;
        const meta =
          rawQ && typeof rawQ === 'object' ? (rawQ as Record<string, unknown>) : {};
        return { ref, vector, quality, meta };
      });
    } else {
      shots = [
        { ref: selfieRef, vector: faceVector, quality: qualityScore, meta: qualityMeta },
      ];
    }

    // The selfie becomes the guest's display photo (parity with RSVP enrollment).
    await admin
      .from('guests')
      .update({
        photo_url: selfieRef,
        photo_source: 'selfie',
        photo_updated_at: new Date().toISOString(),
        photo_consent: true,
      })
      .eq('guest_id', guestId)
      .eq('event_id', eventId);

    // One non-revoked enrollment per (event, guest): retire the live row first
    // (a fresh day-of selfie supersedes a stale one).
    await admin
      .from('guest_face_enrollments')
      .update({ revoked_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .eq('guest_id', guestId)
      .is('revoked_at', null);

    // BIOMETRIC WRITE GUARD (One-Pool spec §3.4). Resolve the EFFECTIVE face
    // mode server-side (christening/debut forced to mode_b; fail-closed) and
    // HARD-NULL every shot's descriptor unless this is an explicit mode_a event
    // — so a crafted POST carrying `selfie_vector(s)` on a mode_b / forced-mode_b
    // event can NEVER persist a biometric. The selfie image + consent rows are
    // still written (display photo / day-of features preserved); only the
    // vectors are dropped. Closes the christening/debut minor-honoree leak.
    const faceMode = faceTagging.mode;

    const nowIso = new Date().toISOString();
    const { error } = await admin.from('guest_face_enrollments').insert(
      shots.map((s) => {
        const stored = faceVectorForMode(faceMode, s.vector, VECTOR_MODEL);
        return {
          event_id: eventId,
          guest_id: guestId,
          asset_url: s.ref,
          source: 'guest_portal',
          quality_score: s.quality,
          quality_meta: s.meta,
          face_vector: stored.face_vector,
          vector_model: stored.vector_model,
          consent_at: nowIso,
          consent_source: consentSource,
          // Consent evidence (One-Pool spec §3.3): pin WHAT disclosure was shown.
          consent_copy_version: FACE_CONSENT_COPY_VERSION,
        };
      }),
    );

    /*
      🔑 A CONSENT WRITE IN THE OTHER DIRECTION, AND IT MOVES THE SAME PAGES.
      Enrolling sets `photo_consent = true` on this guest a few lines above, and
      the story's veto is built from guests who opted OUT — so this LIFTS a veto:
      photographs of this person that the story was withholding may now be shown.
      A change that makes more of a celebration public is exactly as urgent to
      publish as one that makes less, so it goes through the same one list rather
      than waiting for a cache to expire.
    */
    if (!error) await everyCopyIsNowStale(eventId);

    return error ? { ok: false, reason: 'save' } : { ok: true };
  } catch {
    return { ok: false, reason: 'save' };
  }
}

/**
 * The day-of catch's one question — "Want to be tagged in the photos?" — for a
 * guest who never answered it on the RSVP (owner 2026-09-29, lib/face-tagging-wish.ts).
 *
 * Cookie-authenticated exactly like `enrollGuestFace`: the session names the
 * guest, so nobody can answer for somebody else. "No thanks" is stored so the
 * catch never asks again; "Yes, tag me" is stored so the selfie that follows
 * is theirs by choice, and so a guest who stops half-way is not asked the
 * question twice.
 *
 * ⚠ NOT CONSENT. Storing "yes" enrols nothing — the selfie's own two ticks
 * (biometric consent + 18+) still gate `enrollGuestFace`.
 */
export async function recordFaceTaggingWish(wantsTagging: boolean): Promise<{ ok: boolean }> {
  try {
    if (typeof wantsTagging !== 'boolean') return { ok: false };
    const session = await readGuestSession();
    if (!session) return { ok: false };
    const { error } = await createAdminClient()
      .from('guests')
      .update({ face_tagging_wanted: wantsTagging })
      .eq('guest_id', session.guest_id)
      .eq('event_id', session.event_id);
    if (error) console.error('[supabase-error] app/papic/face-enroll-actions.ts · from:guests.update(face_tagging_wanted)', error);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
