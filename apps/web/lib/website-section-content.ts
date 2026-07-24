/**
 * Website section-content presence — the ONE server-side resolver both the
 * widgets editor (PR9) and (via the same signals) the guest site consume
 * (OPEN-BROWSE PR9 · council verdict 2026-07-22 §1.4).
 *
 * The couple's "Shown" force-on control must never manufacture a blank
 * guest-facing section — so the editor disables the Shown button, and the
 * `setSectionMode` writer refuses `mode='shown'`, when a widget's source has
 * no content. "Has content" has to mean exactly what the guest site means by
 * it, or the two would drift. This helper mirrors the `openBrowseContent`
 * signal map in `app/[slug]/_components/site-body.tsx` (schedule → public
 * block count, venue_map → venue name/address, our_love_story → love_story,
 * our_photos → the photo-ref array, special_message, what_to_bring, countdown
 * → event_date) so both surfaces read the same truth.
 *
 * Widget types with no clear content signal are simply ABSENT from the map —
 * `hasContent` (lib/invitation-widgets) fails OPEN for them (treated as
 * HAVING content), matching the pragmatic "assume intentional" posture the
 * council locked.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { WidgetType } from '@/lib/invitation-widgets';

/**
 * The event columns the content signals read. Callers that already loaded the
 * event row for other reasons pass these fields straight through — no second
 * fetch of `events`.
 */
export type SectionContentEvent = {
  event_date: string | null;
  venue_name: string | null;
  venue_address: string | null;
  love_story: string | null;
  special_message: string | null;
  what_to_bring: string | null;
  our_photos: unknown;
};

/**
 * The exact `SELECT` column list a caller needs from `events` to build a
 * {@link SectionContentEvent}. Kept beside the type so the two never drift.
 */
export const SECTION_CONTENT_EVENT_COLUMNS =
  'event_date, venue_name, venue_address, love_story, special_message, what_to_bring, our_photos';

/**
 * Build the per-widget content-presence map for an event. The only DB read is
 * a HEAD count of public schedule blocks (mirrors `fetchPublicScheduleBlocks`'s
 * `is_public=true` filter without pulling the rows); every other signal comes
 * off the already-loaded event row.
 */
export async function computeSectionContentMap(
  supabase: SupabaseClient,
  eventId: string,
  event: SectionContentEvent,
): Promise<Partial<Record<WidgetType, boolean>>> {
  const { count } = await supabase
    .from('event_schedule_blocks')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('is_public', true);

  const ourPhotosCount = Array.isArray(event.our_photos)
    ? event.our_photos.filter((r) => typeof r === 'string' && r.length > 0).length
    : 0;

  return {
    schedule: (count ?? 0) > 0,
    venue_map: Boolean(event.venue_name || event.venue_address),
    our_love_story: Boolean(event.love_story),
    our_photos: ourPhotosCount > 0,
    special_message: Boolean(event.special_message),
    what_to_bring: Boolean(event.what_to_bring),
    countdown: Boolean(event.event_date),
  };
}
