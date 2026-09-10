import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { fetchVendorRoomEvents } from '@/lib/vendor-room-access';
import { isVendorPapicCaptureEnabled } from '@/lib/vendor-dayof-flags';
import { SponsoredShotsStrip } from '../_components/sponsored-shots-strip';
import { fetchVendorPapicAllowance, fetchVendorPapicPortfolioCredits } from '@/lib/vendor-papic-grants';
import { PapicCaptureController } from '../_components/papic-capture-controller';
import { OwnCapturesStrip } from '../_components/own-captures-strip';
import { PortfolioCreditsCard } from '../_components/portfolio-credits-card';
import { PortfolioAlbumSection } from '../_components/portfolio-album-section';

export const metadata = { title: 'Papic capture · Event Hub' };

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`${back}/papic`)}`);
  }

  // Capture writes under the vendor's RLS client (the insert policy requires the
  // caller's OWN vendor profile + a booked event), so this surface is the vendor
  // owner/admin path. A per-event grantee views the console but can't capture.
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect(back);

  const booking =
    (await fetchVendorRoomEvents(supabase, profile.vendor_profile_id)).find(
      (b) => b.eventId === eventId,
    ) ?? null;
  // Not booked on this event at all ⇒ nothing here is theirs. That check stays.
  if (!booking) redirect(back);

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

  // Derive the tier + live capture-point allowance (service-role reads). Only
  // the shutter needs it, so it is not read on a look-back visit.
  const allowance = isEventDay
    ? await fetchVendorPapicAllowance(
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

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium"
          style={{ color: 'var(--m-slate-2)' }}
        >
          <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />{' '}
          {isEventDay ? 'Back to the floor' : 'Back to the Event Hub'}
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: 'var(--m-slate-3)' }}>
          {isEventDay ? 'Papic capture' : 'What you shot'}
        </span>
      </div>

      {isEventDay && allowance ? (
        <PapicCaptureController
          eventId={eventId}
          coupleName={booking.eventName ?? 'this event'}
          tier={allowance.tier}
          allowVideo={allowance.allowVideo}
          pointsCap={allowance.pointsCap}
          pointsSpent={allowance.pointsSpent}
        />
      ) : (
        <p className="mt-4 text-sm" style={{ color: 'var(--m-slate-2)' }}>
          The camera runs on the day itself. These are the photos and clips you
          shot at {booking.eventName ?? 'this event'} — they stay here for you to
          check.
        </p>
      )}

      {/* What they already shot, under the shutter — the question on a dark
          reception floor is "did that upload?", and the answer belongs on the
          same screen. After the day it is the whole point of the page. Read
          with the vendor's OWN client so the RLS policy stays the boundary. */}
      <OwnCapturesStrip supabase={supabase} eventId={eventId} />

      {/* Papic credits + the pack upsell (G3) — reads the ONE-METER total,
          reduced by BOTH doors (on-the-day capture above, portfolio import
          below), so this number never disagrees with either. */}
      <PortfolioCreditsCard
        eventId={eventId}
        credits={portfolioCredits.credits}
        left={portfolioCredits.left}
        offerPack={portfolioCredits.offerPack}
        packPricePhp={portfolioCredits.packPricePhp}
        packCredits={portfolioCredits.packCredits}
      />

      {/* The supplier's PRIVATE portfolio album — visibly its own section,
          never the couple's to see, distinct storage prefix from both the
          host gallery and the capture strip above. */}
      <PortfolioAlbumSection
        supabase={supabase}
        eventId={eventId}
        creditsLeft={portfolioCredits.left}
      />

      {/* Shots guests took FOR this supplier's sponsored challenge — the only
          guest photographs a supplier may ever see (owner 2026-08-26: "the host
          will allow access. they only get shots from the sponsored papic
          challenge"). Eight gates live in the reader and are pinned by
          vendor-sponsored-shots-are-scoped.test.ts; it renders nothing when
          there is nothing, so a supplier without an approved challenge never
          meets an empty frame implying photographs sit behind it. */}
      <SponsoredShotsStrip
        vendorProfileId={profile.vendor_profile_id}
        eventId={eventId}
      />
    </section>
  );
}
