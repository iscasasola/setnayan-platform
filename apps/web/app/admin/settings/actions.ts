'use server';

import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { deletePublicAsset, uploadPublicAsset } from '@/lib/storage';
import { R2_BUCKETS, r2Upload } from '@/lib/r2';
import { packIco } from '@/lib/ico';
import { BRAND_SETTINGS_TAG } from '@/lib/brand-settings';

/**
 * Admin settings server actions — V2 publisher posture, split flows.
 *
 * 2026-05-29 restructure: the previous one-form-saves-everything pattern
 * (`savePlatformSettings`) is split into two role-aligned actions:
 *
 *   - `saveBusinessIdentity` lives on `/admin/settings` (business name, TIN,
 *     address, email, default VAT rate — values printed on every transaction
 *     receipt).
 *   - `savePaymentInstruments` lives on `/admin/settings/payment-methods`
 *     (BDO + GCash account name / number — the active V2 customer payment
 *     rails that couples reference when transferring for an order).
 *
 * Why split: BDO and GCash account fields are merchant payment configuration
 * and conceptually belong with the active payment-methods surface, not the
 * generic business-identity panel. Owner asked 2026-05-29 evening: "shouldn't
 * this be at payment methods?" — yes. Splitting also lets each surface
 * revalidate the right path on save and surface form-specific success/error
 * messages without conflating the two concerns.
 *
 * `uploadMerchantQr` + `removeMerchantQr` are scoped to QR codes and now
 * revalidate + redirect to the payment-methods surface (their canonical home).
 */
