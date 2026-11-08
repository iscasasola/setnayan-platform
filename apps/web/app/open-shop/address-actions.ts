'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { resolveOwnedActiveShop } from '@/lib/active-shop';
import { findSlugConflict } from '@/lib/slug-availability';
import { previewShopAddress } from '@/lib/business-slug';
import { checkShopNameHold } from '@/lib/shop-name-hold';

/**
 * Is the address this shop name would mint actually free?
 *
 * Owner 2026-08-09: *"must be available. if not available we will add a
 * numerical value integer?"* — the database already does that
 * (`generate_business_slug_for_vendor` probes, then appends a counter). This
 * action exists so the WIZARD can say so before the vendor commits to a name.
 *
 * 🔑 IT DELEGATES TO `findSlugConflict`, THE ONE AVAILABILITY ANSWER.
 * A first cut here hand-rolled its own two probes (vendors + events) and was
 * WRONG IN TWO WAYS the shared helper already handles: it never asked about
 * **people** (`users.slug` — same namespace, `setnayan.com/{word}`), and it never
 * asked about **retired addresses still forwarding** (`slug_change_log`), so it
 * would have reported "Available" for a word that sends visitors to someone
 * else's page. Two hand-rolled answers to one question is how the namespace
 * drifted in the first place.
 *
 * It also fails CLOSED where mine failed open: a probe that errors returns
 * `'unverified'`, never "free".
 *
 * ⚠ ADVISORY, NOT AUTHORITATIVE, AND NEVER A GATE. The row does not exist yet,
 * two vendors can be typing the same name right now, and the answer can go stale
 * before submit. The generator's own probe-and-retry loop inside the write
 * transaction is what actually guarantees uniqueness. Telling a vendor "taken,
 * pick another" would refuse a legitimate business name over a race the database
 * already handles for them.
 *
 * Service-role client on purpose: an anonymous or half-registered vendor cannot
 * read other vendors' rows under RLS, and "free" from a denied read is the
 * `count: 0` trap — an RLS denial and an empty result are the same value.
 */
export type AddressCheck =
  | { state: 'empty' }
  /** Under 3 usable characters — the DB will pick something from the shop id. */
  | { state: 'auto'; slug: null }
  | { state: 'free'; slug: string }
  /** Taken, reserved, or still forwarding: the DB appends a counter. */
  | { state: 'taken'; slug: string; suggestion: string }
  /** The lookup itself failed — say nothing rather than guess. */
  | { state: 'unknown'; slug: string }
  /** `ask: 'name'` — the shop NAME's core is held (owner 2026-11-06). Nothing about which shop, or why. */
  | { state: 'name_held' }
  /** `ask: 'name'` — not held, or not checkable (the submit asks again and fails closed). */
  | { state: 'name_free' };

/**
 * `ask: 'name'` asks the OTHER step-1 question with the same action: is this shop NAME's core held (owner
 * 2026-11-06, "A HELD SHOP NAME HOLDS ITS CORE")? One action, not a second export: every exported server action is a
 * Vercel route and the budget is full (`scripts/lint-server-action-budget.mjs`). It asks the SAME database function
 * the submit asks (`checkShopNameHold`), so the wizard and `becomeVendor` cannot disagree.
 *
 * 🔒 It returns the state ONLY. Which shop holds the core, and why (closed · banned · suspended), never leaves the
 * server: the person typing must not learn why another shop closed.
 */
export async function checkShopAddress(name: string, ask: 'address' | 'name' = 'address'): Promise<AddressCheck> {
  if (ask === 'name') return checkNameHold(name);
  const preview = previewShopAddress(name);
  if (preview.kind === 'empty') return { state: 'empty' };
  if (preview.kind === 'too_short') return { state: 'auto', slug: null };

  const base = preview.slug;

  try {
    const admin = createAdminClient();
    const conflict = await findSlugConflict(admin, base);
    if (conflict === null) {
      // A free WORD can still carry a held CORE ("bulgogi1" while "bulgogicatering" is held — owner 2026-11-06).
      // Same answer the submit gives (`becomeVendor` refuses it as taken); unknown says nothing, as below.
      const hold = await checkShopNameHold(admin, base);
      if (hold.state === 'held') return { state: 'taken', slug: base, suggestion: `${base}2` };
      if (hold.state === 'unverified') return { state: 'unknown', slug: base };
      return { state: 'free', slug: base };
    }
    // A probe we could not run is not proof the word is free — and it is not
    // proof it is taken either. Both signs would be a guess, so the UI shows
    // neither and leaves the address line (which is correct on its own) alone.
    if (conflict === 'unverified') return { state: 'unknown', slug: base };
    // Everything else — taken by a wedding, a shop, a person, a reserved word,
    // or an address still forwarding — lands the vendor on the same outcome:
    // the generator will number it. `suggestion` mirrors its first retry. Only a
    // guess (the counter may have moved by submit), so the UI phrases it as
    // "yours will be…", never as a promise.
    return { state: 'taken', slug: base, suggestion: `${base}2` };
  } catch {
    return { state: 'unknown', slug: base };
  }
}


async function checkNameHold(name: string): Promise<AddressCheck> {
  const trimmed = String(name ?? '').trim().slice(0, 128);
  if (!trimmed) return { state: 'name_free' };
  try {
    // The asking shop, when there is one (a wizard re-run on a nameless shop): its own rows never hold against it,
    // and a core an admin already approved for it is free. Signed out, or no shop yet → nobody is asking.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const shop = user ? await resolveOwnedActiveShop(supabase, user.id) : null;
    const hold = await checkShopNameHold(createAdminClient(), trimmed, {
      vendorProfileId: shop?.ok ? shop.vendorProfileId : null,
    });
    return hold.state === 'held' ? { state: 'name_held' } : { state: 'name_free' };
  } catch {
    return { state: 'name_free' };
  }
}
