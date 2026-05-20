'use server';

/**
 * Server actions for the admin Moodboard Library page (iteration 0010 ·
 * "Visual preview pillars" lock 2026-05-21).
 *
 * Three workflows the admin uses:
 *   1. uploadAsset()       — push a file to the moodboard-library bucket and
 *                            create the asset row (status = draft)
 *   2. saveColorRanges()   — replace the color-range tag map for an asset
 *   3. approveAsset() / retireAsset() — flip the visibility gates
 *
 * Auth: admin-only. We rely on the existing /admin layout's role check + RLS
 * policies on the tables themselves. If RLS denies, the action throws.
 */

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ColorRangeMap } from './_components/color-range-manipulator';

const BUCKET = 'moodboard-library';

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('not authenticated');

  const { data: profile } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();

  const isAdmin =
    profile?.is_internal || profile?.is_team_member || profile?.account_type === 'admin';
  if (!isAdmin) throw new Error('admin only');
  return { supabase, userId: user.id };
}

export async function uploadAsset(formData: FormData): Promise<{ assetId: string }> {
  const { userId } = await requireAdmin();
  const admin = createAdminClient();

  const file = formData.get('file') as File | null;
  const label = String(formData.get('label') ?? '').trim();
  const assetType = String(formData.get('assetType') ?? '');
  const assetSubtype = String(formData.get('assetSubtype') ?? '').trim() || null;
  const source = (String(formData.get('source') ?? '') ||
    'internet_placeholder') as 'internet_placeholder' | 'higgsfield_generated' | 'stylist_upload';

  if (!file) throw new Error('file required');
  if (!label) throw new Error('label required');
  if (assetType !== 'venue_scene' && assetType !== 'figure_attire')
    throw new Error('asset_type must be venue_scene or figure_attire');

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const safeExt = ['png', 'jpg', 'jpeg', 'webp', 'avif'].includes(ext) ? ext : 'png';
  const objectKey = `${randomUUID()}.${safeExt}`;
  const storagePath = `${BUCKET}/${objectKey}`;

  // Upload
  const arrayBuffer = await file.arrayBuffer();
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(objectKey, arrayBuffer, {
      contentType: file.type || `image/${safeExt}`,
      upsert: false,
    });
  if (upErr) throw new Error(`upload failed: ${upErr.message}`);

  // Insert metadata row
  const { data: row, error: insErr } = await admin
    .from('moodboard_library_assets')
    .insert({
      asset_type: assetType,
      asset_subtype: assetSubtype,
      label,
      storage_path: storagePath,
      source,
      uploaded_by: userId,
    })
    .select('asset_id')
    .single();

  if (insErr) {
    // Best-effort cleanup of the uploaded object on metadata failure
    await admin.storage.from(BUCKET).remove([objectKey]);
    throw new Error(`db insert failed: ${insErr.message}`);
  }

  revalidatePath('/admin/moodboard-library');
  return { assetId: row.asset_id as string };
}

export async function saveColorRanges(assetId: string, map: ColorRangeMap): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();

  // Replace strategy: delete existing, insert current
  const { error: delErr } = await admin
    .from('moodboard_asset_color_ranges')
    .delete()
    .eq('asset_id', assetId);
  if (delErr) throw new Error(`delete prior tags failed: ${delErr.message}`);

  const rows = Object.values(map).map((slot) => ({
    asset_id: assetId,
    slot_id: slot.slotId,
    sampled_hex: slot.sampledHex,
    tolerance_de: slot.toleranceDe,
    region_label: slot.regionLabel ?? null,
  }));

  if (rows.length > 0) {
    const { error: insErr } = await admin.from('moodboard_asset_color_ranges').insert(rows);
    if (insErr) throw new Error(`insert tags failed: ${insErr.message}`);
  }

  revalidatePath('/admin/moodboard-library');
}

export async function approveAsset(assetId: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from('moodboard_library_assets')
    .update({ approved_at: new Date().toISOString(), retired_at: null })
    .eq('asset_id', assetId);
  if (error) throw new Error(`approve failed: ${error.message}`);
  revalidatePath('/admin/moodboard-library');
}

export async function retireAsset(assetId: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from('moodboard_library_assets')
    .update({ retired_at: new Date().toISOString() })
    .eq('asset_id', assetId);
  if (error) throw new Error(`retire failed: ${error.message}`);
  revalidatePath('/admin/moodboard-library');
}

export async function deleteAsset(assetId: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();

  // Get storage_path so we can remove the object after the row goes
  const { data: row } = await admin
    .from('moodboard_library_assets')
    .select('storage_path')
    .eq('asset_id', assetId)
    .maybeSingle();

  const { error: delErr } = await admin
    .from('moodboard_library_assets')
    .delete()
    .eq('asset_id', assetId);
  if (delErr) throw new Error(`delete failed: ${delErr.message}`);

  if (row?.storage_path) {
    const key = row.storage_path.replace(`${BUCKET}/`, '');
    await admin.storage.from(BUCKET).remove([key]);
  }

  revalidatePath('/admin/moodboard-library');
}
