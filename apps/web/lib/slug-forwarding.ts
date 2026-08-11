import type { SupabaseClient } from '@supabase/supabase-js';
import { publicEventPath, resolveEventOwnerSlug } from '@/lib/public-event-url';
import { CLOSED_SHOP_SLUG_ENTITY_TYPE } from '@/lib/closed-shop-slug';

export {
  SLUG_FORWARDING_MONTHS,
  slugForwardingLabel,
} from '@/lib/slug-forwarding-window';

// ============================================================================
// A RENAMED ADDRESS ACTUALLY FORWARDS.
//
// Three screens promise it — the couple's address field, the person's handle
// field, and the availability endpoint that REFUSES a word because it "still
// sends visitors to its old page". Three writers keep the promise's half of the
// bargain: a rename appends a `slug_change_log` row (event · user), and a shop
// closure appends a hold.
//
// 🚨 NOTHING READ THEM. The only reader (`resolveRenamedEventPath`) returned
// null on its first line unless `NEXT_PUBLIC_U_NESTING_CUTOVER` was on, and
// that flag has never been on in production — so from the day the promise was
// printed, every renamed address 404'd. The ledger was written, the word was
// retired out of the pool to protect a redirect, and the redirect did not
// exist. Person handles were worse: they wrote the same rows and had no reader
// at ANY flag setting.
//
// The forwarding fix is NOT part of the /u/ cutover and is no longer gated on
// it. Ungated, this resolver runs only on the miss path — a URL that matched no
// live event, shop or person — so it adds no query to any page that renders.
//
// ── WHY A CLOSED SHOP IS NOT FORWARDED ──────────────────────────────────────
// `vendor_closed` rows live in the same ledger and share the same expiry
// column, but a closure forwards NOBODY ANYWHERE — it holds the word so a
// stranger can't take it. Sending its visitors to the shop's own (now
// anonymised) page would be a lie told by a redirect. Filtered out here, and
// the filter is a named constant so the two can't drift apart.
// ============================================================================

/** Ledger rows that mean "this word MOVED", as opposed to "this word is held". */
export const FORWARDING_ENTITY_TYPES = ['event', 'vendor', 'user'] as const;
export type ForwardingEntityType = (typeof FORWARDING_ENTITY_TYPES)[number];

type LedgerRow = { entity_type: string; entity_id: string };

/**
 * The newest LIVE forwarding row for a word, or null.
 *
 * `.eq` — not `.ilike` — so a crafted URL segment carrying a `%` or `_` cannot
 * act as a LIKE wildcard and match somebody else's rename row. Stored slugs are
 * always `^[a-z0-9-]{3,32}$`, so an exact lowercase match is complete.
 */
async function newestForwardingRow(
  admin: SupabaseClient,
  oldSlug: string,
  types: readonly ForwardingEntityType[],
): Promise<LedgerRow | null> {
  const { data, error } = await admin
    .from('slug_change_log')
    .select('entity_type, entity_id')
    .eq('old_slug', oldSlug.toLowerCase())
    .in('entity_type', types as unknown as string[])
    .gt('redirect_until', new Date().toISOString())
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  // ⚠ SUPABASE RESOLVES `{ error }` — IT DOES NOT THROW. An unreadable ledger
  // means "we don't know", and the caller's fallback is its existing 404. There
  // is deliberately no fail-closed here: unlike `findSlugConflict`, refusing
  // costs a visitor their page rather than costing someone a retry.
  if (error) return null;
  const row = data as LedgerRow | null;
  if (!row?.entity_id) return null;
  if (row.entity_type === CLOSED_SHOP_SLUG_ENTITY_TYPE) return null;
  return row;
}

