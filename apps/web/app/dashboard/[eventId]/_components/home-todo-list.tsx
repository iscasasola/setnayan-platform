import Link from 'next/link';
import { ExamplePreview } from '@/app/_components/states/empty-state';
import { SAMPLE_TODO } from '@/lib/empty-look-samples';
import { ChevronRight } from 'lucide-react';
import { EVENT_MENU_ICONS } from '@/lib/customer-menu';
import { InfoTip } from '@/app/_components/info-tip';
import { formatCount } from '@/lib/format-number';
import { planningTodoHref } from '@/lib/checklist-anchor';
import { PlanningTick } from '../schedule/_components/schedule-lazy';
import { HomeTodayItem } from './home-parts';
import { shortDay, type HomeChecklistFacts } from './home-control-faces';

/** What the To do list's ⓘ says (the approved prototype's words, `TIPS.todo`). */
export const HOME_TODO_INFO =
  'Your next tasks, soonest first — tick one when it is done. Your whole plan is in Schedule.';

/** How many tasks the list shows (round 3: "the three soonest tasks with their tick"). */
export const HOME_TODO_ROWS = 3;

/**
 * ✅ HOME'S ONE TO DO — UNDER THE EVENT CARD (owner-approved Home redraw 2026-11-02, round 3,
 * `prototypes/home_controller_2026-11-02/` `nextList()`): *"ONE To do under the event card (the three soonest tasks with
 * their tick, then 'N% of the plan done · All N this week ›'); the To do widget is gone."*
 *
 *   · each row is the plan's own row — Planning Stage's tick (`PlanningTick` → `planningRowAction`), saved in place; a
 *     row with no table row to tick (a computed step) opens its exact row in Planning Stage instead;
 *   · the task Now holds is left out (`holds`) — Now never repeats below;
 *   · the closing line is the plan's state and the door to the whole plan (Schedule › Planning Stage's To do filter).
 *
 * `null` = the plan was never seeded: no list. `'unread'` = the read failed: said, with ⟳ — never an empty list.
 */
export function HomeTodoList({ eventId, checklist, holds = null }: { eventId: string; checklist: HomeChecklistFacts | 'unread' | null; holds?: string | null }) {
  if (checklist === null) return null;
  const head = (
    <p className="hc-k2" data-home-todo-head="">
      <InfoTip label="To do" labelClassName="hc-k2-name" align="start">
        {HOME_TODO_INFO}
      </InfoTip>
      <em>soonest first</em>
    </p>
  );
  if (checklist === 'unread') {
    return (
      <div role="group" aria-label="To do" data-home-todo="unread" className="flex flex-col">
        {head}
        <HomeTodayItem kicker="To do" tone="warn" words="Your plan couldn’t load" tail="not empty — unread · tap to try again" reload dataAttr={['data-home-todo-reload', '']} />
      </div>
    );
  }
  const rows = checklist.next.filter((t) => t.id !== holds).slice(0, HOME_TODO_ROWS);
  const pct = checklist.total > 0 ? Math.round((checklist.done / checklist.total) * 100) : null;
  return (
    <div role="group" aria-label="To do" data-home-todo="" className="flex flex-col">
      {head}
      {rows.length > 0 ? (
        <ul className="hc-todo">
          {rows.map((t) => {
            const late = t.daysUntilDue !== null && t.daysUntilDue < 0;
            const when = [t.dueDate ? `due ${shortDay(t.dueDate)}` : 'no date yet', late ? 'overdue' : null].filter(Boolean).join(' · ');
            return (
              <li key={t.id} className="hc-todo-row" data-home-todo-row={t.id}>
                {t.tick ? (
                  <PlanningTick eventId={eventId} kind={t.tick.kind} id={t.tick.id} done={false} title={t.title} />
                ) : (
                  <span className="hc-todo-dot" aria-hidden />
                )}
                <Link href={planningTodoHref(eventId, t.id)} className="hc-todo-words">
                  <span className="hc-todo-k">{t.title}</span>
                  <span className={`hc-todo-v${late ? ' hc-todo-late' : ''}`}>{when}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
      <Link href={planningTodoHref(eventId)} className="hc-todoline" data-home-todo-line="">
        <span>
          {pct !== null ? (
            <>
              <b>{formatCount(pct)}%</b> of the plan done ·{' '}
            </>
          ) : null}
          All <b>{formatCount(checklist.dueThisWeek)}</b> this week
        </span>
        <ChevronRight aria-hidden className="hc-todoline-chev" strokeWidth={1.9} />
      </Link>
      {/* 👻 THE EMPTY LOOK (Build 5 Lane H): an empty plan — the read answered, nothing in it — shows the list's own rows
          on three sample tasks, greyed under "Example". Gone the moment the plan has one task. */}
      {checklist.total === 0 && rows.length === 0 ? (
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
