'use server';

import { after } from 'next/server';
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

/**
 * Open a vendor_disputes row so the demotion cron has input (cross-account QA,
 * 2026-06-19). Before this, `vendor_disputes` was orphaned for INSERT — the
 * couple-side completion→non-delivery flow flipped `event_vendors.completion_status`
 * to 'disputed' but never wrote a `vendor_disputes` row, so the 30-day
 * demote-to-coming_soon cron (api/admin/cron/dispute-counter) had nothing to
 * count and the chain was severed.
 *
 * Constraints honored:
 *  • vendor_disputes.vendor_profile_id is NOT NULL + FK → vendor_profiles. We
 *    resolve it from event_vendors.marketplace_vendor_id; if the booking is an
 *    off-platform/manual vendor with no marketplace profile we SKIP (there's
 *    nothing for the cron to demote and the FK would reject anyway).
 *  • CHECK (payout_id IS NOT NULL OR order_id IS NOT NULL): we link the most
 *    recent matching order when one exists. When neither an order nor a payout
 *    is on file (the common case — vendor money is off-platform), the insert
 *    can't satisfy the CHECK, so the whole helper is fail-soft: the caller's
 *    completion write must always commit regardless.
 *  • Idempotent: re-reporting the same event+vendor must not stack duplicate
 *    open disputes. vendor_disputes has no event_id column, so we dedupe on the
 *    linked order_id when present, else on (vendor_profile_id, opened_by, open).
 *
 * Returns void; never throws — wrapped fail-soft by design.
 */
