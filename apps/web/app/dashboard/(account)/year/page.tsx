import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CalendarHeart, Sparkles, Gift } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { manilaToday } from '@/lib/std-views';
import { buildYearMoments, type MomentEvent, type YearMoment } from '@/lib/year-moments';

export const metadata = { title: 'Your year' };

/**
 * "Your year" — the account-level MOMENTS calendar (date-anchor model, PR-F).
 * Every entry is DERIVED at read time from the couple's anchors (+ a small
 * authored holiday set): anniversaries recur off their anchor date, an
 * on-platform wedding surfaces its own anniversary or a countdown, Christmas
 * and Valentine's return every year. Nothing here is a stored row — a moment
 * becomes an event only when the couple taps to plan it (the go-signal).
 *
 * Deterministic + free (Rule 1); zero PII in this first cut (no birthdate path
 * — milestone birthdays arrive with the counsel-gated dependent People layer).
 */

const FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function formatMoment(iso: string): string {
  // iso is a plain YYYY-MM-DD; render at Manila noon so the civil day is stable.
  return FMT.format(new Date(`${iso}T12:00:00+08:00`));
}

function countdown(days: number): string {
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 30) return `in ${days} days`;
  const months = Math.round(days / 30);
  return months <= 1 ? 'in about a month' : `in about ${months} months`;
}

function MomentIcon({ kind }: { kind: YearMoment['kind'] }) {
  if (kind === 'holiday') return <Gift aria-hidden className="h-5 w-5" />;
  if (kind === 'wedding') return <Sparkles aria-hidden className="h-5 w-5" />;
  return <CalendarHeart aria-hidden className="h-5 w-5" />;
}

export default async function YearPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Events the user co-hosts, with just the anchor columns the derivation needs.
  const { data: rows } = await supabase
    .from('event_members')
    .select(
      `member_type,
       events:event_id (
         event_id, event_type, display_name, event_date,
         anchor_date, anchor_origin, recurs, archived
       )`,
    )
    .eq('user_id', user.id)
    .eq('member_type', 'couple');

  const events: MomentEvent[] = (rows ?? [])
    .flatMap((r) => {
      const e = (r as { events: MomentEvent | MomentEvent[] | null }).events;
      return e ? (Array.isArray(e) ? e : [e]) : [];
    })
    .filter(Boolean);

  const today = manilaToday();
  const moments = buildYearMoments(events, today);
  const nudges = moments.filter((m) => m.isMilestone);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        className="inline-flex items-center gap-1.5 text-sm text-ink/60 transition-colors hover:text-ink"
        href="/dashboard"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Back to events
      </Link>

      <header className="mt-6">
        <h1 className="font-serif text-3xl tracking-tight text-ink">Your year</h1>
        <p className="mt-2 max-w-prose text-ink/60">
          The moments ahead — anniversaries, and the dates worth gathering for. Nothing here is
          on your plate yet; tap one when you’re ready to plan it.
        </p>
      </header>

      {nudges.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-ink/50">
            Worth planning for
          </h2>
          <ul className="mt-3 space-y-3">
            {nudges.map((m) => (
              <li key={`${m.kind}-${m.dateISO}-${m.label}`}>
                <MomentCard moment={m} highlight />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-ink/50">
          The year ahead
        </h2>
        {moments.length === 0 ? (
          <p className="mt-3 rounded-xl border border-ink/10 bg-ink/[0.02] px-4 py-8 text-center text-sm text-ink/55">
            Nothing on your calendar yet. Create an anniversary or a celebration and it’ll appear
            here every year.
          </p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {moments.map((m) => (
              <li key={`all-${m.kind}-${m.dateISO}-${m.label}`}>
                <MomentCard moment={m} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function MomentCard({ moment: m, highlight = false }: { moment: YearMoment; highlight?: boolean }) {
  const inner = (
    <div
      className={[
        'flex items-center gap-4 rounded-xl border px-4 py-3.5 transition-colors',
        highlight
          ? 'border-gold/40 bg-gold/[0.06] hover:bg-gold/[0.1]'
          : 'border-ink/10 bg-ink/[0.015] hover:bg-ink/[0.04]',
      ].join(' ')}
    >
      <span
        className={[
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          highlight ? 'bg-gold/15 text-gold-deep' : 'bg-ink/[0.06] text-ink/55',
        ].join(' ')}
      >
        <MomentIcon kind={m.kind} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{m.label}</p>
        <p className="truncate text-sm text-ink/55">
          {formatMoment(m.dateISO)}
          {m.detail ? <span className="text-ink/40"> · {m.detail}</span> : null}
        </p>
      </div>
      <span
        className={[
          'shrink-0 whitespace-nowrap text-xs font-medium',
          highlight ? 'text-gold-deep' : 'text-ink/45',
        ].join(' ')}
      >
        {countdown(m.daysUntil)}
      </span>
    </div>
  );

  // A moment tied to an event links to it; a holiday prompts a create flow.
  const href = m.eventId ? `/dashboard/${m.eventId}` : '/dashboard/create-event';
  return (
    <Link className="block" href={href}>
      {inner}
    </Link>
  );
}
