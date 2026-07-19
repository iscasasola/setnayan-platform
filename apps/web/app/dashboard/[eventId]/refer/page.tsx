import { redirect } from 'next/navigation';
import { Gift, Check, Hourglass, UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getMyReferral, type ReferralRedemptionSummary } from '@/lib/referral-actions';
import { isReferralProgramEnabled } from '@/lib/platform-settings';
import { CopyButton } from '@/app/_components/copy-button';

export const metadata = { title: 'Refer a couple · Setnayan' };

type Props = { params: Promise<{ eventId: string }> };

const STATUS_COPY: Record<
  ReferralRedemptionSummary['status'],
  { label: string; hint: string }
> = {
  open: {
    label: 'Signed up',
    hint: 'Waiting on their first booking',
  },
  qualified: {
    label: 'Booked their first service',
    hint: 'Your perk is on its way',
  },
  rewarded: {
    label: 'Rewarded',
    hint: 'You both received a perk',
  },
};

export default async function ReferACouplePage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Master toggle: the Refer surface is only reachable while the program is on.
  if (!(await isReferralProgramEnabled())) redirect(`/dashboard/${eventId}`);

  const referral = await getMyReferral();
  // getMyReferral returns null only if unauthenticated (already redirected) or
  // a mint failure; degrade gracefully with a calm empty state.
  if (!referral) {
    return (
      <div className="space-y-4">
        <h1 className="sn-h1">Refer a couple</h1>
        <p className="text-sm text-ink/65">
          We couldn&rsquo;t load your referral link just now. Please refresh and try again.
        </p>
      </div>
    );
  }

  const { code, shareLink, redemptions, qualifiedCount } = referral;

  return (
    <div className="space-y-6">
      <header className="sn-reveal space-y-2">
        <p className="sn-eye">Refer a couple</p>
        <h1 className="sn-h1 flex items-center gap-2">
          <Gift aria-hidden className="h-6 w-6 text-terracotta" strokeWidth={1.75} />
          Refer a couple
        </h1>
        <p className="text-sm text-ink/65">
          Planning is better together. Share your link with couples you know —
          when they book their first Setnayan service, you both get a little
          something to spend on your own event.
        </p>
      </header>

      {/* Share card — the couple's code + link + one-tap copy. */}
      <section className="sn-tile p-5 space-y-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/55">
            Your referral code
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-lg font-semibold tracking-tight text-ink">
              {code}
            </span>
            <CopyButton value={code} label="Copy code" copiedLabel="Copied" />
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-ink/55">
            Your share link
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="break-all text-sm text-ink/80">{shareLink}</span>
            <CopyButton value={shareLink} label="Copy link" copiedLabel="Copied" />
          </div>
        </div>
      </section>

      {/* Redemption status. */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink/80">
          Couples you&rsquo;ve referred
          {redemptions.length > 0 ? (
            <span className="ml-2 text-xs font-normal text-ink/55">
              {qualifiedCount} of {redemptions.length} booked their first service
            </span>
          ) : null}
        </h2>

        {redemptions.length === 0 ? (
          <div className="sn-row border-dashed flex items-start gap-3 p-4 text-sm text-ink/60">
            <UserPlus aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
            <p>
              No referrals yet. Share your link above — you&rsquo;ll see couples
              appear here as they sign up.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {redemptions.map((r) => {
              const copy = STATUS_COPY[r.status];
              const Icon =
                r.status === 'rewarded'
                  ? Check
                  : r.status === 'qualified'
                    ? Gift
                    : Hourglass;
              return (
                <li
                  key={r.referred_user_id}
                  className="sn-row flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      aria-hidden
                      className={
                        r.status === 'open'
                          ? 'h-4 w-4 text-ink/45'
                          : 'h-4 w-4 text-terracotta'
                      }
                      strokeWidth={1.9}
                    />
                    <div>
                      <p className="text-sm font-medium text-ink">{copy.label}</p>
                      <p className="text-xs text-ink/55">{copy.hint}</p>
                    </div>
                  </div>
                  <time
                    className="shrink-0 text-xs text-ink/45"
                    dateTime={r.created_at}
                  >
                    {new Date(r.created_at).toLocaleDateString('en-PH', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
