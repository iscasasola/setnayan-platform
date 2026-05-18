/**
 * Couple-dashboard Concierge banners (iteration 0021 § 2.0b).
 *
 * Pure server component — renders one of five inline cards based on the
 * event's `concierge_status` + the couple's `users.concierge_enforcement_level`
 * + (one-shot) `events.concierge_long_engagement_advised_at`.
 *
 * No client state. The trial-start CTA POSTs to the `startConciergeTrial`
 * server action; the "Buy" CTAs are links to the orders/new route.
 */

import Link from 'next/link';
import { Sparkles, Clock, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';
import {
  CONCIERGE_PRICE_PHP,
  type ConciergeEnforcementLevel,
  type ConciergeStatus,
  daysRemaining,
  formatConciergeDate,
} from '@/lib/concierge';
import { SubmitButton } from '@/app/_components/submit-button';
import { startConciergeTrialFromForm } from '@/app/dashboard/profile/concierge/actions';

type Props = {
  eventId: string;
  status: ConciergeStatus;
  expiresAt: string | null;
  activatedAt: string | null;
  weddingDate: string | null;
  longEngagementAdvisedAt: string | null;
  enforcementLevel: ConciergeEnforcementLevel;
  trialUsedAt: string | null;
  /** Inline status from a recent server action redirect (?concierge_trial=…) */
  trialResultStatus?: string | null;
};

const TRIAL_RESULT_MESSAGE: Record<string, { tone: 'ok' | 'warn'; copy: string }> = {
  started: {
    tone: 'ok',
    copy: 'Trial started — you have 3 days of full Setnayan Concierge.',
  },
  already_used: {
    tone: 'warn',
    copy:
      "You've used your free trial on this account. Buy Setnayan Concierge anytime to continue.",
  },
  enforcement_blocked: {
    tone: 'warn',
    copy: 'The 3-day trial is unavailable on this account. Open the help center to appeal.',
  },
  under_review: {
    tone: 'warn',
    copy:
      'Your account is under review. Contact support if you believe this is in error.',
  },
};

export function ConciergeBanner(props: Props) {
  const {
    eventId,
    status,
    expiresAt,
    activatedAt,
    weddingDate,
    longEngagementAdvisedAt,
    enforcementLevel,
    trialUsedAt,
    trialResultStatus,
  } = props;

  // Full-banned takes over everything except the inline transient message.
  if (enforcementLevel === 'full_banned') {
    return (
      <div className="space-y-3">
        <TrialResultBanner status={trialResultStatus} />
        <section className="rounded-2xl border border-rose-300/60 bg-rose-50 p-5 text-sm text-rose-900">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-rose-900/70">
            Setnayan Concierge unavailable
          </p>
          <p className="mt-2">
            Setnayan Concierge is unavailable on this account. All DIY dashboard tools remain
            functional.
          </p>
          <Link
            href="/help#concierge-full-banned-appeal"
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-rose-700 px-3 py-1.5 text-xs font-medium text-cream hover:bg-rose-800"
          >
            Open appeal ticket →
          </Link>
        </section>
      </div>
    );
  }

  const longEngagementAdvisory =
    status === 'active' &&
    !longEngagementAdvisedAt &&
    activatedAt &&
    weddingDate &&
    isWeddingBeyondCap(activatedAt, weddingDate);

  return (
    <div className="space-y-3">
      <TrialResultBanner status={trialResultStatus} />

      {status === 'diy' ? (
        <DiyBanner
          eventId={eventId}
          showTrialCta={!trialUsedAt && enforcementLevel !== 'trial_banned'}
          enforcementLevel={enforcementLevel}
        />
      ) : null}

      {status === 'trial' ? (
        <TrialBanner eventId={eventId} expiresAt={expiresAt} />
      ) : null}

      {status === 'active' ? (
        <ActiveBanner
          eventId={eventId}
          activatedAt={activatedAt}
          expiresAt={expiresAt}
        />
      ) : null}

      {longEngagementAdvisory ? (
        <LongEngagementAdvisory expiresAt={expiresAt} weddingDate={weddingDate} />
      ) : null}

      {status === 'expired' ? (
        <ExpiredBanner eventId={eventId} expiresAt={expiresAt} />
      ) : null}
    </div>
  );
}

function TrialResultBanner({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const message = TRIAL_RESULT_MESSAGE[status];
  if (!message) return null;
  return (
    <p
      role={message.tone === 'ok' ? 'status' : 'alert'}
      className={`rounded-md border px-4 py-3 text-sm ${
        message.tone === 'ok'
          ? 'border-emerald-300/60 bg-emerald-50 text-emerald-900'
          : 'border-terracotta/30 bg-terracotta/10 text-terracotta-700'
      }`}
    >
      {message.copy}
    </p>
  );
}

function DiyBanner({
  eventId,
  showTrialCta,
  enforcementLevel,
}: {
  eventId: string;
  showTrialCta: boolean;
  enforcementLevel: ConciergeEnforcementLevel;
}) {
  return (
    <section className="rounded-2xl border border-terracotta/30 bg-terracotta/[0.04] p-4 sm:p-5">
      <header className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta/15 text-terracotta">
          <Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
            Setnayan Concierge
          </p>
          <h2 className="text-base font-semibold tracking-tight text-ink">
            Try Setnayan Concierge — your wedding-planning assistant
          </h2>
          <p className="text-xs text-ink/60">
            5× cheaper than a human coordinator. Full 9-step roadmap · daily nudges · priority
            vendor matching · honeymoon planning.{' '}
            <strong className="text-ink">₱{CONCIERGE_PRICE_PHP.toLocaleString()}</strong> with a
            card-less 3-day free trial.
          </p>
        </div>
      </header>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/dashboard/${eventId}/orders/new?sku=concierge_complete`}
          className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-3 py-1.5 text-xs font-medium text-cream hover:bg-terracotta-700"
        >
          Continue with Concierge
        </Link>
        {showTrialCta ? (
          <form action={startConciergeTrialFromForm}>
            <input type="hidden" name="event_id" value={eventId} />
            <SubmitButton
              className="inline-flex items-center gap-1.5 rounded-full border border-terracotta/40 bg-cream px-3 py-1.5 text-xs font-medium text-terracotta hover:bg-terracotta/10"
              pendingLabel="Starting…"
            >
              Try 3 days free
            </SubmitButton>
          </form>
        ) : null}
        <Link
          href="/dashboard/profile/concierge"
          className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
        >
          Manage Concierge →
        </Link>
      </div>
      {enforcementLevel === 'warning' ? (
        <p className="mt-3 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Heads-up: your account was flagged once for review. The trial remains available; further
          flags may limit access.
        </p>
      ) : null}
      {enforcementLevel === 'trial_banned' ? (
        <p className="mt-3 rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-xs text-rose-900">
          The 3-day trial is unavailable on this account.{' '}
          <Link
            href="/help#concierge-trial-banned-appeal"
            className="font-medium underline-offset-2 hover:underline"
          >
            Open an appeal ticket →
          </Link>
        </p>
      ) : null}
    </section>
  );
}

function TrialBanner({
  eventId,
  expiresAt,
}: {
  eventId: string;
  expiresAt: string | null;
}) {
  const days = daysRemaining(expiresAt) ?? 0;
  return (
    <section className="rounded-2xl border border-amber-300/60 bg-amber-50 p-4 sm:p-5">
      <header className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-900">
          <Clock aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-900/75">
            Trial · {days} {days === 1 ? 'day' : 'days'} left
          </p>
          <h2 className="text-base font-semibold tracking-tight text-ink">
            You&rsquo;re on a 3-day Setnayan Concierge trial
          </h2>
          <p className="text-xs text-ink/70">
            Trial ends {formatConciergeDate(expiresAt)}. Continue with Setnayan Concierge for ₱
            {CONCIERGE_PRICE_PHP.toLocaleString()} to keep your roadmap, daily nudges, and
            priority vendor picks.
          </p>
        </div>
      </header>
      <div className="mt-3">
        <Link
          href={`/dashboard/${eventId}/orders/new?sku=concierge_complete`}
          className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-3 py-1.5 text-xs font-medium text-cream hover:bg-terracotta-700"
        >
          Upgrade for ₱{CONCIERGE_PRICE_PHP.toLocaleString()}
        </Link>
      </div>
    </section>
  );
}

function ActiveBanner({
  eventId,
  activatedAt,
  expiresAt,
}: {
  eventId: string;
  activatedAt: string | null;
  expiresAt: string | null;
}) {
  const days = daysRemaining(expiresAt);
  const monthsApprox = days !== null ? Math.max(0, Math.round(days / 30)) : null;
  return (
    <section className="rounded-2xl border border-emerald-300/60 bg-emerald-50 p-4 sm:p-5">
      <header className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-200 text-emerald-900">
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-900/75">
            Setnayan Concierge · active
          </p>
          <h2 className="text-base font-semibold tracking-tight text-ink">
            Active until {formatConciergeDate(expiresAt)}
            {monthsApprox !== null ? ` · ${monthsApprox} month${monthsApprox === 1 ? '' : 's'} remaining` : ''}
          </h2>
          <p className="text-xs text-ink/65">
            Activated {formatConciergeDate(activatedAt)}. The 9-step roadmap, daily nudges, and
            priority vendor matching are unlocked.
          </p>
        </div>
      </header>
      {days !== null && days < 14 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span>Renewal nudge — fewer than 14 days remaining.</span>
          <Link
            href={`/dashboard/${eventId}/orders/new?sku=concierge_complete`}
            className="font-medium underline-offset-2 hover:underline"
          >
            Extend for ₱{CONCIERGE_PRICE_PHP.toLocaleString()} →
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function LongEngagementAdvisory({
  expiresAt,
  weddingDate,
}: {
  expiresAt: string | null;
  weddingDate: string | null;
}) {
  const wedding = weddingDate ? new Date(weddingDate) : null;
  const exp = expiresAt ? new Date(expiresAt) : null;
  const monthsGap =
    wedding && exp
      ? Math.max(
          0,
          Math.round((wedding.getTime() - exp.getTime()) / (30 * 86_400_000)),
        )
      : 0;
  return (
    <section className="flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900">
      <Calendar aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
      <div>
        <p className="font-medium">Long-engagement advisory</p>
        <p className="mt-1 text-amber-900/80">
          Your wedding is more than 24 months away. Setnayan Concierge covers up to 24 months
          from your purchase date — you&rsquo;ll lose access ~{monthsGap} months before your wedding
          day. We recommend renewing closer to your wedding for full coverage.
        </p>
      </div>
    </section>
  );
}

function ExpiredBanner({
  eventId,
  expiresAt,
}: {
  eventId: string;
  expiresAt: string | null;
}) {
  return (
    <section className="rounded-2xl border border-ink/15 bg-cream p-4 sm:p-5">
      <header className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/10 text-ink/60">
          <AlertCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Setnayan Concierge ended
          </p>
          <h2 className="text-base font-semibold tracking-tight text-ink">
            Your Setnayan Concierge ended {expiresAt ? `on ${formatConciergeDate(expiresAt)}` : ''}
          </h2>
          <p className="text-xs text-ink/65">
            Your progress is saved — reactivate anytime to pick up where you left off.
          </p>
        </div>
      </header>
      <div className="mt-3">
        <Link
          href={`/dashboard/${eventId}/orders/new?sku=concierge_complete`}
          className="inline-flex items-center gap-1.5 rounded-full bg-terracotta px-3 py-1.5 text-xs font-medium text-cream hover:bg-terracotta-700"
        >
          Continue with Concierge — ₱{CONCIERGE_PRICE_PHP.toLocaleString()}
        </Link>
      </div>
    </section>
  );
}

function isWeddingBeyondCap(activatedAtIso: string, weddingIso: string): boolean {
  const activated = new Date(activatedAtIso);
  const wedding = new Date(weddingIso);
  if (Number.isNaN(activated.getTime()) || Number.isNaN(wedding.getTime())) return false;
  const cap = new Date(activated);
  cap.setMonth(cap.getMonth() + 24);
  return wedding.getTime() > cap.getTime();
}