async function openCompletionDispute(
  admin: ReturnType<typeof createAdminClient>,
  args: {
    eventId: string;
    vendorId: string; // event_vendors.vendor_id (the UUID PK)
    openedByUserId: string | null;
    category: 'no_show' | 'quality_issue';
    description: string;
  },
): Promise<void> {
  try {
    // 1. Resolve the marketplace vendor_profile_id for this booking.
    const { data: evRow } = await admin
      .from('event_vendors')
      .select('marketplace_vendor_id')
      .eq('event_id', args.eventId)
      .eq('vendor_id', args.vendorId)
      .maybeSingle();
    const vendorProfileId =
      (evRow as { marketplace_vendor_id: string | null } | null)
        ?.marketplace_vendor_id ?? null;
    if (!vendorProfileId) return; // off-platform vendor — nothing to demote.

    // 2. Find a linked order for the CHECK (payout_id OR order_id). orders.vendor_profile_id
    //    is usually NULL today (couple-side orders rarely pin a vendor), so this
    //    may be null — in which case the insert below will fail the CHECK and be
    //    swallowed by the outer catch. That's acceptable: the demotion chain is
    //    re-armed for the orders that DO link a vendor, and is a no-op (logged)
    //    otherwise, while the caller's completion write always commits.
    const { data: orderRow } = await admin
      .from('orders')
      .select('order_id')
      .eq('event_id', args.eventId)
      .eq('vendor_profile_id', vendorProfileId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const orderId = (orderRow as { order_id: string } | null)?.order_id ?? null;

    // 3. Idempotency — don't stack duplicate OPEN disputes for the same booking.
    let dedupe = admin
      .from('vendor_disputes')
      .select('dispute_id')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('status', 'open');
    dedupe = orderId
      ? dedupe.eq('order_id', orderId)
      : args.openedByUserId
        ? dedupe.eq('opened_by_user_id', args.openedByUserId).eq('category', args.category)
        : dedupe.eq('category', args.category);
    const { data: existing } = await dedupe.limit(1).maybeSingle();
    if (existing) return; // already an open dispute for this booking.

    // 4. Insert. counts_toward_demotion=true so the cron's rolling window picks
    //    it up (status defaults to 'open'). order_id only when found.
    const { error: insErr } = await admin.from('vendor_disputes').insert({
      vendor_profile_id: vendorProfileId,
      order_id: orderId,
      opened_by_user_id: args.openedByUserId,
      category: args.category,
      description: args.description,
      counts_toward_demotion: true,
    });
    if (insErr) {
      // eslint-disable-next-line no-console
      console.error(
        `[openCompletionDispute] insert skipped (event_id=${args.eventId} vendor_id=${args.vendorId}):`,
        insErr.message,
      );
    }
  } catch (e) {
    // Fail-soft — the caller's completion write is the primary action.
    // eslint-disable-next-line no-console
    console.error('[openCompletionDispute] failed (non-fatal):', e);
  }
}

/** Star-rated axes submitted by StarRatingInput (1–5 continuous). */
const STAR_AXES: ReadonlyArray<ReviewAxis> = [
  'overall',
  'communication',
  'quality',
  'value',
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
 * on_time is binary: the OnTimeBinaryInput posts 5 (Yes) or 1 (No).
 * We accept only these two integers so the server enforces the same
 * contract the UI expresses — never a mid-range value the toggle can't set.
 */
function parseOnTimeRating(raw: FormDataEntryValue | null): number {
  if (typeof raw !== 'string' || raw === '') {
    throw new Error('Please tell us if they arrived on time.');
  }
  const n = Number(raw);
  if (n !== 5 && n !== 1) {
    throw new Error('On-time answer must be Yes (5) or No (1).');
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
 *
 * "Host" = the couple OR a delegated coordinator. The host ★ review is the
 * event's verdict on the vendor; the coordinator acts on the couple's behalf.
 * We admit both with the canonical `.in('member_type', ['couple','coordinator'])`
 * membership check used verbatim by the sibling host-side actions
 * (coupleConfirmReceived / coupleReportNonDelivery). The DB-level RLS
 * (current_couple_or_coordinator_event_ids) is the real gate; this fails fast
 * with a clean redirect for non-members instead of bubbling an RLS error.
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
  for (const axis of STAR_AXES) {
    ratings[axis] = parseRating(formData.get(`rating_${axis}`));
  }
  // on_time is binary: Yes=5, No=1 — enforced separately.
  ratings['on_time'] = parseOnTimeRating(formData.get('rating_on_time'));

  const bodyRaw = formData.get('body');
  let body: string | null = null;
  if (typeof bodyRaw === 'string') {
    const trimmed = bodyRaw.trim();
    if (trimmed.length > 500) {
      throw new Error('Review body must be 500 characters or fewer.');
    }
    body = trimmed.length > 0 ? trimmed : null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Host gate — the couple OR a delegated coordinator of THIS event may submit
  // the host review. Matches the sibling handshake actions verbatim.
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .in('member_type', ['couple', 'coordinator'])
    .maybeSingle();
  if (!membership) redirect(`/dashboard/${eventId}`);

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

  // Update vendor quality scores (Vendor_Quality_Rating_System_2026-06-17.md §5).
  // triggerVendorActivityRecompute is a fire-and-forget wrapper; it lives in
  // lib/vendor-activity.ts which ships as a separate PR. The dynamic import +
  // outer try/catch means this block is fully inert until the module lands —
  // the review still succeeds, scores just don't refresh yet.
  try {
    const { triggerVendorActivityRecompute } = await import('@/lib/vendor-activity') as {
      triggerVendorActivityRecompute: (id: string) => Promise<void>;
    };
    after(() => triggerVendorActivityRecompute(vendorProfileId));
  } catch {
    // vendor-activity.ts not yet merged — scores will be recomputed when it ships.
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

/**
 * Host-side completion handshake (Event Lifecycle Menu §6.1). After the
 * vendor marks the service complete, the host either confirms they received
 * everything — which unlocks the review + galleries — or reports a problem,
 * which freezes the gate (a non-delivery dispute) until it resolves.
 *
 * "Host" = the couple OR a delegated coordinator (lifecycle spec: "Couple
 * (host) / Coordinator — either may drive; coordinator is the delegated host").
 * We admit both with the canonical `.in('member_type', ['couple','coordinator'])`
 * event-membership check used verbatim by the sibling host-side actions
 * (setEventCeremonyType / updateEventBasics / closeOutTheDay). Both then write
 * via the admin client (the completion columns have no host-update RLS path)
 * and are idempotent. Scope stays tight to genuine members of THIS event.
 */
export async function coupleConfirmReceived(formData: FormData) {
  const eventId = formData.get('event_id');
  const vendorId = formData.get('vendor_id');
  if (typeof eventId !== 'string' || typeof vendorId !== 'string') {
    throw new Error('Invalid input');
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .in('member_type', ['couple', 'coordinator'])
    .maybeSingle();
  if (!membership) redirect(`/dashboard/${eventId}`);

  const admin = createAdminClient();
  // .select() so we learn whether a row actually flipped (it returns [] on the
  // idempotent re-run / not-yet-marked-complete cases) AND grab the booking's
  // marketplace_vendor_id + vendor_name in the same round-trip — both feed the
  // vendor-side notify + score recompute below, which must fire ONCE, on the
  // real first confirm only.
  const { data: confirmedRows } = await admin
    .from('event_vendors')
    .update({
      customer_confirmed_received_at: new Date().toISOString(),
      completion_status: 'confirmed',
    })
    .eq('event_id', eventId)
    .eq('vendor_id', vendorId)
    .not('service_marked_complete_at', 'is', null) // only after the vendor marked complete
    .is('customer_confirmed_received_at', null) // idempotent
    .select('marketplace_vendor_id, vendor_name');

  const confirmed = (confirmedRows ?? [])[0] as
    | { marketplace_vendor_id: string | null; vendor_name: string | null }
    | undefined;

  // Only on the real first confirm: tell the VENDOR (the other side of the
  // handshake — they previously only learned by reopening the brief) and refresh
  // their quality scores so the finalized booking counts. Off-platform vendors
  // (no marketplace profile) have no user/profile to reach — safely skipped.
  if (confirmed?.marketplace_vendor_id) {
    const marketplaceVendorId = confirmed.marketplace_vendor_id;

    // completion_accepted → vendor (best-effort, fail-soft). The couple can't
    // read the vendor's user_id by RLS, so resolve it with the admin client —
    // same vendor-resolution pattern as submitCoupleReview's review_received.
    try {
      const [{ data: profileRow }, { data: eventRow }] = await Promise.all([
        admin
          .from('vendor_profiles')
          .select('user_id')
          .eq('vendor_profile_id', marketplaceVendorId)
          .maybeSingle(),
        admin.from('events').select('display_name').eq('event_id', eventId).maybeSingle(),
      ]);
      const vendorUserId = (profileRow as { user_id: string | null } | null)?.user_id ?? null;
      if (vendorUserId) {
        const coupleName =
          (eventRow as { display_name: string | null } | null)?.display_name ?? 'The couple';
        await emitNotification({
          userId: vendorUserId,
          type: 'completion_accepted',
          title: `${coupleName} confirmed your service`,
          body: `${coupleName} confirmed they received everything — add a moment to their story.`,
          relatedUrl: `/vendor-dashboard/clients/${eventId}/editorial-media`,
        });
      }
    } catch (e) {
      // Fail-soft — the confirm already committed; never block the couple.
      // eslint-disable-next-line no-console
      console.error(
        `[coupleConfirmReceived] completion_accepted notify failed for marketplace_vendor_id=${marketplaceVendorId} event_id=${eventId}:`,
        e,
      );
    }

    // Refresh the vendor's quality scores so the finalized booking is reflected
    // (Vendor_Quality_Rating_System §5). Fire-and-forget via after() — the
    // wrapper never throws, so a recompute hiccup can't affect the confirm.
    try {
      const { triggerVendorActivityRecompute } = (await import('@/lib/vendor-activity')) as {
        triggerVendorActivityRecompute: (id: string) => Promise<void>;
      };
      after(() => triggerVendorActivityRecompute(marketplaceVendorId));
    } catch {
      // vendor-activity unavailable — scores refresh on the next trigger.
    }
  }

  revalidatePath(`/dashboard/${eventId}/vendors/${vendorId}/review`);
  redirect(`/dashboard/${eventId}/vendors/${vendorId}/review`);
}

/**
 * Host-side non-delivery report — the other branch of the §6.1 handshake.
 * Admits the couple OR a delegated coordinator via the same canonical
 * `.in('member_type', ['couple','coordinator'])` membership check (lifecycle
 * spec: "coordinator is the delegated host"). Writes via the admin client and
 * is idempotent (can't dispute an already-confirmed delivery).
 */
export async function coupleReportNonDelivery(formData: FormData) {
  const eventId = formData.get('event_id');
  const vendorId = formData.get('vendor_id');
  if (typeof eventId !== 'string' || typeof vendorId !== 'string') {
    throw new Error('Invalid input');
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .in('member_type', ['couple', 'coordinator'])
    .maybeSingle();
  if (!membership) redirect(`/dashboard/${eventId}`);

  const admin = createAdminClient();
  await admin
    .from('event_vendors')
    .update({
      completion_status: 'disputed',
      completion_disputed_at: new Date().toISOString(),
    })
    .eq('event_id', eventId)
    .eq('vendor_id', vendorId)
    .neq('completion_status', 'confirmed'); // can't dispute an already-confirmed delivery

  // Re-arm the demotion chain (cross-account QA, 2026-06-19): also open a
  // vendor_disputes row so the 30-day dispute-counter cron can see it. The
  // helper is idempotent + fail-soft, so a repeat report or an off-platform
  // vendor is a safe no-op and never blocks the completion write above.
  await openCompletionDispute(admin, {
    eventId,
    vendorId,
    openedByUserId: user.id,
    category: 'no_show',
    description:
      'Couple reported non-delivery via the completion handshake — the service was not delivered.',
  });

  revalidatePath(`/dashboard/${eventId}/vendors/${vendorId}/review`);
  redirect(`/dashboard/${eventId}/vendors/${vendorId}/review`);
}

/**
 * Recommend-your-vendors (Event Lifecycle Menu §6.3). Separate from the review:
 * a per-vendor, opt-in, reversible "I'd recommend them" that builds the couple's
 * Recommended list. Writes through the USER's client so the RLS INSERT gate
 * enforces the anti-fake completion requirement (layers 1+2) — a couple can only
 * recommend a vendor whose service ran the full lifecycle to completion for this
 * event. Upsert on the unique (vendor_profile_id, event_id, recommended_by_user_id)
 * key so re-submitting edits the one-line endorsement instead of erroring.
 */
export async function recommendVendor(formData: FormData) {
  const eventId = formData.get('event_id');
  const vendorId = formData.get('vendor_id');
  const vendorProfileId = formData.get('vendor_profile_id');
  if (
    typeof eventId !== 'string' ||
    typeof vendorId !== 'string' ||
    typeof vendorProfileId !== 'string'
  ) {
    throw new Error('Invalid input');
  }
  const endorsementRaw = formData.get('endorsement');
  let endorsement: string | null = null;
  if (typeof endorsementRaw === 'string') {
    const trimmed = endorsementRaw.trim();
    if (trimmed.length > 280) throw new Error('Endorsement must be 280 characters or fewer.');
    endorsement = trimmed.length > 0 ? trimmed : null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.from('vendor_recommendations').upsert(
    {
      vendor_profile_id: vendorProfileId,
      event_id: eventId,
      recommended_by_user_id: user.id,
      endorsement,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'vendor_profile_id,event_id,recommended_by_user_id' },
  );
  // RLS rejects when the completion gate isn't met — route back with a flag so
  // the page can explain why (rather than a generic crash).
  if (error) {
    redirect(`/dashboard/${eventId}/vendors/${vendorId}/review?recommend=blocked`);
  }

  // review_received-style signal → vendor (best-effort, fail-soft). The couple
  // can't read the vendor's user_id by RLS, so use the admin client.
  try {
    const adminClient = createAdminClient();
    const [{ data: profileRow }, { data: eventRow }] = await Promise.all([
      adminClient
        .from('vendor_profiles')
        .select('user_id')
        .eq('vendor_profile_id', vendorProfileId)
        .maybeSingle(),
      adminClient.from('events').select('display_name').eq('event_id', eventId).maybeSingle(),
    ]);
    const vendorUserId = (profileRow as { user_id: string | null } | null)?.user_id ?? null;
    if (vendorUserId) {
      const eventDisplay =
        (eventRow as { display_name: string } | null)?.display_name ?? 'A couple';
      await emitNotification({
        userId: vendorUserId,
        type: 'review_received',
        title: 'A couple recommended you',
        body: `${eventDisplay} added you to their recommended vendors. It now shows on your marketplace profile and their event page.`,
        relatedUrl: '/vendor-dashboard/reviews',
      });
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(
      `[recommendVendor] notify failed for vendor_profile_id=${vendorProfileId} event_id=${eventId}:`,
      e,
    );
  }

  revalidatePath(`/dashboard/${eventId}/vendors/${vendorId}/review`);
  redirect(`/dashboard/${eventId}/vendors/${vendorId}/review?recommend=on`);
}

/** Withdraw a recommendation (reversible). RLS scopes the delete to own rows. */
export async function withdrawRecommendation(formData: FormData) {
  const eventId = formData.get('event_id');
  const vendorId = formData.get('vendor_id');
  const vendorProfileId = formData.get('vendor_profile_id');
  if (
    typeof eventId !== 'string' ||
    typeof vendorId !== 'string' ||
    typeof vendorProfileId !== 'string'
  ) {
    throw new Error('Invalid input');
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase
    .from('vendor_recommendations')
    .delete()
    .eq('event_id', eventId)
    .eq('vendor_profile_id', vendorProfileId)
    .eq('recommended_by_user_id', user.id);

  revalidatePath(`/dashboard/${eventId}/vendors/${vendorId}/review`);
  redirect(`/dashboard/${eventId}/vendors/${vendorId}/review?recommend=off`);
}
