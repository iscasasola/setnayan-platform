import { createClient } from '@/lib/supabase/server';
import { personLifeStoriesEnabled } from '@/lib/person-life-stories';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  LifeStorySection,
  type LifeStoryGroup,
} from '@/app/dashboard/(account)/_components/life-story-section';
import { getMyLifeStory } from '../life-stories';

/**
 * "Your story" — the person's own story items, with the controls to hide them.
 *
 * ── WHY THIS MOVED HERE (2026-08-19) ───────────────────────────────────────
 * It lived on the account home. The owner is making that page only his events,
 * and a mapping pass found this block is **the only place in the product** where
 * a person can hide a story item, unhide it, or opt out of an event's story
 * altogether. Measured repo-wide: `optOutOfEventStory`, `hideMyStoryItem` and
 * `unhideMyStoryItem` are each imported exactly ONCE, by `life-story-section.tsx`,
 * which is rendered exactly ONCE.
 *
 * Those are RA 10173 data-subject controls over other people's photographs of
 * you, and the feature is LIVE — the owner set NEXT_PUBLIC_PERSON_LIFE_STORIES
 * in Vercel on 2026-08-13.
 *
 * 🔑 IT RENDERS FOR NOBODY TODAY, WHICH IS EXACTLY WHY IT WAS EASY TO LOSE.
 * Production holds zero story items, so the block is invisible — and deleting an
 * invisible thing costs nothing until the first story item appears with no off
 * switch attached. It is moved BEFORE the home is stripped, not after.
 *
 * People is the right home: the actions it calls already live in this route
 * (`people/life-stories.ts`), and a story item is a thing OTHER PEOPLE made that
 * has you in it — which is what this page is about.
 *
 * ⚠ MOUNTED IN BOTH BRANCHES of the People page. That page returns a separate
 * `PeoplePreview` when the connection flags are off, and prod takes that branch.
 * Mounting only the main branch would move the control somewhere nobody can
 * reach — the same defect in a new place. `SamahanPeopleSection` already sets
 * this precedent by rendering in both.
 */
export async function YourStorySection() {
  if (!personLifeStoriesEnabled()) return null;

  const supabase = await createClient();
  const items = await getMyLifeStory({ includeHidden: true });
  if (items.length === 0) return null;

  const eventIds = [...new Set(items.map((i) => i.eventId))];
  const nameById = new Map<string, string | null>();
  const { data: eventRows, error: eventRowsError } = await supabase
    .from('events')
    .select('event_id, display_name')
    .in('event_id', eventIds);
  // A refused name lookup must not hide the CONTROLS — the person can still
  // hide an item from an event whose title we could not read.
  if (eventRowsError) {
    logQueryError('YourStorySection.eventRows', eventRowsError, {}, 'graceful_degrade');
  }
  for (const row of (eventRows ?? []) as Array<{
    event_id: string;
    display_name: string | null;
  }>) {
    nameById.set(row.event_id, row.display_name);
  }

  const byEvent = new Map<string, LifeStoryGroup>();
  for (const item of items) {
    let group = byEvent.get(item.eventId);
    if (!group) {
      group = { eventId: item.eventId, eventName: nameById.get(item.eventId) ?? null, items: [] };
      byEvent.set(item.eventId, group);
    }
    group.items.push({
      storyItemId: item.storyItemId,
      itemKind: item.itemKind,
      hiddenAt: item.hiddenAt,
    });
  }
  const groups = [...byEvent.values()];
  if (groups.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/40">
        Your story
      </h2>
      <LifeStorySection groups={groups} />
    </section>
  );
}
