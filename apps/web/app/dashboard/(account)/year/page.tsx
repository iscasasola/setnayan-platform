import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CalendarHeart, Sparkles, Gift } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { manilaToday } from '@/lib/std-views';
import { buildYearMoments, type MomentEvent, type YearMoment } from '@/lib/year-moments';
import { dependentPeopleEnabled } from '@/lib/dependent-people-flag';
import { buildDependentMoments, type DependentForMoments } from '@/lib/dependent-moments';
import { buildDependentRiteMoments, type DependentForRites } from '@/lib/faith-rites';

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

  // Family graph (Phase 3, flag-off): fold the guardian's dependents' next
  // milestones (a child's 7th/debut, an elder's 60th) into the year. Gated —
  // inert until dependentPeopleEnabled() + counsel clearance.
  let dependentMoments: YearMoment[] = [];
  if (dependentPeopleEnabled()) {
    const { data: deps } = await supabase
      .from('dependents')
      .select('dependent_id, name, birth_date, sex, religion');
    const rows = (deps ?? []) as (DependentForMoments & { religion: string | null })[];
    dependentMoments = [
      ...buildDependentMoments(rows as DependentForMoments[], today),
      ...buildDependentRiteMoments(rows as DependentForRites[], today),
    ];
  }

  const moments = [...buildYearMoments(events, today), ...dependentMoments].sort(
    (a, b) => a.daysUntil - b.daysUntil || a.label.localeCompare(b.label),
  );
  const nudges = moments.filter((m) => m.isMilestone);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link className="sn-chip sn-press w-fit" href="/dashboard">
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} /> Back to events
      </Link>

      <header className="mt-6 space-y-2">
        <p className="sn-eye">
          <CalendarHeart aria-hidden strokeWidth={1.75} />
          The dates ahead
        </p>
        <h1 className="sn-h1">Your year</h1>
        <p className="max-w-prose text-base text-ink/65">
          The moments ahead — anniversaries, and the dates worth gathering for. Nothing here is
          on your plate yet; tap one when you’re ready to plan it.
        </p>
      </header>

      {nudges.length > 0 ? (
        <section className="mt-8">
          <h2 className="sn-sec">Worth planning for</h2>
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
        <h2 className="sn-sec">The year ahead</h2>
        {moments.length === 0 ? (
          <p className="sn-tile mt-3 px-4 py-8 text-center text-sm text-ink/55">
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
        'sn-row flex items-center gap-4 px-4 py-3.5 transition-colors',
        highlight
          ? 'border-gold/40 bg-gold/[0.08] hover:bg-gold/[0.12]'
          : 'hover:bg-white/85',
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
          <span className="font-mono">{formatMoment(m.dateISO)}</span>
          {m.detail ? <span className="text-ink/40"> · {m.detail}</span> : null}
        </p>
      </div>
      <span
        className={[
          'shrink-0 whitespace-nowrap font-mono text-xs font-medium',
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
    <Link className="sn-press block" href={href}>
      {inner}
    </Link>
  );
}
