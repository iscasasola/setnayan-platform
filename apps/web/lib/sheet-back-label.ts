import { pageOwnLabel } from '@/lib/page-home';

/**
 * ‹ THE PAGE YOU CAME FROM (owner 16 Nov 2026, *"we don't want to lose the back button if needed"* · profile menu
 * drawing, approved 16 Nov): the phone's full-screen sheet opens over a page, so its back names that page.
 *   1. the page map's own name for the address (`lib/page-home.ts` LABELS — Today, Guests, Discover, Home…);
 *   2. else the page's own title (`metadata.title`, the first part of `%s · Setnayan`) — Budget, Schedule…;
 *   3. else "Back" — never a page that is not there (Discover has no Today).
 * An event's tab title is the couple's names, which is why the map comes first. Read when the sheet opens, in the
 * browser. Pure — `app/_components/account-switcher/the-sheet-back-names-the-page.test.ts`.
 */
export function sheetBackLabel(at: { pathname: string; search?: string; title?: string | null }): string {
  const mapped = pageOwnLabel(at.pathname, at.search ?? '');
  if (mapped) return mapped;
  const first = (at.title ?? '').split(' · ')[0]?.trim() ?? '';
  return first && first !== 'Setnayan' ? first : 'Back';
}
