'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { mergeSongs } from '@/lib/songs';

const BASE = '/admin/songs';

// Mirrors the /admin/pricing requireAdmin gate (defense-in-depth — the /admin
// layout already 404s non-admins, but server actions re-check).
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
}

function parseId(v: FormDataEntryValue | null): number | null {
  const n = Number(String(v ?? '').trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Merge the duplicate song into the canonical one (re-points repertoires +
 *  couple picks, deletes the dup). Service-role client bypasses the admin-only
 *  songs RLS. */
export async function mergeSongsAction(formData: FormData) {
  await requireAdmin();
  const dupId = parseId(formData.get('dup_id'));
  const canonicalId = parseId(formData.get('canonical_id'));
  if (!dupId || !canonicalId || dupId === canonicalId) {
    redirect(`${BASE}?error=${encodeURIComponent('Enter two different valid song IDs.')}`);
  }
  await mergeSongs(createAdminClient(), dupId, canonicalId);
  revalidatePath(BASE);
  redirect(`${BASE}?merged=1`);
}

/** Remove a junk song (cascades its repertoire/pick links). */
export async function deleteSongAction(formData: FormData) {
  await requireAdmin();
  const songId = parseId(formData.get('song_id'));
  if (!songId) redirect(`${BASE}?error=${encodeURIComponent('Missing song.')}`);
  const { error } = await createAdminClient().from('songs').delete().eq('song_id', songId);
  if (error) redirect(`${BASE}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(BASE);
  redirect(`${BASE}?deleted=1`);
}
