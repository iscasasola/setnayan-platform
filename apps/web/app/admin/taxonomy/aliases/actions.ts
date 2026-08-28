'use server';

/**
 * /admin/taxonomy/aliases/actions.ts — approve or reject one proposed alias.
 *
 * 🔒 THE WHOLE POINT OF THIS FILE. A row in `canonical_service_aliases` with
 * `reviewed_at IS NULL` answers nobody — the RLS read policy hides it from
 * every ordinary session, and `reviewedAliasesByLiveTrade` re-checks the
 * same fact even when read with elevated privileges. APPROVING is the only
 * thing that turns a machine's guess into something a supplier can find
 * their trade by. There is no bulk-approve: each phrase is one press.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdminAction } from '@/lib/admin/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';

const BASE = '/admin/taxonomy/aliases';

function backTo(qs: URLSearchParams): never {
  redirect(`${BASE}?${qs.toString()}`);
}

function carryFilter(formData: FormData): URLSearchParams {
  const qs = new URLSearchParams();
  const q = String(formData.get('_q') ?? '').trim().slice(0, 80);
  if (q) qs.set('q', q);
  return qs;
}

/** Approve one proposed alias — the only act that lets it answer a supplier. */
export async function approveTradeAlias(formData: FormData) {
  const { userId } = await requireAdminAction();
  const id = Number(formData.get('id'));
  const qs = carryFilter(formData);
  if (!Number.isFinite(id) || id <= 0) {
    qs.set('error', 'Missing alias id.');
    backTo(qs);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('canonical_service_aliases')
    .update({
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    // Only ever reviews an UNREVIEWED row — a double-press or a stale tab
    // cannot re-stamp a reviewer over somebody else's decision.
    .is('reviewed_at', null);
  if (error) {
    qs.set('error', error.message);
    backTo(qs);
  }

  revalidatePath(BASE);
  qs.set('ok', 'Approved.');
  backTo(qs);
}

/**
 * Reject one proposed alias. Deleted, not merely flagged — a rejected guess
 * costs nothing to regenerate, and a permanently-pending row would clutter
 * the queue forever with something already decided.
 */
export async function rejectTradeAlias(formData: FormData) {
  await requireAdminAction();
  const id = Number(formData.get('id'));
  const qs = carryFilter(formData);
  if (!Number.isFinite(id) || id <= 0) {
    qs.set('error', 'Missing alias id.');
    backTo(qs);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('canonical_service_aliases')
    .delete()
    .eq('id', id)
    .is('reviewed_at', null);
  if (error) {
    qs.set('error', error.message);
    backTo(qs);
  }

  revalidatePath(BASE);
  qs.set('ok', 'Rejected.');
  backTo(qs);
}

/**
 * Un-teach a REVIEWED alias — the admin changed their mind after it went
 * live. Deletes outright; the seeding script can propose it again later if
 * it is still right, and a live alias must never linger half-retracted.
 */
export async function unteachTradeAlias(formData: FormData) {
  await requireAdminAction();
  const id = Number(formData.get('id'));
  const qs = carryFilter(formData);
  qs.set('tab', 'reviewed');
  if (!Number.isFinite(id) || id <= 0) {
    qs.set('error', 'Missing alias id.');
    backTo(qs);
  }

  const admin = createAdminClient();
  const { error } = await admin.from('canonical_service_aliases').delete().eq('id', id);
  if (error) {
    qs.set('error', error.message);
    backTo(qs);
  }

  revalidatePath(BASE);
  qs.set('ok', 'Removed.');
  backTo(qs);
}
