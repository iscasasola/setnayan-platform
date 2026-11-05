'use server';

/**
 * The server halves of a marked upload (Seal and plate, 2026-11-04), behind ONE
 * exported action, `photoMark(op, req)`. Every exported server action is a
 * Vercel route and the repo sits at its route budget
 * (`scripts/lint-server-action-budget.mjs`), so the halves are ops of one
 * dispatcher rather than an export each — the couple-photo share's pattern.
 *
 *   'mark'  getPhotoMark          — WHAT to stamp. For a supplier photo the spec is read
 *                           from the shop's own row (verified / name / slug /
 *                           logo) for the shop the login is standing in; the
 *                           browser only paints it. Never trusted from props.
 *   'pair'  recordSupplierOriginal — after both PUTs landed: the marked public copy
 *                           and its PRIVATE clean copy, paired in
 *                           supplier_photo_originals so the shop can be
 *                           re-marked when it gains or loses Verified.
 *   'original' getPhotoOriginalUrl — re-open: a 10-minute address of the private
 *                           clean copy, so the Frame step re-frames the original.
 *
 * All answer `{ ok: false }` rather than throw; FileUpload REFUSES the upload
 * on any `ok: false` (fail-closed: nothing goes up unmarked or unpaired).
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveActiveShopId } from '@/lib/active-shop';
import type { MarkSpec } from '@/lib/photo-mark-geometry';
import { parseStoredAsset } from '@/lib/uploads';
import { shopLogoBytes, shopMarkFacts, vendorIdOfMediaKey } from '@/lib/supplier-mark-spec.server';

export type PhotoMarkAnswer =
  | { ok: true; spec: MarkSpec; logoDataUrl: string | null }
  | { ok: false; error: string };

const REFUSED = 'We could not prepare the Setnayan mark just now. Nothing was uploaded — please try again.';

/** The shop a `vendors/<id>/…` prefix names, when it is the shop this login is standing in. */
async function ownShopFor(pathPrefix: string): Promise<{ vendorProfileId: string } | null> {
  const vendorProfileId = vendorIdOfMediaKey(`${pathPrefix.replace(/\/+$/, '')}/`);
  if (!vendorProfileId) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const active = await resolveActiveShopId(supabase, user.id);
  return active === vendorProfileId ? { vendorProfileId } : null;
}

async function getPhotoMark(kind: 'supplier' | 'setnayan', pathPrefix: string): Promise<PhotoMarkAnswer> {
  try {
    if (kind === 'setnayan') return { ok: true, spec: { kind: 'setnayan' }, logoDataUrl: null };
    const shop = await ownShopFor(pathPrefix);
    if (!shop) return { ok: false, error: REFUSED };
    const facts = await shopMarkFacts(createAdminClient(), shop.vendorProfileId);
    let logoDataUrl: string | null = null;
    if (facts.spec.hasLogo) {
      const bytes = await shopLogoBytes(facts.logoRef);
      if (bytes) {
        const { logoCoinPng } = await import('@/lib/photo-mark-server');
        const png = await logoCoinPng(bytes, facts.logoRef);
        if (png) logoDataUrl = `data:image/png;base64,${png.toString('base64')}`;
      }
    }
    // A verified shop whose logo cannot be read is still marked verified — with no coin
    // (the approved page's "Verified, no logo yet" case), never with someone else's.
    const spec: MarkSpec = { ...facts.spec, hasLogo: logoDataUrl !== null };
    return { ok: true, spec, logoDataUrl };
  } catch (err) {
    console.error('[photo-mark] getPhotoMark failed', err);
    return { ok: false, error: REFUSED };
  }
}

