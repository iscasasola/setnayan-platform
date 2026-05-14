'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  MAX_OCR_IMAGES,
  generateCatalogFromImagesWithClaude,
  generateCatalogWithClaude,
  type GeneratedCatalogEntry,
} from '@/lib/anthropic-catalog';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { VENDOR_CATEGORIES, type VendorCategory } from '@/lib/vendors';

const CATEGORY_SET: ReadonlySet<string> = new Set(VENDOR_CATEGORIES);

async function ensureProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  return { supabase, profile };
}

export type GenerateCatalogResult =
  | { ok: true; entries: GeneratedCatalogEntry[] }
  | { ok: false; error: string };

/**
 * Calls Claude (or the stub) to turn a vendor's plain-English description
 * into a structured catalog preview. Auth-checked: only the signed-in vendor
 * profile owner may call this.
 */
export async function generateCatalog(
  description: string,
): Promise<GenerateCatalogResult> {
  // Validate auth (and redirect if missing) BEFORE doing any other work.
  await ensureProfile();

  const trimmed = description.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'Description cannot be empty.' };
  }
  if (trimmed.length > 4000) {
    return {
      ok: false,
      error: 'Description is too long (max 4000 characters).',
    };
  }

  try {
    const entries = await generateCatalogWithClaude(trimmed);
    return { ok: true, entries };
  } catch (e) {
    return {
      ok: false,
      error: `AI generation failed: ${(e as Error).message}`,
    };
  }
}

/**
 * Photo-OCR sibling of `generateCatalog`. Takes the R2 refs (`r2://bucket/key`
 * strings) the FileUpload widget emits after each photo upload finishes, signs
 * fresh GET URLs for each, and hands them to Claude vision.
 *
 * Why R2 refs and not direct base64? Two reasons:
 *   1. The photos are already on R2 (the FileUpload component uploads
 *      browser → R2 directly via presigned PUT). Sending them up to the
 *      server again as base64 would double the bytes for no benefit.
 *   2. The R2 ref is bucket + key, not a URL — we re-sign on each call so
 *      the URL we hand Claude is short-lived (5 min default) even if the
 *      ref is persisted in the browser.
 *
 * Auth: only the signed-in vendor profile owner may call. We also defensively
 * validate that every R2 ref the client sent is rooted in this vendor's own
 * `menu-scan/` prefix — otherwise a hostile caller could pass a colleague's
 * R2 ref and have us sign a GET URL for it.
 */
export async function generateCatalogFromPhotos(
  vendorProfileId: string,
  photoR2Keys: string[],
): Promise<GenerateCatalogResult> {
  const { profile } = await ensureProfile();

  // 1. Caller-supplied vendorProfileId must match the signed-in vendor.
  //    Defensive: the page only renders the generator for the owner, but
  //    a server action is reachable from anywhere with a session.
  if (vendorProfileId !== profile.vendor_profile_id) {
    return { ok: false, error: 'Vendor profile mismatch.' };
  }

  // 2. Validate the photo list shape + count.
  if (!Array.isArray(photoR2Keys) || photoR2Keys.length === 0) {
    return { ok: false, error: 'At least one photo is required.' };
  }
  if (photoR2Keys.length > MAX_OCR_IMAGES) {
    return {
      ok: false,
      error: `Too many photos (got ${photoR2Keys.length}, max ${MAX_OCR_IMAGES}).`,
    };
  }

  // 3. Every ref must be a media-bucket `r2://` string scoped to this
  //    vendor's menu-scan prefix. We reject anything else rather than risk
  //    signing a URL for an asset the caller doesn't own.
  const expectedPrefix = `r2://setnayan-media/vendors/${profile.vendor_profile_id}/menu-scan/`;
  for (const ref of photoR2Keys) {
    if (typeof ref !== 'string' || !ref.startsWith(expectedPrefix)) {
      return {
        ok: false,
        error: 'Invalid photo reference. Photos must be uploaded via the menu-scan flow.',
      };
    }
  }

  // 4. Sign one GET URL per photo. Failures here usually mean R2 creds are
  //    missing locally — surface that to the vendor as a generic error so we
  //    don't leak env-var names.
  let signedUrls: string[];
  try {
    const resolved = await Promise.all(
      photoR2Keys.map((ref) => displayUrlForStoredAsset(ref)),
    );
    if (resolved.some((u) => u === null)) {
      return {
        ok: false,
        error: 'Could not sign access URLs for one or more photos.',
      };
    }
    signedUrls = resolved as string[];
  } catch (e) {
    return {
      ok: false,
      error: `Could not sign access URLs: ${(e as Error).message}`,
    };
  }

  // 5. Hand off to the vision client. Errors here are surfaced verbatim
  //    because they're already vendor-friendly ("too many photos", "Claude
  //    returned no text", etc.).
  try {
    const entries = await generateCatalogFromImagesWithClaude(
      signedUrls,
      profile.vendor_profile_id,
    );
    return { ok: true, entries };
  } catch (e) {
    return {
      ok: false,
      error: `AI photo OCR failed: ${(e as Error).message}`,
    };
  }
}

