/**
 * lib/supplier-today-greeting.ts — 👋 THE SUPPLIER TODAY'S COVER WORDS (pure; THE ONE BUILD, v113 Today).
 *
 * Rulings (corpus `SUPPLIER_DASHBOARD_BUILD_PLAN_2026-11-08.md`, newest wins):
 *   · the greeting names the SHOP (owner v112 HOLD answer: *"Name of shop name"*) — never the person's name;
 *   · the word follows the Manila clock, the 12 MN – 12 MN day: 12 MN–11:59 AM "morning" · 12 NN–5:59 PM
 *     "afternoon" · 6 PM–11:59 PM "evening";
 *   · "N tasks today" counts the SAME Needs-you list the page draws (carry-over included) — the caller hands in that
 *     list's length, so the chip and the list can never disagree.
 *
 * 🔒 lib/supplier-today-greeting.test.ts
 */
import { manilaHour } from '@/lib/push-levels';
import { formatCount } from '@/lib/format-number';
import { dayMonth } from '@/lib/format-date';
import { shortDay } from '@/lib/supplier-today';

export type GreetingWord = 'morning' | 'afternoon' | 'evening';

/** "morning" · "afternoon" · "evening" — by the hour in Manila (the 12 MN – 12 MN day). */
export function greetingFor(nowMs: number): GreetingWord {
  const h = manilaHour(nowMs);
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

/** "Good morning," — the cover's first line (the shop name is the second). */
export function greetingLine(nowMs: number): string {
  return `Good ${greetingFor(nowMs)},`;
}

/**
 * The name the cover greets: the shop's `business_name`. A shop with no name yet is greeted without one — never
 * the signed-in person's name, never a stand-in.
 */
export function greetedShop(businessName: string | null | undefined): string | null {
  const n = (businessName ?? '').trim();
  return n ? n : null;
}

/** "9 tasks today" · "1 task today" · "Nothing today" — the cover's chip. `null` (the list could not be read) → null. */
export function tasksWord(n: number | null): string | null {
  if (n === null) return null;
  if (n === 0) return 'Nothing today';
  return `${formatCount(n)} task${n === 1 ? '' : 's'} today`;
}

/** "9 tasks · 7 Nov" — the pinned row's count line, the count FIRST so a narrow row never cuts it. */
export function pinnedCountsLine(n: number | null, todayIso: string): string {
  const day = dayMonth(todayIso) ?? todayIso;
  if (n === null) return day;
  return `${formatCount(n)} task${n === 1 ? '' : 's'} · ${day}`;
}

/** "Sat 7 Nov" — the cover's date chip (Manila's civil date, handed in). */
export function dateChip(todayIso: string): string {
  return shortDay(todayIso) ?? todayIso;
}
