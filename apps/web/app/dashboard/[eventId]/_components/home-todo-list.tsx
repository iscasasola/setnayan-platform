import Link from 'next/link';
import type { ReactNode } from 'react';
import { ExamplePreview } from '@/app/_components/states/empty-state';
import { SAMPLE_TODO } from '@/lib/empty-look-samples';
import { ChevronRight, List } from 'lucide-react';
import { EVENT_MENU_ICONS } from '@/lib/customer-menu';
import { InfoTip } from '@/app/_components/info-tip';
import { formatCount } from '@/lib/format-number';
import { EVENT_TODAY_TASK_ROWS, type EventToday } from '@/lib/event-today';
import { EventTodayGroup, EventTodayRowItem, EventTodayTomorrow, EventTodayUnreadRow } from './event-today-list';

/** What the list's ⓘ says. */
export const HOME_TODO_INFO =
  'What needs you, most urgent first. Tap a row to answer it here. Drag right to open its page, drag left to do it tomorrow. Your whole plan is in Schedule.';

/** How many plan tasks the list shows (round 3: "the three soonest tasks with their tick"). */
export const HOME_TODO_ROWS = EVENT_TODAY_TASK_ROWS;

/**
 * ☀ HOME'S ONE LIST — "NEEDS YOU TODAY", UNDER THE EVENT CARD (owner 20 Nov 2026: *"make the Today of the event
 * dashboard run like the Focus of Admin and Today of Suppliers Dashboard"*; drawing
 * `prototypes/event_today_focus_2026-11-20/` v3). It REPLACES the "To do · soonest first" block and the Today pill
 * lines for asks (drawing part C): the plan's tasks, the payments that are late or due soon, and every ask are rows of
 * ONE list, ordered by urgency (`lib/event-today.ts`).
 *
 *   · the rows and their order are the lib's — this only draws them; the client part (`event-today-list.tsx`) holds
 *     the tap-to-open card and the two drags;
 *   · `bodies` = the shipped answer of an ask, drawn on the server and handed in by row key;
 *   · then ONE row "N more plan tasks this week ›" (Planning Stage), the plan's own closing line — "N% of the plan done
 *     · All N this week ›" — and the "Tomorrow N" fold;
 *   · the item the card's strip holds is not here ("Now never repeats below").
 *
 * A read that failed is a row that SAYS so, with ⟳ — never an empty list.
 */
export function HomeTodayList({
  eventId,
  today,
  bodies = {},
}: {
  eventId: string;
  today: EventToday;
  bodies?: Record<string, ReactNode>;
}) {
  const planUnread = today.list.some((r) => r.key === 'unread:plan');
  const nothing = today.list.length === 0 && !today.more;
  return (
    <div role="group" aria-label="Needs you today" data-home-todo={planUnread ? 'unread' : ''} data-event-today="" className="flex flex-col">
      <p className="hc-k2 min-h-11" data-home-todo-head="" data-event-today-head="">
        <InfoTip label="Needs you today" labelClassName="hc-k2-name" align="start">
          {HOME_TODO_INFO}
        </InfoTip>
        {/* Only a real count: nothing waiting draws no "0" (the line under it says so). */}
        {today.listCount > 0 ? <em data-event-today-count="">{formatCount(today.listCount)}</em> : null}
      </p>
      <EventTodayGroup eventId={eventId}>
        <ul className="m-0 flex flex-col p-0" data-event-today-list="">
          {today.list.map((row) =>
            row.kind === 'unread' ? (
              <EventTodayUnreadRow key={row.key} row={row} />
            ) : (
              <EventTodayRowItem key={row.key} row={row}>
                {bodies[row.key] ?? null}
              </EventTodayRowItem>
            ),
          )}
          {today.more ? (
            <li className="list-none" data-event-today-more="">
              <Link href={today.more.href} className="et-more flex min-h-16 items-center gap-3 py-2.5">
                <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink/5 text-ink">
                  <List className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </span>
                <span className="grid min-w-0 flex-1">
                  <span className="text-[15px] font-semibold leading-[1.3] text-ink">
                    {formatCount(today.more.count)} more plan {today.more.count === 1 ? 'task' : 'tasks'} this week
                  </span>
                  <span className="text-[13px] text-ink/60">Opens your plan in Schedule</span>
                </span>
                <ChevronRight aria-hidden className="h-[18px] w-[18px] shrink-0 text-sn-accent" strokeWidth={2} />
              </Link>
            </li>
          ) : null}
          {nothing && !today.unread ? (
            <li className="list-none py-3 text-[14px] text-ink/60" data-event-today-none="" role="status">
              {today.tomorrow.length > 0 ? 'Nothing else needs you today.' : 'Nothing needs you today.'}
            </li>
          ) : null}
        </ul>
        {today.foot ? (
          <Link href={today.foot.href} className="hc-todoline" data-home-todo-line="">
            <span>
              {today.foot.pct !== null ? (
                <>
                  <b>{formatCount(today.foot.pct)}%</b> of the plan done ·{' '}
                </>
              ) : null}
              All <b>{formatCount(today.foot.week)}</b> this week
            </span>
            <ChevronRight aria-hidden className="hc-todoline-chev" strokeWidth={1.9} />
          </Link>
        ) : null}
        <EventTodayTomorrow rows={today.tomorrow} />
      </EventTodayGroup>
      {/* 👻 THE EMPTY LOOK (Build 5 Lane H): an empty plan — the read answered, nothing in it — shows the list's own rows
          on three sample tasks, greyed under "Example". Gone the moment the plan has one task. */}
      {today.planEmpty ? (
        <ExamplePreview>
          <ul className="hc-todo">
            {SAMPLE_TODO.map((t) => (
              <li key={t.title} className="hc-todo-row">
                <span className="hc-todo-dot" aria-hidden />
                <span className="hc-todo-words">
                  <span className="hc-todo-k">{t.title}</span>
                  <span className="hc-todo-v">{t.when}</span>
                </span>
              </li>
            ))}
          </ul>
        </ExamplePreview>
      ) : null}
    </div>
  );
}

/**
 * ✨ MEMORIES — ONE SLIM LINE OF ITS OWN (owner-approved Home redraw 2026-11-02, round 3 — `memLine()`): photos, reels,
 * the Live Watch replay and the Thank-you video, everything from the day, in one place. The line opens the Memories tab;
 * its state words are handed in (what Home already read) — never a figure it did not read.
 */
export function HomeMemoriesLine({ eventId, line }: { eventId: string; line: string }) {
  return (
    <Link href={`/dashboard/${eventId}/memories`} className="hc-memline" data-home-memories="" data-tour="home-memories">
      <span className="hc-memline-mark" aria-hidden>
        <MemoriesMark />
      </span>
      <span className="min-w-0 flex-1">
        <span className="hc-memline-k">Memories</span>
        <span className="hc-memline-v">{line}</span>
      </span>
      <ChevronRight aria-hidden className="hc-memline-chev" strokeWidth={1.9} />
    </Link>
  );
}

/** The bar's own Memories glyph (`EVENT_MENU_ICONS`) — one vocabulary, never a private icon. */
function MemoriesMark() {
  const I = EVENT_MENU_ICONS.memories;
  return <I aria-hidden width={16} height={16} strokeWidth={1.8} />;
}
