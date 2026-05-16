import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse } from '@/lib/api-auth';
import {
  parseSelfReviewBlock,
  selfReviewBlockedBody,
} from '@/lib/self-review-gate';

/**
 * POST /api/v1/reviews
 *
 * Authenticated couple-side review submission. The actual gate logic lives
 * in the BEFORE INSERT trigger on `vendor_reviews` declared in
 * 20260515000000_self_review_gate.sql; this route exists to translate the
 * Postgres exception into the structured 403 response specified in 0006
 * § "Dual-role customer ↔ vendor — review gate":
 *
 *   {
 *     "error": { "code": "SELF_REVIEW_BLOCKED", "message": "…" },
 *     "matched_signal": "owner_self" | "team_member" | "payment_match"
 *                       | "device_match" | "household_match",
 *     "next_action": "contest_via_help"
 *   }
 *
 * Uses the auth-cookie Supabase client (not service-role) so the trigger
 * still fires and RLS still applies. The route is part of the SDK-style
 * /api/v1 surface; auth comes from the browser session (server-action
 * style) rather than API key Bearer auth so the existing review form can
 * call it without a key. Bearer-key access can be layered on later.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return apiErrorResponse(401, 'unauthenticated', 'Sign in to submit a review.');
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return apiErrorResponse(400, 'invalid_json', 'Request body is not valid JSON.');
  }

  const parsed = parseReviewBody(payload);
  if (!parsed.ok) {
    return apiErrorResponse(400, 'invalid_body', parsed.error);
  }
  const body = parsed.value;

  const { data, error } = await supabase
    .from('vendor_reviews')
    .insert({
      vendor_profile_id: body.vendor_profile_id,
      event_id: body.event_id,
      couple_user_id: user.id,
      rating_overall: body.rating_overall,
      rating_communication: body.rating_communication,
      rating_quality: body.rating_quality,
      rating_value: body.rating_value,
      rating_on_time: body.rating_on_time,
      body: body.body,
    })
    .select('review_id, public_id')
    .single();

  if (error) {
    // The trigger raises with ERRCODE = 'check_violation'; Postgres surfaces
    // that as code '23514' on the error object the supabase-js client emits.
    const signal = parseSelfReviewBlock(error.message);
    if (signal) {
      return NextResponse.json(
        {
          error: {
            code: 'SELF_REVIEW_BLOCKED',
            message:
              "We can't accept this review — it looks like you're related to the vendor account. " +
              'You can appeal via the Help inbox; an admin will review and override-publish if it was a false positive.',
          },
          ...selfReviewBlockedBody(signal),
        },
        {
          status: 403,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        },
      );
    }
    return apiErrorResponse(400, 'review_insert_failed', error.message);
  }

  return NextResponse.json(
    {
      data: {
        review_id: data.review_id,
        public_id: data.public_id,
      },
    },
    {
      status: 201,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    },
  );
}

type ReviewBody = {
  vendor_profile_id: string;
  event_id: string;
  rating_overall: number;
  rating_communication: number;
  rating_quality: number;
  rating_value: number;
  rating_on_time: number;
  body: string | null;
};

function parseReviewBody(
  raw: unknown,
): { ok: true; value: ReviewBody } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Body must be a JSON object.' };
  }
  const o = raw as Record<string, unknown>;
  const vendorProfileId = o['vendor_profile_id'];
  const eventId = o['event_id'];
  if (typeof vendorProfileId !== 'string' || vendorProfileId.length === 0) {
    return { ok: false, error: 'vendor_profile_id is required.' };
  }
  if (typeof eventId !== 'string' || eventId.length === 0) {
    return { ok: false, error: 'event_id is required.' };
  }

  const axes = [
    'rating_overall',
    'rating_communication',
    'rating_quality',
    'rating_value',
    'rating_on_time',
  ] as const;
  const ratings: Record<(typeof axes)[number], number> = {
    rating_overall: 0,
    rating_communication: 0,
    rating_quality: 0,
    rating_value: 0,
    rating_on_time: 0,
  };
  for (const axis of axes) {
    const v = o[axis];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 5) {
      return { ok: false, error: `${axis} must be an integer 1–5.` };
    }
    ratings[axis] = v;
  }

  let body: string | null = null;
  const rawBody = o['body'];
  if (rawBody === null || rawBody === undefined) {
    body = null;
  } else if (typeof rawBody === 'string') {
    const trimmed = rawBody.trim();
    if (trimmed.length > 4000) {
      return { ok: false, error: 'body must be ≤4000 characters.' };
    }
    body = trimmed.length > 0 ? trimmed : null;
  } else {
    return { ok: false, error: 'body must be a string or null.' };
  }

  return {
    ok: true,
    value: {
      vendor_profile_id: vendorProfileId,
      event_id: eventId,
      ...ratings,
      body,
    },
  };
}
