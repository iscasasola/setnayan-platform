import { getCurrentUser } from '@/lib/auth';
import { papicOwnerTag } from '@/lib/papic-upload/owner-tag.server';
import { isStoreShellRequest } from '@/lib/request-platform';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { openRailOptions } from '@/lib/payment-channels';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRoleForProfile, canManageVendor } from '@/lib/vendor-role';
import { fetchVendorRoomEventsDetailed } from '@/lib/vendor-room-access';
import { isVendorPapicCaptureEnabled } from '@/lib/vendor-dayof-flags';
import { SponsoredShotsStrip } from '../_components/sponsored-shots-strip';
import { fetchVendorEventCaptureAllowance, fetchVendorPapicPortfolioCredits } from '@/lib/vendor-papic-grants';
import { TIER_LABEL, asVendorTier } from '@/lib/vendor-tier-caps';
import { PapicDeskBody, PapicReadFailed } from '../_components/papic-desk-body';
import { OwnCapturesStrip } from '../_components/own-captures-strip';
import { PortfolioCreditsCard } from '../_components/portfolio-credits-card';
import { PortfolioAlbumSection } from '../_components/portfolio-album-section';
import { resolveEventFeeGate } from '@/lib/vendor-event-fee-access.server';
import { EventLockedPage } from '@/app/vendor-dashboard/_components/event-locked-by-fee';

export const metadata = { title: 'Papic capture · Hub' };