export type PublishGeneratedCatalogResult = {
  ok: boolean;
  created: number;
  skipped: number;
  errors: string[];
};

/**
 * Persist the (possibly vendor-edited) AI catalog preview to `vendor_services`.
 *
 * Constraints from the existing flat schema (iteration 0022):
 *   • `vendor_services` has UNIQUE (vendor_profile_id, category) — so
 *     multiple "packages" per category (Bronze/Silver/Gold catering) must
 *     collapse into a single row. We take the LOWEST `starting_price_php`
 *     per category since the column is "starting price".
 *   • The table has no `name` column — names are review-only hints from
 *     iteration 0040's eventual modifier-groups schema. Not persisted here.
 *   • A category that already has a row for this vendor is skipped (the
 *     vendor edits it via the manual /vendor-dashboard/services page).
 *
 * Returns `{ created, skipped, errors }` so the UI can show what happened
 * without making this action a redirect (the client component drives the
 * confirmation screen).
 */
export async function publishGeneratedCatalog(
  entries: GeneratedCatalogEntry[],
): Promise<PublishGeneratedCatalogResult> {
  const { supabase, profile } = await ensureProfile();

  if (!Array.isArray(entries) || entries.length === 0) {
    return {
      ok: false,
      created: 0,
      skipped: 0,
      errors: ['No services to publish.'],
    };
  }

  // 1. Validate entries and group by category (take min price per category).
  type Bucket = { category: VendorCategory; starting_price_php: number };
  const byCategory = new Map<VendorCategory, Bucket>();
  const errors: string[] = [];

  for (const e of entries) {
    if (!e || typeof e !== 'object') continue;
    const categoryRaw =
      typeof e.category === 'string' ? e.category.trim() : '';
    if (!CATEGORY_SET.has(categoryRaw)) {
      errors.push(`Skipped entry with invalid category: ${categoryRaw}`);
      continue;
    }
    const category = categoryRaw as VendorCategory;

    const priceRaw = e.starting_price_php;
    if (
      typeof priceRaw !== 'number' ||
      !Number.isFinite(priceRaw) ||
      priceRaw < 0
    ) {
      errors.push(`Skipped "${e.name ?? '(unnamed)'}" — invalid price.`);
      continue;
    }
    const price = Math.round(priceRaw);

    const existing = byCategory.get(category);
    if (!existing || price < existing.starting_price_php) {
      byCategory.set(category, { category, starting_price_php: price });
    }
  }

  if (byCategory.size === 0) {
    return {
      ok: false,
      created: 0,
      skipped: 0,
      errors: errors.length > 0 ? errors : ['No valid services to publish.'],
    };
  }

  // 2. Find which categories the vendor already has — those get skipped
  //    rather than throwing a UNIQUE-violation. Vendor can edit them on the
  //    manual /vendor-dashboard/services page.
  const { data: existingRows, error: fetchErr } = await supabase
    .from('vendor_services')
    .select('category')
    .eq('vendor_profile_id', profile.vendor_profile_id);
  if (fetchErr) {
    return {
      ok: false,
      created: 0,
      skipped: 0,
      errors: [`Could not load existing services: ${fetchErr.message}`],
    };
  }
  const existingCategories = new Set(
    (existingRows ?? []).map((r) => r.category as string),
  );

  let created = 0;
  let skipped = 0;
  const inserts: Array<{
    vendor_profile_id: string;
    category: VendorCategory;
    starting_price_php: number;
    is_active: boolean;
  }> = [];

  for (const bucket of byCategory.values()) {
    if (existingCategories.has(bucket.category)) {
      skipped += 1;
      errors.push(
        `Skipped "${bucket.category}" — you already have a service in that category. Edit it on the Services page.`,
      );
      continue;
    }
    inserts.push({
      vendor_profile_id: profile.vendor_profile_id,
      category: bucket.category,
      starting_price_php: bucket.starting_price_php,
      is_active: true,
    });
  }

  if (inserts.length === 0) {
    return { ok: false, created: 0, skipped, errors };
  }

  // 3. One batch insert — RLS policy `vendor_services_owner` already gates by
  //    user_id, and the explicit vendor_profile_id filter on the read above
  //    guarantees we only write rows the caller owns.
  const { error: insertErr } = await supabase
    .from('vendor_services')
    .insert(inserts);
  if (insertErr) {
    return {
      ok: false,
      created: 0,
      skipped,
      errors: [`Insert failed: ${insertErr.message}`],
    };
  }
  created = inserts.length;

  revalidatePath('/vendor-dashboard/services');
  return { ok: true, created, skipped, errors };
}
