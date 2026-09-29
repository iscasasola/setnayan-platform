import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventAnimatedMonogramActive } from '@/lib/animated-monogram';
import { markAnimationSwitchedOff } from '@/lib/monogram-studio-shared';
import { coupleLogoPlays } from '@/lib/couple-logo-plays';

/**
 * ▶ IS THE ANIMATION ON FOR THIS EVENT? — for a surface that shows the couple's
 * logo but never resolved the hero's `animatedMonogram` (a door's seal, a
 * collection card, the rail chip, the supplier's client page). Owner
 * 2026-09-29: *"all logos should animate if animation is active"*.
 *
 * The SAME gate as the Event Hub hero (`resolveEventMonogram`,
 * `app/[slug]/_lib/loaders.ts`) and the RSVP crest: (a) the couple owns the
 * logo animation (`eventAnimatedMonogramActive` — paid and approved, or
 * included with Event Hub Pro) AND (b) they have not chosen "Use Static Image"
 * (`markAnimationSwitchedOff`). This file only fetches those two inputs for a
 * surface that does not already hold them. Asked with an admin client
 * because orders RLS is purchaser-scoped and several of these screens are a
 * guest's or a supplier's. Once per event per request (`cache`).
 */
const animationOnFor = cache(async (eventId: string): Promise<boolean> => {
  const admin = createAdminClient();
  const [owned, row] = await Promise.all([
    eventAnimatedMonogramActive(admin, eventId),
    admin.from('events').select('monogram_studio_config').eq('event_id', eventId).maybeSingle(),
  ]);
  if (row.error) return false;
  const studioConfig = (row.data as { monogram_studio_config?: unknown } | null)?.monogram_studio_config;
  // 🔑 NOT A SECOND GATE — the hero's own, word for word, from the same two
  // helpers (`resolveEventMonogram`, `loadMedia`, and the RSVP crest in #6144):
  return owned && !markAnimationSwitchedOff(studioConfig);
});

/**
 * Does THIS logo play on this event's screens? 🔑 A logo that does not move
 * costs NO read at all — the gate is only asked for a saved logo with motion —
 * so a board of a dozen still marks pays nothing for this. A failed read is
 * "still", never an error on the page.
 */
export async function logoPlaysFor(eventId: string, svg: string | null | undefined): Promise<boolean> {
  if (!coupleLogoPlays(svg, true)) return false;
  return animationOnFor(eventId).catch(() => false);
}
