'use server';

/**
 * Server actions for the vendor-side Moodboard Library — the supplier surface
 * for putting their own photographs in front of couples.
 *
 * ── WHAT MB11 CHANGED (2026-09-04) AND WHY ──────────────────────────────────
 * This page shipped in May 2026 and HAS NEVER BEEN USED. Three locks kept it
 * shut, and all three are opened here, each with the safeguard that was never
 * optional:
 *
 *  1. THE TRADE GATE was `services.includes('reception_decor')` — one service
 *     key, which excluded gown designers, florists, cake makers and rental
 *     houses, i.e. the exact trades whose photographs a couple wants. It now
 *     derives from MB10's slot→trade map (lib/moodboard-gallery.ts).
 *
 *  2. THE PAGE AND THIS FILE DISAGREED ABOUT WHO MAY BE HERE. The page asked
 *     "do you own a shop"; `requireVendor` asked `users.account_type`. The page
 *     rendered and the save threw. One predicate now —
 *     `resolveMoodboardLibraryAccess` — imported by both.
 *
 *  3. THE PUBLIC BUCKET HAD NO SAFEGUARDS AT ALL. Every upload through this
 *     action now, in this order:
 *       · captures a RIGHTS WARRANTY (rights_warranted_at +
 *         rights_warranty_version — MB10 landed the columns for this);
 *       · is WATERMARKED ON THE SERVER (lib/watermark-server.ts). It used to
 *         be watermarked in the browser only, which is a request, not a rule;
 *       · is SCREENED for a QR code, the shop's own contact details and the
 *         shop's own logo, and is REFUSED with a message naming what was found
 *         (lib/moodboard-gallery-screen.server.ts);
 *       · is fed to the CROSS-VENDOR THEFT SCAN (hashAndScanVendorImages) —
 *         this was the one publicly-readable bucket without one;
 *       · counts against a per-tier BACK-CATALOGUE QUOTA, which never counts a
 *         photo from a celebration the shop was actually booked on.
 *
 * ⚠ THE ORDER IS LOAD-BEARING. The screen runs on the ORIGINAL bytes (a QR
 * still decodes after watermarking, but the model reads the un-marked picture
 * more reliably) and the hash is taken from the WATERMARKED bytes — the ones
 * actually stored, so the theft scan is comparing what the public can see.
 *
 * What vendors still cannot do here (admin-only): approve their own uploads,
 * or touch another shop's rows. Auth is enforced at TWO layers — this action's
 * precondition, and RLS on moodboard_library_assets + storage.objects.
 */

import { revalidatePath } from 'next/cache';
import { randomUUID } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseStoredAsset } from '@/lib/uploads';
import { r2GetBytes } from '@/lib/r2';
import { safeFetchImageBytes } from '@/lib/safe-image-fetch';
import { hashAndScanVendorImages } from '@/lib/vendor-image-repost-watch';
import { getEditorialEligibility } from '@/lib/editorial-vendor-media';
import { tierCaps } from '@/lib/vendor-tier-caps';
import {
  watermarkImageBytes,
  watermarkOutputExtension,
} from '@/lib/watermark-server';
import { screenGalleryImage } from '@/lib/moodboard-gallery-screen.server';
import {
  resolveMoodboardLibraryAccess,
  MOODBOARD_LIBRARY_DENIAL,
} from '@/lib/moodboard-library-access';
import {
  backCatalogueQuotaVerdict,
  slotUploadVerdict,
  RIGHTS_WARRANTY_VERSION,
  type GalleryUploadMode,
} from '@/lib/moodboard-gallery-upload';
import { SUPPLIER_GALLERY_ASSET_TYPE } from '@/lib/moodboard-gallery';
import type { VendorProfileRow } from '@/lib/vendor-profile';
import type { ColorRangeMap } from '@/app/admin/moodboard-library/_components/color-range-manipulator';

const BUCKET = 'moodboard-library';

/** The three Setnayan-template asset types the stylist surface has always had,
 *  plus MB10's supplier-gallery type. */
const LEGACY_ASSET_TYPES = ['venue_scene', 'figure_attire', 'florals'] as const;

