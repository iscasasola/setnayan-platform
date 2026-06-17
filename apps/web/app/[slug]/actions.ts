'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { insertFaultLog } from '@/lib/telemetry/fault-log';
import { createAdminClient } from '@/lib/supabase/admin';
import { VECTOR_MODEL } from '@/lib/face-embed-core';
import { readGuestSession } from '@/lib/guest-session';
import { emitNotification } from '@/lib/notification-emit';
import type { MealPreference, RsvpStatus } from '@/lib/guests';

const RSVP_VALUES: RsvpStatus[] = ['pending', 'attending', 'declined', 'maybe'];
const MEAL_VALUES: MealPreference[] = [
  'beef',
  'chicken',
  'fish',
  'vegetarian',
  'vegan',
  'kids',
  'no_preference',
];

function clean(value: FormDataEntryValue | null): string {
  return value ? String(value).trim() : '';
}

export async function submitRsvp(
  eventId: string,
  guestId: string,
  formData: FormData,
): Promise<void> {
  const session = await readGuestSession();
  if (!session || session.event_id !== eventId || session.guest_id !== guestId) {
    // Session got out of sync — kick them back to the slug landing.
    const admin = createAdminClient();
    const { data: ev } = await admin
      .from('events')
      .select('slug')
      .eq('event_id', eventId)
      .maybeSingle();
    redirect(ev?.slug ? `/${ev.slug}` : '/');
  }

  const status = clean(formData.get('rsvp_status')) as RsvpStatus;
  const meal_raw = clean(formData.get('meal_preference'));
  const meal = (meal_raw || 'no_preference') as MealPreference;
  const dietary = clean(formData.get('dietary_restrictions')) || null;
  const notes = clean(formData.get('notes')) || null;

  if (!RSVP_VALUES.includes(status)) {
    return;
  }
  if (meal && !MEAL_VALUES.includes(meal)) {
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('guests')
    .update({
      rsvp_status: status,
      meal_preference: meal,
      dietary_restrictions: dietary,
      notes,
      rsvp_responded_at:
        status === 'attending' || status === 'declined'
          ? new Date().toISOString()
          : null,
      updated_at: new Date().toISOString(),
    })
    .eq('guest_id', guestId)
    .eq('event_id', eventId);

  if (error) {
    // Best-effort silent failure for guest-side surface; couple sees the row
    // unchanged. A toast UI lands with the polish pass.
    await insertFaultLog({
      event_type: 'SUPABASE_SAVE_ERROR',
      element_name: 'Submit guest RSVP',
      file_path: 'app/[slug]/actions.ts',
      error_message: error.message,
      payload_snapshot: { eventId, guestId, status, meal },
    });
    return;
  }

  // Persist the RSVP selfie + face-recognition enrollment (owner directive
  // 2026-06-05). Gated on EXPLICIT biometric consent (RA 10173): no consent →
  // no photo, no enrollment. Best-effort + non-fatal — a selfie/enrollment
  // failure must NEVER roll back the RSVP that already succeeded above.
  const selfieRef = clean(formData.get('selfie_ref'));
  const biometricConsent = clean(formData.get('biometric_consent')) === '1';
  if (selfieRef && biometricConsent) {
    try {
      // Selfie is the highest-priority display photo — it always wins over a
      // Gmail avatar / couple upload.
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

      // Advisory quality meta from the in-browser gate (may be absent if the
      // gate couldn't run — that's fine, we enroll without it).
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

      // Optional on-device face descriptor (dlib via face-api.js) — the guest's
      // face fingerprint for gallery auto-tagging. Absent until the embedder +
      // a hosted model are live → enroll image-only exactly as before.
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

      // Upsert: the partial unique index allows only one non-revoked enrollment
      // per (event, guest), so retire any live row before inserting the fresh
      // one (re-RSVP with a new selfie supersedes the old).
      await admin
        .from('guest_face_enrollments')
        .update({ revoked_at: new Date().toISOString() })
        .eq('event_id', eventId)
        .eq('guest_id', guestId)
        .is('revoked_at', null);

      await admin.from('guest_face_enrollments').insert({
        event_id: eventId,
        guest_id: guestId,
        asset_url: selfieRef,
        source: 'rsvp_selfie',
        quality_score: qualityScore,
        quality_meta: qualityMeta,
        face_vector: faceVector,
        vector_model: faceVector ? VECTOR_MODEL : null,
        consent_at: new Date().toISOString(),
        consent_source: 'rsvp',
      });
    } catch {
      // Selfie/enrollment failure never blocks the RSVP.
    }
  }

  const { data: ev } = await admin
    .from('events')
    .select('slug, display_name')
    .eq('event_id', eventId)
    .maybeSingle();

  // Notify couple-side members that an RSVP came in. emitNotification handles
  // both the in-app row + the Resend email (when configured). Failures here
  // never roll back the RSVP — best-effort.
  if (status === 'attending' || status === 'declined') {
    try {
      const { data: guest } = await admin
        .from('guests')
        .select('first_name, last_name, display_name')
        .eq('guest_id', guestId)
        .maybeSingle();
      const guestName =
        (guest?.display_name ?? '').trim() ||
        `${guest?.first_name ?? ''} ${guest?.last_name ?? ''}`.trim() ||
        'A guest';
      const statusLabel = status === 'attending' ? 'attending' : 'not attending';
      const { data: coupleMembers } = await admin
        .from('event_members')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('member_type', 'couple');
      for (const m of coupleMembers ?? []) {
        await emitNotification({
          userId: m.user_id,
          type: 'rsvp_received',
          title: `${guestName} RSVP'd: ${statusLabel}`,
          body:
            status === 'attending' && meal && meal !== 'no_preference'
              ? `Meal preference: ${meal}.`
              : null,
          relatedUrl: `/dashboard/${eventId}/guests/${guestId}`,
        });
      }
    } catch {
      // Notification failures must not break the guest-side RSVP submit.
    }
  }

  revalidatePath(`/dashboard/${eventId}/guests`);
  redirect(ev?.slug ? `/${ev.slug}?saved=1` : '/');
}

/**
 * Guest withdraws face-recognition consent (RA 10173 — the data subject's
 * right to withdraw). Revokes the live enrollment and clears the selfie
 * display photo (reverting to initials); a Gmail avatar, being display-only
 * and non-biometric, is left intact. Admin-client + guest-session authorized,
 * the same trust model as submitRsvp.
 */
export async function withdrawFaceConsent(
  eventId: string,
  guestId: string,
  _formData: FormData,
): Promise<void> {
  const session = await readGuestSession();
  if (!session || session.event_id !== eventId || session.guest_id !== guestId) {
    return;
  }
  const admin = createAdminClient();
  await admin
    .from('guest_face_enrollments')
    .update({ revoked_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .is('revoked_at', null);
  await admin
    .from('guests')
    .update({
      photo_url: null,
      photo_source: null,
      photo_updated_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .eq('photo_source', 'selfie');

  const { data: ev } = await admin
    .from('events')
    .select('slug')
    .eq('event_id', eventId)
    .maybeSingle();
  revalidatePath(`/dashboard/${eventId}/guests`);
  redirect(ev?.slug ? `/${ev.slug}?face_removed=1` : '/');
}
