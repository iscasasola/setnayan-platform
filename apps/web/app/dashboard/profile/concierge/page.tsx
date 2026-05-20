/**
 * Settings → Setnayan Concierge tab (iteration 0025 § 3.7).
 *
 * 4 event-state variants (DIY · Trial · Active · Expired) + enforcement
 * overlay (none · warning · trial_banned · full_banned) per the 2026-05-17
 * Concierge lock. Single SKU `concierge_complete` at ₱2,499 (repriced from
 * ₱4,999 in CLAUDE.md row 415, 2026-05-18). Card-less
 * 3-day trial · one per account.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Sparkles, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchUserEvents } from '@/lib/events';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  CONCIERGE_ENABLED,
  CONCIERGE_PRICE_PHP,
  type ConciergeEnforcementLevel,
  type ConciergeStatus,
  daysRemaining,
  formatConciergeDate,
  sweepExpiredConcierge,
} from '@/lib/concierge';
import { startConciergeTrialFromForm, cancelConcierge } from './actions';

export const metadata = { title: 'Setnayan Concierge · Settings' };

type Props = {
  searchParams: Promise<{
    event?: string;
    trial?: string;
    cancelled?: string;
    error?: string;
  }>;
};

const TRIAL_RESULT_COPY: Record<string, { tone: 'ok' | 'warn'; message: string }> = {
  started: {
    tone: 'ok',
    message:
      "Trial started — you've got 3 days of Setnayan Concierge. Your dashboard is now in trial mode.",
  },
  already_used_on_event: {
    tone: 'warn',
    message:
      'Another host on this event already started the 3-day trial. Buy Setnayan Concierge anytime to continue.',
  },
  already_used: {
    tone: 'warn',
    message:
      "You've already used your free 3-day trial on this account. Buy Setnayan Concierge anytime to continue with the full experience.",
  },
  enforcement_blocked: {
    tone: 'warn',
    message:
      'The 3-day trial is unavailable on this account. Open the help center to appeal.',
  },
  under_review: {
    tone: 'warn',
    message:
      'Your account is under review. Contact support if you believe this is in error.',
  },
  already_active: {
    tone: 'ok',
    message: 'Trial is already running for this event.',
  },
};

export default async function ConciergePage({ searchParams }: Props) {
  const search = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Owner kill-switch (2026-05-20). Direct URL visitors get a polite
  // "Temporarily unavailable" panel instead of the live purchase flow,
  // which currently conflates the couple's ideal budget with the SKU fee
  // (see chat log). Flip CONCIERGE_ENABLED back to true once that's fixed.
  if (!CONCIERGE_ENABLED) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/profile"
          className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Back to profile
        </Link>
        <section className="mt-6 rounded-2xl border border-ink/10 bg-cream p-8 text-center">
          <Sparkles aria-hidden className="mx-auto h-8 w-8 text-terracotta" strokeWidth={1.5} />
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            Setnayan Concierge
          </h1>
          <p className="mt-2 text-base text-ink/65">
            Concierge is temporarily unavailable while we rework the purchase flow.
          </p>
          <p className="mt-1 text-sm text-ink/55">
            All your DIY planning tools — guest list, vendors, budget, mood board, schedule — stay
            fully working in the meantime.
          </p>
        </section>
      </div>
    );
  }

  // Lazy expiry sweep at the top of any Concierge-surfacing page (no-cron
  // architecture per CLAUDE.md 2026-05-14 lock / PR #47).
  const admin = createAdminClient();
  await sweepExpiredConcierge(admin);

  const [{ data: profile }, events] = await Promise.all([
    supabase
      .from('users')
      .select(
        'display_name, phone, concierge_trial_used_at, concierge_enforcement_level, concierge_enforcement_reason, concierge_enforcement_at',
      )
      .eq('user_id', user.id)
      .maybeSingle(),
    fetchUserEvents(supabase, user.id, 'couple'),
  ]);

  const activeEvents = events.filter((e) => !e.archived);
  const requestedEventId = typeof search.event === 'string' ? search.event : null;
  const selectedEvent =
    activeEvents.find((e) => e.event_id === requestedEventId) ?? activeEvents[0] ?? null;

  type ConciergeEventRow = {
    concierge_status: ConciergeStatus;
    concierge_tier: string | null;
    concierge_activated_at: string | null;
    concierge_expires_at: string | null;
    concierge_long_engagement_advised_at: string | null;
  };
  let conciergeRow: ConciergeEventRow | null = null;
  if (selectedEvent) {
    const { data: eventDetail } = await supabase
      .from('events')
      .select(
        'concierge_status, concierge_tier, concierge_activated_at, concierge_expires_at, concierge_long_engagement_advised_at',
      )
      .eq('event_id', selectedEvent.event_id)
      .maybeSingle();
    conciergeRow = (eventDetail as unknown as ConciergeEventRow | null) ?? null;
  }

  const status: ConciergeStatus = conciergeRow?.concierge_status ?? 'diy';
  const enforcementLevel: ConciergeEnforcementLevel =
    (profile?.concierge_enforcement_level as ConciergeEnforcementLevel | undefined) ?? 'none';
  const trialUsedAt = profile?.concierge_trial_used_at ?? null;

  const trialResult =
    typeof search.trial === 'string' ? TRIAL_RESULT_COPY[search.trial] ?? null : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-2">
        <Link
          href="/dashboard/profile"
          className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Back to profile
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Setnayan Concierge
        </h1>
        <p className="text-base text-ink/60">
          Optional paid SKU — single tier <strong>₱{CONCIERGE_PRICE_PHP.toLocaleString()}</strong>{' '}
          with a card-less 3-day free trial. Wedding-anchored access (12-month floor · 24-month
          cap) per the locked V1 spec.
        </p>
      </header>

      {/* One-shot status banners */}
      {trialResult ? (
        <p
          role={trialResult.tone === 'ok' ? 'status' : 'alert'}
          className={`mb-6 rounded-md border px-4 py-3 text-sm ${
            trialResult.tone === 'ok'
              ? 'border-emerald-300/60 bg-emerald-50 text-emerald-900'
              : 'border-terracotta/30 bg-terracotta/10 text-terracotta-700'
          }`}
        >
          {trialResult.message}
        </p>
      ) : null}
      {search.cancelled === '1' ? (
        <p
          role="status"
          className="mb-6 rounded-md border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Cancellation requested. Your Setnayan Concierge access will continue until your paid
          period ends — you keep what you paid for.
        </p>
      ) : null}

      {/* Enforcement overlay */}
      <EnforcementOverlay
        level={enforcementLevel}
        reason={profile?.concierge_enforcement_reason ?? null}
      />

      {/* Event picker (multi-event accounts) */}
      {activeEvents.length > 1 ? (
        <EventPicker
          events={activeEvents.map((e) => ({
            event_id: e.event_id,
            display_name: e.display_name,
          }))}
          selectedId={selectedEvent?.event_id ?? ''}
        />
      ) : null}

      {selectedEvent ? (
        enforcementLevel === 'full_banned' ? (
          <FullBannedPanel eventName={selectedEvent.display_name} />
        ) : (
          <StatusPanel
            eventId={selectedEvent.event_id}
            eventName={selectedEvent.display_name}
            status={status}
            expiresAt={conciergeRow?.concierge_expires_at ?? null}
            activatedAt={conciergeRow?.concierge_activated_at ?? null}
            trialUsedAt={trialUsedAt}
            enforcementLevel={enforcementLevel}
          />
        )
      ) : (
        <p className="rounded-xl border border-dashed border-ink/15 bg-cream p-6 text-center text-sm text-ink/60">
          Create your first event from the dashboard to see Setnayan Concierge options.
        </p>
      )}

      {/* Comparison card — always rendered below */}
      {selectedEvent ? (
        <PlanComparison
          eventId={selectedEvent.event_id}
          showTrialCta={
            !trialUsedAt &&
            enforcementLevel !== 'trial_banned' &&
            enforcementLevel !== 'full_banned' &&
            status !== 'trial' &&
            status !== 'active'
          }
        />
      ) : null}
    </div>
  );
}

