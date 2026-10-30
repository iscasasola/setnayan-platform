'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { limitedHelperRefusal } from '@/lib/host-gate';
import { memoriesManagerRole } from '@/lib/memories-rules.server';
import { guestDisplayName } from '@/lib/guests';
import { readAllPages } from '@/lib/read-all-pages';
import { logQueryError } from '@/lib/supabase/error-detect';
import { everyCopyIsNowStale } from '@/lib/a-withdrawal-reaches-every-copy.server';
import { isTaggableTable } from '@/lib/memories-viewer';
import type { PhotoTagInput, PhotoTagResult, PhotoTagState } from '@/lib/memories-photo-tags';

/**
 * 🏷 WHO IS IN THIS PHOTO — the Memories viewer's Tag (owner 2026-10-30: "Share, Hide, Delete, Tag, Add to Chapter").
 *
 * ONE action, three ops (the server-action budget sits at its ceiling — `lint-server-action-budget.mjs`):
 *   read     the photo's live tags (with names) + the event's guests to add from
 *   remove   a wrong tag goes — a SOFT TOMBSTONE (`removed_at` · `removed_by = 'couple'`), the shipped "Not me"
 *            mechanism (migration 20270131081062): a deleted row would be re-added by the next face-match run, the
 *            tombstone is never re-tagged (`autoTagCapture` reads every row, live or not)
 *   add      the right person — a `manual_pick` tag; a tag the hosts removed earlier is revived in place (the UNIQUE
 *            pair is reused). 🔒 A tag the GUEST removed ("Not me", RA 10173 — their objection) is NOT re-added here:
 *            only they can take it back.
 *
 * 🔒 WHO: whoever manages the Memories rules — the hosts and the event's coordinator (`memoriesManagerRole`, the
 * 2026-10-30 ruling; a refused read refuses). Limited helpers are refused first, in their own words. Every write is
 * pinned to this event's photo and this event's guest — an id from another event matches nothing.
 *
 * Why it matters: under "Only tagged" (the default) a tag decides which guest sees the photo — a wrong face-match
 * tag shows one guest's photo to another.
 */
