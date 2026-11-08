import type { TodayNeedKind } from '@/lib/supplier-today';

/**
 * 🔍 TODAY'S SEARCH + SHOW, APPLIED (THE ONE BUILD A10) — kept apart from the thumb row's component (which carries the
 * shared row's CSS modules) so the rule runs in a test as written.
 */
export type TodayShow = 'all' | TodayNeedKind;

/** Hide every Needs-you row whose words / kind do not match; say so when none is left. */
export function narrowTodayNeeds(root: ParentNode, words: string, show: TodayShow): number {
  const needle = words.trim().toLowerCase();
  let shown = 0;
  const fits = (el: Element, kind: string | null) =>
    (show === 'all' || kind === show) && (!needle || (el.textContent ?? '').toLowerCase().includes(needle));
  for (const row of root.querySelectorAll<HTMLElement>('[data-today-need]')) {
    const hit = fits(row, row.getAttribute('data-today-need-kind'));
    // `style.display`, not `hidden`: a row is a `.home-row` grid, and the class's display beats the attribute's
    // (the Hub crew row's lesson, `hub-thumb-row.tsx`).
    row.style.display = hit ? '' : 'none';
    if (hit) shown += 1;
  }
  // The unpaid booking fees are the shipped rows (`BookingFeeBills today`) — each is a payment.
  for (const bill of root.querySelectorAll<HTMLElement>('[data-today-need-bills] [data-fee-bill-today]')) {
    const hit = fits(bill, 'payments');
    bill.style.display = hit ? '' : 'none';
    if (hit) shown += 1;
  }
  const none = root.querySelector<HTMLElement>('[data-today-needs-none]');
  const total = root.querySelectorAll('[data-today-need], [data-today-need-bills] [data-fee-bill-today]').length;
  if (none) none.hidden = shown > 0 || total === 0;
  return shown;
}

