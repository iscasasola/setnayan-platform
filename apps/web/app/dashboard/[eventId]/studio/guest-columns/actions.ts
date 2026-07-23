'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// Guest Columns — review actions (OnTheDay BUILD ① · studies doc § 1).
//
// NO RPC, NO admin client: approve/decline are plain `.update()`s riding the
// guest_columns_moderate RLS policy via the reviewer's OWN session — the
// moderation/actions.ts approveKwento/rejectKwento precedent. The RLS admits
// member_type IN ('couple','coordinator'); we deliberately follow the RLS
// (coordinator review allowed) rather than the kwento server actions'
// stricter `requireCouple` app gate — the study (§ 1.2) flagged that
// couple-only-vs-RLS-coordinator divergence as a live inconsistency, and for
// columns the policy is the authority.
//
// False-success discipline: RLS-filtered updates return 0 rows WITHOUT an
// error, so every update selects back the touched row and treats 0 rows as a
// failure (not-found / not-allowed / already-moved-on).

type ColumnActionResult = { ok: true } | { ok: false; error: string };

function columnsPath(eventId: string): string {
  return `/dashboard/${eventId}/studio/guest-columns`;
}

/** Approve a pending column — publishes it to the paper (guest site + the
 *  post-event editorial). The gcol_approved_needs_screen CHECK is the DB
 *  backstop (an 'unscreened'/'blocked' row can never be approved); public
 *  renders additionally require moderation_state='clean' (fail-closed). */
export async function approveColumn(
  eventId: string,
  columnId: string,
): Promise<ColumnActionResult> {
  if (!columnId?.trim()) return { ok: false, error: 'missing_input' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('guest_columns')
    .update({
      status: 'approved',
      decline_note: null,
      reviewed_at: new Date().toISOString(),
      reviewed_by_user_id: user?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('column_id', columnId)
    .eq('event_id', eventId)
    .eq('status', 'pending')
    .select('column_id');
  if (error) return { ok: false, error: error.message.slice(0, 80) };
  if (!data || data.length === 0) return { ok: false, error: 'not_found' };
  revalidatePath(columnsPath(eventId));
  return { ok: true };
}

/** Decline a column — RETURNS it to the guest (owner rule): the guest sees
 *  the optional note and can edit + resubmit through the same slot. Also
 *  unpublishes an approved column (the take-it-down lever). */
export async function declineColumn(
  eventId: string,
  columnId: string,
  note?: string,
): Promise<ColumnActionResult> {
  if (!columnId?.trim()) return { ok: false, error: 'missing_input' };
  const trimmed = (note ?? '').trim().slice(0, 200);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('guest_columns')
    .update({
      status: 'rejected',
      decline_note: trimmed.length > 0 ? trimmed : null,
      reviewed_at: new Date().toISOString(),
      reviewed_by_user_id: user?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('column_id', columnId)
    .eq('event_id', eventId)
    .in('status', ['pending', 'approved'])
    .select('column_id');
  if (error) return { ok: false, error: error.message.slice(0, 80) };
  if (!data || data.length === 0) return { ok: false, error: 'not_found' };
  revalidatePath(columnsPath(eventId));
  return { ok: true };
}
