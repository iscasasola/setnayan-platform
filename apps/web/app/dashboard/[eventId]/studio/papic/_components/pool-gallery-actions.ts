'use server';

/**
 * Shared Pool Gallery — the couple's open/close action (OnTheDay build ⑥).
 *
 * COUPLE-ONLY (owner-locked): unlike the wall controls (couple + coordinator),
 * opening the whole capture pool to every guest is a privacy decision only the
 * couple may make — a coordinator gets 'forbidden'. Membership-gated here,
 * then written with the admin client (events RLS update path is couple-or-admin
 * anyway; the explicit gate keeps the semantics readable and coordinator-proof).
 *
 * Closing is RETROACTIVE: the guest_pool_gallery RPC re-checks
 * events.pool_gallery_open on every read, so flipping OFF empties the pool
 * (and kills self-linking) on the very next request.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { papicPoolGalleryEnabled } from '@/lib/papic-pool-flag';

type ActionResult = { ok: true; open: boolean } | { ok: false; error: string };

export async function setPoolGalleryOpen(
  eventId: string,
  open: boolean,
): Promise<ActionResult> {
  if (!papicPoolGalleryEnabled()) return { ok: false, error: 'unavailable' };
  const clean = eventId?.trim();
  if (!clean) return { ok: false, error: 'missing_event' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'unauthorized' };

  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', clean)
    .eq('user_id', user.id)
    .maybeSingle();
  // COUPLE-only — a coordinator may run the wall, but not open the pool.
  if (!membership || membership.member_type !== 'couple') {
    return { ok: false, error: 'forbidden' };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('events')
    .update({ pool_gallery_open: open === true })
    .eq('event_id', clean)
    .select('event_id');
  if (error) return { ok: false, error: error.message.slice(0, 80) };
  // 0-row update (event vanished / column missing pre-migration) is NOT success.
  if (!data || data.length === 0) return { ok: false, error: 'not_saved' };

  revalidatePath(`/dashboard/${clean}/studio/papic`);
  return { ok: true, open: open === true };
}
