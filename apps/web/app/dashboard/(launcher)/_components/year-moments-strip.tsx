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
 * The strip shows the first few moments and expands the rest INLINE via
 * <YearMomentsList>, AND carries that list's "See the year →" door to the full
 * /dashboard/year calendar (re-linked 2026-07-15 under the owner's "nothing
 * orphaned" directive, superseding the 2026-07-13 de-link that had left the
 * full Year view without an in-app doorway). Event moments still deep-link into
 * their dashboards.
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

  // "This year" glass row — the strip renders INSIDE the Alaala section
  // (owner-approved final home design 2026-07-15); its old standalone
  // "Your year" section merged into Alaala, killing the events/year dupe.
  // The glass panel lives HERE (not around the call site) so the no-moments
  // null return never leaves an empty frame on the page.
  return (
    <div className="sn-tile-glass sn-lift-3 rounded-2xl p-4 sm:p-[18px]">
      <h3 className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[color:var(--sn-gold-700)]">
        This year
      </h3>
      <YearMomentsList moments={views} initial={HOME_LIMIT} />
    </div>
  );
}
