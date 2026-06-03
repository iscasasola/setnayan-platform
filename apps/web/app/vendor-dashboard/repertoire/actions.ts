'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { findOrCreateSongId } from '@/lib/songs';

const BASE = '/vendor-dashboard/repertoire';

// Preserve the vendor's current search query across the action redirect so they
// stay on their results after adding / removing.
function back(params: { q?: string; saved?: boolean; error?: string }): never {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.error) sp.set('error', params.error);
  else if (params.saved) sp.set('saved', '1');
  const qs = sp.toString();
  redirect(qs ? `${BASE}?${qs}` : BASE);
}

async function ensureProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  return { supabase, profile };
}

/**
 * Add a song to the vendor's repertoire. Accepts either an existing master
 * `song_id` (a pick from search / curated) or a typed `title` + `artist` (a new
 * song → find-or-create in the master catalogue). The vendor_songs upsert is
 * idempotent (ON CONFLICT DO NOTHING) so re-adding is a no-op, and RLS scopes
 * the write to the vendor's own profile.
 */
export async function addRepertoireSong(formData: FormData) {
  const { supabase, profile } = await ensureProfile();
  const q = String(formData.get('q') ?? '').trim();

  const rawId = String(formData.get('song_id') ?? '').trim();
  let songId: number | null = null;
  if (rawId) {
    const n = Number(rawId);
    if (Number.isInteger(n) && n > 0) songId = n;
  }
  if (!songId) {
    songId = await findOrCreateSongId(
      supabase,
      String(formData.get('title') ?? ''),
      String(formData.get('artist') ?? ''),
    );
  }
  if (!songId) back({ q, error: 'Add a song title.' });

  const { error } = await supabase
    .from('vendor_songs')
    .upsert(
      { vendor_profile_id: profile.vendor_profile_id, song_id: songId },
      { onConflict: 'vendor_profile_id,song_id', ignoreDuplicates: true },
    );
  if (error) back({ q, error: error.message });

  revalidatePath(BASE);
  back({ q, saved: true });
}

/** Remove a song from the vendor's repertoire (the master record is untouched). */
export async function removeRepertoireSong(formData: FormData) {
  const { supabase, profile } = await ensureProfile();
  const q = String(formData.get('q') ?? '').trim();
  const songId = Number(String(formData.get('song_id') ?? ''));
  if (!Number.isInteger(songId) || songId <= 0) back({ q, error: 'Missing song.' });

  const { error } = await supabase
    .from('vendor_songs')
    .delete()
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .eq('song_id', songId);
  if (error) back({ q, error: error.message });

  revalidatePath(BASE);
  back({ q, saved: true });
}
