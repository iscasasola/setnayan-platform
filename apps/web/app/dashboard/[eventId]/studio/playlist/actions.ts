'use server';

/**
 * Server actions for the Playlist Builder add-on surface.
 *
 * Couple-side mutations only — the booked Music vendor's RLS policy is
 * SELECT-only (read the picks, can't write). All four actions revalidate
 * both /studio/playlist (the editor) AND the booked vendor's per-vendor
 * workspace at /dashboard/[eventId]/vendors/[vendorId] so the vendor sees
 * fresh state on their next view.
 *
 * Sort-order spacing of 100 between picks gives room for inserts without
 * full reorder (mirrors `reorderScheduleBlocks` from Card 15). When the
 * host reorders explicitly, a bulk gap-100 reassignment runs.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { findOrCreateSongId } from '@/lib/songs';
import {
  PLAYLIST_SLOT_TYPES,
  PLAYLIST_VIBES,
  type PlaylistSlotType,
  type PlaylistVibe,
} from '@/lib/playlist';

const VALID_SLOTS = new Set<PlaylistSlotType>(PLAYLIST_SLOT_TYPES);
const VALID_VIBES = new Set<PlaylistVibe>(PLAYLIST_VIBES);

function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

function trimToMax(raw: FormDataEntryValue | null, max: number): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (t.length === 0) return null;
  return t.slice(0, max);
}

/**
 * Add a song pick to a specific slot. Auto-assigns sort_order to be 100
 * greater than the max in that slot (so the new pick lands at the bottom
 * of its section).
 */