export async function memoriesPhotoTags(eventId: string, input: PhotoTagInput): Promise<PhotoTagResult> {
  const refusal = await limitedHelperRefusal(eventId, null);
  if (refusal) return { ok: false, error: refusal };
  const clean = typeof eventId === 'string' ? eventId.trim() : '';
  if (!clean || !input || !isTaggableTable(input.table) || typeof input.photoId !== 'string' || !input.photoId) {
    return { ok: false, error: 'Something was missing — close this and try again.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };
  const role = await memoriesManagerRole(supabase, clean, user.id);
  if (!role) return { ok: false, error: 'Only the hosts and the coordinator can tag photos.' };

  const admin = createAdminClient();
  const idCol = input.table === 'papic_photos' ? 'photo_id' : 'capture_id';
  // The photo belongs to THIS event — the tenancy binding for every write below.
  const { data: photo, error: photoErr } = await admin.from(input.table).select(idCol).eq(idCol, input.photoId).eq('event_id', clean).maybeSingle();
  if (photoErr) {
    logQueryError('memoriesPhotoTags.photo', photoErr, { event_id: clean });
    return { ok: false, error: 'We couldn’t check this photo just now — nothing changed.' };
  }
  if (!photo) return { ok: false, error: 'This photo is no longer here.' };

  if (input.op === 'remove' || input.op === 'add') {
    const guestId = typeof input.guestId === 'string' ? input.guestId : '';
    if (!guestId) return { ok: false, error: 'Pick a person first.' };
    const { data: guest, error: guestErr } = await admin.from('guests').select('guest_id').eq('guest_id', guestId).eq('event_id', clean).maybeSingle();
    if (guestErr || !guest) return { ok: false, error: 'That guest isn’t on this event’s list.' };
    const { data: row, error: rowErr } = await admin
      .from('photo_tags')
      .select('tag_id, removed_at, removed_by')
      .eq('source_table', input.table)
      .eq('source_id', input.photoId)
      .eq('guest_id', guestId)
      .maybeSingle();
    if (rowErr) {
      logQueryError('memoriesPhotoTags.row', rowErr, { event_id: clean });
      return { ok: false, error: 'We couldn’t read this photo’s tags — nothing changed.' };
    }

    if (input.op === 'remove') {
      if (row && !row.removed_at) {
        const { data: done, error } = await admin
          .from('photo_tags')
          .update({ removed_at: new Date().toISOString(), removed_by: 'couple' })
          .eq('tag_id', row.tag_id as string)
          .eq('event_id', clean)
          .select('tag_id');
        // A zero-row update is not a removal.
        if (error || !done || done.length === 0) return { ok: false, error: 'We couldn’t remove that tag — nothing changed.' };
      }
    } else {
      if (row && row.removed_at && row.removed_by === 'guest') {
        return { ok: false, error: 'They said this photo isn’t them — only they can add it back.' };
      }
      if (row && row.removed_at) {
        const { data: done, error } = await admin
          .from('photo_tags')
          .update({ removed_at: null, removed_by: null, source: 'manual_pick', confidence: null })
          .eq('tag_id', row.tag_id as string)
          .eq('event_id', clean)
          .select('tag_id');
        if (error || !done || done.length === 0) return { ok: false, error: 'We couldn’t add that tag — nothing changed.' };
      } else if (!row) {
        const { error } = await admin
          .from('photo_tags')
          .insert({ event_id: clean, source_table: input.table, source_id: input.photoId, guest_id: guestId, source: 'manual_pick' });
        if (error) return { ok: false, error: 'We couldn’t add that tag — nothing changed.' };
      }
    }
    // A tag decides who sees the photo (Only tagged) and what a guest's story may show — every cached copy is stale.
    await everyCopyIsNowStale(clean);
    revalidatePath(`/dashboard/${clean}/memories`);
  }

  const state = await readTagState(admin, clean, input.table, input.photoId);
  return state ? { ok: true, state } : { ok: false, error: 'We couldn’t load who is tagged just now.' };
}

/** The photo's tags (live and guest-removed) and the event's guests — one read each, said as a refusal when refused. */
async function readTagState(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  table: string,
  photoId: string,
): Promise<PhotoTagState | null> {
  const [tagsRes, guestsRes] = await Promise.all([
    admin.from('photo_tags').select('guest_id, source, removed_at, removed_by').eq('event_id', eventId).eq('source_table', table).eq('source_id', photoId),
    readAllPages(async (from, to) => {
      const r = await admin
        .from('guests')
        .select('guest_id, display_name, first_name, last_name', { count: 'exact' })
        .eq('event_id', eventId)
        .is('deleted_at', null)
        .order('first_name', { ascending: true })
        .range(from, to);
      return { rows: r.data, error: r.error?.message ?? null, total: r.count };
    }),
  ]);
  if (tagsRes.error || guestsRes.error) {
    logQueryError('memoriesPhotoTags.state', tagsRes.error ?? { message: guestsRes.error ?? 'guests' }, { event_id: eventId });
    return null;
  }
  const names = new Map(
    (guestsRes.rows as { guest_id: string; display_name: string | null; first_name: string | null; last_name: string | null }[]).map((g) => [
      g.guest_id,
      guestDisplayName({ display_name: g.display_name, first_name: g.first_name ?? '', last_name: g.last_name ?? '' }) || 'A guest',
    ]),
  );
  const rows = (tagsRes.data ?? []) as { guest_id: string; source: string; removed_at: string | null; removed_by: string | null }[];
  return {
    tagged: rows
      .filter((r) => !r.removed_at)
      .map((r) => ({ guestId: r.guest_id, name: names.get(r.guest_id) ?? 'A guest no longer on your list', auto: r.source === 'auto_face' })),
    guests: [...names].map(([guestId, name]) => ({ guestId, name })),
    saidNotMe: rows.filter((r) => r.removed_at && r.removed_by === 'guest').map((r) => r.guest_id),
    complete: guestsRes.complete,
  };
}
