import Link from 'next/link';
import { ArrowUpRight, CalendarHeart, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { manilaToday } from '@/lib/std-views';
import { buildYearMoments, type MomentEvent, type YearMoment } from '@/lib/year-moments';

/**
 * "Your year" home strip (date-anchor model). A compact, self-fetching preview
 * of the couple's next few DERIVED moments (anniversaries · wedding countdowns),
 * surfaced on the launcher home so the lifecycle model is felt where users land
 * — the design's "Year view ≈ the Membership home surface".
 *
 * Holidays are intentionally excluded here (they live in the full /dashboard/year
 * view) so the home strip stays PERSONAL. Renders nothing when the user has no
 * anchors yet — zero home clutter, zero PII (no birthdate path; that's PR-D).
 */

const HOME_LIMIT = 3;

const FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  month: 'short',
  day: 'numeric',
});

function fmt(iso: string): string {
  return FMT.format(new Date(`${iso}T12:00:00+08:00`));
}

function countdown(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 30) return `in ${days} days`;
  const months = Math.round(days / 30);
  return months <= 1 ? 'in ~1 month' : `in ~${months} months`;
}

export async function YearMomentsStrip({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('event_members')
    .select(
      `member_type,
       events:event_id (
         event_id, event_type, display_name, event_date,
         anchor_date, anchor_origin, recurs, archived
       )`,
    )
    .eq('user_id', userId)
    .eq('member_type', 'couple');

  const events: MomentEvent[] = (rows ?? []).flatMap((r) => {
    const e = (r as { events: MomentEvent | MomentEvent[] | null }).events;
    return e ? (Array.isArray(e) ? e : [e]) : [];
  });

  // Personal anchor moments only — holidays stay in the full Year view.
  const moments = buildYearMoments(events, manilaToday(), { includeHolidays: false });
  if (moments.length === 0) return null;

  const shown = moments.slice(0, HOME_LIMIT);

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">Your year</h2>
        <Link
          className="inline-flex items-center gap-1 text-xs font-medium text-gold-deep transition-colors hover:text-ink"
          href="/dashboard/year"
        >
          See your year <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
      </div>
      <ul className="space-y-2.5">
        {shown.map((m) => (
          <li key={`${m.kind}-${m.dateISO}-${m.label}`}>
            <MomentRow moment={m} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function MomentRow({ moment: m }: { moment: YearMoment }) {
  const Icon = m.kind === 'wedding' ? Sparkles : CalendarHeart;
  const href = m.eventId ? `/dashboard/${m.eventId}` : '/dashboard/year';
  return (
    <Link
      className={[
        'flex items-center gap-3.5 rounded-xl border px-4 py-3 transition-colors',
        m.isMilestone
          ? 'border-gold/40 bg-gold/[0.06] hover:bg-gold/[0.1]'
          : 'border-ink/10 bg-ink/[0.015] hover:bg-ink/[0.04]',
      ].join(' ')}
      href={href}
    >
      <span
        className={[
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          m.isMilestone ? 'bg-gold/15 text-gold-deep' : 'bg-ink/[0.06] text-ink/55',
        ].join(' ')}
      >
        <Icon aria-hidden className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{m.label}</p>
        <p className="truncate text-xs text-ink/50">{fmt(m.dateISO)}</p>
      </div>
      <span
        className={[
          'shrink-0 whitespace-nowrap text-xs font-medium',
          m.isMilestone ? 'text-gold-deep' : 'text-ink/45',
        ].join(' ')}
      >
        {countdown(m.daysUntil)}
      </span>
    </Link>
  );
}
