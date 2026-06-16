import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { planAutoTags, type EnrollmentVec } from '@/lib/face-match-core';

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
 * The DB cap trigger backstops the 10-tags-per-photo limit across all writers;
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
    if (enrollments.length === 0) return { autoTagged: 0 };

    // Existing tags on this photo (QR/manual/auto) — fill the cap, never re-tag.
    const { data: existing } = await admin
      .from('photo_tags')
      .select('guest_id')
      .eq('source_table', sourceTable)
      .eq('source_id', photoId);
    const alreadyTaggedGuestIds = (existing ?? []).map((r) => r.guest_id as string);

    const plan = planAutoTags({ faceVectors, enrollments, alreadyTaggedGuestIds });
    if (plan.autoTags.length === 0) return { autoTagged: 0 };

    // Write auto_face tags. The (source_table, source_id, guest_id) unique
    // constraint dedupes; the DB 10-tag cap trigger truncates any over-cap row.
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
