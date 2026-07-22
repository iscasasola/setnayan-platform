// Papic Games — Phase 4b: the VENDOR authoring panel (spec §3.4). A booked
// Pro-and-up vendor writes a custom Photo Challenge for this event; it lands
// pending the couple's approval (§3.6). Async SERVER component — self-fetches the
// vendor's own challenges + tier, so it adds nothing to the host page's big
// data-load. Self-gates on papicGamesEnabled(); renders null when the flag is
// off. Mounted after BoothPosterCard (booked-only) on the client-event card.

import { Trophy } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchVendorChallenges } from '@/lib/papic-games';
import { vendorChallengeStatus, type VendorChallengeStatus } from '@/lib/papic-missions';
import { resolveVendorTier } from '@/lib/vendor-feature-gate';
import type { VendorTier } from '@/lib/vendor-tier-caps';
import { papicGamesEnabled } from '@/lib/papic-games-flag';
import { SubmitButton } from '@/app/_components/submit-button';
import { createVendorChallengeAction } from '../actions';

// Paid Pro-and-up (mirrors the RPC's tier gate — pro/enterprise/custom). Below
// this the vendor sees an upsell, not a compose box.
// Paid tiers that may author a custom challenge (mirrors the RPC's gate). Owner
// 2026-07-22 extended eligibility DOWN to Solo (₱400/event for solo/pro/enterprise);
// 'custom' stays eligible. free/verified see the upsell.
const PAID_CREATE_TIERS: readonly VendorTier[] = ['solo', 'pro', 'enterprise', 'custom'];

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
  const [challenges, tier] = await Promise.all([
    fetchVendorChallenges(supabase, eventId),
    resolveVendorTier(supabase, vendorProfileId),
  ]);
  const canCreate = PAID_CREATE_TIERS.includes(tier);

  return (
    <section className="rounded-2xl border border-ink/10 bg-white p-5 sm:p-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Trophy aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={2} />
        Photo Challenges
      </h3>
      <p className="mt-1 text-xs text-ink/55">
        Ask guests to photograph your service — your signature dish, the booth, the
        pour. Each one needs the couple&rsquo;s okay before it goes live.
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
      ) : (
        <p className="mt-4 text-sm text-ink/50">No challenges yet.</p>
      )}

      {canCreate ? (
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
      ) : (
        <p className="mt-4 rounded-lg border border-mulberry/20 bg-mulberry/[0.05] px-3 py-2.5 text-xs text-ink/70">
          Custom challenges are a <span className="font-semibold">paid-plan</span> feature —
          upgrade to <span className="font-semibold">Solo</span> or higher to author them at
          every event you&rsquo;re booked for. (The free auto booth mission is already live
          for your guests.)
        </p>
      )}
    </section>
  );
}
