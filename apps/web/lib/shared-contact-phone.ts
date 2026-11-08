/**
 * shared-contact-phone.ts — "This number is also on another shop", for the admin
 * verification desk (owner 2026-11-06, DECISION_LOG "A CONTACT NUMBER ON TWO
 * ACCOUNTS — LENIENT NOW, FLAGGED TO ADMIN").
 *
 * ── LENIENT, ON PURPOSE ────────────────────────────────────────────────────
 * Sign-up is NEVER refused for a number already on another shop. There is no
 * SMS in V1, so nobody can prove a number is theirs; a hard block would let a
 * squatter lock the real owner out of their own number. Instead the reviewer
 * sees the overlap and the real owner proves it with their papers.
 *
 * ── ONE PERSON'S OWN SHOPS MAY SHARE A NUMBER ──────────────────────────────
 * Only a match on a DIFFERENT owner's shop is flagged (`vendor_profiles.user_id`).
 *
 * PURE: the admin page owns the read; this decides. READ-ONLY — nothing here
 * writes, blocks, or changes a shop.
 */
import { parsePhPhone } from './ph-phone';

export type PhoneShop = {
  vendor_profile_id: string;
  user_id: string | null;
  business_name: string | null;
  business_slug: string | null;
  contact_phone: string | null;
};

export type OtherShop = { vendorProfileId: string; businessName: string; businessSlug: string | null };

/**
 * The one comparable form of a stored number. Both writers save E.164 today
 * (`parsePhPhone().e164`), but `contact_phone` is free text and older rows may
 * hold "0917 123 4567" — so a stored value is re-parsed, and anything that is
 * not a Philippine number falls back to its digits.
 */
export function phoneKey(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const parsed = parsePhPhone(raw);
  if (parsed.ok) return parsed.e164;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 7 ? `+${digits}` : null;
}

/**
 * Every stored spelling worth asking the database for, so the read can stay an
 * exact `in (…)` match on the column (no scan of every shop): the raw value,
 * its E.164, and the local 0-prefixed and bare 63 forms of a PH number.
 */
export function phoneLookupVariants(raw: string | null | undefined): string[] {
  if (!raw || !raw.trim()) return [];
  const out = new Set<string>([raw.trim()]);
  const parsed = parsePhPhone(raw);
  if (parsed.ok) {
    out.add(parsed.e164);
    out.add(parsed.display);
    const national = parsed.e164.replace(/^\+63/, '');
    out.add(`0${national}`);
    out.add(`63${national}`);
  }
  return [...out];
}

/**
 * For each shop under review, the OTHER owners' shops that carry the same number.
 * A shop with no such match is omitted entirely.
 */
export function shopsSharingPhone(
  reviewed: ReadonlyArray<PhoneShop>,
  candidates: ReadonlyArray<PhoneShop>,
): Record<string, OtherShop[]> {
  const byKey = new Map<string, PhoneShop[]>();
  for (const c of candidates) {
    const key = phoneKey(c.contact_phone);
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    if (!list.some((x) => x.vendor_profile_id === c.vendor_profile_id)) list.push(c);
    byKey.set(key, list);
  }
  const out: Record<string, OtherShop[]> = {};
  for (const shop of reviewed) {
    const key = phoneKey(shop.contact_phone);
    if (!key) continue;
    const others = (byKey.get(key) ?? []).filter(
      (c) =>
        c.vendor_profile_id !== shop.vendor_profile_id &&
        // Same owner → their own shops; never flagged. An unknown owner on
        // either side cannot be proven the same person, so it IS shown.
        !(shop.user_id && c.user_id && c.user_id === shop.user_id),
    );
    if (others.length > 0) {
      out[shop.vendor_profile_id] = others.map((c) => ({
        vendorProfileId: c.vendor_profile_id,
        businessName: c.business_name?.trim() || 'Unnamed shop',
        businessSlug: c.business_slug,
      }));
    }
  }
  return out;
}