/**
 * ONE gate, shared with the page. Throws with the same sentence the page would
 * have shown, so an account that somehow reaches the action without the page
 * gets a reason rather than "vendor only".
 */
async function requireLibraryAccess(): Promise<{
  userId: string;
  profile: VendorProfileRow;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const access = await resolveMoodboardLibraryAccess(supabase, user?.id);
  if (!access.allowed) throw new Error(MOODBOARD_LIBRARY_DENIAL[access.reason]);
  return { userId: user!.id, profile: access.profile };
}

/** The shop's tier, read straight off its own row. Unknown → the free ladder. */
async function fetchShopTier(
  admin: ReturnType<typeof createAdminClient>,
  vendorProfileId: string,
): Promise<string | null> {
  const { data } = await admin
    .from('vendor_profiles')
    .select('tier_state')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  return (data as { tier_state?: string | null } | null)?.tier_state ?? null;
}

/**
 * How many BACK-CATALOGUE gallery photos this shop already holds.
 *
 * 🔑 `source_event_id IS NULL` IS THE WHOLE QUOTA. A photo delivered on a
 * celebration the shop was booked on carries the event id and is not in this
 * count at any tier — see lib/moodboard-gallery-upload.ts for why rationing
 * that would be the wrong shape of gate. Retired rows are excluded so retiring
 * one genuinely frees a slot.
 */
async function countBackCatalogue(
  admin: ReturnType<typeof createAdminClient>,
  vendorProfileId: string,
): Promise<number> {
  const { count } = await admin
    .from('moodboard_library_assets')
    .select('asset_id', { count: 'exact', head: true })
    .eq('vendor_profile_id', vendorProfileId)
    .eq('asset_type', SUPPLIER_GALLERY_ASSET_TYPE)
    .is('source_event_id', null)
    .is('retired_at', null);
  return count ?? 0;
}

/**
 * Watermark → screen → store → hash. The single place bytes become a library
 * asset, shared by the file upload and the editorial import so neither can
 * skip a step the other runs.
 *
 * Throws (with a vendor-readable sentence) when the screen refuses. Cleans up
 * the stored object if the row insert then fails.
 */
async function storeScreenedAsset(args: {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  profile: VendorProfileRow;
  bytes: Uint8Array;
  contentType: string | null;
  row: {
    asset_type: string;
    asset_subtype: string | null;
    label: string;
    source: string;
    source_event_id: string | null;
  };
}): Promise<{ assetId: string; textScreen: 'ran' | 'unavailable' }> {
  // ⚠ THE SHOP IS STAMPED ON GALLERY ROWS ONLY, AND THAT IS NOT AN OVERSIGHT.
  // MB10's shape CHECK REQUIRES `vendor_profile_id` on a 'supplier_gallery'
  // row — it is the credit the couple reads. The three Setnayan-template types
  // (venue_scene / figure_attire / florals) have carried NULL since May 2026,
  // and stamping the shop onto them would silently change a DELETE: that FK is
  // ON DELETE CASCADE, so a shop closing its account would take its
  // shared-library photos with it, and `event_inspiration_assets
  // .library_asset_id` cascades in turn — deleting the tile off every couple's
  // board that had picked it. That is a real behaviour change to a path MB11
  // was not asked to touch, so it is left alone.

  const { admin, userId, profile } = args;
  const isGalleryRow = args.row.asset_type === SUPPLIER_GALLERY_ASSET_TYPE;

  // 1 · SCREEN THE ORIGINAL. A QR code, the shop's own contact details, or the
  //     shop's own logo REFUSES the upload — and the message names what was
  //     found so the vendor can fix it and resubmit in a minute. Never a silent
  //     drop, never a ban.
  const logoBytes = await fetchLogoBytes(profile.logo_url);
  const screen = await screenGalleryImage({
    bytes: args.bytes,
    profile: {
      business_name: profile.business_name,
      contact_phone: profile.contact_phone,
      contact_email: profile.contact_email,
      website: profile.website,
    },
    logoBytes,
  });
  if (screen.blocked) throw new Error(screen.message);

  // 2 · WATERMARK, on the server, on the authoritative bytes.
  const marked = await watermarkImageBytes(args.bytes, args.contentType);
  const ext = watermarkOutputExtension(args.contentType);

  // Vendor uploads land under their own user-id prefix so the storage RLS
  // policy can scope writes by `name LIKE auth.uid()::text || '/%'`.
  const objectKey = `${userId}/${randomUUID()}.${ext}`;
  const storagePath = `${BUCKET}/${objectKey}`;

  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(objectKey, marked.bytes, {
      contentType: marked.contentType,
      upsert: false,
    });
  if (upErr) throw new Error(`upload failed: ${upErr.message}`);

  const { data: row, error: insErr } = await admin
    .from('moodboard_library_assets')
    .insert({
      ...args.row,
      storage_path: storagePath,
      uploaded_by: userId,
      vendor_profile_id: isGalleryRow ? profile.vendor_profile_id : null,
      rights_warranted_at: new Date().toISOString(),
      rights_warranty_version: RIGHTS_WARRANTY_VERSION,
    })
    .select('asset_id')
    .single();

  if (insErr) {
    await admin.storage.from(BUCKET).remove([objectKey]);
    throw new Error(`db insert failed: ${insErr.message}`);
  }

  // 3 · THE THEFT SCAN, on the bytes we actually stored. Best-effort by
  //     contract (it swallows its own failures) — an un-hashed image is
  //     re-attempted by the admin "Rescan all" backfill, and a hashing hiccup
  //     must never lose a vendor's upload.
  await hashAndScanVendorImages({
    vendorProfileId: profile.vendor_profile_id,
    refs: [storagePath],
    surface: 'moodboard_library',
    bytesByRef: { [storagePath]: marked.bytes },
  });

  return { assetId: row.asset_id as string, textScreen: screen.textScreen };
}

