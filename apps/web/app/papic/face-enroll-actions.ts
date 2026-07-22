'use server';

import { readGuestSession } from '@/lib/guest-session';
import { createAdminClient } from '@/lib/supabase/admin';
import { VECTOR_MODEL } from '@/lib/face-embed-core';
import { FACE_CONSENT_COPY_VERSION } from '@/lib/papic-face-mode';

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
    // Adults-only gate (RA 10173 · NPC — minors scoped OUT of biometric
    // enrollment for V1). Server-side backstop for the client checkbox: a
    // crafted/replayed POST with biometric_consent=1 must not enrol a minor.
    // No age is stored — a boolean attestation only. Parity with submitRsvp;
    // this is ALSO the custom-QR enrol path (a guest who scanned their custom
    // QR carries the session this action reads).
    const ageAffirmed = clean(formData.get('age_affirmation')) === '1';
    if (!selfieRef || !consent || !ageAffirmed) return { ok: false };

    const admin = createAdminClient();
    const guestId = session.guest_id;
    const eventId = session.event_id;

    // Minor safeguard (DPIA BV-8, 2026-07-05): never enrol a guest the host has
    // excluded from face recognition (typically a minor), regardless of consent.
    const { data: fx } = await admin
      .from('guests')
      .select('face_recognition_excluded')
      .eq('guest_id', guestId)
      .eq('event_id', eventId)
      .maybeSingle();
    if ((fx as { face_recognition_excluded: boolean } | null)?.face_recognition_excluded === true) {
      return { ok: false };
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
    const refsArr = parseStrArray(clean(formData.get('selfie_refs')));
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

    const nowIso = new Date().toISOString();
    const { error } = await admin.from('guest_face_enrollments').insert(
      shots.map((s) => ({
        event_id: eventId,
        guest_id: guestId,
        asset_url: s.ref,
        source: 'guest_portal',
        quality_score: s.quality,
        quality_meta: s.meta,
        face_vector: s.vector,
        vector_model: s.vector ? VECTOR_MODEL : null,
        consent_at: nowIso,
        consent_source: consentSource,
        // Consent evidence (One-Pool spec §3.3): pin WHAT disclosure was shown.
        consent_copy_version: FACE_CONSENT_COPY_VERSION,
      })),
    );

    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
