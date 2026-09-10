/**
 * THE BACK COVER'S LOAD — and it must never cost the story.
 *
 * `/[slug]` is a Server Component, so a throw here takes the WHOLE published
 * story down: the clock, every minute, the last word and the song vanish
 * together and the reader gets a failed page. S7's own guard states the rule for
 * the desk (*"a step that cannot load must cost that step — never the Story
 * Maker"*); the published page deserves it more, because the reader is a guest
 * at somebody's wedding rather than the host at a console.
 *
 * ⇒ EVERY failure returns `null`, and `null` means the back cover is simply
 * absent — which is also what "the host announced nothing" means, and what the
 * owner's ruling says most stories should look like. **Failing quiet here
 * degrades to the correct-by-default state rather than to an error.**
 */
import 'server-only';

import { backCoverFor, type BackCover } from '@/lib/the-back-cover';
import { eventWordsFor } from '@/app/[slug]/_lib/event-words';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { formatEventDate } from '@/lib/events';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  nextCandidates,
  sanitizeNextAnnouncement,
  type NextTypeOption,
} from '@/lib/whats-next';
import type { StoryViewer } from '@/lib/who-can-see-your-story';

/**
 * Resolve this story's back cover for one reader.
 *
 * 🔑 THE CANDIDATE LIST IS REBUILT, NOT TRUSTED. The stored value is only a
 * `kind` string on the host's own draft; `sanitizeNextAnnouncement` validates it
 * against the kinds the screen would actually offer TODAY, so a retired type, a
 * solemn one, or a hand-posted value cannot put a sentence on a published page
 * that no screen would ever have shown. That is the same function and the same
 * list the desk validates against — not a second copy of the rule.
 */
export async function loadBackCover(args: {
  eventId: string;
  eventDateISO: string | null;
  viewer: StoryViewer;
}): Promise<BackCover | null> {
  try {
    const admin = createAdminClient();

    const { data: row, error } = await admin
      .from('event_editorial')
      .select('draft_json')
      .eq('event_id', args.eventId)
      .maybeSingle();
    // A REFUSED READ IS NOT AN EMPTY DRAFT — but for a read-only surface both
    // resolve to the same safe answer: draw nothing.
    if (error || !row) return null;

    const draft =
      row.draft_json && typeof row.draft_json === 'object'
        ? (row.draft_json as Record<string, unknown>)
        : {};
    if (draft.whatsNext == null) return null; // the common case, and the cheap one

    const roster: NextTypeOption[] = await Promise.all(
      (await getCreatableEventTypes()).map(async (t) => ({
        key: t.key,
        label: t.label,
        solemn: (await eventWordsFor(t.key)).solemn,
      })),
    );

    const offered = nextCandidates({
      eventDateISO: args.eventDateISO,
      todayISO: new Date().toISOString().slice(0, 10),
      roster,
      formatDate: formatEventDate,
    });

    return backCoverFor({
      announcement: sanitizeNextAnnouncement(draft.whatsNext, offered),
      offered,
      viewer: args.viewer,
      eventId: args.eventId,
    });
  } catch {
    return null;
  }
}