async function requireAdmin(): Promise<void> {
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

function nullIfBlank(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

// Onboarding background music moved to apps/web/app/admin/onboarding/actions.ts
// (updateOnboardingMusic) on 2026-06-09 — grouped into the new type-organized
// onboarding settings surface. It still writes the same platform_settings
// columns (onboarding_bg_music_r2_key / _enabled).

export async function saveBusinessIdentity(formData: FormData) {
  await requireAdmin();

  const vatRaw = formData.get('default_vat_rate_pct');
  const vatRate = typeof vatRaw === 'string' ? Number(vatRaw) : 12;
  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) {
    return redirect(
      `/admin/settings?error=${encodeURIComponent('VAT rate must be 0–100')}`,
    );
  }

  const payload = {
    business_name:
      (typeof formData.get('business_name') === 'string'
        ? (formData.get('business_name') as string).trim()
        : '') || 'Setnayan',
    business_tin: nullIfBlank(formData.get('business_tin')),
    business_address: nullIfBlank(formData.get('business_address')),
    business_email: nullIfBlank(formData.get('business_email')),
    default_vat_rate_pct: Math.round(vatRate * 100) / 100,
    updated_at: new Date().toISOString(),
  };

  const admin = createAdminClient();
  const { error } = await admin
    .from('platform_settings')
    .update(payload)
    .eq('id', 1);
  if (error) {
    return redirect(`/admin/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/admin/settings');
  revalidatePath('/receipts', 'layout');
  redirect('/admin/settings?saved=1');
}

export async function savePaymentInstruments(formData: FormData) {
  await requireAdmin();

  // QR URLs are managed via the separate upload/remove actions below — they
  // aren't included in this update, so re-saving text fields doesn't blow
  // away an already-uploaded QR.
  const payload = {
    bdo_account_name: nullIfBlank(formData.get('bdo_account_name')),
    bdo_account_number: nullIfBlank(formData.get('bdo_account_number')),
    gcash_account_name: nullIfBlank(formData.get('gcash_account_name')),
    gcash_number: nullIfBlank(formData.get('gcash_number')),
    updated_at: new Date().toISOString(),
  };

  const admin = createAdminClient();
  const { error } = await admin
    .from('platform_settings')
    .update(payload)
    .eq('id', 1);
  if (error) {
    return redirect(
      `/admin/settings/payment-methods?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/admin/settings/payment-methods');
  revalidatePath('/receipts', 'layout');
  redirect('/admin/settings/payment-methods?saved=1');
}

type QrKind = 'bdo' | 'gcash';

function qrColumn(kind: QrKind): 'bdo_qr_url' | 'gcash_qr_url' {
  return kind === 'bdo' ? 'bdo_qr_url' : 'gcash_qr_url';
}

export async function uploadMerchantQr(formData: FormData) {
  await requireAdmin();
  const kindRaw = formData.get('kind');
  if (kindRaw !== 'bdo' && kindRaw !== 'gcash') {
    throw new Error('Invalid QR kind');
  }
  const kind: QrKind = kindRaw;
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return redirect(
      `/admin/settings/payment-methods?error=${encodeURIComponent('Pick a file first')}`,
    );
  }

  const upload = await uploadPublicAsset({
    pathPrefix: `merchant-qr/${kind}`,
    file,
  });
  if (!upload.ok) {
    return redirect(
      `/admin/settings/payment-methods?error=${encodeURIComponent(upload.error)}`,
    );
  }

  const admin = createAdminClient();

  // Read the existing URL so we can clean up the old asset after the row is
  // updated to point at the new one.
  const { data: existing } = await admin
    .from('platform_settings')
    .select(qrColumn(kind))
    .eq('id', 1)
    .maybeSingle();
  const existingUrl: string | null =
    (existing as Record<string, unknown> | null)?.[qrColumn(kind)] as
      | string
      | null
      | undefined ?? null;

  const { error } = await admin
    .from('platform_settings')
    .update({
      [qrColumn(kind)]: upload.publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  if (error) {
    return redirect(
      `/admin/settings/payment-methods?error=${encodeURIComponent(error.message)}`,
    );
  }

  if (existingUrl) {
    await deletePublicAsset({ publicUrl: existingUrl });
  }

  revalidatePath('/admin/settings/payment-methods');
  redirect('/admin/settings/payment-methods?qr_uploaded=1');
}

export async function removeMerchantQr(formData: FormData) {
  await requireAdmin();
  const kindRaw = formData.get('kind');
  if (kindRaw !== 'bdo' && kindRaw !== 'gcash') {
    throw new Error('Invalid QR kind');
  }
  const kind: QrKind = kindRaw;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('platform_settings')
    .select(qrColumn(kind))
    .eq('id', 1)
    .maybeSingle();
  const existingUrl: string | null =
    (existing as Record<string, unknown> | null)?.[qrColumn(kind)] as
      | string
      | null
      | undefined ?? null;

  const { error } = await admin
    .from('platform_settings')
    .update({
      [qrColumn(kind)]: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  if (error) {
    return redirect(
      `/admin/settings/payment-methods?error=${encodeURIComponent(error.message)}`,
    );
  }

  if (existingUrl) {
    await deletePublicAsset({ publicUrl: existingUrl });
  }

  revalidatePath('/admin/settings/payment-methods');
  redirect('/admin/settings/payment-methods?qr_removed=1');
}

// ---------------------------------------------------------------------------
// Default brand icon (owner 2026-06-10).
//
// The admin uploads ONE square brand image; we derive the whole icon set
// server-side with sharp + our tiny .ico packer, store each public URL on the
// platform_settings singleton, and bump brand_icon_version (the cache-buster).
// Those URLs then feed the /favicon.ico route, the root metadata icon links,
// and the in-app <Logo>/<LogoMark> (via BrandProvider) — so a single upload
// repaints the brand everywhere, and the orange Safari tab can never return.
//
// Derived assets are uploaded with r2Upload (not uploadPublicAsset) because
// the .ico (image/x-icon) and SVG passthrough (image/svg+xml) aren't in the
// shared uploadPublicAsset MIME allowlist — and these are server-derived,
// trusted bytes, not raw user input. deletePublicAsset round-trips the same
// URL shape for cleanup.
// ---------------------------------------------------------------------------

const BRAND_ICON_COLUMNS =
  'brand_icon_master_url,brand_favicon_ico_url,brand_apple_touch_url,brand_icon_png_512_url,brand_icon_svg_url,brand_icon_version';

function settingsError(message: string): never {
  return redirect(`/admin/settings?error=${encodeURIComponent(message)}`);
}

export async function uploadBrandIcon(formData: FormData) {
  await requireAdmin();

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    settingsError('Pick an image first.');
  }
  const upload = file as File;
  if (upload.size > 6 * 1024 * 1024) {
    settingsError(
      `Image is ${(upload.size / 1024 / 1024).toFixed(1)} MB — max is 6 MB.`,
    );
  }

  const isSvg =
    upload.type === 'image/svg+xml' || /\.svg$/i.test(upload.name);
  const input = Buffer.from(await upload.arrayBuffer());

  // SVGs are rasterized at high density so the small derivatives stay crisp.
  const pipe = () => sharp(input, isSvg ? { density: 384 } : undefined);

  let width = 0;
  let height = 0;
  try {
    const meta = await pipe().metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
  } catch {
    settingsError(
      "That file isn't a readable image. Use a square PNG, JPEG, WebP, or SVG.",
    );
  }
  if (!width || !height) {
    settingsError('Could not read the image dimensions — try another file.');
  }
  if (!isSvg && (width < 48 || height < 48)) {
    settingsError(
      `Image is ${width}×${height}. Use at least 48×48 so the favicon stays crisp.`,
    );
  }
  const ratio = width / height;
  if (ratio < 0.8 || ratio > 1.25) {
    settingsError(
      `Please upload a roughly square image (got ${width}×${height}).`,
    );
  }

  const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
  const squarePng = (size: number) =>
    pipe()
      .resize(size, size, { fit: 'contain', background: transparent })
      .png()
      .toBuffer();

  let ico: Buffer;
  let apple180: Buffer;
  let png512: Buffer;
  let master: Buffer;
  try {
    const [i16, i32, i48] = await Promise.all([
      squarePng(16),
      squarePng(32),
      squarePng(48),
    ]);
    ico = packIco([
      { size: 16, png: i16 },
      { size: 32, png: i32 },
      { size: 48, png: i48 },
    ]);
    [png512, master] = await Promise.all([squarePng(512), squarePng(1024)]);
    // iOS composites transparency onto black, so the apple-touch tile must be
    // opaque — flatten onto white.
    apple180 = await pipe()
      .resize(180, 180, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .flatten({ background: '#ffffff' })
      .png()
      .toBuffer();
  } catch {
    settingsError('Could not process that image — try a different file.');
  }

  const bucket = R2_BUCKETS.media;
  const base = `brand-icon/${randomUUID()}`;
  let icoUrl: string;
  let appleUrl: string;
  let png512Url: string;
  let masterUrl: string;
  let svgUrl: string | null;
  try {
    [icoUrl, appleUrl, png512Url, masterUrl, svgUrl] = await Promise.all([
      r2Upload({ bucket, key: `${base}/favicon.ico`, body: ico, contentType: 'image/x-icon' }),
      r2Upload({ bucket, key: `${base}/apple-touch.png`, body: apple180, contentType: 'image/png' }),
      r2Upload({ bucket, key: `${base}/icon-512.png`, body: png512, contentType: 'image/png' }),
      r2Upload({ bucket, key: `${base}/master.png`, body: master, contentType: 'image/png' }),
      isSvg
        ? r2Upload({ bucket, key: `${base}/mark.svg`, body: input, contentType: 'image/svg+xml' })
        : Promise.resolve<string | null>(null),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    settingsError(`Couldn't save the icon to storage: ${message}`);
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('platform_settings')
    .select(BRAND_ICON_COLUMNS)
    .eq('id', 1)
    .maybeSingle();
  const prev = (existing as Record<string, unknown> | null) ?? null;
  const prevVersion =
    typeof prev?.brand_icon_version === 'number' ? prev.brand_icon_version : 0;

  const { error } = await admin
    .from('platform_settings')
    .update({
      brand_icon_master_url: masterUrl,
      brand_favicon_ico_url: icoUrl,
      brand_apple_touch_url: appleUrl,
      brand_icon_png_512_url: png512Url,
      brand_icon_svg_url: svgUrl,
      brand_icon_version: prevVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  if (error) {
    settingsError(error.message);
  }

  // Best-effort cleanup of the previous icon set.
  for (const col of [
    'brand_icon_master_url',
    'brand_favicon_ico_url',
    'brand_apple_touch_url',
    'brand_icon_png_512_url',
    'brand_icon_svg_url',
  ]) {
    const old = prev?.[col];
    if (typeof old === 'string' && old.length > 0) {
      await deletePublicAsset({ publicUrl: old });
    }
  }

  // Bust every cache the icon feeds: the settings read, the whole layout tree
  // (metadata + BrandProvider), and the favicon route.
  revalidateTag(BRAND_SETTINGS_TAG);
  revalidatePath('/', 'layout');
  revalidatePath('/favicon.ico');
  redirect('/admin/settings?brand_icon=1');
}

export async function removeBrandIcon() {
  await requireAdmin();

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('platform_settings')
    .select(BRAND_ICON_COLUMNS)
    .eq('id', 1)
    .maybeSingle();
  const prev = (existing as Record<string, unknown> | null) ?? null;
  const prevVersion =
    typeof prev?.brand_icon_version === 'number' ? prev.brand_icon_version : 0;

  const { error } = await admin
    .from('platform_settings')
    .update({
      brand_icon_master_url: null,
      brand_favicon_ico_url: null,
      brand_apple_touch_url: null,
      brand_icon_png_512_url: null,
      brand_icon_svg_url: null,
      // Still bump — the URL changes back to the default, and the version
      // cache-buster forces browsers off the previous custom icon.
      brand_icon_version: prevVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  if (error) {
    settingsError(error.message);
  }

  for (const col of [
    'brand_icon_master_url',
    'brand_favicon_ico_url',
    'brand_apple_touch_url',
    'brand_icon_png_512_url',
    'brand_icon_svg_url',
  ]) {
    const old = prev?.[col];
    if (typeof old === 'string' && old.length > 0) {
      await deletePublicAsset({ publicUrl: old });
    }
  }

  revalidateTag(BRAND_SETTINGS_TAG);
  revalidatePath('/', 'layout');
  revalidatePath('/favicon.ico');
  redirect('/admin/settings?brand_icon_removed=1');
}
