// Papic Games — Phase 4b + Photo Challenge (owner 2026-07-22): the VENDOR panel
// on a booked, Papic-active event. A booked Pro/Enterprise vendor pays ₱400 to
// SPONSOR Photo Challenge for this event, then authors custom challenges that
// land pending the couple's approval (§3.6). Async SERVER component —
// self-fetches the vendor's own challenges + tier + verification + sponsorship +
// Papic-active, so it adds nothing to the host page's big data-load. Self-gates
// on papicGamesEnabled(); renders null when the flag is off. Mounted after
// BoothPosterCard (booked-only) on the client-event card.

import Link from 'next/link';
import { Trophy, Check, ImageIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchVendorChallenges } from '@/lib/papic-games';
import { vendorChallengeStatus, type VendorChallengeStatus } from '@/lib/papic-missions';
import { asVendorTier } from '@/lib/vendor-tier-caps';
import { eventPapicActive } from '@/lib/papic-seats';
import {
  fetchPhotoChallengeSponsored,
  fetchVendorPhotoChallengePricePhp,
  photoChallengeEligibility,
  PHOTO_CHALLENGE_DENY_MESSAGE,
} from '@/lib/vendor-photo-challenge';
import { papicGamesEnabled } from '@/lib/papic-games-flag';
import { SubmitButton } from '@/app/_components/submit-button';
import { createVendorChallengeAction } from '../actions';
import { PhotoChallengeBuy } from './photo-challenge-buy';

const STATUS_BADGE: Record<VendorChallengeStatus, { label: string; cls: string }> = {
  pending: { label: 'Awaiting couple', cls: 'bg-mulberry/15 text-mulberry' },
  live: { label: 'Live', cls: 'bg-terracotta/15 text-terracotta' },
  rejected: { label: 'Declined', cls: 'bg-ink/10 text-ink/55' },
};

export async function VendorChallengeSection({
  eventId,
  vendorProfileId,
}: {
  eventId: string;
  vendorProfileId: string;
}) {
  if (!papicGamesEnabled()) return null;

  const supabase = await createClient();
  const admin = createAdminClient();

  // The section is mounted only when the vendor is BOOKED on the event (the host
  // page gates it behind isBooked), so booked = true here.
  const [challenges, profRow, sponsored, papicActive, pricePhp] = await Promise.all([
    fetchVendorChallenges(supabase, eventId),
    supabase
      .from('vendor_profiles')
      .select('tier_state, verification_state')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle(),
    fetchPhotoChallengeSponsored(supabase, eventId, vendorProfileId),
    eventPapicActive(admin, eventId), // needs admin: paparazzi_seats + couple orders are couple-RLS
    fetchVendorPhotoChallengePricePhp(supabase),
  ]);

  const tier = asVendorTier((profRow.data as { tier_state?: string | null } | null)?.tier_state);
  const verification =
    (profRow.data as { verification_state?: string | null } | null)?.verification_state ?? null;

  // The same pure gate the buy action enforces (booked is implied by mount).
  const eligibility = photoChallengeEligibility({
    tier,
    verification,
    booked: true,
    papicActive,
    alreadySponsored: sponsored,
  });

  return (
    <section className="rounded-2xl border border-ink/10 bg-white p-5 sm:p-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Trophy aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={2} />
        Photo Challenge
        {sponsored ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/15 px-2 py-0.5 text-[11px] font-semibold text-terracotta">
            <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            Sponsored
          </span>
        ) : null}
      </h3>
      <p className="mt-1 text-xs text-ink/55">
        Sponsor a guest photo mission at this event — ask guests to photograph your
        service (your signature dish, the booth, the pour). It&rsquo;s free and fun for
        every guest; each challenge needs the couple&rsquo;s okay before it goes live.
      </p>

      {challenges.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {challenges.map((c) => {
            const badge = STATUS_BADGE[vendorChallengeStatus(c)];
            return (
              <li
                key={c.mission_id}
                className="rounded-xl border border-ink/10 bg-white px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-ink/90">{c.prompt}</p>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.cls}`}
                  >
                    {badge.label}
                  </span>
                </div>
                {vendorChallengeStatus(c) === 'live' ? (
                  <p className="mt-1 text-xs text-ink/50">
                    {c.completions} guest{c.completions === 1 ? '' : 's'} completed
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : sponsored ? (
        <p className="mt-4 text-sm text-ink/50">No challenges yet — write your first one below.</p>
      ) : null}

      {sponsored ? (
        // Paid → the vendor may author challenges (the RPC re-checks the paid
        // sponsorship server-side) + collect the consented guest photos (Phase 5).
        <>
          <form action={createVendorChallengeAction} className="mt-4 space-y-2">
            <input type="hidden" name="event_id" value={eventId} />
            <textarea
              name="prompt"
              required
              maxLength={280}
              rows={2}
              placeholder="Order our signature calamansi mojito and show us the pour"
              className="w-full resize-none rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-terracotta/50 focus:outline-none"
            />
            <SubmitButton
              pendingLabel="Submitting"
              className="inline-flex h-11 items-center rounded-md bg-mulberry px-5 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600"
            >
              Submit for the couple&rsquo;s okay
            </SubmitButton>
          </form>
          <Link
            href={`/vendor-dashboard/clients/${eventId}/challenge-photos`}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-terracotta hover:text-terracotta/80"
          >
            <ImageIcon aria-hidden className="h-4 w-4" strokeWidth={2} />
            View shared photos
          </Link>
        </>
      ) : eligibility.ok ? (
        // Eligible to buy → the ₱400 sponsorship CTA.
        <>
          <p className="mt-4 text-sm font-medium text-ink">
            {`Sponsor Photo Challenge for this event — ₱${pricePhp.toLocaleString('en-PH')}.`}
          </p>
          <PhotoChallengeBuy eventId={eventId} pricePhp={pricePhp} />
        </>
      ) : (
        // Not eligible → the honest reason (below Pro, unverified, or Papic not active).
        <p className="mt-4 rounded-lg border border-mulberry/20 bg-mulberry/[0.05] px-3 py-2.5 text-xs text-ink/70">
          {PHOTO_CHALLENGE_DENY_MESSAGE[eligibility.reason]}
        </p>
      )}
    </section>
  );
}
