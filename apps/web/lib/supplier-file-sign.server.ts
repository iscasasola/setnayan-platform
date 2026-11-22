import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  displayUrlForPrivateStoredAsset,
  displayUrlForStoredAsset,
  encodeR2Ref,
  parseStoredAsset,
  R2_BUCKETS,
} from '@/lib/uploads';
import {
  FREE_SHOP_FILE_TTL_SECONDS,
  serveForFileRef,
  shopFileServe,
  shopIdOfFileRef,
  shopIdsOfFileRefs,
  storedFileKey,
  type OwnShopServe,
  type ShopFileServe,
  type ShopFileViewer,
} from '@/lib/free-shop-files';

/**
 * Sign one stored ref for drawing: a portfolio photo through the public signer; a private stored copy ONLY when it sits
 * in THIS shop's own `supplier-files/<shop>/` folder (the policy-checked private signer — never a raw one).
 */
export async function signStoredRef(ref: string | null | undefined, shop: string): Promise<string | null> {
  if (!ref) return null;
  const parsed = parseStoredAsset(ref);
  if (!parsed || parsed.kind === 'legacy_url') return null;
  if (parsed.bucket === 'setnayan-media') return displayUrlForStoredAsset(ref);
  return displayUrlForPrivateStoredAsset(ref, { bucket: 'setnayan-thread-files', prefixes: [`supplier-files/${shop}/`] }, { ttlSeconds: 60 * 60 });
}

/* ── 🔒 FREE FILES STAY PRIVATE (spec § ★ J, owner-locked 22 Nov) — the rule is lib/free-shop-files.ts ─────────────── */

/** The private folders a shop's own files may sit in, each signed only under that shop's id. */
const PRIVATE_SHOP_FOLDERS: ReadonlyArray<{ root: string; bucket: (typeof R2_BUCKETS)[keyof typeof R2_BUCKETS] }> = [
  { root: 'supplier-files', bucket: R2_BUCKETS.threadFiles },
  { root: 'vendor-payment-qr', bucket: R2_BUCKETS.threadFiles },
];

/**
 * A Free shop's file, signed for a signed-in viewer: `FREE_SHOP_FILE_TTL_SECONDS`, never the public host, never the
 * 24 h signer. A legacy absolute URL is NOT passed through (it may be our own permanent public address); a ref in a
 * private bucket is signed only inside its own shop's folder (the policy-checked signer).
 */
async function signFreeShopFile(value: string, shop: string): Promise<string | null> {
  const ttl = { ttlSeconds: FREE_SHOP_FILE_TTL_SECONDS };
  // An absolute URL is never passed through (it may be our own permanent public address): `storedFileKey` is null.
  const key = storedFileKey(value);
  if (!key) return null;
  const parsed = parseStoredAsset(value);
  // A bare key (`uploadPublicAsset`) lives in the media bucket.
  const ref = parsed?.kind === 'r2' ? value.trim() : encodeR2Ref(R2_BUCKETS.media, key);
  const r = parseStoredAsset(ref);
  if (!r || r.kind !== 'r2') return null;
  if (r.bucket === R2_BUCKETS.media) return displayUrlForStoredAsset(ref, ttl);
  const folder = PRIVATE_SHOP_FOLDERS.find((f) => f.bucket === r.bucket && r.key.startsWith(`${f.root}/`));
  if (!folder) return null;
  return displayUrlForPrivateStoredAsset(ref, { bucket: folder.bucket, prefixes: [`${folder.root}/${shop}/`] }, ttl);
}

/**
 * Serve one stored value under the Free-files rule. `publicUrl` is the surface's OWN resolver for a verified shop
 * (`displayUrlForStoredAsset`, `publicUrlForStoredAsset`, …) so a verified shop's page is byte-for-byte what it was.
 * A value filed under no shop is not a shop file and goes to `publicUrl` untouched.
 */
export async function shopFileUrl(
  value: string | null | undefined,
  serves: ReadonlyMap<string, ShopFileServe>,
  publicUrl: (value: string) => string | null | Promise<string | null>,
): Promise<string | null> {
  if (typeof value !== 'string' || !value.trim()) return null;
  const serve = serveForFileRef(value, serves);
  if (serve === 'public') return publicUrl(value);
  if (serve === 'withheld') return null;
  return signFreeShopFile(value, shopIdOfFileRef(value)!);
}

/** `shopFileUrl` for a page that knows whose file it draws (`OwnShopServe`): the shop's serve, whatever the folder. */
export async function ownShopFileUrl(
  value: string | null | undefined,
  own: OwnShopServe,
  publicUrl: (value: string) => string | null | Promise<string | null>,
): Promise<string | null> {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (own.serve === 'public') return publicUrl(value);
  if (own.serve === 'withheld') return null;
  return signFreeShopFile(value, own.shopId);
}

/**
 * `shopFileUrl` over a list, in order; a file that may not be served drops out (never a broken image). With `own`, the
 * list is one known shop's files and follows that shop's serve (`ownShopFileUrl`) — `serves` is then not asked.
 */
export async function shopFileUrls(
  values: ReadonlyArray<string | null | undefined>,
  serves: ReadonlyMap<string, ShopFileServe>,
  publicUrl: (value: string) => string | null | Promise<string | null>,
  own?: OwnShopServe,
): Promise<string[]> {
  const out = await Promise.all(
    values.map((v) => (own ? ownShopFileUrl(v, own, publicUrl) : shopFileUrl(v, serves, publicUrl)).catch(() => null)),
  );
  return out.filter((u): u is string => typeof u === 'string' && u.length > 0);
}

/**
 * How each shop named by these stored values is served to this viewer — ONE read of `vendor_profiles`, for a page
 * that shows other shops' files (a couple's suppliers, a partner row). No shop named ⇒ no read. A failed read leaves
 * those shops OUT of the map, so `serveForFileRef` withholds their files: a read we could not make never publishes a
 * file (fail closed — the files come back on the next load, nothing is lost).
 */
export async function readShopFileServes(
  values: Iterable<unknown>,
  viewer: ShopFileViewer,
  /** The caller's service-role client when it already holds one; otherwise one is made. */
  admin?: SupabaseClient,
): Promise<ReadonlyMap<string, ShopFileServe>> {
  const ids = shopIdsOfFileRefs(values);
  const out = new Map<string, ShopFileServe>();
  if (ids.length === 0) return out;
  const { data, error } = await (admin ?? createAdminClient())
    .from('vendor_profiles')
    .select('vendor_profile_id, verification_state')
    .in('vendor_profile_id', ids);
  if (error) {
    console.error('[supabase-error] free-shop-files: verification read', error);
    return out;
  }
  for (const row of (data ?? []) as Array<{ vendor_profile_id: string; verification_state: unknown }>) {
    out.set(String(row.vendor_profile_id).toLowerCase(), shopFileServe(row.verification_state, viewer));
  }
  return out;
}
