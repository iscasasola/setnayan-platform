import 'server-only';

import { belongsToThisEvent, NOBODY } from '@/app/[slug]/_lib/belongs-to-this-event';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadStoryArrangement, type LoadedArrangement } from '@/lib/story-arrangement-store';
import { hostUserId } from './host-authority';

/**
 * The arrangement as its HOST sees it — for the Story Maker's "Make it yours" (step 4).
 *
 * Authority is proved through the caller's own session first; `null` means "not a host of
 * this celebration", and the editor then has nothing to show. The read itself is the same one
 * the public page uses (`loadStoryArrangement`), asked as the host — so what the host arranges
 * and what a guest is shown are resolved by one function, and the consent veto applies to the
 * host's view too: a photograph a guest took back is off the host's page, not only the guest's.
 *
 * ⚠ AN EDITOR MUST NOT SAVE WHILE `unreadable` IS NON-EMPTY — see `LoadedArrangement`.
 */
export async function loadArrangementForHost(eventId: string): Promise<LoadedArrangement | null> {
  const userId = await hostUserId(eventId);
  if (!userId) return null;
  /*
    The host's authority is `isHost`, proved one line up — it admits them at every audience.
    Belonging is a different question with its own ONE rule, and this surface establishes none
    of its facts, so it asks the rule with none and gets the fail-closed answer. A literal
    `true` here is the exact shape that once let /{slug}/print hand a stranger a restricted
    story (`the-keepsake-is-not-a-way-around.test.ts`).
  */
  return loadStoryArrangement(createAdminClient(), eventId, {
    isHost: true,
    belongsToEvent: belongsToThisEvent(NOBODY),
  });
}
