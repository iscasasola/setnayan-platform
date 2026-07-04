'use server';

import { revalidatePath } from 'next/cache';
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
 * (default OFF), so in production they are inert no-ops until PH counsel signs
 * off and the owner flips `NEXT_PUBLIC_PERSON_LIFE_STORIES=1`. Nothing writes or
 * surfaces cross-event participant media while the flag is off.
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
  return { ok: true };
}

// ---------------------------------------------------------------------------
// ASSEMBLY (host / system side) — the flag-gated multi-home. Runs with the
// admin client because it writes into UNCLAIMED persons' archives too (a guest
// who never signed up has no auth.uid()); application-level scoping is enforced
// here. Idempotent via the (person, source_table, source_id) unique index.
// ---------------------------------------------------------------------------

/**
 * Multi-home a single Papic item (photo/clip) into the archive of every tagged
 * PARTICIPANT who is a linked person. Assembled from TAGS + QR only — face
 * (`auto_face`) tags are skipped by `originFromPhotoTagSource`. Called by the
 * capture/tag pipeline (guarded); a no-op while the flag is off.
 */
export async function multiHomePapicItem(input: {
  eventId: string;
  sourceTable: 'papic_photos' | 'papic_guest_captures';
  sourceId: string;
  itemKind: 'photo' | 'clip';
}): Promise<ActionResult> {
  if (!personLifeStoriesEnabled()) return OFF;
  const admin = createAdminClient();

  // Every tag on this item, with the tagged guest's linked person (if any).
  const { data: tags, error: tagErr } = await admin
    .from('photo_tags')
    .select('tag_id,source,guest_id,guests!inner(person_id)')
    .eq('event_id', input.eventId)
    .eq('source_table', input.sourceTable)
    .eq('source_id', input.sourceId);
  if (tagErr) return { ok: false, error: 'Couldn’t read tags.' };

  type TagRow = {
    tag_id: string;
    source: 'individual_qr' | 'table_qr' | 'auto_face' | 'manual_pick';
    guests: { person_id: string | null } | { person_id: string | null }[] | null;
  };
  const rows: {
    person_id: string;
    event_id: string;
    item_kind: 'photo' | 'clip';
    source_table: StorySourceTable;
    source_id: string;
    origin: StoryOrigin;
    source_tag_id: string;
  }[] = [];
  const seen = new Set<string>();

  for (const t of (tags ?? []) as TagRow[]) {
    const origin = originFromPhotoTagSource(t.source); // null for auto_face → skipped
    if (!origin) continue;
    const g = Array.isArray(t.guests) ? t.guests[0] : t.guests;
    const personId = g?.person_id;
    if (!personId || seen.has(personId)) continue; // one row per person per item
    seen.add(personId);
    rows.push({
      person_id: personId,
      event_id: input.eventId,
      item_kind: input.itemKind,
      source_table: input.sourceTable,
      source_id: input.sourceId,
      origin,
      source_tag_id: t.tag_id,
    });
  }
  if (rows.length === 0) return { ok: true };

  const { error } = await admin
    .from('person_story_items')
    .upsert(rows, { onConflict: 'person_id,source_table,source_id', ignoreDuplicates: true });
  if (error) return { ok: false, error: 'Couldn’t update stories.' };
  return { ok: true };
}

/**
 * Propagate a PUBLISHED editorial into participants' archives. Constraint #5:
 * editorials propagate ONLY on host publish AND per the existing consented-guest
 * gate. Callers pass the list of person_ids that cleared that gate (consented
 * Papic participants); this writes one consented editorial row per person.
 * A no-op while the flag is off, or if the editorial isn't published.
 */
export async function propagatePublishedEditorial(input: {
  eventId: string;
  editorialId: string;
  consentedPersonIds: string[];
}): Promise<ActionResult> {
  if (!personLifeStoriesEnabled()) return OFF;
  if (input.consentedPersonIds.length === 0) return { ok: true };
  const admin = createAdminClient();

  // Host-publish gate — refuse unless the editorial is actually published.
  const { data: ed, error: edErr } = await admin
    .from('event_editorial')
    .select('status')
    .eq('editorial_id', input.editorialId)
    .eq('event_id', input.eventId)
    .maybeSingle();
  if (edErr || !ed || (ed as { status: string }).status !== 'published') {
    return { ok: false, error: 'Editorial isn’t published.' };
  }

  const now = new Date().toISOString();
  const rows = input.consentedPersonIds.map((personId) => ({
    person_id: personId,
    event_id: input.eventId,
    item_kind: 'editorial' as const,
    source_table: 'event_editorial' as StorySourceTable,
    source_id: input.editorialId,
    origin: 'editorial_publish' as StoryOrigin,
    consented_at: now, // required by the CHECK for editorial rows
  }));

  const { error } = await admin
    .from('person_story_items')
    .upsert(rows, { onConflict: 'person_id,source_table,source_id', ignoreDuplicates: true });
  if (error) return { ok: false, error: 'Couldn’t propagate the editorial.' };
  return { ok: true };
}
