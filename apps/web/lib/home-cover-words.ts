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
  const forName = event.for_tag?.name.trim();
  if (event.for_tag && forName) words.forWho = { name: forName, markUrl: event.for_tag.markUrl };
  return words;
}