function EventPicker({
  events,
  selectedId,
}: {
  events: Array<{ event_id: string; display_name: string }>;
  selectedId: string;
}) {
  return (
    <section className="mb-6 space-y-2">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Event</p>
      <div className="flex flex-wrap gap-2">
        {events.map((e) => {
          const isActive = e.event_id === selectedId;
          return (
            <Link
              key={e.event_id}
              href={`/dashboard/profile/concierge?event=${encodeURIComponent(e.event_id)}`}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-terracotta text-cream'
                  : 'bg-ink/5 text-ink/70 hover:bg-ink/10 hover:text-ink'
              }`}
            >
              {e.display_name}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function EnforcementOverlay({
  level,
  reason,
}: {
  level: ConciergeEnforcementLevel;
  reason: string | null;
}) {
  if (level === 'none') return null;
  if (level === 'full_banned') return null; // rendered below by FullBannedPanel
  if (level === 'warning') {
    return (
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900">
        <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
        <div>
          <p className="font-medium">Heads-up — your account was flagged for review</p>
          <p className="mt-1 text-amber-900/80">
            Your account was flagged once and cleared with a warning. Your 3-day trial remains
            available; further flags may limit access.
          </p>
        </div>
      </div>
    );
  }
  // trial_banned
  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-300/60 bg-rose-50 p-4 text-sm text-rose-900">
      <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
      <div className="flex-1 space-y-2">
        <p className="font-medium">3-day trial unavailable on this account</p>
        <p className="text-rose-900/80">
          You can still purchase Setnayan Concierge anytime. If you believe this is in error,
          open an appeal ticket below.
        </p>
        {reason ? (
          <p className="rounded-md bg-rose-100 px-3 py-2 text-xs text-rose-900/90">
            Reason: {reason}
          </p>
        ) : null}
        <Link
          href="/help#concierge-trial-banned-appeal"
          className="inline-flex items-center gap-1.5 rounded-md bg-rose-700 px-3 py-1.5 text-xs font-medium text-cream hover:bg-rose-800"
        >
          Why this happened — open appeal ticket →
        </Link>
      </div>
    </div>
  );
}

function FullBannedPanel({ eventName }: { eventName: string }) {
  return (
    <section className="rounded-2xl border border-rose-300/60 bg-rose-50 p-6 text-sm text-rose-900">
      <h2 className="text-lg font-semibold tracking-tight">{eventName}</h2>
      <p className="mt-2">
        Setnayan Concierge is unavailable on this account. Contact support if you believe this
        is in error.
      </p>
      <p className="mt-3 text-rose-900/75">
        Your DIY mode dashboard tools remain fully functional — only the Concierge SKU is
        gated.
      </p>
      <Link
        href="/help#concierge-full-banned-appeal"
        className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-rose-700 px-3 py-2 text-sm font-medium text-cream hover:bg-rose-800"
      >
        Open appeal ticket →
      </Link>
    </section>
  );
}

function StatusPanel({
  eventId,
  eventName,
  status,
  expiresAt,
  activatedAt,
  trialUsedAt,
  enforcementLevel,
}: {
  eventId: string;
  eventName: string;
  status: ConciergeStatus;
  expiresAt: string | null;
  activatedAt: string | null;
  trialUsedAt: string | null;
  enforcementLevel: ConciergeEnforcementLevel;
}) {
  const showTrial =
    !trialUsedAt && enforcementLevel !== 'trial_banned' && enforcementLevel !== 'full_banned';

  if (status === 'trial') {
    const days = daysRemaining(expiresAt);
    return (
      <section className="rounded-2xl border border-amber-300/60 bg-amber-50 p-6">
        <header className="mb-3 flex items-center gap-2">
          <Clock aria-hidden className="h-4 w-4 text-amber-700" strokeWidth={1.75} />
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-900/75">
            Currently · 3-day Trial
          </p>
        </header>
        <h2 className="text-2xl font-semibold tracking-tight">{eventName}</h2>
        <p className="mt-1 text-sm text-amber-900/80">
          You&rsquo;re trying the full Setnayan Concierge experience for {days ?? 0} more{' '}
          {days === 1 ? 'day' : 'days'}.
        </p>
        <p className="mt-1 text-sm text-amber-900/80">
          Trial ends: <strong>{formatConciergeDate(expiresAt)}</strong>
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/dashboard/${eventId}/orders/new?sku=concierge_complete`}
            className="button-primary"
          >
            Buy Setnayan Concierge — ₱{CONCIERGE_PRICE_PHP.toLocaleString()}
          </Link>
        </div>
      </section>
    );
  }

  if (status === 'active') {
    const days = daysRemaining(expiresAt);
    return (
      <section className="rounded-2xl border border-emerald-300/60 bg-emerald-50 p-6">
        <header className="mb-3 flex items-center gap-2">
          <CheckCircle2 aria-hidden className="h-4 w-4 text-emerald-700" strokeWidth={1.75} />
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-900/75">
            Currently · Setnayan Concierge active
          </p>
        </header>
        <h2 className="text-2xl font-semibold tracking-tight">{eventName}</h2>
        <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FactRow label="Activated" value={formatConciergeDate(activatedAt)} />
          <FactRow label="Active until" value={formatConciergeDate(expiresAt)} />
          <FactRow
            label="Days remaining"
            value={days !== null ? `${days} day${days === 1 ? '' : 's'}` : '—'}
          />
        </dl>
        {days !== null && days < 14 ? (
          <p className="mt-4 rounded-md border border-amber-300/60 bg-amber-100/60 px-3 py-2 text-xs text-amber-900">
            Renewal nudge — fewer than 14 days remaining. Buy another ₱
            {CONCIERGE_PRICE_PHP.toLocaleString()} block to extend.
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/dashboard/${eventId}/orders/new?sku=concierge_complete`}
            className="button-secondary"
          >
            Extend my plan
          </Link>
          <form action={cancelConcierge}>
            <input type="hidden" name="event_id" value={eventId} />
            <SubmitButton
              className="rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
              pendingLabel="Cancelling…"
            >
              Cancel Setnayan Concierge
            </SubmitButton>
          </form>
        </div>
      </section>
    );
  }

  if (status === 'expired') {
    return (
      <section className="rounded-2xl border border-ink/15 bg-cream p-6">
        <header className="mb-3 flex items-center gap-2">
          <Clock aria-hidden className="h-4 w-4 text-ink/60" strokeWidth={1.75} />
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Setnayan Concierge ended
          </p>
        </header>
        <h2 className="text-2xl font-semibold tracking-tight">{eventName}</h2>
        <p className="mt-1 text-sm text-ink/65">
          Your Setnayan Concierge expired on <strong>{formatConciergeDate(expiresAt)}</strong>.
          Your progress is saved — reactivate anytime to pick up where you left off.
        </p>
        <div className="mt-4">
          <Link
            href={`/dashboard/${eventId}/orders/new?sku=concierge_complete`}
            className="button-primary"
          >
            Reactivate — ₱{CONCIERGE_PRICE_PHP.toLocaleString()}
          </Link>
        </div>
      </section>
    );
  }

  // DIY
  return (
    <section className="rounded-2xl border border-ink/10 bg-cream p-6">
      <header className="mb-3 flex items-center gap-2">
        <Sparkles aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          Currently · DIY mode (free)
        </p>
      </header>
      <h2 className="text-2xl font-semibold tracking-tight">{eventName}</h2>
      <p className="mt-1 text-sm text-ink/65">
        You&rsquo;re planning on your own. All dashboard tools are available, but you won&rsquo;t get
        timeline help, deadline alerts, or vendor picks matched to your style.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={`/dashboard/${eventId}/orders/new?sku=concierge_complete`}
          className="button-primary inline-flex items-center gap-2"
        >
          <Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Buy Setnayan Concierge · ₱{CONCIERGE_PRICE_PHP.toLocaleString()}
        </Link>
        {showTrial ? (
          <form action={startConciergeTrialFromForm}>
            <input type="hidden" name="event_id" value={eventId} />
            <SubmitButton
              className="button-secondary"
              pendingLabel="Starting trial…"
            >
              Try 3 days free — no card required
            </SubmitButton>
          </form>
        ) : null}
      </div>
      {trialUsedAt && !showTrial ? (
        <p className="mt-4 rounded-md border border-ink/10 bg-ink/[0.03] px-3 py-2 text-xs text-ink/55">
          You&rsquo;ve used your free 3-day trial on this account. Buy Setnayan Concierge anytime
          to continue with the full experience.
        </p>
      ) : null}
    </section>
  );
}

function PlanComparison({
  eventId,
  showTrialCta,
}: {
  eventId: string;
  showTrialCta: boolean;
}) {
  return (
    <section className="mt-8 space-y-4">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
        Compare plans
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <article className="flex flex-col gap-2 rounded-2xl border border-ink/10 bg-cream p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            DIY mode
          </p>
          <p className="text-2xl font-semibold tracking-tight">Free</p>
          <p className="text-sm text-ink/65">
            All tools. Plan at your own pace. No timeline help.
          </p>
          <p className="mt-auto text-xs text-ink/55">Default for every event.</p>
        </article>
        <article className="flex flex-col gap-2 rounded-2xl border border-terracotta/40 bg-terracotta/[0.05] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
            Setnayan Concierge ✦
          </p>
          <p className="text-2xl font-semibold tracking-tight">
            ₱{CONCIERGE_PRICE_PHP.toLocaleString()}
          </p>
          <p className="text-xs text-ink/55">
            Wedding-anchored access · 12-month floor · 24-month cap
          </p>
          <p className="text-sm text-ink/75">
            Full 9-step roadmap, daily nudges, priority vendor matching, honeymoon planning
            included. Less than ₱25K coordinator.
          </p>
          <Link
            href={`/dashboard/${eventId}/orders/new?sku=concierge_complete`}
            className="button-primary mt-2 text-sm"
          >
            Buy ₱{CONCIERGE_PRICE_PHP.toLocaleString()}
          </Link>
        </article>
      </div>
      {showTrialCta ? (
        <p className="text-center text-sm text-ink/65">
          Not ready to commit?{' '}
          <form action={startConciergeTrialFromForm} className="inline">
            <input type="hidden" name="event_id" value={eventId} />
            <SubmitButton
              className="font-medium text-terracotta underline-offset-2 hover:underline"
              pendingLabel="Starting…"
            >
              Try 3 days free →
            </SubmitButton>
          </form>{' '}
          (no card required)
        </p>
      ) : null}
    </section>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5 rounded-md border border-ink/10 bg-cream/50 p-3">
      <dt className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">{label}</dt>
      <dd className="text-base text-ink">{value}</dd>
    </div>
  );
}
