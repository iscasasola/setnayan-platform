import { createClient } from '@/lib/supabase/server';
import { manilaToday } from '@/lib/std-views';
import { buildYearMoments, type MomentEvent } from '@/lib/year-moments';
import { YearMomentsList, type YearMomentView } from './year-moments-list';

/**
 * "Your year" home strip (date-anchor model). A compact, self-fetching preview
 * of the couple's DERIVED moments (anniversaries · wedding countdowns), surfaced
 * on the launcher home so the lifecycle model is felt where users land — the
 * design's "Year view ≈ the Membership home surface".
 *
 * Holidays are intentionally excluded here (they live in the full /dashboard/year
 * view) so the home strip stays PERSONAL. Renders nothing when the user has no
 * anchors yet — zero home clutter, zero PII (no birthdate path; that's PR-D).
 *
 * Per the owner rule (2026-07-13) the strip no longer links out to
 * /dashboard/year: it shows the first few moments and expands the rest INLINE
 * via <YearMomentsList>. Event moments still deep-link into their dashboards.
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

  // Precompute display strings server-side (Asia/Manila) so the client list
  // never re-derives dates or timezones.
  const views: YearMomentView[] = moments.map((m) => ({
    key: `${m.kind}-${m.dateISO}-${m.label}`,
    isWedding: m.kind === 'wedding',
    label: m.label,
    dateLabel: fmt(m.dateISO),
    countdownLabel: countdown(m.daysUntil),
    isMilestone: m.isMilestone,
    eventId: m.eventId ?? null,
  }));

  // "This year" sub-heading — the strip renders INSIDE the Alaala section
  // (owner-approved final home design 2026-07-15); its old standalone
  // "Your year" section merged into Alaala, killing the events/year dupe.
  return (
    <div>
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/40">
        This year
      </h3>
      <YearMomentsList moments={views} initial={HOME_LIMIT} />
    </div>
  );
}
