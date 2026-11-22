/**
 * 🔒 FREE FILES STAY PRIVATE — the rule for serving a supplier's own uploaded file (owner-locked 22 Nov 2026,
 * DECISION_LOG "SUPPLIER PLAN ANTI-ABUSE RULES LOCKED" (8); `SUPPLIER_SUBSCRIPTIONS_BUILD_SPEC_2026-11-22.md` § ★ J).
 *
 * Owner, verbatim: an unverified (Free) shop's files are *"viewable only inside the app, never as public or shareable
 * links"*. Reason: Free must never become free public file hosting. Once the shop is verified its public surfaces
 * (service cards, shop photos on the marketplace) work exactly as they did.
 *
 * ─── THE RULE (pure — `shopFileServe`) ──────────────────────────────────────────────────────────────────────────────
 *   public   — the shop is verified (`shopIsVerified`, the ONE test, lib/own-clients.ts). Today's resolver, unchanged.
 *   in_app   — the shop is NOT verified and the viewer is signed in (inside the app). A signed URL that dies in
 *              `FREE_SHOP_FILE_TTL_SECONDS` — never the unsigned public host, never the 24 h signer.
 *   withheld — the shop is NOT verified and the viewer is a stranger (signed out, a cached stranger copy, a link
 *              preview, a crawler). No URL at all; the page draws what it draws for a shop with no photo.
 *   An unread or unknown verification state is NOT verified (fail closed): a short select must never publish a file.
 *
 * ─── WHOSE FILE IS IT (pure — `shopIdOfFileRef`) ────────────────────────────────────────────────────────────────────
 * Every supplier upload is filed under its shop: `vendors/<shop>/…` (logo, portfolio, service cards, showcase, booth
 * posters, forms), `vendor-originals/<shop>`, `vendor-payment-qr/<shop>/…`, `supplier-files/<shop>/…`
 * (`app/api/upload/route.ts` tenancy, `lib/upload-prefix-tenancy.ts`). So the key alone names the shop, and a page that
 * shows OTHER shops' files (a couple's suppliers, a partner row) can ask once for all of them
 * (`readShopFileServes`, lib/supplier-file-sign.server.ts). A file filed under no shop is not a shop file: this rule
 * leaves it alone. A shop's VERIFICATION papers share the `vendors/` root but live in their own private bucket with
 * their own signer; they are never served through here.
 *
 * Pure, client-safe (no `server-only`, no SDK, no I/O) so `lib/free-shop-files.test.ts` holds it by behaviour.
 */
import { shopIsVerified } from './own-clients';

/** How long a Free shop's file link lives: 15 minutes. Long enough to look; too short to host anything. */
export const FREE_SHOP_FILE_TTL_SECONDS = 15 * 60;

export type ShopFileServe = 'public' | 'in_app' | 'withheld';

/** Who is looking. `signedIn` = a real account (an anonymous session is a stranger). */
export type ShopFileViewer = { signedIn: boolean };

export function shopFileServe(verificationState: unknown, viewer: ShopFileViewer): ShopFileServe {
  if (shopIsVerified(verificationState)) return 'public';
  return viewer.signedIn ? 'in_app' : 'withheld';
}

/** The key roots a supplier's own uploads are filed under; the segment after each is the shop's id. */
export const SHOP_FILE_ROOTS: ReadonlySet<string> = new Set(['vendors', 'vendor-originals', 'vendor-payment-qr', 'supplier-files']);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const R2_SCHEME = 'r2://';

/** The object key of a stored value: `r2://<bucket>/<key>` → key; a bare key → itself; a URL or junk → null. */
export function storedFileKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  if (v.startsWith(R2_SCHEME)) {
    const rest = v.slice(R2_SCHEME.length);
    const slash = rest.indexOf('/');
    if (slash <= 0 || slash === rest.length - 1) return null;
    return rest.slice(slash + 1);
  }
  // A bare key (`uploadPublicAsset`) never carries a scheme or a host.
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) || v.startsWith('/')) return null;
  return v;
}

/** The shop a stored file is filed under (lower-cased id), or null when it is not a shop's own upload. */
export function shopIdOfFileRef(value: unknown): string | null {
  const key = storedFileKey(value);
  if (!key) return null;
  const [root, id] = key.split('/');
  if (!root || !id || !SHOP_FILE_ROOTS.has(root)) return null;
  return UUID.test(id) ? id.toLowerCase() : null;
}

/** Every distinct shop named by a list of stored values (refs that name none are skipped). */
export function shopIdsOfFileRefs(values: Iterable<unknown>): string[] {
  const out = new Set<string>();
  for (const v of values) {
    const id = shopIdOfFileRef(v);
    if (id) out.add(id);
  }
  return [...out];
}

/**
 * How one stored value is served, given the serves read for its shop. Not a shop's file ⇒ `public` (this rule does not
 * touch it). A shop's file whose shop was not read ⇒ `withheld` (fail closed: unknown is never public).
 */
export function serveForFileRef(value: unknown, serves: ReadonlyMap<string, ShopFileServe>): ShopFileServe {
  const shop = shopIdOfFileRef(value);
  if (!shop) return 'public';
  return serves.get(shop) ?? 'withheld';
}

/**
 * A page that draws ONE shop's files and knows whose they are (the shop's own page, its work albums): every file it
 * draws for that shop follows that shop's serve, whatever folder the file sits in (a Papic portfolio photo is filed
 * under the event, not the shop, and is still the shop's).
 */
export type OwnShopServe = { readonly shopId: string; readonly serve: ShopFileServe };

export function ownShopServe(shopId: string, verificationState: unknown, viewer: ShopFileViewer): OwnShopServe {
  return { shopId: shopId.toLowerCase(), serve: shopFileServe(verificationState, viewer) };
}