async function recordSupplierOriginal(input: {
  publicRef: string;
  originalRef: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const pub = parseStoredAsset(input.publicRef);
    const orig = parseStoredAsset(input.originalRef);
    if (!pub || pub.kind !== 'r2' || pub.bucket !== 'setnayan-media') return { ok: false, error: REFUSED };
    if (!orig || orig.kind !== 'r2' || orig.bucket !== 'setnayan-vendor-verification') return { ok: false, error: REFUSED };
    const vendorProfileId = vendorIdOfMediaKey(pub.key);
    if (!vendorProfileId || !orig.key.startsWith(`vendor-originals/${vendorProfileId}/`)) {
      return { ok: false, error: REFUSED };
    }
    const shop = await ownShopFor(`vendors/${vendorProfileId}`);
    if (!shop) return { ok: false, error: REFUSED };
    const admin = createAdminClient();
    const facts = await shopMarkFacts(admin, vendorProfileId);
    const { error } = await admin.from('supplier_photo_originals').upsert(
      {
        vendor_profile_id: vendorProfileId,
        public_ref: input.publicRef,
        original_ref: input.originalRef,
        mark_kind: facts.spec.verified ? 'verified' : 'setnayan',
      },
      { onConflict: 'public_ref' },
    );
    if (error) {
      console.error('[supabase-error] photo-mark-actions · supplier_photo_originals.upsert', error);
      return { ok: false, error: REFUSED };
    }
    return { ok: true };
  } catch (err) {
    console.error('[photo-mark] recordSupplierOriginal failed', err);
    return { ok: false, error: REFUSED };
  }
}

/**
 * RE-OPEN (Photo Frame Template · "Tapping the photo on its row opens the same
 * step with the saved framing"): a short-lived address of the PRIVATE clean
 * copy behind a marked supplier photo, so the Frame step re-frames the
 * original — never the marked copy, which would stamp a second mark over the
 * first. Only for the shop the login is standing in; 10 minutes.
 */
async function getPhotoOriginalUrl(publicRef: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const NONE = 'The original of this photo is not available. Upload it again to re-frame it.';
  try {
    const pub = parseStoredAsset(publicRef);
    if (!pub || pub.kind !== 'r2' || pub.bucket !== 'setnayan-media') return { ok: false, error: NONE };
    const vendorProfileId = vendorIdOfMediaKey(pub.key);
    if (!vendorProfileId) return { ok: false, error: NONE };
    const shop = await ownShopFor(`vendors/${vendorProfileId}`);
    if (!shop) return { ok: false, error: NONE };
    const { data, error } = await createAdminClient()
      .from('supplier_photo_originals')
      .select('original_ref')
      .eq('public_ref', publicRef)
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (error) {
      console.error('[supabase-error] photo-mark-actions · supplier_photo_originals.select', error);
      return { ok: false, error: NONE };
    }
    // The private signer, held to THIS shop's own originals root: a row naming any other bucket or shop signs nothing.
    const { displayUrlForPrivateStoredAsset } = await import('@/lib/uploads');
    const url = await displayUrlForPrivateStoredAsset(
      (data as { original_ref?: string } | null)?.original_ref ?? null,
      { bucket: 'setnayan-vendor-verification', prefixes: [`vendor-originals/${vendorProfileId}/`] },
      { ttlSeconds: 600 },
    );
    return url ? { ok: true, url } : { ok: false, error: NONE };
  } catch (err) {
    console.error('[photo-mark] getPhotoOriginalUrl failed', err);
    return { ok: false, error: NONE };
  }
}

/** Each op's request and reply. */
type PhotoMarkOps = {
  mark: { req: { kind: 'supplier' | 'setnayan'; pathPrefix: string }; res: PhotoMarkAnswer };
  pair: { req: { publicRef: string; originalRef: string }; res: { ok: true } | { ok: false; error: string } };
  original: { req: { publicRef: string }; res: { ok: true; url: string } | { ok: false; error: string } };
};

/** The ONE exported action. An op it does not know is refused like any other failure (fail-closed). */
export async function photoMark<K extends keyof PhotoMarkOps>(op: K, req: PhotoMarkOps[K]['req']): Promise<PhotoMarkOps[K]['res']> {
  type Res = PhotoMarkOps[K]['res'];
  if (op === 'mark') {
    const r = req as PhotoMarkOps['mark']['req'];
    return (await getPhotoMark(r.kind, r.pathPrefix)) as Res;
  }
  if (op === 'pair') return (await recordSupplierOriginal(req as PhotoMarkOps['pair']['req'])) as Res;
  if (op === 'original') return (await getPhotoOriginalUrl((req as PhotoMarkOps['original']['req']).publicRef)) as Res;
  return { ok: false, error: REFUSED } as Res;
}
