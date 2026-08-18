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

/**
 * Put a song into the common list, or take it out.
 *
 * 🚨 THE MISSING HALF, built 2026-08-18. The catalogue fills up from the BANDS
 * (owner: *"songs in the catalogue will be filled in by the bands. not from us.
 * but we can place songs that are common for now"*) — so the seeded list is a
 * starting point Setnayan curates, and until today the screen printed "curated"
 * as a read-only LABEL. You could delete a song and merge two songs; you could
 * not say "this one belongs in the common list". When 93 songs fell out of it,
 * nobody had a button to put a single one back.
 *
 * ⛔ DELIBERATELY THE USER-SCOPED CLIENT, NOT `createAdminClient()` — and this
 * is the whole reason this docblock exists. The other two actions here use the
 * service-role client to bypass RLS, so copying them would be the obvious move.
 * It would ship a control that SILENTLY DOES NOTHING:
 *
 *   `songs_nonadmin_guard` pins `is_curated_pick` to its OLD value unless
 *   `public.is_admin()` is true, and `is_admin()` reads `auth.uid()` — which is
 *   NULL under service role. The UPDATE would report success, change nothing,
 *   and the label would not move.
 *
 * 🔑 That is the exact defect this whole day has been about: a gate with no
 * handle, and it would have been BUILT TODAY, by the person fixing them.
 *
 * The user-scoped client is also sufficient: `songs_admin_update` admits
 * `authenticated` where `is_admin()`, and both `is_curated_pick` and `source`
 * are UPDATE-granted to that role — verified against production, not inferred.
 * The same session satisfies the policy AND the trigger, so the write lands.
 *
 * `source` is set alongside, so a band-added song promoted into the common list
 * stops claiming to be a vendor submission — and the pair stays consistent with
 * the seed, which is what the (now-superseded) repair query keyed on.
 */
export async function setSongCuratedAction(formData: FormData) {
  await requireAdmin();
  const songId = parseId(formData.get('song_id'));
  if (!songId) redirect(`${BASE}?error=${encodeURIComponent('Missing song.')}`);
  const curated = String(formData.get('curated') ?? '') === '1';

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('songs')
    .update({ is_curated_pick: curated, source: curated ? 'seed' : 'vendor' })
    .eq('song_id', songId)
    .select('song_id');

  if (error) redirect(`${BASE}?error=${encodeURIComponent(error.message)}`);
  /*
    🪤 A ZERO-ROW UPDATE IS A SILENT REFUSAL. Supabase resolves rather than
    throwing, and an RLS filter and a successful no-op are the same shape: no
    rows, no error. Without this the screen would report success while the
    label stayed exactly where it was — which is how this feature would have
    failed if it had been built on the service-role client.
  */
  if (!data || data.length === 0) {
    redirect(
      `${BASE}?error=${encodeURIComponent(
        'That did not save. Your account may no longer have admin rights.',
      )}`,
    );
  }
  revalidatePath(BASE);
  redirect(`${BASE}?curated=${curated ? '1' : '0'}`);
}
