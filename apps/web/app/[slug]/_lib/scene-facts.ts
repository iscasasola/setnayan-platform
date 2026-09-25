import { countdownTargetMs } from '@/lib/countdown-target';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';
import { resolveMonogram } from '@/lib/monogram';
import type { SceneFacts } from '../_components/scene-template';
import type { EventRow } from './types';

/**
 * WHAT A TEMPLATE BUILT ON A SHIPPED PART PRINTS — read from the event, once.
 *
 * Owner, 2026-09-24: four of the 25 templates "build on shipped parts" —
 * 10 Title card (the names), 11 Letter (the special message), 12 Big number
 * (the countdown: "85 days to go is real"), 16 Monogram, and 24 Timeline (the
 * love-story milestones). The prototype's note is explicit that names,
 * monogram and "85" are REAL, never placeholders — so each is read from the
 * same column the shipped widget reads, through the same helper:
 *
 *   names      → `display_name`, as the invitation card prints it;
 *   monogram   → `resolveMonogram`, the resolver every other surface uses;
 *   days       → `countdownTargetMs` at the VENUE's zone, the countdown's own
 *                rule (a date is midnight where the wedding is, never UTC);
 *   message    → `special_message`;
 *   milestones → `love_story.milestones`, read with the same field fallbacks
 *                `our-love-story-widget.tsx` uses.
 *
 * ⚠ The day count is computed at render. The guest page revalidates every 60 s
 * (`export const revalidate` in `[slug]/page.tsx`), so the number is at most a
 * minute stale — never a day.
 */
export function sceneFactsFor(event: EventRow, opts: { solemn: boolean; now?: number }): SceneFacts {
  const e = event as EventRow & {
    display_name?: string | null;
    monogram_text?: string | null;
    monogram_color?: string | null;
    special_message?: string | null;
    love_story?: unknown;
  };
  const names = (e.display_name ?? '').trim() || null;
  const monogram = names || e.monogram_text
    ? resolveMonogram({
        display_name: e.display_name ?? null,
        monogram_text: e.monogram_text ?? null,
        monogram_color: e.monogram_color ?? null,
      }).text || null
    : null;

  let daysToGo: number | null = null;
  // A solemn event (the funeral) never counts down — the countdown widget's own rule.
  if (!opts.solemn) {
    const target = countdownTargetMs(
      (e as { event_date?: string | null }).event_date ?? null,
      eventTimezoneFromCoords(
        (e as { venue_latitude?: number | null }).venue_latitude ?? null,
        (e as { venue_longitude?: number | null }).venue_longitude ?? null,
      ),
    );
    if (target !== null) {
      const days = Math.ceil((target - (opts.now ?? Date.now())) / 86_400_000);
      daysToGo = days >= 0 ? days : null;
    }
  }

  const story = e.love_story && typeof e.love_story === 'object' ? (e.love_story as Record<string, unknown>) : {};
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const milestones = (Array.isArray(story.milestones) ? (story.milestones as unknown[]) : [])
    .map((m) => {
      const mm = m && typeof m === 'object' ? (m as Record<string, unknown>) : {};
      const year = typeof mm.year === 'number' ? String(mm.year) : str(mm.year);
      const title = str(mm.title) || str(mm.label) || str(mm.what);
      const note = str(mm.note) || str(mm.text) || str(mm.detail);
      return { head: year || title, text: year ? [title, note].filter(Boolean).join(' — ') : note };
    })
    .filter((m) => m.head || m.text)
    .slice(0, 6);

  return {
    names,
    monogram,
    daysToGo,
    specialMessage: (e.special_message ?? '').trim() || null,
    milestones,
  };
}
