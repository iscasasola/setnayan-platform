/**
 * worth-planning.server.ts — "Worth planning": the days that come around for this person (birthdays, anniversaries,
 * the seasons that book out early). ONE reader, used by the full Events board's shelf (`YearMomentsStrip`) and by
 * Unihome v5's one row ("Worth planning · Mama's 60th · 4 Jun"), so the two can never name different days.
 *
 * Two reads in one trip: the account's own events (anchors and recurrences) and its own birthday. A refused read is
 * `readFailed: true` — the callers then say "couldn't read", never "nothing coming up".
 */
import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { manilaToday } from '@/lib/std-views';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  buildYearMoments,
  buildSelfMoments,
  mergeSelfMoments,
  worthPlanningMoments,
  type MomentEvent,
  type SelfForMoments,
} from '@/lib/year-moments';

export type WorthPlanningRead = {
  moments: ReturnType<typeof worthPlanningMoments>;
  /** True when either read was refused — the list may be missing days. */
  readFailed: boolean;
};

export async function readWorthPlanning(userId: string): Promise<WorthPlanningRead> {
  const supabase = await createClient();
  const today = manilaToday();

  const [{ data: rows, error: rowsErr }, { data: selfRow, error: selfErr }] = await Promise.all([
    supabase
      .from('event_members')
      .select(
        `member_type,
       events:event_id (
         event_id, event_type, display_name, event_date,
         anchor_date, anchor_origin, recurs, recur_cadence, archived
       )`,
      )
      .eq('user_id', userId)
      .eq('member_type', 'couple'),
    supabase.from('users').select('birth_date, sex').eq('user_id', userId).maybeSingle(),
  ]);

  if (rowsErr) logQueryError('readWorthPlanning (event_members)', rowsErr);
  if (selfErr) logQueryError('readWorthPlanning (users birthday)', selfErr);

  const events: MomentEvent[] = (rows ?? []).flatMap((r) => {
    const e = (r as { events: MomentEvent | MomentEvent[] | null }).events;
    return e ? (Array.isArray(e) ? e : [e]) : [];
  });

  const moments = worthPlanningMoments(
    mergeSelfMoments(
      buildYearMoments(events, today, { includeHolidays: true }),
      buildSelfMoments((selfRow as SelfForMoments | null) ?? null, today),
    ),
  );
  return { moments, readFailed: Boolean(rowsErr) || Boolean(selfErr) };
}

const SHORT = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' });

/** "4 Jun" — the moment's day as the row prints it. */
export function worthPlanningDay(iso: string): string {
  const parts = SHORT.formatToParts(new Date(`${iso}T12:00:00+08:00`));
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  return `${day} ${month}`.trim();
}
