/**
 * ‹ THE PAGE YOU CAME FROM (owner 16 Nov 2026, *"we don't want to lose the back button if needed"* · profile menu
 * drawing, approved 16 Nov): the phone's full-screen sheet opens over a page, so its back names that page — the first
 * part of the tab's title (`%s · Setnayan`, app/layout.tsx), e.g. "Budget". A page with no title of its own falls back to
 * "Today". Read when the sheet opens, in the browser. Pure — `app/_components/account-switcher/the-sheet-back-names-the-page.test.ts`.
 */
export function sheetBackLabel(title: string | null | undefined): string {
  const first = (title ?? '').split(' · ')[0]?.trim() ?? '';
  return first && first !== 'Setnayan' ? first : 'Today';
}
