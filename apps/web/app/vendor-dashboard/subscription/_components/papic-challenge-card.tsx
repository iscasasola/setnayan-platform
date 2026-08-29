'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock, Lock, Trophy } from 'lucide-react';
import { useToast } from '@/app/_components/toast/toast-provider';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  sponsorPhotoChallenge,
  type PhotoChallengeActionState,
} from '../photo-challenge-actions';

/**
 * Papic Challenges card — the sellable surface on the subscription hub.
 *
 * OWNER 2026-08-28, verbatim: **"unlimited us 2500 for 4 weeks."** ₱2,500 per 28
 * days, unlimited guest photo missions, across EVERY celebration the shop is
 * booked for. It replaces the ₱400-PER-EVENT sponsorship locked 2026-07-22.
 *
 * ── WHY IT LIVES HERE AND NOT ON A CELEBRATION ──────────────────────────────
 * The old buy button sat on `/vendor-dashboard/clients/[eventId]`, a route that
 * needs a booking to exist. That was right when the thing being bought WAS one
 * celebration. A shop subscription bought from a celebration's page is a
 * purchase hidden behind a booking, so it moved to the hub where the shop's
 * other 28-day add-ons already live. The celebration page keeps the composer
 * and, when the shop has not subscribed, one link back here.
 *
 * Honest states (mirror the 3D Booth card deliberately — same register, same
 * order, so a supplier reads three add-ons and not three inventions):
 *   • Papic Games switched off → "Coming soon", NO buy CTA. We never take money
 *     for a product that cannot run.
 *   • not eligible (below Pro unless the tiered model is on, OR unverified) → a
 *     muted upsell, no CTA.
 *   • active → live chip + "active through …" + Renew.
 *   • otherwise → "Turn on Papic Challenges — ₱2,500 / 28 days".
 *
 * ⚠ THERE IS NO FREE FIRST CYCLE, and its absence is a decision, not an
 * oversight: the owner set a trial for the AI and 3D add-ons only, and that has
 * never changed. `first5Free` ("free until your 6th booking", owner 2026-07-25)
 * is a different, flag-dark perk and IS honoured.
 */

const IDLE: PhotoChallengeActionState = { status: 'idle' };
const peso = (n: number) => '₱' + n.toLocaleString('en-PH');

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export type PapicChallengeCardProps = {
  /** papicGamesEnabled() — the Papic Games master switch. Off ⇒ "Coming soon". */
  available: boolean;
  /** Tier gate (Pro+, or every tier under the 2026-07-25 model) AND verified. */
  eligible: boolean;
  /** True while the shop clears the tier gate but is NOT yet verified. */
  paidButUnverified: boolean;
  /** isPhotoChallengeSubscriptionActive(papic_challenge_expires_at). */
  active: boolean;
  /** papic_challenge_expires_at, when set. */
  expiresAt: string | null;
  /** The standing price from the admin-managed catalog (or the tiered band). */
  pricePhp: number;
  /** One cycle in days — 28. Passed in, never re-typed in copy. */
  periodDays: number;
  /** "Free until your 6th booking" is ACTIVE right now (owner 2026-07-25). */
  first5Free?: boolean;
  /** How many of the first 5 bookings remain — the honest "2 to go" line. */
  first5Remaining?: number;
};

export function PapicChallengeCard(props: PapicChallengeCardProps) {
  const {
    available,
    eligible,
    paidButUnverified,
    active,
    expiresAt,
    pricePhp,
    periodDays,
  } = props;
  const first5Free = props.first5Free === true;
  const first5Remaining = Math.max(0, Math.floor(props.first5Remaining ?? 0));

  const toast = useToast();
  const router = useRouter();
  const [state, formAction] = useActionState(sponsorPhotoChallenge, IDLE);
  const handled = useRef<PhotoChallengeActionState | null>(null);

  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (state.status === 'error') toast.error(state.message);
    if (state.status === 'activated') {
      toast.success(state.message);
      router.refresh();
    }
  }, [state, toast, router]);

  return (
    <section className="sn-tile mt-8 p-6">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-deep)' }}
        >
          <Trophy className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-ink">
              Papic Challenges — guest photo missions
            </h2>
            {active ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2 py-0.5 text-xs font-medium text-success-800">
                <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                Active
              </span>
            ) : null}
          </div>
          <p className="mt-1 max-w-prose text-sm text-ink/65">
            Ask guests to photograph your work — the signature dish, the booth, the
            pour — and collect the shots they choose to share with you. Unlimited
            challenges at every celebration you&rsquo;re booked for, not one at a
            time. Free and fun for guests; each challenge needs the
            couple&rsquo;s okay before it goes live.
          </p>
          <p className="mt-2 text-sm font-medium text-ink">
            {first5Free ? (
              <>
                Free while you&rsquo;re on your first 5 bookings
                {first5Remaining > 0 ? <> &middot; {first5Remaining} to go</> : null}, then{' '}
                {peso(pricePhp)} / {periodDays} days.
              </>
            ) : (
              <>
                {peso(pricePhp)} / {periodDays} days &middot; unlimited.
              </>
            )}
          </p>
          {active && expiresAt ? (
            <p className="mt-0.5 text-xs text-ink/55">Active through {fmtDate(expiresAt)}.</p>
          ) : null}
        </div>
      </div>

      {!available ? (
        <div
          className="mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs text-ink/60"
          style={{ borderColor: 'var(--m-line)' }}
        >
          <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          <span>
            Coming soon — guest photo missions are being finalized. You&rsquo;ll be
            able to turn Papic Challenges on here the moment they go live.
          </span>
        </div>
      ) : !eligible ? (
        <div
          className="mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs text-ink/60"
          style={{ borderColor: 'var(--m-line)' }}
        >
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
          {paidButUnverified ? (
            <span>
              Get your shop verified to unlock Papic Challenges — it&rsquo;s a
              verified-only add-on.
            </span>
          ) : (
            <span>
              Papic Challenges is available on the Pro, Enterprise, and Custom plans.
              Upgrade above to add it.
            </span>
          )}
        </div>
      ) : (
        <form action={formAction} className="mt-4">
          <input type="hidden" name="return_to" value="/vendor-dashboard/subscription" />
          {/* A ₱0 grant collects no payment, so it needs no channel. */}
          {!first5Free ? (
            <fieldset className="mb-3">
              <legend className="text-xs font-medium text-ink">Pay with</legend>
              <div className="mt-1.5 flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-1.5 text-sm text-ink/80">
                  <input type="radio" name="channel" value="bdo" defaultChecked />
                  BDO
                </label>
                <label className="inline-flex items-center gap-1.5 text-sm text-ink/80">
                  <input type="radio" name="channel" value="gcash" />
                  GCash
                </label>
              </div>
            </fieldset>
          ) : null}

          <SubmitButton
            className="inline-flex items-center gap-1.5 rounded-lg bg-terracotta-700 px-4 py-2 text-sm font-medium text-cream hover:bg-terracotta-800"
            pendingLabel={first5Free ? 'Turning on…' : 'Starting…'}
          >
            {first5Free
              ? active
                ? 'Extend Papic Challenges — still free'
                : 'Turn on Papic Challenges — free'
              : active
                ? `Renew — ${peso(pricePhp)} / ${periodDays} days`
                : `Turn on Papic Challenges — ${peso(pricePhp)} / ${periodDays} days`}
          </SubmitButton>
        </form>
      )}
    </section>
  );
}