/** The shop's own logo bytes, or null when it has no logo on file. */
async function fetchLogoBytes(logoUrl: string | null): Promise<Uint8Array | null> {
  const parsed = parseStoredAsset(logoUrl);
  if (!parsed) return null;
  try {
    if (parsed.kind === 'r2') {
      const { bytes } = await r2GetBytes({ bucket: parsed.bucket, key: parsed.key });
      return bytes;
    }
    return await safeFetchImageBytes(parsed.url);
  } catch {
    // No logo we can read → the own-logo check is SKIPPED, never guessed at.
    return null;
  }
}

export async function uploadStylistAsset(
  formData: FormData,
): Promise<{ assetId: string; textScreen: 'ran' | 'unavailable' }> {
  const { userId, profile } = await requireLibraryAccess();
  const admin = createAdminClient();

  const file = formData.get('file') as File | null;
  const label = String(formData.get('label') ?? '').trim();
  const assetType = String(formData.get('assetType') ?? '');
  const assetSubtype = String(formData.get('assetSubtype') ?? '').trim() || null;
  const rightsWarranted = String(formData.get('rightsWarranted') ?? '') === '1';

  if (!file) throw new Error('file required');
  if (!label) throw new Error('label required');

  const isGallery = assetType === SUPPLIER_GALLERY_ASSET_TYPE;
  if (!isGallery && !(LEGACY_ASSET_TYPES as readonly string[]).includes(assetType)) {
    throw new Error(
      `asset_type must be ${LEGACY_ASSET_TYPES.join(', ')} or ${SUPPLIER_GALLERY_ASSET_TYPE}`,
    );
  }

  // 🛑 THE WARRANTY IS NOT OPTIONAL AND IT IS NOT A DEFAULT. MB10's CHECK
  // refuses a supplier-gallery row that reaches `approved_at` without one; this
  // refuses it at the door, so the vendor learns at upload rather than
  // discovering their photo silently never went live.
  if (!rightsWarranted) {
    throw new Error(
      'Please confirm you hold the rights to publish this photo before uploading.',
    );
  }

  if (isGallery) {
    const slot = slotUploadVerdict(assetSubtype ?? '', profile.services);
    if (!slot.allowed) throw new Error(slot.message);

    const tier = await fetchShopTier(admin, profile.vendor_profile_id);
    const mode: GalleryUploadMode = 'back_catalogue';
    const quota = backCatalogueQuotaVerdict({
      mode,
      cap: tierCaps(tier).galleryBackCatalogPhotos,
      backCatalogueUsed: await countBackCatalogue(admin, profile.vendor_profile_id),
    });
    if (!quota.allowed) throw new Error(quota.message);
  }

  const arrayBuffer = await file.arrayBuffer();
  const result = await storeScreenedAsset({
    admin,
    userId,
    profile,
    bytes: new Uint8Array(arrayBuffer),
    contentType: file.type || null,
    row: {
      asset_type: assetType,
      asset_subtype: assetSubtype,
      label,
      source: 'stylist_upload',
      // A file picked off the shop's own machine is BACK-CATALOGUE by
      // definition — there is no celebration attached to it. The event-linked
      // route is `importEditorialMediaToGallery` below, which can prove the
      // link instead of taking the vendor's word for it.
      source_event_id: null,
    },
  });

  revalidatePath('/vendor-dashboard/moodboard-library');
  return result;
}

