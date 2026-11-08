import type { ReactNode } from 'react';
import { dateChip, greetedShop, greetingLine, pinnedCountsLine, tasksWord } from '@/lib/supplier-today-greeting';

/**
 * 👋 TODAY'S COVER (THE ONE BUILD A1 · A2, v113 Today): "Good morning, / <Shop>" · the date chip · "N tasks today" ·
 * Today's ⚙ — the event Home's cover reused (v113: *"A big header that shrinks to one line on scroll (reused from the
 * event Home)"*): the same plain ground (`hc-ecard-plain`) and the same name face (`hc-ecard-name`), nothing new drawn.
 *
 *   · The greeting names the SHOP (`greetedShop`, owner v112 *"Name of shop name"*), never the person, and its word
 *     follows the Manila clock (`greetingLine`).
 *   · "N tasks today" is handed in — the length of the Needs-you list under it (`view.needsCount`), so the two never
 *     disagree.
 *   · ⚙ is ONE mount (`TodaySettings`), handed in as `gear`: the same node rides the pinned row once the cover has
 *     collapsed (`TodayPinnedRow`, below) — never a second sheet.
 *
 * ⏳ THE COLLAPSE: the shared `CollapsingTop` (L1 foundation F2) takes `cover` = this, `row` = `TodayPinnedRow` and
 * `second` = the stats strip. Until `-foundation` lands the cover scrolls with the page (spec §3.1 "build behind the
 * shipped chrome, swap in when it lands") — no second collapse mechanism is drawn here.
 *
 * 🔒 lib/supplier-today-greeting.test.ts
 */
export function TodayCover({
  shopName,
  tasks,
  todayIso,
  now,
  gear = null,
}: {
  shopName: string | null;
  /** The Needs-you list's length (null when the list could not be read). */
  tasks: number | null;
  todayIso: string;
  now: number;
  gear?: ReactNode;
}) {
  const shop = greetedShop(shopName);
  const tasksChip = tasksWord(tasks);
  return (
    <header
      data-today-cover=""
      data-tour="today-cover"
      className="hc-ecard-plain relative -mx-4 -mt-4 mb-4 flex min-h-[248px] flex-col justify-end overflow-hidden rounded-b-3xl px-4 pb-5 pt-14 sm:-mx-6 sm:px-6"
    >
      {gear ? <div className="absolute right-3 top-3" data-today-cover-gear="">{gear}</div> : null}
      <h1 className="sr-only">Today</h1>
      <p className="text-[15px] opacity-90" data-today-greeting="">
        {greetingLine(now)}
      </p>
      {shop ? (
        <p className="hc-ecard-name truncate text-[30px] font-semibold leading-[1.1] tracking-[-0.01em]" data-today-greeted="">
          {shop}
        </p>
      ) : null}
      <p className="mt-3 flex flex-wrap items-center gap-2">
        {/* State chips, never pressed (the badge shape on the dark ground). */}
        <span className="inline-flex min-h-8 items-center rounded-full bg-white/15 px-3 text-[13px]" data-today-date-chip="">
          {dateChip(todayIso)}
        </span>
        {tasksChip ? (
          <span className="inline-flex min-h-8 items-center rounded-full bg-white px-3 text-[13px] font-semibold text-[rgb(var(--color-ink-on-plate,var(--color-ink)))]" data-today-tasks-chip="">
            {tasksChip}
          </span>
        ) : null}
      </p>
    </header>
  );
}

/**
 * 📌 ROW 1 ONCE THE COVER HAS COLLAPSED (v113 pinned row): "Good morning, <Shop>" · "9 tasks · 7 Nov" · ⚙. The count
 * goes FIRST so a narrow row never cuts it. Handed to `CollapsingTop` as `row` when the foundation lands.
 */
export function TodayPinnedRow({
  shopName,
  tasks,
  todayIso,
  now,
}: {
  shopName: string | null;
  tasks: number | null;
  todayIso: string;
  now: number;
}) {
  const shop = greetedShop(shopName);
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2" data-today-pinned-row="" data-first-row="">
      <span className="min-w-0 truncate text-[16px] font-semibold text-ink">
        {greetingLine(now).replace(/,$/, '')}
        {shop ? `, ${shop}` : ''}
      </span>
      <span className="ml-auto shrink-0 text-[13px] text-ink/60">{pinnedCountsLine(tasks, todayIso)}</span>
    </span>
  );
}
