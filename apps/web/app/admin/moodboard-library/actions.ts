'use server';

/**
 * Server actions for the admin Moodboard Library page (iteration 0010 ·
 * "Visual preview pillars" lock 2026-05-21).
 *
 * Three workflows the admin uses:
 *   1. uploadAsset()       — push a file to the moodboard-library bucket and
 *                            create the asset row (status = draft)
 *   2. saveColorRanges()   — replace the color-range tag map for an asset
 *   3. approveAsset() / rejectAsset() / retireAsset() — flip the visibility
 *                            gates. MB21 added rejectAsset: a refusal that
 *                            carries a REASON the supplier can read.
 *
 * Auth: admin-only. We rely on the existing /admin layout's role check + RLS
 * policies on the tables themselves. If RLS denies, the action throws.
 */

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  assertNotPlaceholder,
  PLACEHOLDER_COLUMNS,
} from '@/lib/moodboard-library-placeholder';
import {
  generateRandomMoodboardPrompt,
  type RandomMoodboardPrompt,
} from '@/lib/higgsfield-prompts';
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

/**
 * Random Higgsfield prompt generator — admin clicks "Generate prompt" on the
 * moodboard library page; receives a fresh Filipino-first prompt + recommended
 * model + aspect ratio. Per owner directive 2026-05-21: "we can just click
 * generate and it will make one everytime."
 *
 * V1 surface: returns the prompt for the admin to copy/paste into Higgsfield
 * manually; once Higgsfield API access lands in env, we can wire the full
 * generate → download → watermark → upload loop in one click.
 */
export async function getRandomHiggsfieldPrompt(): Promise<RandomMoodboardPrompt> {
  await requireAdmin();
  return generateRandomMoodboardPrompt();
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
  if (
    assetType !== 'venue_scene' &&
    assetType !== 'figure_attire' &&
    assetType !== 'florals'
  )
    throw new Error('asset_type must be venue_scene, figure_attire, or florals');

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
  // MB23 — a bring-up placeholder (picsum/Pexels stock, or source =
  // 'internet_placeholder') is never publishable to a couple. Throws on refusal;
  // the rule and its reasoning live in lib/moodboard-library-placeholder.ts.
  await assertNotPlaceholder(() =>
    admin
      .from('moodboard_library_assets')
      .select(PLACEHOLDER_COLUMNS)
      .eq('asset_id', assetId)
      .maybeSingle(),
  );
  const { error } = await admin
    .from('moodboard_library_assets')
    .update({
      approved_at: new Date().toISOString(),
      retired_at: null,
      // 🔑 MB21 — APPROVING UNDOES A REJECTION, BOTH HALVES OF IT. The DB CHECK
      // `moodboard_library_assets_rejection_paired` refuses a reason without a
      // timestamp, so clearing only one of these is not a cosmetic slip: the
      // UPDATE is REFUSED and the admin's Publish silently does nothing.
      // Leaving both would be worse — the supplier's editor would go on showing
      // "We couldn't publish this…" underneath a photo that is live.
      rejected_at: null,
      rejection_reason: null,
    })
    .eq('asset_id', assetId);
  if (error) throw new Error(`approve failed: ${error.message}`);
  revalidatePath('/admin/moodboard-library');
  revalidatePath('/admin/studio');
  revalidatePath('/vendor-dashboard/moodboard-library');
}

/**
 * MB21 · REFUSE A PHOTO, AND TELL ITS SUPPLIER WHY.
 *
 * ── THE GAP THIS CLOSES ─────────────────────────────────────────────────────
 * Before this, an admin had `approveAsset`, `retireAsset` and `deleteAsset`.
 * Retiring hid the photo and said nothing; the supplier's own library editor
 * went on reading "draft (pending review)" forever, for a photo nobody was
 * ever going to review again. That is the same shape as every defect in this
 * repo's 2026-08-19 sweep: the decision was made, recorded, and never reached
 * the one person who could act on it.
 *
 * 🛑 REJECTION IS NOT RETIREMENT, AND THEY ARE DELIBERATELY DIFFERENT COLUMNS.
 * `retired_at` means "was live, now it is not" — reversible housekeeping, no
 * judgement attached. `rejected_at` + `rejection_reason` mean "a person looked
 * and said no, and here is what to fix". Collapsing them would make an
 * ordinary un-publish read to the supplier as an accusation.
 *
 * `retired_at` is set ALONGSIDE the rejection so a photo that was already live
 * comes down in the same statement — the public read policy is
 * `approved_at IS NOT NULL AND retired_at IS NULL`, so this is the half that
 * actually unpublishes it.
 *
 * ⚠ A RESIDUE, NAMED RATHER THAN ASSUMED HANDLED: a couple who ALREADY picked
 * this photo keeps their tile. `event_inspiration_assets.library_asset_id`
 * cascades on DELETE and is untouched by `retired_at`, so retiring — and now
 * rejecting — takes a photo out of the PICKER without reaching into boards that
 * already hold it. That is the shipped behaviour of `retireAsset`, unchanged
 * here; pulling a tile off a stranger's mood board is a real, separate decision
 * about somebody else's design and MB21 was not asked to make it. Use
 * `deleteAsset` when a photo genuinely must come off every board.
 */
export async function rejectAsset(assetId: string, reason: string): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();

  // The DB CHECK refuses a blank reason beside a rejection. Catching it here
  // means the admin gets a sentence instead of a constraint name.
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new Error(
      'Say what is wrong with the photo — the supplier sees this sentence and it is the only thing they can act on.',
    );
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from('moodboard_library_assets')
    .update({
      rejected_at: now,
      rejection_reason: trimmed,
      retired_at: now,
    })
    .eq('asset_id', assetId);
  if (error) throw new Error(`reject failed: ${error.message}`);
  revalidatePath('/admin/moodboard-library');
  revalidatePath('/admin/studio');
  revalidatePath('/vendor-dashboard/moodboard-library');
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
  revalidatePath('/admin/studio');
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