/** PH wall-clock today (UTC+8) as 'YYYY-MM-DD'. */
function phToday(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default async function VendorPapicCapturePage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const back = `/vendor-dashboard/on-the-day/live/${eventId}`;

  // Counsel gate — fail-closed. Until the DPO/NPC control is approved this route
  // never renders a camera.
  if (!(await isVendorPapicCaptureEnabled())) redirect(back);

  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`${back}/papic`)}`);
  }

  // ── 🔒 A FAILED READ IS SAID; A REFUSAL STILL SENDS YOU BACK (supplier pages set two, page 8, 21 Nov 2026:
  // "Papic · this event could not be read" — until now a failed read sent the supplier back to the floor with no
  // word). Each read below answers one of three ways, and the FAILED answer is decided before the REFUSED one:
  //   · failed  — the profile read threw (both projections refused), or the bookings read could not reach its end
  //               (`complete: false`, or it threw) and this event is not among what it did read → the honest page;
  //   · refused — the read answered and said no: no shop of your own, or not booked on this event → `redirect(back)`,
  //               exactly as before (the counsel switch above and the fee lock below are refusals too, unchanged).
  // None of these reads surfaces a SQLSTATE here (the profile read wraps its errors; the bookings read reports a
  // completeness flag), so "answered with no row" vs "could not answer" is the whole distinction.

  // Capture writes under the vendor's RLS client (the insert policy requires the
  // caller's OWN vendor profile + a booked event), so this surface is the vendor
  // owner/admin path. A per-event grantee views the console but can't capture.
  let profile: Awaited<ReturnType<typeof fetchOwnVendorProfile>>;
  try {
    profile = await fetchOwnVendorProfile(supabase, user.id);
  } catch {
    return <PapicReadFailed eventId={eventId} />;
  }
  if (!profile) redirect(back);

  const room = await fetchVendorRoomEventsDetailed(supabase, profile.vendor_profile_id).catch(() => null);
  const booking = room?.events.find((b) => b.eventId === eventId) ?? null;
  if (!booking && (room === null || !room.complete)) return <PapicReadFailed eventId={eventId} />;
  // Not booked on this event at all ⇒ nothing here is theirs. That check stays.
  if (!booking) redirect(back);

  // ── THE BOOKING FEE UNLOCKS THE EVENT (owner, 2026-09-20) ────────────────
  // Item 3 of the ruling — "their papic service for that event". Gated WHOLE:
  // the shutter, the allowance and the look-back gallery all belong to the
  // event, and the event is what the fee unlocks.
  // Flag OFF ⇒ 'unlocked' for everyone and this is a no-op.
  const feeGate = await resolveEventFeeGate(profile.vendor_profile_id, eventId);
  if (feeGate.stage !== 'unlocked') {
    return (
      <EventLockedPage
        eventId={eventId}
        gate={feeGate}
        threadId={booking.threadId}
        backHref={back}
        backLabel="Back to the Hub"
      />
    );
  }

  // ⚠ THE SHUTTER IS DAY-BOUND. LOOKING BACK IS NOT.
  //
  // This used to redirect away unless `bookedDate === phToday()`, and the same
  // page mounts the "what you shot" strip. So at midnight the door shut on the
  // photographer's own pictures — and the next morning, which is exactly when
  // they want to confirm a shot landed, it was closed.
  //
  // It was never a permission limit. Verified in production: the row policy on
  // these captures is "the vendor owns this profile OR is an admin", with no
  // date condition anywhere in it. The photos have always been theirs on any
  // day; only this screen disagreed.
  //
  // So the gate splits. Capture is still today-only (a camera on the wrong day
  // is a mis-tagged photo in someone's album). The gallery is not.
  const isEventDay = booking.bookedDate === phToday();

  // 📸 The plan's event limit + what this shop has taken here (service-role reads; owner 2026-11-23). Only the shutter
  // needs it, so it is not read on a look-back visit.
  const allowance = isEventDay
    ? await fetchVendorEventCaptureAllowance(
        createAdminClient(),
        profile.vendor_profile_id,
        eventId,
      )
    : null;

  // The floor console carries the same today-only gate, so sending someone
  // there after the day just bounces them through a redirect. Off-day, "back"
  // means the on-the-day list they actually came from.
  const backHref = isEventDay ? back : '/vendor-dashboard/on-the-day';

  // The credit readout + the portfolio album are NOT day-bound (a supplier
  // curates their portfolio whenever they like), so this reads on every visit,
  // not only isEventDay — the opposite scoping from `allowance` above.
  const portfolioCredits = await fetchVendorPapicPortfolioCredits(
    createAdminClient(),
    profile.vendor_profile_id,
    eventId,
  );
  // The rails the owner has left ON — the credit-pack buy offers only these.
  const openRails = openRailOptions(await fetchPlatformSettings(supabase));
  // "Put on my page" is an owner/admin press (the action refuses everyone else) — never offered to a Helper.
  const canPutOnPage = canManageVendor(await resolveVendorRoleForProfile(supabase, user.id, profile.vendor_profile_id));

  return (
    <PapicDeskBody
      eventId={eventId}
      isEventDay={isEventDay}
      backHref={backHref}
      coupleName={booking.eventName ?? 'this event'}
      capture={
        isEventDay && allowance
          ? {
              uploadOwner: papicOwnerTag('vendor', profile.vendor_profile_id, eventId),
              // An unread plan draws Free's rule with the count unread — the shutter waits and says why.
              plan: allowance.plan ?? 'free',
              planLabel: TIER_LABEL[asVendorTier(allowance.plan)],
              photosTaken: allowance.plan === null ? null : allowance.allowance.photosTaken,
            }
          : null
      }
      // What they already shot, under the shutter — read with the vendor's OWN client so the RLS policy stays the
      // boundary. After the day it is the whole point of the page.
      shotStrip={<OwnCapturesStrip supabase={supabase} eventId={eventId} />}
      // Papic credits + the pack upsell (G3) — the portfolio-import album's meter (the camera above spends nothing
      // since 2026-11-23; its limit is the plan's).
      walletCard={
        <PortfolioCreditsCard
          eventId={eventId}
          credits={portfolioCredits.credits}
          left={portfolioCredits.left}
          // 🔒 No pack for sale in the App Store / Play Store shell (guideline
          // 3.1.1; lib/store-shell.ts) — the credit count still shows.
          offerPack={portfolioCredits.offerPack && !(await isStoreShellRequest())}
          packs={portfolioCredits.packs}
          openRails={openRails}
        />
      }
      // The supplier's PRIVATE portfolio album — visibly its own section, never the couple's to see, distinct storage
      // prefix from both the host gallery and the capture strip above.
      album={
        <PortfolioAlbumSection
          supabase={supabase}
          eventId={eventId}
          creditsLeft={portfolioCredits.left}
          canPutOnPage={canPutOnPage}
          vendorProfileId={profile.vendor_profile_id}
          eventEnded={Boolean(booking.bookedDate) && String(booking.bookedDate) < phToday()}
          coupleName={booking.eventName ?? 'the couple'}
        />
      }
      // Shots guests took FOR this supplier's sponsored challenge — the only guest photographs a supplier may ever see
      // (owner 2026-08-26: "the host will allow access. they only get shots from the sponsored papic challenge"). Eight
      // gates live in the reader and are pinned by vendor-sponsored-shots-are-scoped.test.ts; it renders nothing when
      // there is nothing, so a supplier without an approved challenge never meets an empty frame.
      challenge={<SponsoredShotsStrip vendorProfileId={profile.vendor_profile_id} eventId={eventId} />}
    />
  );
}
