import { notFound, redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { eventSkuActive } from '@/lib/entitlements';
import { ADD_ONS, addOnHref } from '@/lib/add-ons-catalog';
import { addOnOfferedForEvent } from '@/lib/add-on-event-scope';
import { getMenuLifecyclePhase } from '@/lib/day-of-mode';
import { resolveProfileByEvent } from '@/lib/event-type-profile';
import {
  AddOnDetailView,
  addOnAboutTitle,
} from '../../_components/addon-detail-view';

// Catalog-driven App Store-style detail page for every couple-side in-app
// service (the fan-out of the 2026-05-17 Panood pilot — owner 2026-06-19
// "Studio should look like the App Store so we can see info on each feature").
//
// Lives under the LITERAL `about` segment (studio/about/[addon]) — NOT
// studio/[addon]/about — so it is never shadowed by a feature's own literal
// folder (studio/papic/, studio/save-the-date/, …). One dynamic route serves
// every feature's About page. Render is shared via _components/addon-detail-view.tsx.

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ eventId: string; addon: string }> };

export async function generateMetadata({ params }: Props) {
  const { addon } = await params;
  return { title: addOnAboutTitle(addon) };
}

export default async function AddOnDetailPage({ params }: Props) {
  const { eventId, addon } = await params;

  // Owner deep-link (paid-features-auto-show, Tier 3 2026-06-25): a couple who
  // already OWNS this paid service shouldn't land on the marketing/About
  // interstitial — send them straight to the working tool. Generalizes the
  // former Patiktok-only redirect to EVERY paid service. Bundle-aware +
  // admin-approved gate (eventSkuActive covers a direct order AND the granting
  // GUIDED_PACK / MEDIA_PACK bundle; refund/cancel releases it). Admin client
  // because orders RLS is purchaser-scoped — a co-host who didn't place the
  // order is still an owner. Graceful-degrade on a missing/legacy orders table
  // (eventSkuActive → not active) falls through to the About page, never crashes.
  const entry = ADD_ONS.find((a) => a.key === addon);

  // ── EVENT-TYPE GATE (added 2026-07-31) ────────────────────────────────────
  //
  // This route had NONE. The Suite grid filters its cards by event type, but a
  // grid that hides a card does not close the URL behind it — and this page is
  // the URL. `/dashboard/<id>/studio/about/papic-guest` rendered the Papic Pool
  // pitch on event types the grid was hiding (the motivating example was
  // `travel`, then denied; allowed since 2026-08-01), and
  // `/about/save-the-date` rendered on types whose profile disables that
  // surface. Every "learn more" link in the product points here, so the deep
  // link is not exotic — it is the ordinary path with the grid skipped.
  //
  // Shares `addOnOfferedForEvent` with Suite precisely so the two cannot drift
  // again; the split between them is what let this survive.
  //
  // notFound() rather than a redirect: the couple asked for a service their
  // event type does not offer, and there is no honest "instead, try…" — bouncing
  // them to the Suite grid would imply the thing exists somewhere in it.
  let eventHasHappened = false;
  if (entry) {
    const [profile, { data: eventRow, error: eventRowError }] = await Promise.all([
      resolveProfileByEvent(eventId),
      createAdminClient()
        .from('events')
        // ⚠ the three lifecycle columns ride along in the SAME read — no extra
        // round trip. They decide whether the buy path below is still open.
        .select('community_id, event_date, event_end_date, cleared_at, timezone')
        .eq('event_id', eventId)
        .maybeSingle(),
    ]);
    if (eventRowError) {
      logQueryError('StudioAboutAddonPage.eventRow', eventRowError, { event_id: eventId }, 'graceful_degrade');
    }
    const communityId =
      (eventRow as { community_id?: string | null } | null)?.community_id ?? null;
    if (!addOnOfferedForEvent(entry, profile, communityId)) notFound();
    eventHasHappened =
      getMenuLifecyclePhase(
        (eventRow as { event_date?: string | null } | null)?.event_date ?? null,
        (eventRow as { cleared_at?: string | null } | null)?.cleared_at ?? null,
        (eventRow as { timezone?: string | null } | null)?.timezone ?? undefined,
        undefined,
        (eventRow as { event_end_date?: string | null } | null)?.event_end_date ?? null,
      ) === 'after';
  }

  /*
    ⚠ THE OWNERSHIP REDIRECT RUNS FIRST, AND THE ORDER IS THE WHOLE POINT.

    A couple who PAID for Papic and deep-links this URL the morning after must
    land on their working tool. Closing the page above this branch would hand
    them a 404 for a service they own — the opposite of the owner's ruling,
    which was about OFFERING, never about taking away what somebody bought.
  */
  if (
    entry?.serviceKey &&
    (await eventSkuActive(createAdminClient(), eventId, entry.serviceKey))
  ) {
    // Patiktok owners go to the operator booth (more specific than its index).
    redirect(
      addon === 'patiktok'
        ? `/dashboard/${eventId}/studio/patiktok/booth`
        : addOnHref(addon, eventId),
    );
  }

  /*
    Not owned, and the celebration is over: this is a buy screen for something
    that can only happen during the event. `notFound()` is the shipped refusal
    on this route — the same one the event-type scope gate uses a few lines up.
  */
  if (entry?.dayOfOnly && eventHasHappened) notFound();

  return <AddOnDetailView eventId={eventId} addon={addon} />;
}
