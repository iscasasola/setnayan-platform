import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { planAutoTags, type EnrollmentVec } from '@/lib/face-match-core';
import { accountSeedsForEvent } from '@/lib/account-face-profile';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';
import { resolvePapicFaceMode } from '@/lib/papic-face-mode';

// Papic face auto-tagging — server-side MATCHER ("match-on-our-server").
//
// The capturing phone computes a face descriptor per detected face (on-device,
// face-api.js) and sends just those vectors here. We compare them — pure number
// math, no model, no cloud face API — against the event's enrolled guest
// descriptors and write auto_face tags. The face IMAGES never go to any
// recognition service; only the small vectors move, and the guest vectors never
// leave our server. Per-event scoped, consent-gated. Best-effort: a failure here
// never breaks a capture (untagged-still-delivered guarantee covers it).
//
// Dormant until enrollments carry vectors: today guest_face_enrollments.face_vector
// is filled only once the on-device embedder ships + a model is hosted, so with
// no enrolled vectors this is a clean no-op.

type SourceTable = 'papic_photos' | 'papic_guest_captures';

/**
 * Auto-tag one capture from the face descriptors detected in it. Fetches the
 * event's consented, non-revoked enrollments that have a stored vector, runs the
 * pure matcher (euclidean bands, dedupe, cap), and writes auto_face photo_tags.
 * The DB cap trigger backstops the 20-LIVE-tags-per-photo limit across all writers;
 * ON CONFLICT dedupes against existing QR/manual tags. Never throws.
 */
export async function autoTagCapture(params: {
  eventId: string;
  sourceTable: SourceTable;
  photoId: string;
  /** One descriptor per face detected in the capture (from the on-device embedder). */
  faceVectors: number[][];
}): Promise<{ autoTagged: number }> {
  const { eventId, sourceTable, photoId, faceVectors } = params;
  try {
    if (!eventId || !photoId || !Array.isArray(faceVectors) || faceVectors.length === 0) {
      return { autoTagged: 0 };
    }
    const admin = createAdminClient();

    // FAIL-CLOSED BIOMETRIC GATES (One-Pool spec §3.4). Both must hold before a
    // descriptor is EVER matched or persisted as a tag — the server backstop for
    // the client mode gate (a crafted POST that transmits vectors to a Mode-B /
    // control-off event is dropped here):
    //   (1) the /admin/data-privacy 'face_enrollment' control is ACTIVE — until
    //       now this control had ZERO runtime callers, so it was a paper record;
    //   (2) the event resolves to mode_a (christening/debut are forced mode_b).
    if (!(await isDataPrivacyControlActive('face_enrollment'))) return { autoTagged: 0 };
    if ((await resolvePapicFaceMode(admin, eventId)) !== 'mode_a') return { autoTagged: 0 };

    // This event's consented, non-revoked enrollments that actually have a vector.
    const { data: enr, error } = await admin
      .from('guest_face_enrollments')
      .select('guest_id, face_vector')
      .eq('event_id', eventId)
      .is('revoked_at', null)
      .not('consent_at', 'is', null)
      .not('face_vector', 'is', null);
    if (error || !enr || enr.length === 0) return { autoTagged: 0 };

    const enrollments: EnrollmentVec[] = enr
      .map((r) => ({ guestId: r.guest_id as string, vector: r.face_vector as number[] }))
      .filter((e) => e.guestId && Array.isArray(e.vector) && e.vector.length > 0);

    // ACCOUNT-LEVEL FACE PROFILE seed (owner-locked 2026-06-26 reversal of
    // per-event scoping). When the flag is ON, also seed recognition with the
    // account-level profiles of users who are THEMSELVES guests at this event
    // (consented, non-revoked). Each account seed is keyed to that user's OWN
    // guest_id, so a match can only ever tag the person whose face it is
    // (guardrail #2). The pure matcher dedupes per guest, so a guest with both
    // an event enrollment AND account seeds collapses to one tag at the closest
    // distance. `accountSeedsForEvent` is a clean no-op when the flag is OFF.
    const accountSeeds = await accountSeedsForEvent(admin, eventId);
    for (const seed of accountSeeds) {
      for (const vector of seed.vectors) {
        if (Array.isArray(vector) && vector.length > 0) {
          enrollments.push({ guestId: seed.guestId, vector });
        }
      }
    }

    if (enrollments.length === 0) return { autoTagged: 0 };

    // Existing tags on this photo (QR/manual/auto) INCLUDING tombstoned removals:
    // a removed guest is never re-tagged (gravestone rule, 20270131081062) but
    // only LIVE tags fill the cap (owner 2026-07-23 — ghosts don't burn slots).
    const { data: existing } = await admin
      .from('photo_tags')
      .select('guest_id, removed_at')
      .eq('source_table', sourceTable)
      .eq('source_id', photoId);
    const existingRows = existing ?? [];
    const alreadyTaggedGuestIds = existingRows.map((r) => r.guest_id as string);
    const liveTagCount = existingRows.filter((r) => r.removed_at == null).length;

    const plan = planAutoTags({ faceVectors, enrollments, alreadyTaggedGuestIds, liveTagCount });
    if (plan.autoTags.length === 0) return { autoTagged: 0 };

    // Write auto_face tags. The (source_table, source_id, guest_id) unique
    // constraint dedupes; the DB 20-live-tag cap trigger truncates any over-cap row.
    const rows = plan.autoTags.map((t) => ({
      event_id: eventId,
      source_table: sourceTable,
      source_id: photoId,
      guest_id: t.guestId,
      source: 'auto_face',
    }));
    const { error: insErr } = await admin
      .from('photo_tags')
      .upsert(rows, { onConflict: 'source_table,source_id,guest_id', ignoreDuplicates: true });
    if (insErr) return { autoTagged: 0 };

    return { autoTagged: rows.length };
  } catch {
    return { autoTagged: 0 };
  }
}