/* ══════════════════════════════════════════════════════════════════════════
   THE EVENT-LINKED ROUTE — editorial_vendor_media → the gallery pool
   ══════════════════════════════════════════════════════════════════════════

   `editorial_vendor_media` was built on 2026-06-16 for the couple's editorial
   ("From Your Vendors") and has stood at ZERO ROWS since. It already holds the
   thing the gallery needs most: photographs a supplier took of their own work
   on a celebration they were the couple's recommended pick for, screened for
   NSFW, and curated by the couple themselves.

   🔑 THE SELECTION_MATCH_RANK CHECK IS RE-RUN HERE, NOT INHERITED. Submission
   proved the vendor was the recommended pick THEN. A re-plan can change the
   pick, and the editorial render already re-checks it live for exactly that
   reason — a promotion into a PERMANENT, publicly-browsable gallery must not
   be the one path that trusts a stale gate.

   Three further conditions, each of which is somebody's consent:
     · moderation_state = 'clean'  — it passed the NSFW screen;
     · hidden_by_couple = FALSE    — the couple did not hide it on their own
       editorial, and a photo they hid from their own story must not resurface
       on a stranger's mood board;
     · the vendor ticks the same rights warranty as any other upload.
*/

export type ImportableEditorialPhoto = {
  mediaId: string;
  eventId: string;
  caption: string | null;
  createdAt: string;
  /** Already imported into the gallery — shown, but not importable twice. */
  alreadyImported: boolean;
};

/**
 * The vendor's own editorial photos that are eligible to become gallery
 * photos, with the recommended-pick gate re-checked per event.
 */
export async function listImportableEditorialMedia(): Promise<ImportableEditorialPhoto[]> {
  const { profile } = await requireLibraryAccess();
  const admin = createAdminClient();

  const { data } = await admin
    .from('editorial_vendor_media')
    .select('media_id, event_id, caption, created_at, media_type, moderation_state, hidden_by_couple')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .eq('media_type', 'photo')
    .eq('moderation_state', 'clean')
    .eq('hidden_by_couple', false)
    .order('created_at', { ascending: false })
    .limit(60);

  const rows = (data ?? []) as Array<{
    media_id: string;
    event_id: string;
    caption: string | null;
    created_at: string;
  }>;
  if (rows.length === 0) return [];

  // Re-check the pick ONCE per event, not once per photo.
  const eventIds = Array.from(new Set(rows.map((r) => r.event_id)));
  const eligibleEvents = new Set<string>();
  for (const eventId of eventIds) {
    const e = await getEditorialEligibility(admin, eventId, profile.vendor_profile_id);
    if (e.eligible) eligibleEvents.add(eventId);
  }

  // ⚠ ADVISORY, NOT A GUARD. There is no media-id column on the library row, so
  // "already added" is inferred from (event, label). Two photos from ONE
  // celebration carrying the SAME caption would read as one — a cosmetic
  // double-add the vendor can delete, never a safeguard being bypassed. The
  // real gates (eligibility, moderation, the couple's hide, the content screen)
  // all re-run on the import itself.
  const { data: imported } = await admin
    .from('moodboard_library_assets')
    .select('label, source_event_id')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .eq('source', 'editorial_import');
  const importedKeys = new Set(
    ((imported ?? []) as Array<{ label: string; source_event_id: string | null }>).map(
      (r) => `${r.source_event_id ?? ''}::${r.label}`,
    ),
  );

  return rows
    .filter((r) => eligibleEvents.has(r.event_id))
    .map((r) => ({
      mediaId: r.media_id,
      eventId: r.event_id,
      caption: r.caption,
      createdAt: r.created_at,
      alreadyImported: importedKeys.has(
        `${r.event_id}::${importLabel(r.media_id, r.caption)}`,
      ),
    }));
}

