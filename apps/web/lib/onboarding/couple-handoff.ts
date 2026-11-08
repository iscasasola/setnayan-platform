/**
 * couple-handoff.ts — carrying the two names of a couple across the
 * People → create-event → wedding onboarding hop.
 *
 * Owner, 2026-09-29: *"add partner (to become a couple)"* — and once both have
 * confirmed, ONE plain next step: "Plan an event together", opening the
 * existing create-event step "prefilled with both names". Nothing is created
 * until they create it.
 *
 * The wedding's name screen asks for the bride's and the groom's first names,
 * and asks FIRST whether you are the bride or the groom. So the carry holds
 * "me" and "my partner", never "bride" and "groom": the flow puts each name in
 * its slot only once the person has said which one they are. We do not know,
 * and must not guess, who is walking down the aisle.
 *
 * ⚠ SAME ROUTE AS `honoree-handoff.ts`, FOR THE SAME REASON. These are two
 * people's first names; personal data does not go in a URL. They ride in
 * sessionStorage — same tab, same origin, never transmitted — are READ ONCE,
 * and expire in ten minutes. Every failure degrades to "no carry": the wizard
 * asks, exactly as it does today.
 */

import { isHandoffFresh } from '@/lib/onboarding/honoree-handoff';

const KEY = 'setnayan_create_couple_v1';

export type CoupleCarry = { me: string; partner: string };

/** Pure half: tidy one name the way the carry stores it. */
export function carriedName(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().split(/\s+/)[0]?.slice(0, 40) ?? '' : '';
}

/** Stash the pair. Either name missing CLEARS — half a couple is not a carry. */
export function stashCouple(couple: CoupleCarry | null): void {
  if (typeof window === 'undefined') return;
  try {
    const me = carriedName(couple?.me);
    const partner = carriedName(couple?.partner);
    if (!me || !partner) {
      window.sessionStorage.removeItem(KEY);
      return;
    }
    window.sessionStorage.setItem(KEY, JSON.stringify({ m: me, p: partner, t: Date.now() }));
  } catch {
    /* private mode / quota — the wizard simply asks */
  }
}

/** Read AND consume. Null when absent, stale, half, or unreadable. */
export function takeCouple(): CoupleCarry | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw) as { m?: unknown; p?: unknown; t?: unknown };
    if (!isHandoffFresh(parsed?.t, Date.now())) return null;
    const me = carriedName(parsed.m);
    const partner = carriedName(parsed.p);
    return me && partner ? { me, partner } : null;
  } catch {
    return null;
  }
}

/**
 * Which slot each name lands in, once the person has said who they are. A
 * helper ("someone helping") is neither — nothing is filled. A slot the person
 * already typed in is never overwritten.
 */
export function seatCouple(
  role: 'bride' | 'groom' | 'helper' | string,
  couple: CoupleCarry | null,
  current: { brideFirstName: string; groomFirstName: string },
): { brideFirstName?: string; groomFirstName?: string } {
  if (!couple || (role !== 'bride' && role !== 'groom')) return {};
  const mine = role === 'bride' ? 'brideFirstName' : 'groomFirstName';
  const theirs = role === 'bride' ? 'groomFirstName' : 'brideFirstName';
  const out: { brideFirstName?: string; groomFirstName?: string } = {};
  if (!current[mine].trim()) out[mine] = couple.me;
  if (!current[theirs].trim()) out[theirs] = couple.partner;
  return out;
}

/**
 * "I'm the bride" / "I'm the groom" with no couple carried: the person's OWN slot starts filled from
 * their account name (owner 2026-11-08 — the forms that ask the signed-in person for their own name start
 * filled and stay editable). First word → first name, the rest → last name. The partner's slot is never
 * touched — never prefill another person's field with the account's data — and neither is a helper's,
 * nor a slot already typed in. Pure, so the rule is pinned by a test.
 */
export function seatSelf(
  role: 'bride' | 'groom' | 'helper' | string,
  selfName: string | null | undefined,
  current: { brideFirstName: string; groomFirstName: string; brideLastName: string; groomLastName: string },
): { brideFirstName?: string; groomFirstName?: string; brideLastName?: string; groomLastName?: string } {
  if (role !== 'bride' && role !== 'groom') return {};
  const words = (selfName ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || words[0]!.includes('@')) return {};
  const first = words[0]!.slice(0, 40);
  const last = words.slice(1).join(' ').slice(0, 60);
  const firstKey = role === 'bride' ? 'brideFirstName' : 'groomFirstName';
  const lastKey = role === 'bride' ? 'brideLastName' : 'groomLastName';
  const out: { brideFirstName?: string; groomFirstName?: string; brideLastName?: string; groomLastName?: string } = {};
  if (!current[firstKey].trim()) out[firstKey] = first;
  if (last && !current[lastKey].trim()) out[lastKey] = last;
  return out;
}
