import type { ReactNode } from 'react';
import { routes } from '@/lib/routes';
import { formatCount } from '@/lib/format-number';
import { claimAsksDoorwayTitle } from '@/lib/claim-access-asks';
import { changesTodayWords, suggestionsTodayWords } from '@/lib/mood-board-changes';
import { dateChangeHomeLine, dateChangeWhen } from '@/lib/date-change';
import { dateFinderHref } from '@/lib/home-date-finder';
import { deadlineUrgency, type EventTodayAsk } from '@/lib/event-today';
import type { PutOffRecord } from '@/lib/today-put-off';
import type { createClient } from '@/lib/supabase/server';
import { EventDayPrepCta } from '@/app/_components/event-day-prep-cta';
import type { AccessAsksRead } from './access-requests-doorway';
import type { MoodBoardAsksRead } from './mood-board-asks-doorway';
import { MoodBoardAsks } from './mood-board-asks';
import { DateChangeBody, type DateChangeRead } from './date-change-doorway';

/**
 * ☀ THE ASKS, AS ROWS OF THE ONE LIST (Event Today, Focus shape — owner 20 Nov 2026; drawing part C · 2: *"The 'TODAY'
 * pill line for asks → each ask is a row in the list"*). Home's first screen read each ask ONCE; this words every one
 * as a row (`EventTodayAsk`, ordered and counted by `lib/event-today.ts`) and hands the list the answer that goes
 * inside its open card (`bodies`, by row key) — the SHIPPED part each time, never a second flow:
 *
 *   access requests ........ the door to the requests page (its answers live there)
 *   Mood Board ............. the photos to Keep · Decline / the changes to Undo (`MoodBoardAsks`, inline)
 *   a date change .......... who answered, keep waiting · drop, use the date, withdraw (`DateChangeBody`)
 *   event day soon ......... "Prepare for event day" — an offer: listed, never counted
 *
 * A read that FAILED is a row that says so — never a quiet nothing. The day-of console and the after-the-day screen
 * keep the Today lines (`todayAsks` in `page.tsx`), unchanged.
 */
export function eventTodayAsks(i: {
  eventId: string;
  access: AccessAsksRead;
  mood: MoodBoardAsksRead;
  dateChange: DateChangeRead;
  /** "Prepare for event day" is on offer (`isInPrepWindow`, and the day has not been). */
  prep: { eventDate: string | null } | null;
  now: number;
}): { asks: EventTodayAsk[]; bodies: Record<string, ReactNode> } {
  const e = i.eventId;
  const asks: EventTodayAsk[] = [];
  const bodies: Record<string, ReactNode> = {};

  /* 🔑 Access requests — the page that answers them is the door. */
  const requestsHref = routes.dashboard.accessRequests(e);
  if (!i.access.ok) {
    asks.push({ key: 'ask:access', title: 'We couldn’t check for access requests', line: 'Open the list', icon: 'warn', href: requestsHref, unread: true });
  } else {
    const waiting = i.access.count + i.access.claims.length;
    const claimTitle = claimAsksDoorwayTitle(i.access.claims);
    if (i.access.count || claimTitle) {
      const claimsOnly = Boolean(claimTitle) && !i.access.count;
      asks.push({
        key: 'ask:access',
        title: claimsOnly ? claimTitle! : waiting === 1 ? 'Your coordinator is asking for access' : `${formatCount(waiting)} access requests are waiting`,
        line: claimsOnly ? 'Approve to let them in' : 'You decide what to share',
        icon: 'person',
        href: requestsHref,
        door: { label: 'Answer', href: requestsHref },
      });
    }
  }

  /* 🖼⏱ The Mood Board — suppliers' photos to approve, and others' changes with their 24 hours to undo. */
  const moodHref = `/dashboard/${e}/studio/mood-board`;
  if (!i.mood.ok) {
    asks.push({ key: 'ask:mood', title: 'We couldn’t check the Mood Board for changes', line: 'Try again', icon: 'warn', href: moodHref, unread: true, reload: true });
  } else {
    const { suggestions, changes } = i.mood.asks;
    if (suggestions.length > 0) {
      asks.push({ key: 'ask:mood:approve', title: suggestionsTodayWords(suggestions), line: 'Keep or decline', icon: 'image', href: moodHref, page: 'Mood Board' });
      bodies['ask:mood:approve'] = <MoodBoardAsks eventId={e} suggestions={suggestions} changes={changes} inline="approve" />;
    }
    if (changes.length > 0) {
      asks.push({ key: 'ask:mood:changes', title: changesTodayWords(changes), line: 'Undo within 24 hours', icon: 'image', href: moodHref, page: 'Mood Board' });
      bodies['ask:mood:changes'] = <MoodBoardAsks eventId={e} suggestions={suggestions} changes={changes} inline="changes" />;
    }
  }

  /* 🗓 A date change — the suppliers' own 3-day reply deadline (`dueAt`) is its level. */
  if (!i.dateChange.ok) {
    asks.push({ key: 'ask:date-change', title: 'We couldn’t check whether a date change is waiting', line: 'Reload', icon: 'warn', href: null, unread: true, reload: true });
  } else if (i.dateChange.view) {
    const view = i.dateChange.view;
    const to = dateChangeWhen(view.proposedDate, view.proposedPrecision);
    const waitingOn = view.suppliers.filter((s) => s.answer === 'asked').map((s) => s.dueAt).sort()[0] ?? null;
    asks.push({
      key: 'ask:date-change',
      title: dateChangeHomeLine(view),
      line: view.ready ? `Use ${to}` : view.suppliers.some((s) => s.overdue) ? 'Someone hasn’t answered' : `Moving to ${to}`,
      icon: 'cal',
      href: dateFinderHref(e),
      urgency: view.ready ? null : deadlineUrgency(waitingOn, i.now),
    });
    bodies['ask:date-change'] = <DateChangeBody eventId={e} view={view} />;
  }

  /* 📱 Event day soon — an offer, not a task. */
  if (i.prep) {
    asks.push({ key: 'ask:event-day-prep', title: 'Prepare for event day', line: 'Works on bad venue signal', icon: 'phone', href: null, offer: true });
    bodies['ask:event-day-prep'] = <EventDayPrepCta eventId={e} eventDate={i.prep.eventDate} inCard />;
  }

  return { asks, bodies };
}

/**
 * ⏭ THIS PERSON'S OWN "Do it tomorrow" records on this event, still in force (`event_today_put_offs` — RLS: own rows,
 * on an event they belong to). `null` = they could not be read: then NOTHING is held off (every row stays on Today —
 * an unread record never hides work).
 */
export async function readEventTodayPutOffs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  userId: string,
  todayIso: string,
): Promise<PutOffRecord[] | null> {
  const r = await supabase.from('event_today_put_offs').select('task_key, until_day').eq('event_id', eventId).eq('user_id', userId).gt('until_day', todayIso).limit(200);
  if (r.error) {
    console.error('[supabase-error] app/dashboard/[eventId]/_components/event-today-asks.tsx · from:event_today_put_offs.select', r.error);
    return null;
  }
  return (r.data ?? []) as PutOffRecord[];
}
