'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { isReservedSlug } from '@/lib/reserved-slugs';
import { previewShopAddress } from '@/lib/business-slug';

/**
 * Is the address this shop name would mint actually free?
 *
 * Owner 2026-08-09: *"must be available. if not available we will add a
 * numerical value integer?"* — the database already does exactly that
 * (`generate_business_slug_for_vendor` probes, then appends a counter). This
 * action exists so the WIZARD can say so before the vendor commits to a name,
 * rather than letting them discover it after the fact.
 *
 * 🔑 IT ANSWERS WITH THE SAME THREE QUESTIONS THE GENERATOR ASKS, IN THE SAME
 * ORDER — reserved word, then another vendor's address, then an EVENT's address.
 * Events share the one top-level namespace (`setnayan.com/{slug}`) and
 * `app/[slug]/page.tsx` resolves an event BEFORE a vendor, so an event-shadowed
 * address would be dead on arrival. Checking only vendors would report "free"
 * for an address the vendor can never actually use.
 *
 * ⚠ ADVISORY, NOT AUTHORITATIVE. This is a preview: the row does not exist yet,
 * two vendors can be typing the same name right now, and the answer can go stale
 * between here and submit. The generator's own probe-and-retry loop inside the
 * write transaction is what actually guarantees uniqueness. This must never
 * become a gate — telling a vendor "taken, pick another" would refuse a
 * legitimate business name over a race the database already handles for them.
 *
 * Service-role read on purpose: an anonymous or half-registered vendor cannot
 * read other vendors' rows under RLS, and "free" from a denied read is the
 * `count: 0` trap — an RLS denial and an empty result are the same value.
 */
export type AddressCheck =
  | { state: 'empty' }
  /** Under 3 usable characters — the DB will pick something from the shop id. */
  | { state: 'auto'; slug: null }
  | { state: 'free'; slug: string }
  /** Taken or reserved: the DB will append a counter. `suggestion` is that guess. */
  | { state: 'taken'; slug: string; suggestion: string }
  /** The lookup itself failed — say nothing rather than guess. */
  | { state: 'unknown'; slug: string };

export async function checkShopAddress(name: string): Promise<AddressCheck> {
  const preview = previewShopAddress(name);
  if (preview.kind === 'empty') return { state: 'empty' };
  if (preview.kind === 'too_short') return { state: 'auto', slug: null };

  const base = preview.slug;

  // Reserved is decided in code — no round trip, and it is the one answer that
  // cannot go stale.
  if (isReservedSlug(base)) {
    return { state: 'taken', slug: base, suggestion: `${base}2` };
  }

  try {
    const admin = createAdminClient();
    const [vendorRes, eventRes] = await Promise.all([
      admin
        .from('vendor_profiles')
        .select('vendor_profile_id', { count: 'exact', head: true })
        .ilike('business_slug', base),
      admin
        .from('events')
        .select('event_id', { count: 'exact', head: true })
        .ilike('slug', base),
    ]);

    // A failed read is NOT "free". `count === null` means NOT MEASURED, and
    // reporting an unmeasured address as available is how a vendor ends up with
    // a different one than the screen promised.
    if (vendorRes.error || eventRes.error) return { state: 'unknown', slug: base };
    if (vendorRes.count == null || eventRes.count == null) {
      return { state: 'unknown', slug: base };
    }

    const taken = vendorRes.count > 0 || eventRes.count > 0;
    if (!taken) return { state: 'free', slug: base };

    // Mirrors the generator's first retry. Only a guess — by submit time the
    // counter may have moved — so the UI phrases it as "we'll make it…", never
    // as a promise.
    return { state: 'taken', slug: base, suggestion: `${base}2` };
  } catch {
    return { state: 'unknown', slug: base };
  }
}
