import type { ReactNode } from 'react';
import { dateChip, greetedShop, greetingLine, pinnedCountsLine, tasksWord } from '@/lib/supplier-today-greeting';
import { SupplierHero, type SupplierHeroPicture, type SupplierHeroUpload } from './supplier-hero';

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
  hero = null,
}: {
  shopName: string | null;
  /** The Needs-you list's length (null when the list could not be read). */
  tasks: number | null;
  todayIso: string;
  now: number;
  gear?: ReactNode;
  /**
   * 🖼 Lane E item 11: the shared hero's picture — the most-viewed portfolio photo ("Most viewed · N views"), else the
   * latest, else the category placeholder with its Upload door. Null (the lab, a guard) = the shipped placeholder file.
   */
  hero?: { picture: SupplierHeroPicture | null; caption: string | null; upload: SupplierHeroUpload | null } | null;
}) {
  const shop = greetedShop(shopName);
  const tasksChip = tasksWord(tasks);
  return (
    <header data-today-cover="" data-tour="today-cover" className="relative -mx-4 -mt-4 mb-4 sm:-mx-6">
      <h1 className="sr-only">Today</h1>
      {/* 🖼 THE ONE SUPPLIER HERO (Lane E item 10) — the same part, height and gutters as Shop and Portfolio. */}
      <SupplierHero
        eyebrow={
          <>
            Today · <span data-today-date-chip="">{dateChip(todayIso)}</span>
          </>
        }
        gear={gear ? <span data-today-cover-gear="">{gear}</span> : null}
        title={
          <>
            <span data-today-greeting="">{greetingLine(now)}</span>
            {shop ? (
              <>
                {' '}
                <span data-today-greeted="">
                  {shop}
                </span>
              </>
            ) : null}
          </>
        }
        sub={tasksChip ? <b className="font-semibold" data-today-tasks-chip="">{tasksChip}</b> : null}
        picture={hero?.picture ?? null}
        caption={hero?.caption ?? null}
        upload={hero?.upload ?? null}
        data={{ 'today-hero': '' }}
      />
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
