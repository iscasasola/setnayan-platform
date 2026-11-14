// Papic Games — Phase 4b + Papic Challenges: the VENDOR panel on a booked,
// Papic-active celebration. The shop authors custom challenges that land pending
// the couple's approval (§3.6).
//
// ⚠ IT IS NO LONGER A BUY SURFACE. Owner 2026-08-28 — "unlimited us 2500 for 4
// weeks" — replaced the ₱400-per-event sponsorship with a ₱2,500 / 28-day
// SHOP subscription, so there is nothing here to buy for THIS celebration. This
// panel now answers one question — can this shop run a challenge HERE? (booked +
// Papic active + entitled) — and when the answer is "not subscribed" it links to
// the one place the subscription is turned on. Keeping a buy button on a page
// that requires an event would have kept the purchase behind a booking, which is
// exactly what the repricing moves it off.
//
// Async SERVER component — self-fetches the vendor's own challenges + tier +
// entitlement + Papic-active, so it adds nothing to the host page's big
// data-load. Self-gates on papicGamesEnabled(); renders null when the flag is
// off. Mounted after BoothPosterCard (booked-only) on the client-event card.

import { ActionButton } from '@/components/action-button';
import { Badge, type BadgeTone } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';
import Link from 'next/link';
import { Trophy, ImageIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchVendorChallenges } from '@/lib/papic-games';
import {
  displayChallengePrompt,
  vendorChallengeStatus,
  type VendorChallengeStatus,
} from '@/lib/papic-missions';
import { eventPapicActive } from '@/lib/papic-seats';
import {
  fetchPhotoChallengeEntitled,
  photoChallengeEventReady,
  PHOTO_CHALLENGE_DENY_MESSAGE,
} from '@/lib/vendor-photo-challenge';
import { papicGamesEnabled } from '@/lib/papic-games-flag';
import { SubmitButton } from '@/app/_components/submit-button';
import { createVendorChallengeAction } from '../actions';
import { ShopCard } from '../../../_components/kit';
import { formatCount } from '@/lib/format-number';
import { StayForm } from '@/app/_components/stay-form';

const STATUS_BADGE: Record<VendorChallengeStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Awaiting couple', tone: 'wait' },
  live: { label: 'Live', tone: 'ok' },
  rejected: { label: 'Declined', tone: 'no' },
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
  const [challenges, entitled, papicActive] = await Promise.all([
    fetchVendorChallenges(supabase, eventId),
    // The shop's live 28-day window, or a legacy per-event sponsorship. Read with
    // the ADMIN client: papic_challenge_expires_at is a paid entitlement column
    // and a read the session could refuse would degrade to "not entitled",
    // hiding the composer from somebody who is paying for it.
    fetchPhotoChallengeEntitled(admin, eventId, vendorProfileId),
    eventPapicActive(admin, eventId), // needs admin: paparazzi_seats + couple orders are couple-RLS
  ]);

  // The same pure decision the database re-asks in vendor_papic_challenge_entitled
  // (booked is implied by mount).
  const ready = photoChallengeEventReady({ booked: true, papicActive, entitled });

  return (
    <ShopCard pad="roomy">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Trophy aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={2} />
        Papic Challenges
        {entitled ? (
          <Badge tone="ok" data="challenges-on">On</Badge>
        ) : null}
      </h3>
      <div className="mt-1 text-[13px] text-ink/70">
        <InfoTip label="Set a guest photo mission at this event" align="start">
          Ask guests to photograph your service (your signature dish, the booth, the pour). It&rsquo;s free and fun for
          every guest; each challenge needs the couple&rsquo;s okay before it goes live.
        </InfoTip>
      </div>

      {challenges.length > 0 ? (
        <ul className="mt-3">
          {challenges.map((c) => {
            const badge = STATUS_BADGE[vendorChallengeStatus(c)];
            return (
              <li
                key={c.mission_id}
                className="min-h-14 border-b border-ink/10 py-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-ink/90">{displayChallengePrompt(c.prompt)}</p>
                  <Badge tone={badge.tone} data="challenge-status">{badge.label}</Badge>
                </div>
                {vendorChallengeStatus(c) === 'live' ? (
                  <p className="mt-1 text-xs text-ink/70">
                    {formatCount(c.completions)} guest{c.completions === 1 ? '' : 's'} completed
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : ready.ok ? (
        <p className="mt-4 text-sm text-ink/70">No challenges yet — write your first one below.</p>
      ) : null}

      {ready.ok ? (
        // Entitled → the vendor may author challenges (the RPC re-checks the paid
        // entitlement server-side) + collect the consented guest photos (Phase 5).
        <>
          <StayForm door="supClients.createVendorChallengeAction" action={createVendorChallengeAction} className="mt-4 space-y-2">
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
          </StayForm>
          <div className="mt-3">
            <ActionButton
              tone="info"
              href={`/vendor-dashboard/clients/${eventId}/challenge-photos`}
              icon={<ImageIcon aria-hidden className="h-4 w-4" strokeWidth={2} />}
              label="View shared photos"
            />
          </div>
        </>
      ) : (
        // Not ready → the honest reason. "not_subscribed" is the only one the
        // shop can act on, so it is the only one that carries a way forward —
        // and that way forward leaves this page, because the subscription is
        // bought by the shop and not for this celebration.
        <div className="mt-4 rounded-lg border border-mulberry/20 bg-mulberry/[0.05] px-3 py-2.5 text-xs text-ink/70">
          <p>{PHOTO_CHALLENGE_DENY_MESSAGE[ready.reason]}</p>
          {ready.reason === 'not_subscribed' ? (
            <Link
              href="/vendor-dashboard/subscription"
              className="mt-2 inline-flex min-h-11 items-center gap-1.5 font-semibold text-link underline"
            >
              Turn on Papic Challenges
            </Link>
          ) : null}
        </div>
      )}
    </ShopCard>
  );
}
