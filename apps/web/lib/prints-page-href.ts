/**
 * lib/prints-page-href.ts — 🖨 THE PRINTS PAGE'S ADDRESS, and nothing else (owner 2026-10-27, DECISION_LOG "PRINTS LEAVES
 * STUDIO — ITS OWN PAGE (THE APPROVED SWIPE CAROUSEL), OPENED FROM A PRINTS LINE ON HOME; NO NEW BOTTOM TAB"; build plan
 * `EVENT_MENU_REORG_BUILD_PLAN_2026-10-27.md` step R8).
 *
 * No imports, on purpose: `lib/maker-details-items.ts` (`detailsItemHref`, "every link into Details") sends a print here,
 * and `lib/prints-page.ts` reads `maker-details-items` — one module with both would be a circle. The rest of the page's
 * rules (which item it opens, which old address forwards) are `lib/prints-page.ts`.
 */

/** The page's name — Home's line, the page's own top bar and its `<title>` say it. */
export const PRINTS_PAGE_LABEL = 'Prints';

/** `/dashboard/<id>/prints` — beside `/guests`, `/memories`, `/budget`: an event's page, never a tab of the bottom bar. */
export function printsPageHref(eventId: string, item?: string | null, extra = ''): string {
  const base = `/dashboard/${eventId}/prints`;
  const parts = [item ? `item=${encodeURIComponent(item)}` : '', extra.replace(/^[?&]+/, '')].filter((p) => p.length > 0);
  return parts.length > 0 ? `${base}?${parts.join('&')}` : base;
}
