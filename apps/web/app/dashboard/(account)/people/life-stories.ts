'use server';

import { revalidatePath } from 'next/cache';

import { everyCopyIsNowStale } from '@/lib/a-withdrawal-reaches-every-copy.server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import {
  personLifeStoriesEnabled,
  originFromPhotoTagSource,
  type PersonStoryItem,
  type StoryOrigin,
  type StorySourceTable,
} from '@/lib/person-life-stories';

/**
 * Person-spine · Phase 2 · LIFE STORIES — server actions (STAGED / flag-off).
 *
 * ⚠ Every mutating/assembly action hard-guards on `personLifeStoriesEnabled()`
 * (default OFF), so in production they are inert no-ops until the owner sets
 * `NEXT_PUBLIC_PERSON_LIFE_STORIES=1`. Nothing writes or surfaces cross-event
 * participant media while the flag is off.
 * ⚖ THAT IS THE ONLY CONDITION LEFT — corrected 2026-08-13. This used to say
 * "until PH counsel signs off AND …"; the first half was discharged by the
 * OWNER'S OWN ruling as registered DPO, not by outside counsel. See the
 * authority note on personLifeStoriesEnabled() in lib/person-life-stories.ts.
 * Plan: 03_Strategy/People_Graph_and_Lifelong_Identity_2026-07-04.md §9 + §12.
 *
 * WHAT THIS DOES: multi-homes a shared event photo / 5s clip / editorial into
 * every PARTICIPANT's own archive (person_story_items = references, not copies).
 * A participant reads their story, hides items from THEIR view (host gallery
 * untouched), and opt-out / face-blur tombstones them out entirely. Editorials
 * only propagate on host publish + the consented-guest gate.
 */

type ActionResult = { ok: true } | { ok: false; error: string };
type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

const OFF: ActionResult = { ok: false, error: 'Life stories aren’t available yet.' };

/** The claimed person node for the signed-in account (their own archive). */
async function myPersonId(supabase: SupabaseServer, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('people')
    .select('person_id')
    .eq('claimed_by_user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  return (data as { person_id: string } | null)?.person_id ?? null;
}

type StoryRow = {
  story_item_id: string;
  person_id: string;
  event_id: string;
  item_kind: PersonStoryItem['itemKind'];
  source_table: StorySourceTable;
  source_id: string;
  origin: StoryOrigin;
  consented_at: string | null;
  hidden_at: string | null;
  removed_at: string | null;
  created_at: string;
};

function toItem(r: StoryRow): PersonStoryItem {
  return {
    storyItemId: r.story_item_id,
    personId: r.person_id,
    eventId: r.event_id,
    itemKind: r.item_kind,
    sourceTable: r.source_table,
    sourceId: r.source_id,
    origin: r.origin,
    consentedAt: r.consented_at,
    hiddenAt: r.hidden_at,
    removedAt: r.removed_at,
    createdAt: r.created_at,
  };
}

/**
 * READ MODEL — the signed-in person's own lifelong story, newest first.
 * `includeHidden` surfaces items the person tidied away (for a "hidden" view);
 * removed (opt-out / face-blur) items are NEVER returned. RLS already scopes to
 * the caller's claimed person; this is the read a "Living" page would call.
 * Returns `[]` while the flag is off — inert, never leaks.
 */
export async function getMyLifeStory(
  opts: { includeHidden?: boolean } = {},
): Promise<PersonStoryItem[]> {
  if (!personLifeStoriesEnabled()) return [];
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const personId = await myPersonId(supabase, user.id);
  if (!personId) return [];

  let query = supabase
    .from('person_story_items')
    .select(
      'story_item_id,person_id,event_id,item_kind,source_table,source_id,origin,consented_at,hidden_at,removed_at,created_at',
    )
    .eq('person_id', personId)
    .is('removed_at', null)
    .order('created_at', { ascending: false });
  if (!opts.includeHidden) query = query.is('hidden_at', null);

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as StoryRow[]).map(toItem);
}

/** Hide an item from MY story. Per-person — never touches the host gallery. */
export async function hideMyStoryItem(storyItemId: string): Promise<ActionResult> {
  if (!personLifeStoriesEnabled()) return OFF;
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Please sign in.' };
  const supabase = await createClient();
  const personId = await myPersonId(supabase, user.id);
  if (!personId) return { ok: false, error: 'Your profile isn’t ready yet — try again in a moment.' };

  // RLS restricts the update to the caller's own person; person_id filter is a
  // belt-and-braces scope so no other person's rows can be touched.
  const { error } = await supabase
    .from('person_story_items')
    .update({ hidden_at: new Date().toISOString() })
    .eq('story_item_id', storyItemId)
    .eq('person_id', personId)
    .is('removed_at', null);
  if (error) return { ok: false, error: 'Couldn’t hide that.' };
  revalidatePath('/dashboard/people');
  return { ok: true };
}

/** Un-hide an item I previously hid. */
export async function unhideMyStoryItem(storyItemId: string): Promise<ActionResult> {
  if (!personLifeStoriesEnabled()) return OFF;
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Please sign in.' };
  const supabase = await createClient();
  const personId = await myPersonId(supabase, user.id);
  if (!personId) return { ok: false, error: 'Your profile isn’t ready yet — try again in a moment.' };

  const { error } = await supabase
    .from('person_story_items')
    .update({ hidden_at: null })
    .eq('story_item_id', storyItemId)
    .eq('person_id', personId)
    .is('removed_at', null);
  if (error) return { ok: false, error: 'Couldn’t restore that.' };
  revalidatePath('/dashboard/people');
  return { ok: true };
}

/**
 * OPT-OUT — remove me from an event's story entirely (RA 10173 opt-out / the
 * face-blur path). Tombstones every one of my story rows for that event so the
 * person disappears from the assembled story. Does NOT delete host media.
 */
export async function optOutOfEventStory(eventId: string): Promise<ActionResult> {
  if (!personLifeStoriesEnabled()) return OFF;
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Please sign in.' };
  const supabase = await createClient();
  const personId = await myPersonId(supabase, user.id);
  if (!personId) return { ok: false, error: 'Your profile isn’t ready yet — try again in a moment.' };

  const { error } = await supabase
    .from('person_story_items')
    .update({ removed_at: new Date().toISOString(), removed_reason: 'opt_out' })
    .eq('person_id', personId)
    .eq('event_id', eventId)
    .is('removed_at', null);
  if (error) return { ok: false, error: 'Couldn’t update your preference.' };
  revalidatePath('/dashboard/people');
  /*
    🔴 THE STRONGEST WITHDRAWAL IN THE PRODUCT REACHED ONE HOST SCREEN. This
    action is the RA 10173 opt-out — "remove me from this event's story
    entirely" — and it revalidated `/dashboard/people`, which is the person's own
    account page. The celebration's public story, its recap, its printable
    keepsake and its share card all carried on serving the old answer until
    whichever cache expired first. Same defect as the guest form and the "Not
    me" button (`04` §3); it is fixed the same way, through the one list.
  */
  await everyCopyIsNowStale(eventId);
  return { ok: true };
}
