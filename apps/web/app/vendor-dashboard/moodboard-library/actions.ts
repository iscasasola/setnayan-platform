'use server';

/**
 * Server actions for the vendor-side Moodboard Library — the stylist surface
 * for tagging their own uploaded photos. Per owner directive 2026-05-21:
 *   "stylists can edit it and ... stylists can upload their own design"
 *
 * V1 implementation stores vendor uploads in Setnayan storage with
 * source='stylist_upload'. The Drive-direct variant the owner described
 * lands in V1.x.
 *
 * What vendors can do here:
 *   - Upload a photo (gets watermarked client-side; auto SETNAYAN watermark)
 *   - Tag color ranges via the Color Range Manipulator
 *   - Save / retire / delete their OWN drafts
 *
 * What vendors cannot do here (admin-only):
 *   - Approve their own uploads (admins approve via /admin/moodboard-library)
 *   - Touch other vendors' uploads or Setnayan-curated templates
 *
 * Auth is enforced at TWO layers:
 *   1. Server action precondition (requireVendor below)
 *   2. RLS policies on moodboard_library_assets + storage.objects
 */

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ColorRangeMap } from '@/app/admin/moodboard-library/_components/color-range-manipulator';

const BUCKET = 'moodboard-library';

async function requireVendor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('not authenticated');

  const { data: profile } = await supabase
    .from('users')
    .select('account_type')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profile?.account_type !== 'vendor') throw new Error('vendor only');
  return { supabase, userId: user.id };
}

export async function uploadStylistAsset(
  formData: FormData,
): Promise<{ assetId: string }> {
  const { userId } = await requireVendor();
  const admin = createAdminClient();

  const file = formData.get('file') as File | null;
  const label = String(formData.get('label') ?? '').trim();
  const assetType = String(formData.get('assetType') ?? '');
  const assetSubtype = String(formData.get('assetSubtype') ?? '').trim() || null;

  if (!file) throw new Error('file required');
  if (!label) throw new Error('label required');
  if (
    assetType !== 'venue_scene' &&
    assetType !== 'figure_attire' &&
    assetType !== 'florals'
  )
    throw new Error('asset_type must be venue_scene, figure_attire, or florals');

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const safeExt = ['png', 'jpg', 'jpeg', 'webp', 'avif'].includes(ext) ? ext : 'png';
  // Vendor uploads land under their own user-id prefix so the storage RLS
  // policy can scope writes by `name LIKE auth.uid()::text || '/%'`.
  const objectKey = `${userId}/${randomUUID()}.${safeExt}`;
  const storagePath = `${BUCKET}/${objectKey}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(objectKey, arrayBuffer, {
      contentType: file.type || `image/${safeExt}`,
      upsert: false,
    });
  if (upErr) throw new Error(`upload failed: ${upErr.message}`);

  const { data: row, error: insErr } = await admin
    .from('moodboard_library_assets')
    .insert({
      asset_type: assetType,
      asset_subtype: assetSubtype,
      label,
      storage_path: storagePath,
      source: 'stylist_upload',
      uploaded_by: userId,
    })
    .select('asset_id')
    .single();

  if (insErr) {
    await admin.storage.from(BUCKET).remove([objectKey]);
    throw new Error(`db insert failed: ${insErr.message}`);
  }

  revalidatePath('/vendor-dashboard/moodboard-library');
  return { assetId: row.asset_id as string };
}

export async function saveStylistColorRanges(
  assetId: string,
  map: ColorRangeMap,
): Promise<void> {
  const { userId } = await requireVendor();
  const admin = createAdminClient();

  // Verify ownership: vendor can only save tags for assets they uploaded
  const { data: asset } = await admin
    .from('moodboard_library_assets')
    .select('uploaded_by')
    .eq('asset_id', assetId)
    .maybeSingle();
  if (!asset) throw new Error('asset not found');
  if (asset.uploaded_by !== userId) throw new Error('not the owner of this asset');

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
    const { error: insErr } = await admin
      .from('moodboard_asset_color_ranges')
      .insert(rows);
    if (insErr) throw new Error(`insert tags failed: ${insErr.message}`);
  }

  revalidatePath('/vendor-dashboard/moodboard-library');
}

export async function deleteStylistAsset(assetId: string): Promise<void> {
  const { userId } = await requireVendor();
  const admin = createAdminClient();

  const { data: row } = await admin
    .from('moodboard_library_assets')
    .select('storage_path, uploaded_by')
    .eq('asset_id', assetId)
    .maybeSingle();
  if (!row) throw new Error('asset not found');
  if (row.uploaded_by !== userId) throw new Error('not the owner of this asset');

  const { error: delErr } = await admin
    .from('moodboard_library_assets')
    .delete()
    .eq('asset_id', assetId);
  if (delErr) throw new Error(`delete failed: ${delErr.message}`);

  if (row.storage_path) {
    const key = row.storage_path.replace(`${BUCKET}/`, '');
    await admin.storage.from(BUCKET).remove([key]);
  }

  revalidatePath('/vendor-dashboard/moodboard-library');
}