/**
 * TRUE when the word is STILL somebody's live address.
 *
 * 🚨 A FORWARD MUST NEVER SHADOW A LIVE PAGE. Every hand-out path asks
 * `findSlugConflict`, which refuses a word that is still forwarding — but the
 * DATABASE'S OWN auto-mint does not consult the ledger at all, so a shop can be
 * minted a word that is mid-forward. Without this check the shop would exist,
 * be in the sitemap, and bounce every visitor to a stranger's page.
 *
 * Costs nothing in practice: it runs only after a live forwarding row was
 * found, which is rare — a junk URL returns on the ledger miss above.
 */
async function wordIsLiveElsewhere(
  admin: SupabaseClient,
  lower: string,
): Promise<boolean> {
  const [event, shop, person] = await Promise.all([
    admin.from('events').select('event_id').ilike('slug', lower).maybeSingle(),
    admin
      .from('vendor_profiles')
      .select('vendor_profile_id')
      .ilike('business_slug', lower)
      .maybeSingle(),
    admin.from('users').select('user_id').ilike('slug', lower).maybeSingle(),
  ]);
  // Fails CLOSED, opposite to the ledger read above and for the opposite
  // reason: an unreadable probe cannot prove the word is free, and forwarding
  // on top of a live page sends its visitors somewhere else entirely.
  if (event.error || shop.error || person.error) return true;
  return !!(event.data || shop.data || person.data);
}

/**
 * Given a bare word that matches NO live event, shop or person, resolve where
 * it went — the CURRENT public path of whatever used to live there — or null.
 *
 * Resolving through the ledger's `entity_id` to the row's CURRENT slug (rather
 * than the stored `new_slug`) survives chained renames: rename A→B→C and a
 * visitor holding A lands on C, not on a second dead word.
 *
 * Returns null when the row points at something deleted since, or when the old
 * word already equals the current one (a redirect loop onto the same URL).
 *
 * ADMIN CLIENT REQUIRED. This runs for anonymous visitors with no RLS session,
 * and `slug_change_log` is admin-read only — under any other client every
 * lookup would come back empty and read exactly like "no such page".
 */
export async function resolveRenamedPath(
  admin: SupabaseClient,
  oldSlug: string,
  types: readonly ForwardingEntityType[] = FORWARDING_ENTITY_TYPES,
): Promise<string | null> {
  const lower = String(oldSlug ?? '').trim().toLowerCase();
  if (!lower) return null;

  const row = await newestForwardingRow(admin, lower, types);
  if (!row) return null;
  if (await wordIsLiveElsewhere(admin, lower)) return null;

  const same = (current: string | null | undefined): boolean =>
    !!current && current.trim().toLowerCase() === lower;

  if (row.entity_type === 'event') {
    const { data } = await admin
      .from('events')
      .select('event_id, slug')
      .eq('event_id', row.entity_id)
      .maybeSingle();
    const event = data as { event_id: string; slug: string | null } | null;
    const slug = event?.slug?.trim();
    if (!event || !slug || same(slug)) return null;
    // Emits the nested `/u/` form once the cutover flag is on, and the bare
    // root while it is off — the same helper every QR and canonical uses, so a
    // forwarded visitor lands on the identical URL a fresh one would.
    const ownerSlug = await resolveEventOwnerSlug(admin, event.event_id);
    return publicEventPath(slug, ownerSlug);
  }

  if (row.entity_type === 'vendor') {
    const { data } = await admin
      .from('vendor_profiles')
      .select('business_slug')
      .eq('vendor_profile_id', row.entity_id)
      .maybeSingle();
    const slug = (data as { business_slug?: string | null } | null)?.business_slug?.trim();
    if (!slug || same(slug)) return null;
    // The BARE ROOT is a shop's canonical address (app/[slug] dispatches to the
    // vendor renderer); `/v/{slug}` is legacy.
    return `/${slug}`;
  }

  const { data } = await admin
    .from('users')
    .select('slug')
    .eq('user_id', row.entity_id)
    .maybeSingle();
  const slug = (data as { slug?: string | null } | null)?.slug?.trim();
  if (!slug || same(slug)) return null;
  return `/u/${slug}`;
}
