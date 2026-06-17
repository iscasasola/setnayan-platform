'use server';

import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { VECTOR_MODEL } from '@/lib/face-embed-core';

// Day-of / camera face enrollment — the "register your face if you haven't yet"
// path for a guest who SKIPPED the optional RSVP selfie. Same write as the RSVP
// enrollment block (app/[slug]/actions.ts), but cookie-authenticated
// (setnayan_guest_session) instead of riding the RSVP form, so it can run from
// the day-of landing card or the guest camera. Source 'guest_portal' (the guest
// self-enrolling from their own page); biometric consent is mandatory (RA 10173).
//
// Best-effort + non-fatal — a failure never blocks anything; the guest can
// always fall back to QR-scan tagging. The on-device face_vector is DORMANT
// until a model is hosted (NEXT_PUBLIC_FACE_MODEL_URL); image-only until then.

function clean(v: FormDataEntryValue | null): string {
  return typeof v === 'string' ? v.trim() : '';
}

export async function enrollGuestFace(
  formData: FormData,
): Promise<{ ok: boolean }> {
  try {
    const session = await readGuestSession();
    if (!session) return { ok: false };

    const selfieRef = clean(formData.get('selfie_ref'));
    const consent = clean(formData.get('biometric_consent')) === '1';
    if (!selfieRef || !consent) return { ok: false };

    const admin = createAdminClient();
    const guestId = session.guest_id;
    const eventId = session.event_id;
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

    // Optional on-device face descriptor (dlib via face-api.js). Absent until
    // the embedder + a hosted model are live → enroll image-only.
    let faceVector: number[] | null = null;
    const rawVector = clean(formData.get('selfie_vector'));
    if (rawVector) {
      try {
        const v = JSON.parse(rawVector) as unknown;
        if (
          Array.isArray(v) &&
          v.length > 0 &&
          v.every((n) => typeof n === 'number' && Number.isFinite(n))
        ) {
          faceVector = v as number[];
        }
      } catch {
        // malformed vector — enroll without it
      }
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

    const { error } = await admin.from('guest_face_enrollments').insert({
      event_id: eventId,
      guest_id: guestId,
      asset_url: selfieRef,
      source: 'guest_portal',
      quality_score: qualityScore,
      quality_meta: qualityMeta,
      face_vector: faceVector,
      vector_model: faceVector ? VECTOR_MODEL : null,
      consent_at: new Date().toISOString(),
      consent_source: consentSource,
    });

    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
