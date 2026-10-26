import { formatEventDate } from '@/lib/events';
import type { ForTag } from '@/lib/for-tag';

/**
 * lib/home-cover-words.ts — THE WORDS ON THE EVENT HOME'S COVER, worked out in ONE place.
 *
 * The Home page draws them once its reads are in; the event layout hands the same words to
 * the Home's loading screen (`home-loading-cover.tsx`), so a tap on an event shows its name
 * and date at once instead of a blank veil (measured 2026-10-16: the name appeared ~1.1 s
 * after the tap at 4× CPU, behind the loader). One function, so the cover the loading screen
 * draws and the one the Home draws can never say two different things.
 * 🔒 app/dashboard/[eventId]/opening-an-event-shows-its-name-at-once.test.ts
 */
export type HomeCoverWords = {
  eyebrow: string;
  name: string;
  /**
   * "FOR <NAME>" (owner 22 Oct 2026, prototypes/for_tag_on_event_cards_2026-10-22.html) — the
   * subject the viewer holds (their shop, a loved one), drawn as ONE quiet line under the name.
   * ABSENT when the event is for nobody the viewer holds, or the read failed: never a guessed name.
   * The eyebrow is untouched — at 375 it already fills its line beside Event Details.
   */
  forWho?: ForTag;
  /**
   * The date, short ("Dec 5") — the PINNED cover's one line (owner 2026-10-27, Home A: `<names> · <date>`). Absent
   * when the event has no day picked: the pinned line is then the name alone, never a guessed date.
   */
  shortDate?: string;
};

export function homeCoverWords(event: {
  event_type?: string | null;
  event_date?: string | null;
  display_name?: string | null;
  /** `readForTags`' answer for this event — the Home passes it; the loading screen has none. */
  for_tag?: ForTag | null;
}): HomeCoverWords {
  const typeLabel = (event.event_type ?? 'wedding').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const dateLabel = event.event_date ? formatEventDate(event.event_date) || null : null;
  const words: HomeCoverWords = {
    eyebrow: dateLabel ? `${typeLabel} · ${dateLabel}` : typeLabel,
    name: (event.display_name ?? '').trim() || `Your ${typeLabel}`,
  };
  const shortDate = shortEventDate(event.event_date ?? null);
  if (shortDate) words.shortDate = shortDate;
  const forName = event.for_tag?.name.trim();
  if (event.for_tag && forName) words.forWho = { name: forName, markUrl: event.for_tag.markUrl };
  return words;
}

/** "Dec 5" from a calendar day ("2026-12-05"), built from its parts so the reader's timezone cannot move the day
    (`formatEventDate`'s own rule); '' for anything that is not a plain day. */
export function shortEventDate(iso: string | null, locale = 'en-US'): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}
