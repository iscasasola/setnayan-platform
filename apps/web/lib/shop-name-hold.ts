import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * A HELD SHOP NAME HOLDS ITS CORE (owner 2026-11-06, DECISION_LOG "A HELD SHOP NAME HOLDS ITS CORE").
 *
 * *"there was a shop named Bulgogi Catering. and the shop was deactivated, banned, or deleted. we have a rule that the
 * name cannot be used for 1 year. then they created Bulgogi 1. that should also not be allowed."*
 *
 * ── ONE QUESTION, ASKED OF THE DATABASE ─────────────────────────────────────
 * The core name and the holds live in SQL (`shop_name_core` / `shop_name_core_hold`, migration `20271320018288`) and
 * nowhere else. There is deliberately NO TypeScript copy of the core: a mirror that drifts is worse than no mirror
 * (`lib/business-slug.ts` has to be held to its SQL twin by a whole test), and the trade words are read live from the
 * taxonomy tables, which a TS copy could not see. Every name writer — the open-shop wizard (its live check AND its
 * submit), the My Shop rename, the correction request, the admin queue — asks this one function.
 *
 * ⚠ SUPABASE RESOLVES `{ error }` — IT DOES NOT THROW. A refused or failed probe is `unverified`, never "free": a
 * lookup we could not run is not proof the name is free. The writers fail CLOSED on it; the live preview says nothing.
 *
 * 🔒 PRIVACY. `holder` and `reason` (closed · banned · suspended) are for the admin queue only. A vendor is told the
 * name is held, never why another shop closed or was banned — so the vendor-facing callers use `state` alone, and the
 * copy below says nothing about the other shop.
 */
export type ShopNameHold =
  | { state: 'free'; core: string | null }
  | { state: 'held'; core: string; holder: string | null; reason: 'closed' | 'banned' | 'suspended' | null }
  | { state: 'unverified' };

/** The refusal. Its own wording, and it names no reason (privacy — owner 2026-11-06). */
export const SHOP_NAME_HELD_MESSAGE =
  'That name is too close to a business name Setnayan is holding, so a new shop can’t use it. Try a different name — or, if it really is your business, tell us and our team will check your papers.';

export const SHOP_NAME_UNVERIFIED_MESSAGE = 'We couldn’t check that shop name just now. Please try again.';

/** The claim button and its sent state — never a dead end (owner 2026-11-06, the "It's my number" shape). */
export const ITS_MY_BUSINESS_LABEL = 'It’s my business';
export const ITS_MY_BUSINESS_SENT =
  'Sent. Our team will check your papers and let you know. You can keep setting up your shop meanwhile.';
/** In the wizard the shop does not exist yet — the request goes in WITH it, and the copy says so. */
export const ITS_MY_BUSINESS_QUEUED =
  'We’ll send this to our team when you open your shop. Your shop opens without this name and its web address until they’ve checked your papers — you can keep going.';

/**
 * The marker every "It's my business" request carries in `vendor_correction_requests.note`, so the admin queue can
 * tell a held-name claim from an ordinary correction. Shown to the vendor as their own request — so it says nothing
 * about the other shop either.
 */
export const ITS_MY_BUSINESS_NOTE =
  'It’s my business — this name is close to a name Setnayan is holding. Please check my papers.';

type HoldRow = {
  core: string | null;
  held: boolean | null;
  holder_vendor_profile_id: string | null;
  hold_reason: string | null;
};

const REASONS = new Set(['closed', 'banned', 'suspended']);

/**
 * Ask the database whether `name`'s core is held. Requires an ADMIN client: the holds (`fraud_banned_at`, the
 * closure ledger) are invisible under a vendor's RLS, so "free" from a session client would only mean "invisible to
 * you". `vendorProfileId` = the shop asking — its own rows, and a core an admin already approved for it, never hold.
 */
export async function checkShopNameHold(
  admin: SupabaseClient,
  name: string,
  opts: { vendorProfileId?: string | null } = {},
): Promise<ShopNameHold> {
  const { data, error } = await admin.rpc('shop_name_core_hold', {
    p_name: name,
    p_vendor_profile_id: opts.vendorProfileId ?? null,
  });
  if (error) console.error('[supabase-error] lib/shop-name-hold.ts · rpc:shop_name_core_hold', error);
  if (error) return { state: 'unverified' };
  const row = (Array.isArray(data) ? data[0] : data) as HoldRow | null | undefined;
  // The function always answers with exactly one row. No row is not "free" — it is an answer we did not get.
  if (!row || typeof row.held !== 'boolean') return { state: 'unverified' };
  if (!row.held) return { state: 'free', core: row.core ?? null };
  if (!row.core) return { state: 'unverified' };
  return {
    state: 'held',
    core: row.core,
    holder: row.holder_vendor_profile_id ?? null,
    reason: REASONS.has(row.hold_reason ?? '') ? (row.hold_reason as 'closed' | 'banned' | 'suspended') : null,
  };
}

/**
 * File "It's my business" into the EXISTING admin queue — `vendor_correction_requests` → /admin/corrections, the
 * one door that already writes a shop's name on an admin's say-so (RULE 0: no new table). An approved row is also
 * what releases the core for this shop (`shop_name_core_hold` reads `status = 'applied'`).
 *
 * Idempotent: a second tap, or a wizard re-run, with an OPEN request for the same name files nothing new.
 */
export async function fileItsMyBusiness(
  client: SupabaseClient,
  args: { vendorProfileId: string; name: string; currentValue: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = args.name.trim().slice(0, 128);
  if (!name) return { ok: false, error: 'Tell us the name first.' };
  const { data: open, error: readErr } = await client
    .from('vendor_correction_requests')
    .select('id, requested_value')
    .eq('vendor_profile_id', args.vendorProfileId)
    .eq('field_key', 'business_name')
    .eq('status', 'open')
    .limit(20);
  if (readErr) console.error('[supabase-error] lib/shop-name-hold.ts · from:vendor_correction_requests.select', readErr);
  if (!readErr && ((open ?? []) as { requested_value: string | null }[]).some(
    (r) => (r.requested_value ?? '').trim().toLowerCase() === name.toLowerCase(),
  )) {
    return { ok: true };
  }
  const { error } = await client.from('vendor_correction_requests').insert({
    vendor_profile_id: args.vendorProfileId,
    field_key: 'business_name',
    current_value: args.currentValue,
    requested_value: name,
    note: ITS_MY_BUSINESS_NOTE,
  });
  if (error) console.error('[supabase-error] lib/shop-name-hold.ts · from:vendor_correction_requests.insert', error);
  if (error) return { ok: false, error: 'Your request couldn’t be sent right now — please try again shortly.' };
  return { ok: true };
}
