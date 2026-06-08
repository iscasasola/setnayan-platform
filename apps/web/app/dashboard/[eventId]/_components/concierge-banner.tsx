/**
 * Couple-dashboard Setnayan AI banner.
 *
 * RETIRED 2026-05-28 V2 cutover.
 * V1 surfaced five distinct banner variants (DIY · Trial · Active ·
 * Expired · Full-banned) keyed on the host's `concierge_status` +
 * enforcement level + long-engagement advisory. V2 retires the trial
 * mechanic, the enforcement framework, and the long-engagement advisory
 * — Setnayan AI is a single one-time purchase per event (see
 * `platform_retail_catalog_v2.TODAYS_FOCUS`). The CONCIERGE_ENABLED
 * kill-switch from V1 stays as the V2 visibility gate: while it's off
 * the banner renders nothing, so couples never see a Setnayan AI CTA
 * on event-home until the V2 purchase flow lights up post-pilot.
 *
 * Component name + prop shape kept (export `ConciergeBanner`) to avoid
 * cross-iteration import churn during cutover. Engineering rename to
 * TodaysFocusBanner is V2.x scope. Route URLs unchanged.
 *
 * Pure server component — no client state. CTAs are plain anchors.
 */

import Link from 'next/link';
import { Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  CONCIERGE_ENABLED,
  type ConciergeEnforcementLevel,
  type ConciergeStatus,
  daysRemaining,
  formatConciergeDate,
} from '@/lib/concierge';

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

export function ConciergeBanner(props: Props) {
  const {
    eventId,
    status,
    expiresAt,
    activatedAt,
    enforcementLevel,
  } = props;

  // Owner kill-switch. Hides the entire banner so couples don't see a
  // Setnayan AI CTA until the V2 purchase flow lights up post-pilot.
  if (!CONCIERGE_ENABLED) return null;

  // Full-banned takes over everything. V1 enforcement framework retained
  // during cutover; V2 schema migration retires the framework alongside.
  if (enforcementLevel === 'full_banned') {
    return (
      <section className="rounded-2xl border border-rose-300/60 bg-rose-50 p-5 text-sm text-rose-900">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-rose-900/70">
          Setnayan AI unavailable
        </p>
        <p className="mt-2">
          Setnayan AI is unavailable on this account. All DIY dashboard tools remain
          functional.
        </p>
        <Link
          href="/help#concierge-full-banned-appeal"
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-rose-700 px-3 py-1.5 text-xs font-medium text-cream hover:bg-rose-800"
        >
          Open appeal ticket →
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      {status === 'diy' ? <DiyBanner /> : null}

      {/* V1 'trial' status still renders during the cutover window since
          the V1 schema may still carry trial rows; surface as Active. */}
      {(status === 'trial' || status === 'active') ? (
        <ActiveBanner activatedAt={activatedAt} expiresAt={expiresAt} />
      ) : null}

      {status === 'expired' ? (
        <ExpiredBanner eventId={eventId} expiresAt={expiresAt} />
      ) : null}
    </div>
  );
}

function DiyBanner() {
  return (
    <section className="rounded-2xl border border-terracotta/30 bg-terracotta/[0.04] p-4 sm:p-5">
      <header className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-terracotta/15 text-terracotta">
          <Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
            Setnayan AI
          </p>
          <h2 className="text-base font-semibold tracking-tight text-ink">
            Need a hand? Setnayan AI surfaces your next planning step.
          </h2>
          <p className="text-xs text-ink/60">
            Every dashboard tool — guest list, vendors, mood board, schedule — works the same.
            Setnayan AI adds a daily &ldquo;here&rsquo;s the next step&rdquo; suggestion
            every time you open the app.
          </p>
        </div>
      </header>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-1.5 rounded-full bg-mulberry px-3 py-1.5 text-xs font-medium text-cream hover:bg-mulberry-700"
        >
          See pricing
        </Link>
        <Link
          href="/dashboard/profile/concierge"
          className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
        >
          Manage Setnayan AI →
        </Link>
      </div>
    </section>
  );
}

function ActiveBanner({
  activatedAt,
  expiresAt,
}: {
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
            Setnayan AI · active
          </p>
          <h2 className="text-base font-semibold tracking-tight text-ink">
            Active until {formatConciergeDate(expiresAt)}
            {monthsApprox !== null ? ` · ${monthsApprox} month${monthsApprox === 1 ? '' : 's'} remaining` : ''}
          </h2>
          <p className="text-xs text-ink/65">
            Activated {formatConciergeDate(activatedAt)}. Your daily planner is unlocked across
            every event surface.
          </p>
        </div>
      </header>
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
  // eventId retained on the props signature for cutover-period continuity
  // with the parent page.tsx, even though the V2 expired-state CTA routes
  // to /pricing rather than the event-scoped order form.
  void eventId;
  return (
    <section className="rounded-2xl border border-ink/15 bg-cream p-4 sm:p-5">
      <header className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink/10 text-ink/60">
          <AlertCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Setnayan AI ended
          </p>
          <h2 className="text-base font-semibold tracking-tight text-ink">
            Setnayan AI ended {expiresAt ? `on ${formatConciergeDate(expiresAt)}` : ''}
          </h2>
          <p className="text-xs text-ink/65">
            Your planning progress is saved — pick it back up anytime.
          </p>
        </div>
      </header>
      <div className="mt-3">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-1.5 rounded-full bg-mulberry px-3 py-1.5 text-xs font-medium text-cream hover:bg-mulberry-700"
        >
          See pricing
        </Link>
      </div>
    </section>
  );
}