/**
 * The label an imported photo carries. Derived from the media id so a re-import
 * of the same photo is recognisable without a second column — the caption is
 * the couple-facing wording and may be blank or edited.
 */
function importLabel(mediaId: string, caption: string | null): string {
  const trimmed = (caption ?? '').trim();
  return trimmed ? trimmed.slice(0, 80) : `Day-of photo ${mediaId.slice(0, 8)}`;
}

export async function importEditorialMediaToGallery(input: {
  mediaId: string;
  slotKey: string;
  rightsWarranted: boolean;
}): Promise<{ assetId: string; textScreen: 'ran' | 'unavailable' }> {
  const { userId, profile } = await requireLibraryAccess();
  const admin = createAdminClient();

  if (!input.rightsWarranted) {
    throw new Error(
      'Please confirm you hold the rights to publish this photo before adding it.',
    );
  }

  const slot = slotUploadVerdict(input.slotKey, profile.services);
  if (!slot.allowed) throw new Error(slot.message);

  const { data: media } = await admin
    .from('editorial_vendor_media')
    .select('media_id, event_id, vendor_profile_id, still_r2_key, caption, media_type, moderation_state, hidden_by_couple')
    .eq('media_id', input.mediaId)
    .maybeSingle();
  const row = media as {
    media_id: string;
    event_id: string;
    vendor_profile_id: string;
    still_r2_key: string;
    caption: string | null;
    media_type: string;
    moderation_state: string;
    hidden_by_couple: boolean;
  } | null;

  if (!row) throw new Error('That photo is no longer available.');
  if (row.vendor_profile_id !== profile.vendor_profile_id) {
    throw new Error('That photo belongs to another shop.');
  }
  if (row.media_type !== 'photo') throw new Error('Only photos can join the gallery.');
  if (row.moderation_state !== 'clean') {
    throw new Error('That photo has not cleared review yet.');
  }
  if (row.hidden_by_couple) {
    throw new Error(
      'The couple hid this photo on their own story, so it can’t go on other couples’ mood boards.',
    );
  }

  // THE RE-CHECK. Not inherited from submission — see the block comment above.
  const eligibility = await getEditorialEligibility(admin, row.event_id, profile.vendor_profile_id);
  if (!eligibility.eligible) {
    throw new Error(
      'You’re no longer the couple’s recommended supplier on that celebration, so its photos can’t be added.',
    );
  }

  const parsed = parseStoredAsset(row.still_r2_key);
  if (!parsed || parsed.kind !== 'r2') {
    throw new Error('That photo could not be opened.');
  }
  const { bytes, contentType } = await r2GetBytes({
    bucket: parsed.bucket,
    key: parsed.key,
  });

  const result = await storeScreenedAsset({
    admin,
    userId,
    profile,
    bytes,
    contentType,
    row: {
      asset_type: SUPPLIER_GALLERY_ASSET_TYPE,
      asset_subtype: slot.slotKey,
      label: importLabel(row.media_id, row.caption),
      source: 'editorial_import',
      // EVENT-LINKED. This is what keeps it out of the back-catalogue quota —
      // and the DB CHECK `moodboard_library_assets_editorial_import_has_event`
      // refuses an import that arrives without it.
      source_event_id: row.event_id,
    },
  });

  revalidatePath('/vendor-dashboard/moodboard-library');
  return result;
}

/* ══════════════════════════════════════════════════════════════════════════
   TAGGING + REMOVAL — unchanged in behaviour, moved onto the shared gate
   ══════════════════════════════════════════════════════════════════════════ */

export async function saveStylistColorRanges(
  assetId: string,
  map: ColorRangeMap,
): Promise<void> {
  const { userId } = await requireLibraryAccess();
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
  const { userId } = await requireLibraryAccess();
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
