'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
import { createReview, type ReviewAxis } from '@/lib/reviews';
import {
  parseSelfReviewBlock,
  SELF_REVIEW_SIGNALS,
  type SelfReviewSignal,
} from '@/lib/self-review-gate';

const AXES: ReadonlyArray<ReviewAxis> = [
  'overall',
  'communication',
  'quality',
  'value',
  'on_time',
];

function parseRating(raw: FormDataEntryValue | null): number {
  if (typeof raw !== 'string') {
    throw new Error('Rating is required.');
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    throw new Error('Each rating must be 1–5 stars.');
  }
  return n;
}

/**
 * Couple-side submission. Validates everything client-side schema-style,
 * then delegates the RLS-gated INSERT to lib/reviews.ts. On success, sends
 * the user back to the vendor tracker with the new review already counted
 * via revalidatePath.
 *
 * Decision 1 (CLAUDE.md 2026-05-15) — § 2.2d.i Self-review block. If the
 * BEFORE INSERT trigger refuses with SELF_REVIEW_BLOCKED, we route back to
 * the review URL with `?blocked=<signal>` so the page renders the disabled
 * + appeal flow instead of a generic error.
 */
export async function submitCoupleReview(formData: FormData) {
  const eventId = formData.get('event_id');
  const eventVendorId = formData.get('event_vendor_id');
  const vendorProfileId = formData.get('vendor_profile_id');

  if (
    typeof eventId !== 'string'
    || typeof eventVendorId !== 'string'
    || typeof vendorProfileId !== 'string'
  ) {
    throw new Error('Invalid input');
  }

  const ratings = {} as Record<ReviewAxis, number>;
  for (const axis of AXES) {
    ratings[axis] = parseRating(formData.get(`rating_${axis}`));
  }

  const bodyRaw = formData.get('body');
  let body: string | null = null;
  if (typeof bodyRaw === 'string') {
    const trimmed = bodyRaw.trim();
    if (trimmed.length > 4000) {
      throw new Error('Review body must be 4000 characters or fewer.');
    }
    body = trimmed.length > 0 ? trimmed : null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  try {
    await createReview(supabase, {
      vendorProfileId,
      eventId,
      coupleUserId: user.id,
      ratings,
      body,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const signal = parseSelfReviewBlock(message);
    if (signal) {
      // Routing back to the review URL with `?blocked=<signal>` keeps the
      // user in context — the page detects the same signal up front and
      // renders the appeal form for the soft cases (payment/device/household)
      // or the hard-block state for owner_self/team_member.
      redirect(
        `/dashboard/${eventId}/vendors/${eventVendorId}/review?blocked=${signal}`,
      );
    }
    throw err;
  }

  // review_received signal → vendor (cross-actor audit 2026-06-07). Before
  // this the review was a fully silent write: createReview only touched
  // vendor_reviews, and the vendor's Reviews page told them "we notify you
  // via email" — a claim that wasn't true. The vendor only ever learned of a
  // review by happening to open the page. Now they get an in-app row + email
  // the moment a couple submits one. Best-effort + fail-soft: a notification
  // hiccup must never roll back the review the couple just left. Uses the
  // admin client because the couple can't read the vendor's user_id by RLS.
  try {
    const adminClient = createAdminClient();
    const [{ data: profileRow }, { data: eventRow }] = await Promise.all([
      adminClient
        .from('vendor_profiles')
        .select('user_id')
        .eq('vendor_profile_id', vendorProfileId)
        .maybeSingle(),
      adminClient
        .from('events')
        .select('display_name')
        .eq('event_id', eventId)
        .maybeSingle(),
    ]);
    const vendorUserId =
      (profileRow as { user_id: string | null } | null)?.user_id ?? null;
    if (vendorUserId) {
      const eventDisplay =
        (eventRow as { display_name: string } | null)?.display_name ??
        'A couple';
      await emitNotification({
        userId: vendorUserId,
        type: 'review_received',
        title: `New ${ratings.overall}-star review`,
        body: `${eventDisplay} left you a ${ratings.overall}-star review. Open your Reviews page to read it and post a one-time public reply.`,
        relatedUrl: '/vendor-dashboard/reviews',
      });
    }
  } catch (e) {
    // Fail-soft — the review already landed; never block the couple's submit.
    // eslint-disable-next-line no-console
    console.error(
      `[submitCoupleReview] review_received notify failed for vendor_profile_id=${vendorProfileId} event_id=${eventId}:`,
      e,
    );
  }

  revalidatePath(`/dashboard/${eventId}/vendors`);
  redirect(`/dashboard/${eventId}/vendors?reviewed=${eventVendorId}`);
}

/**
 * § 3.9 Self-review appeal — files a row in `vendor_review_appeals` for
 * admin moderation. The reviewer attaches their `review_payload` (the
 * would-be review row) plus a free-text reason explaining why they
 * believe the related-account block is a false positive.
 */
export async function submitReviewAppeal(formData: FormData) {
  const eventId = formData.get('event_id');
  const eventVendorId = formData.get('event_vendor_id');
  const vendorProfileId = formData.get('vendor_profile_id');
  const matchedSignal = formData.get('matched_signal');
  const appealReason = formData.get('appeal_reason');

  if (
    typeof eventId !== 'string'
    || typeof eventVendorId !== 'string'
    || typeof vendorProfileId !== 'string'
    || typeof matchedSignal !== 'string'
    || typeof appealReason !== 'string'
  ) {
    throw new Error('Invalid appeal input');
  }
  if (!(SELF_REVIEW_SIGNALS as ReadonlyArray<string>).includes(matchedSignal)) {
    throw new Error('Invalid matched_signal');
  }
  const reason = appealReason.trim();
  if (reason.length === 0 || reason.length > 4000) {
    throw new Error('Appeal reason must be 1–4000 characters.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Optional payload — when the user filled in the rating/body fields the
  // appeal can carry them forward so the admin sees the would-be review
  // when deciding the appeal.
  const payload: Record<string, unknown> = {};
  const overallRaw = formData.get('payload_rating_overall');
  if (typeof overallRaw === 'string' && overallRaw.length > 0) {
    const n = Number(overallRaw);
    if (Number.isInteger(n) && n >= 1 && n <= 5) {
      payload['rating_overall'] = n;
    }
  }
  const payloadBodyRaw = formData.get('payload_body');
  if (typeof payloadBodyRaw === 'string') {
    const trimmed = payloadBodyRaw.trim();
    if (trimmed.length > 0) payload['body'] = trimmed.slice(0, 4000);
  }

  const { error } = await supabase
    .from('vendor_review_appeals')
    .insert({
      vendor_profile_id: vendorProfileId,
      reviewer_user_id: user.id,
      event_id: eventId,
      event_vendor_id: eventVendorId,
      matched_signal: matchedSignal as SelfReviewSignal,
      review_payload: payload,
      appeal_reason: reason,
    });
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/vendors`);
  redirect(
    `/dashboard/${eventId}/vendors/${eventVendorId}/review?appeal_filed=1`,
  );
}
