import type { SupabaseClient } from '@supabase/supabase-js';
import { isReservedSlug } from './reserved-slugs';

/**
 * ONE availability answer for the ONE top-level namespace.
 *
 * Weddings (`events.slug`), shops (`vendor_profiles.business_slug`) and people
 * (`users.slug`) all live at `setnayan.com/{word}`, and a retired word keeps
 * forwarding for 90 days (`slug_change_log.redirect_until`). Anything that
 * hands out a word must therefore ask about all four, not just its own table.
 *
 * Two live holes this closes:
 *   1. The couple's RENAME form checked the shape and the events table only —
 *      no reserved check at all, so a wedding could take `/creators`.
 *   2. A RETIRED address went straight back into the pool, so a guest holding a
 *      printed invitation could land on a stranger's page.
 *
 * ⚠ SUPABASE RESOLVES `{ error }` — IT DOES NOT THROW. Every probe here checks
 * `error` explicitly and FAILS CLOSED (`'unverified'`): a lookup we could not
 * run is not proof the word is free. Refusing costs someone a retry; handing
 * out a live address costs a printed invitation.
 */
export type SlugConflict =
  | 'invalid_format'
  | 'reserved'
  | 'taken'
  | 'taken_by_shop'
  | 'taken_by_person'
  | 'forwarding'
  | 'unverified';

export const SLUG_FORMAT = /^[a-z0-9-]{3,32}$/;

export type SlugExclusions = {
  /** The event doing the renaming — its own current slug is not a conflict. */
  eventId?: string | null;
  /** The shop doing the renaming. */
  vendorProfileId?: string | null;
  /** The person doing the renaming. */
  userId?: string | null;
};

/** Human copy for each refusal, safe to show to a couple or a vendor. */
export const SLUG_CONFLICT_MESSAGE: Record<SlugConflict, string> = {
  invalid_format: 'Use 3–32 characters: lowercase letters, numbers and hyphens only.',
  reserved: 'That address is reserved by Setnayan — please pick another.',
  taken: 'That address is already taken. Please pick another.',
  taken_by_shop: 'That address already belongs to a business page. Please pick another.',
  taken_by_person: 'That address already belongs to someone’s profile. Please pick another.',
  forwarding:
    'That address was used before and still sends visitors to its old page. Please pick another.',
  unverified: 'We couldn’t check that address just now. Please try again.',
};

function sameId(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a === b;
}

/**
 * TRUE when the word still carries a live forwarding row that does NOT belong
 * to the caller — i.e. a printed invitation or a shared link still points at it.
 *
 * Fails closed: an unreadable ledger returns TRUE.
 *
 * `.eq` — not `.ilike` — so a crafted segment containing `%` or `_` cannot act
 * as a LIKE wildcard and match somebody else's rename row.
 */
export async function isSlugForwarding(
  admin: SupabaseClient,
  slug: string,
  exclusions: SlugExclusions = {},
): Promise<boolean> {
  const lower = slug.toLowerCase();
  const { data, error } = await admin
    .from('slug_change_log')
    .select('entity_id')
    .eq('old_slug', lower)
    .gt('redirect_until', new Date().toISOString())
    .limit(50);

  if (error) return true; // fail closed — we cannot prove the word is free
  const rows = (data ?? []) as { entity_id: string | null }[];
  const mine = [exclusions.eventId, exclusions.vendorProfileId, exclusions.userId];
  return rows.some((row) => !mine.some((id) => sameId(id, row.entity_id)));
}

/**
 * The whole availability answer for a bare-root word. Returns `null` when the
 * word is free for this caller to take.
 *
 * Requires an ADMIN client: the probes must see rows the caller's RLS hides,
 * or "free" would just mean "invisible to you" — an RLS denial and an empty
 * read are the same value.
 */
export async function findSlugConflict(
  admin: SupabaseClient,
  slug: string,
  exclusions: SlugExclusions = {},
): Promise<SlugConflict | null> {
  const lower = String(slug ?? '').trim().toLowerCase();
  if (!SLUG_FORMAT.test(lower)) return 'invalid_format';
  if (isReservedSlug(lower)) return 'reserved';

  const event = await admin
    .from('events')
    .select('event_id')
    .ilike('slug', lower)
    .maybeSingle();
  if (event.error) return 'unverified';
  const eventId = (event.data as { event_id?: string } | null)?.event_id ?? null;
  if (eventId && !sameId(exclusions.eventId, eventId)) return 'taken';

  const shop = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id')
    .ilike('business_slug', lower)
    .maybeSingle();
  if (shop.error) return 'unverified';
  const shopId = (shop.data as { vendor_profile_id?: string } | null)?.vendor_profile_id ?? null;
  if (shopId && !sameId(exclusions.vendorProfileId, shopId)) return 'taken_by_shop';

  const person = await admin.from('users').select('user_id').ilike('slug', lower).maybeSingle();
  if (person.error) return 'unverified';
  const personId = (person.data as { user_id?: string } | null)?.user_id ?? null;
  if (personId && !sameId(exclusions.userId, personId)) return 'taken_by_person';

  if (await isSlugForwarding(admin, lower, exclusions)) return 'forwarding';

  return null;
}
