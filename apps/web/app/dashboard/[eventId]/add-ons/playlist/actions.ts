'use server';

/**
 * Server actions for the Playlist Builder add-on surface.
 *
 * Couple-side mutations only — the booked Music vendor's RLS policy is
 * SELECT-only (read the picks, can't write). All four actions revalidate
 * both /add-ons/playlist (the editor) AND the booked vendor's per-vendor
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
import { PLAYLIST_SLOT_TYPES, type PlaylistSlotType } from '@/lib/playlist';

const VALID_SLOTS = new Set<PlaylistSlotType>(PLAYLIST_SLOT_TYPES);

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

  const { error } = await supabase.from('event_playlist_picks').insert({
    event_id: eventId,
    slot_type: slotRaw,
    song_label: trimmedLabel,
    artist,
    notes,
    sort_order: nextSortOrder,
    created_by_user_id: user.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/add-ons/playlist`);
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

  const { error } = await supabase
    .from('event_playlist_picks')
    .update(patch)
    .eq('pick_id', pickId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}/add-ons/playlist`);
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

  revalidatePath(`/dashboard/${eventId}/add-ons/playlist`);
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

  revalidatePath(`/dashboard/${eventId}/add-ons/playlist`);
  revalidatePath(`/dashboard/${eventId}`);
}
