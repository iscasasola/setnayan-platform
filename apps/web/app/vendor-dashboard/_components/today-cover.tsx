import type { ReactNode } from 'react';
import { dateChip, greetedShop, greetingLine, pinnedCountsLine, tasksWord } from '@/lib/supplier-today-greeting';

/**
 * 👋 TODAY'S MAST (Today v3 part 1 — owner 19 Nov, looking at live Today: *"then why do i have a header when this was
 * not part of the design"* · *"remove the photo of that header"* · *"we do not want unwanted space on top"* · *"it was
 * suppose to look like focus"*). The Focus shape, as admin Focus draws it: ONE quiet line — "Good morning, <Shop> ·
 * <date>" — over ONE bold line — "N tasks today · 2 of 9 done" — and Today's ⚙ at the right. No photo, no band, no
 * Upload pill: it is only as tall as its two lines, so the first task sits right under it.
 *
 *   · The greeting names the SHOP (`greetedShop`, owner v112 *"Name of shop name"*), never the person, and its word
 *     follows the Manila clock (`greetingLine`).
 *   · "N tasks today" is handed in — the length of the Needs-you list under it (`view.needsCount`), so the two never
 *     disagree.
 *   · ⚙ is ONE mount (`TodaySettings`), handed in as `gear` — top-right here, and only here.
 *   · Uploading a photo stays on Portfolio (its own ＋); nothing on Today uploads any more.
 *
 * Supersedes the 9 Nov "Today's hero = the most-viewed portfolio photo" (Lane E item 11) and, for Today, the one
 * 208-px `SupplierHero` (item 10) — Shop keeps its cover.
 * 🔒 lib/supplier-today-greeting.test.ts · app/vendor-dashboard/_components/today-is-focus-shaped.test.ts
 */
export function TodayCover({
  shopName,
  tasks,
  todayIso,
  now,
  gear = null,
  sub,
}: {
  shopName: string | null;
  /** The Needs-you list's length (null when the list could not be read). */
  tasks: number | null;
  todayIso: string;
  now: number;
  gear?: ReactNode;
  /** 📋 "6 tasks today · 1 of 7 done" + the pips (`TodayV2Sub`) in place of the bare tasks line. */
  sub?: ReactNode;
}) {
  const shop = greetedShop(shopName);
  const tasksChip = tasksWord(tasks);
  const bold = sub !== undefined ? sub : tasksChip ? <b className="font-semibold" data-today-tasks-chip="">{tasksChip}</b> : null;
  return (
    <header data-today-cover="" data-today-mast="" data-tour="today-cover" className="mb-1 flex items-start gap-2 pt-1">
      <h1 className="sr-only">Today</h1>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-[color:var(--m-slate-2)]">
          <span data-today-greeting="">{greetingLine(now)}</span>
          {shop ? (
            <>
              {' '}
              <span data-today-greeted="">{shop}</span>
            </>
          ) : null}
          {' · '}
          <span data-today-date-chip="">{dateChip(todayIso)}</span>
        </p>
        {bold ? <div className="text-[22px] font-extrabold leading-tight text-ink">{bold}</div> : null}
      </div>
      {gear ? (
        <span className="shrink-0" data-today-cover-gear="">
          {gear}
        </span>
      ) : null}
    </header>
  );
}

/**
 * ⛔ NOT MOUNTED SINCE 10 NOV — Today's one pinned row is "Needs you today" (DECISION_LOG 2026-11-10 📌; the cover now
 * scrolls away, `supplier-today-screen.tsx`). Kept only while its words' guard still renders it; the undershell sweep
 * deletes it with that assertion.
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
      <span className="ml-auto shrink-0 text-[13px] text-[color:var(--m-slate-2)]">{pinnedCountsLine(tasks, todayIso)}</span>
    </span>
  );
}
