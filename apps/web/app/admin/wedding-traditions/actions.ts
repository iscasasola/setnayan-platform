'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { WEDDING_TRADITIONS_GUIDE } from '@/lib/wedding-traditions';

/**
 * Admin CRUD for the per-religion wedding traditions content
 * (wedding_tradition_items, migration 20260807000000). The /paperwork "What to
 * expect" guide reads these rows when present, else the code defaults. Mirrors
 * the console admin-auth gate; the table RLS (`public.is_admin()`) is the
 * server-side backstop.
 */

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
  return user.id;
}

const CEREMONY_TYPES = [
  'catholic', 'civil', 'inc', 'christian', 'muslim', 'cultural', 'chinese', 'mixed',
] as const;
const DIMENSIONS = ['officiant', 'ceremonial', 'food', 'custom', 'paperwork'] as const;

export async function upsertTraditionItem(formData: FormData) {
  await requireAdmin();
  const itemId = String(formData.get('item_id') ?? '').trim();
  const ceremonyType = String(formData.get('ceremony_type') ?? '').trim();
  const dimension = String(formData.get('dimension') ?? '').trim();
  const label = String(formData.get('label') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim();
  const sortRaw = Number(formData.get('sort_order'));
  const sortOrder = Number.isFinite(sortRaw) ? Math.trunc(sortRaw) : 0;
  const isActive = String(formData.get('is_active') ?? 'true') === 'true';

  if (
    !CEREMONY_TYPES.includes(ceremonyType as (typeof CEREMONY_TYPES)[number]) ||
    !DIMENSIONS.includes(dimension as (typeof DIMENSIONS)[number]) ||
    !label
  ) {
    throw new Error('Invalid input');
  }

  const admin = createAdminClient();
  const patch = {
    ceremony_type: ceremonyType,
    dimension,
    label,
    note,
    sort_order: sortOrder,
    is_active: isActive,
    updated_at: new Date().toISOString(),
  };

  if (itemId) {
    const { error } = await admin
      .from('wedding_tradition_items')
      .update(patch)
      .eq('item_id', itemId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await admin.from('wedding_tradition_items').insert(patch);
    if (error) throw new Error(error.message);
  }
  revalidatePath('/admin/wedding-traditions');
}

export async function deleteTraditionItem(formData: FormData) {
  await requireAdmin();
  const itemId = String(formData.get('item_id') ?? '').trim();
  if (!itemId) throw new Error('Missing item');
  const admin = createAdminClient();
  const { error } = await admin
    .from('wedding_tradition_items')
    .delete()
    .eq('item_id', itemId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/wedding-traditions');
}

/**
 * Copy the code-default items (WEDDING_TRADITIONS_GUIDE) into the table for any
 * religion that has NO rows yet. Idempotent + non-destructive — religions you've
 * already edited are skipped, so re-running never clobbers your edits.
 */
export async function seedTraditionsFromDefaults() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('wedding_tradition_items')
    .select('ceremony_type');
  const haveRows = new Set((existing ?? []).map((r) => r.ceremony_type as string));

  const rows: Array<Record<string, unknown>> = [];
  for (const [key, guide] of Object.entries(WEDDING_TRADITIONS_GUIDE)) {
    if (key === 'unknown' || haveRows.has(key)) continue;
    guide.items.forEach((item, i) => {
      rows.push({
        ceremony_type: key,
        dimension: item.dimension,
        label: item.label,
        note: item.note,
        sort_order: i * 10,
        is_active: true,
      });
    });
  }
  if (rows.length > 0) {
    const { error } = await admin.from('wedding_tradition_items').insert(rows);
    if (error) throw new Error(error.message);
  }
  revalidatePath('/admin/wedding-traditions');
}

/**
 * Replace ALL tradition items with the current code defaults
 * (WEDDING_TRADITIONS_GUIDE) — deletes every existing row first, so it discards
 * any manual edits. Use it to pull in a fresh / improved starter set across all
 * religions at once. Distinct from seedTraditionsFromDefaults (which only fills
 * religions that have no rows).
 */
export async function resetTraditionsToDefaults() {
  await requireAdmin();
  const admin = createAdminClient();

  const rows: Array<Record<string, unknown>> = [];
  for (const [key, guide] of Object.entries(WEDDING_TRADITIONS_GUIDE)) {
    if (key === 'unknown') continue;
    guide.items.forEach((item, i) => {
      rows.push({
        ceremony_type: key,
        dimension: item.dimension,
        label: item.label,
        note: item.note,
        sort_order: i * 10,
        is_active: true,
      });
    });
  }

  // Delete-all (the `not is null` filter matches every row — supabase requires
  // a filter on delete), then re-insert. The window between the two is tiny +
  // admin-only; a couple loading /paperwork mid-reset falls back to the code
  // defaults (identical content), so there is no broken state.
  const { error: delErr } = await admin
    .from('wedding_tradition_items')
    .delete()
    .not('item_id', 'is', null);
  if (delErr) throw new Error(delErr.message);
  if (rows.length > 0) {
    const { error: insErr } = await admin.from('wedding_tradition_items').insert(rows);
    if (insErr) throw new Error(insErr.message);
  }
  revalidatePath('/admin/wedding-traditions');
}