export async function addPlaylistPick(formData: FormData) {
  const eventId = formData.get('event_id');
  const slotRaw = formData.get('slot_type');
  const songLabel = formData.get('song_label');

  if (typeof eventId !== 'string' || eventId.length === 0) {
    throw new Error('event_id required');
  }
  if (typeof slotRaw !== 'string' || !VALID_SLOTS.has(slotRaw as PlaylistSlotType)) {
    throw new Error('Invalid slot type');
  }
  if (typeof songLabel !== 'string' || songLabel.trim().length === 0) {
    throw new Error('Song label is required');
  }

  const trimmedLabel = songLabel.trim().slice(0, 200);
  const artist = trimToMax(formData.get('artist'), 200);
  const notes = trimToMax(formData.get('notes'), 500);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Find the next sort_order so new picks append to the slot.
  const { data: maxRow } = await supabase
    .from('event_playlist_picks')
    .select('sort_order')
    .eq('event_id', eventId)
    .eq('slot_type', slotRaw)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder =
    (maxRow?.sort_order as number | undefined) != null
      ? (maxRow!.sort_order as number) + 100
      : 100;

  // Resolve the catalogue identity at WRITE time (PR 3 · migration
  // 20271022319040). Three readers used to answer "is this the same song?" by
  // normalising strings — the tray, the band's repertoire crossing, and the
  // vendor match score. Resolving once here replaces all three fuzzy joins with
  // an id. Best-effort: an uncatalogued song (a family composition, a spelling
  // they prefer) stores NULL and keeps its text, which is a legitimate pick and
  // not an error.
  const songId = await findOrCreateSongId(supabase, trimmedLabel, artist ?? '');

  const { error } = await supabase.from('event_playlist_picks').insert({
    event_id: eventId,
    slot_type: slotRaw,
    song_label: trimmedLabel,
    artist,
    notes,
    sort_order: nextSortOrder,
    created_by_user_id: user.id,
    song_id: songId,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/studio/playlist`);
  revalidatePath(`/dashboard/${eventId}`);
}

/** Update a single pick · label/artist/notes. Empty body fields nullify
 *  the column. */
export async function updatePlaylistPick(formData: FormData) {
  const eventId = formData.get('event_id');
  const pickId = formData.get('pick_id');

  if (typeof eventId !== 'string' || typeof pickId !== 'string') {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  type Patch = {
    song_label?: string;
    artist?: string | null;
    notes?: string | null;
    song_id?: number | null;
    updated_at: string;
  };
  const patch: Patch = { updated_at: new Date().toISOString() };

  const labelRaw = formData.get('song_label');
  if (typeof labelRaw === 'string') {
    const trimmed = labelRaw.trim().slice(0, 200);
    if (trimmed.length === 0) throw new Error('Song label cannot be empty');
    patch.song_label = trimmed;
  }

  const artistRaw = formData.get('artist');
  if (artistRaw !== null) patch.artist = nullIfBlank(artistRaw);

  const notesRaw = formData.get('notes');
  if (notesRaw !== null) patch.notes = nullIfBlank(notesRaw);

  // ⚠ RE-RESOLVE WHENEVER THE TEXT MOVES. A stale `song_id` is worse than a null
  // one: it would keep crossing against the OLD song in the tray, the band's
  // repertoire match and the vendor score, invisibly, while the couple looks at
  // the new title. So any edit to label or artist re-resolves — and needs BOTH
  // final values, which means reading the row for whichever side was not sent.
  if (patch.song_label !== undefined || patch.artist !== undefined) {
    const { data: current } = await supabase
      .from('event_playlist_picks')
      .select('song_label, artist')
      .eq('pick_id', pickId)
      .eq('event_id', eventId)
      .maybeSingle();
    const finalLabel = patch.song_label ?? (current?.song_label as string | undefined) ?? '';
    const finalArtist =
      patch.artist !== undefined ? patch.artist : ((current?.artist as string | null) ?? null);
    patch.song_id = finalLabel
      ? await findOrCreateSongId(supabase, finalLabel, finalArtist ?? '')
      : null;
  }

  const { error } = await supabase
    .from('event_playlist_picks')
    .update(patch)
    .eq('pick_id', pickId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/studio/playlist`);
  revalidatePath(`/dashboard/${eventId}`);
}

/** Delete a single pick by id. RLS double-checks event_id ownership. */
export async function deletePlaylistPick(formData: FormData) {
  const eventId = formData.get('event_id');
  const pickId = formData.get('pick_id');

  if (typeof eventId !== 'string' || typeof pickId !== 'string') {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_playlist_picks')
    .delete()
    .eq('pick_id', pickId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/studio/playlist`);
  revalidatePath(`/dashboard/${eventId}`);
}

/**
 * Bulk reorder picks within a single slot. Caller passes comma-separated
 * pick_ids in the target order; server reassigns sort_order at gap-100
 * spacing. Mirrors reorderScheduleBlocks (Card 15) pattern.
 */
export async function reorderPlaylistPicks(formData: FormData) {
  const eventId = formData.get('event_id');
  const orderedRaw = formData.get('ordered_pick_ids');

  if (typeof eventId !== 'string' || typeof orderedRaw !== 'string') {
    throw new Error('Invalid input');
  }

  const orderedIds = orderedRaw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (orderedIds.length === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const now = new Date().toISOString();
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('event_playlist_picks')
      .update({ sort_order: (i + 1) * 100, updated_at: now })
      .eq('pick_id', orderedIds[i]!)
      .eq('event_id', eventId);
    if (error) throw new Error(`Reorder failed at row ${i}: ${error.message}`);
  }

  revalidatePath(`/dashboard/${eventId}/studio/playlist`);
  revalidatePath(`/dashboard/${eventId}`);
}

/**
 * Set — or clear — the FEEL the couple wants for one moment. (Song Desk PR 4,
 * owner-locked 2026-07-30: six frozen names, `acoustic`…`showband`.)
 *
 * A vibe sits ALONGSIDE the picks, never instead of them: the owner's own
 * example is a slot carrying both — "jazz for dinner, but you must play Through
 * the Years" — so this touches `event_playlist_slot_vibes` and never
 * `event_playlist_picks`.
 *
 * CLEARING IS A DELETE, not a sentinel value. The absence of a row is what "let
 * the band decide" means, which is exactly why the owner declined a seventh
 * "Band's call" option — storing one would give us two ways to say one thing.
 *
 * UPSERT on the (event, slot) unique index rather than insert-or-update by hand:
 * a second "dinner" row would leave the surface picking one arbitrarily.
 */
export async function setPlaylistSlotVibe(formData: FormData) {
  const eventId = formData.get('event_id');
  const slotType = formData.get('slot_type');
  // '' (or absent) means clear. Anything else must be one of the six.
  const rawVibe = formData.get('vibe');

  if (typeof eventId !== 'string' || typeof slotType !== 'string') {
    throw new Error('Invalid input');
  }
  if (!VALID_SLOTS.has(slotType as PlaylistSlotType)) {
    throw new Error('Unknown moment');
  }
  const vibe = typeof rawVibe === 'string' && rawVibe.length > 0 ? rawVibe : null;
  if (vibe !== null && !VALID_VIBES.has(vibe as PlaylistVibe)) {
    throw new Error('Unknown vibe');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (vibe === null) {
    const { error } = await supabase
      .from('event_playlist_slot_vibes')
      .delete()
      .eq('event_id', eventId)
      .eq('slot_type', slotType);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('event_playlist_slot_vibes').upsert(
      {
        event_id: eventId,
        slot_type: slotType,
        vibe,
        set_by_user_id: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'event_id,slot_type' },
    );
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/dashboard/${eventId}/studio/playlist`);
  revalidatePath(`/dashboard/${eventId}`);
}
