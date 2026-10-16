import { formatEventDate } from '@/lib/events';

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
export type HomeCoverWords = { eyebrow: string; name: string };

export function homeCoverWords(event: {
  event_type?: string | null;
  event_date?: string | null;
  display_name?: string | null;
}): HomeCoverWords {
  const typeLabel = (event.event_type ?? 'wedding').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const dateLabel = event.event_date ? formatEventDate(event.event_date) || null : null;
  return {
    eyebrow: dateLabel ? `${typeLabel} · ${dateLabel}` : typeLabel,
    name: (event.display_name ?? '').trim() || `Your ${typeLabel}`,
  };
}
