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
import { sanitizeName } from '@/lib/typed-names';

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
  selfName: SelfName,
  current: { brideFirstName: string; groomFirstName: string; brideLastName: string; groomLastName: string },
): { brideFirstName?: string; groomFirstName?: string; brideLastName?: string; groomLastName?: string } {
  if (role !== 'bride' && role !== 'groom') return {};
  const self = splitSelfName(selfName);
  if (!self) return {};
  const { first: firstKey, last: lastKey } = SIDE_KEYS[role];
  const out: { brideFirstName?: string; groomFirstName?: string; brideLastName?: string; groomLastName?: string } = {};
  if (!current[firstKey].trim()) out[firstKey] = self.first;
  if (self.last && !current[lastKey].trim()) out[lastKey] = self.last;
  return out;
}

type CoupleNames = { brideFirstName: string; groomFirstName: string; brideLastName: string; groomLastName: string };

const SIDE_KEYS = {
  bride: { first: 'brideFirstName', last: 'brideLastName' },
  groom: { first: 'groomFirstName', last: 'groomLastName' },
} as const;

/**
 * Who the signed-in person is, as the account holds it: the display name (one string), or the formal
 * first + last (`users.first_name` / `last_name`) with the display name as the fallback. One type for
 * every "which one is you" seat, so there is still ONE prefill path (`seatSelf` / `moveSelf`).
 */
export type SelfName =
  | string
  | { first: string | null; last: string | null; display: string | null }
  | null
  | undefined;

/**
 * The account name as the two name fields hold it — first word → first name, the rest → last name,
 * through the same letters-only rule the fields apply as typed (`sanitizeName`), so a seated value and a
 * typed value are compared like for like. Null for no name or an email local-part.
 */
export function splitSelfName(selfName: SelfName): { first: string; last: string } | null {
  // The account's FORMAL name, when it has one (`users.first_name` / `last_name`, Profile & settings) —
  // taken as it is written, so "Maria Clara" + "dela Cruz" never splits on the first space (Lane P,
  // 10 Nov: "It asked me who i am and it did not fill it up").
  if (selfName && typeof selfName === 'object') {
    const first = sanitizeName((selfName.first ?? '').trim().slice(0, 40)).trim();
    const last = sanitizeName((selfName.last ?? '').trim().slice(0, 60)).trim();
    if (first && !first.includes('@')) return { first, last };
    return splitSelfName(selfName.display ?? null);
  }
  const words = (selfName ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0 || words[0]!.includes('@')) return null;
  const first = sanitizeName(words[0]!.slice(0, 40)).trim();
  const last = sanitizeName(words.slice(1).join(' ').slice(0, 60)).trim();
  return first ? { first, last } : null;
}

/**
 * "Which one is you?" — picked, or picked AGAIN (owner 2026-11-08, verbatim: *"yes. they need to be one
 * of the 2."*). The account name MOVES with the pick:
 *   · it leaves the row that is no longer yours — but only where that row still holds exactly the
 *     account name (the untouched prefill); anything the person typed or edited stays where it is;
 *   · it lands in your row only where that row is empty — typed text is never overwritten.
 * So the partner's row never keeps the account's name, and nothing typed is ever lost. Pure, so the rule
 * is pinned by a test (`lib/onboarding/w-names-asks-which-one-is-you.test.ts`).
 */
export function moveSelf(
  prev: 'bride' | 'groom' | 'helper' | string | null,
  next: 'bride' | 'groom' | 'helper' | string,
  selfName: SelfName,
  current: CoupleNames,
): Partial<CoupleNames> {
  const self = splitSelfName(selfName);
  if (!self) return {};
  const names: CoupleNames = { ...current };
  const out: Partial<CoupleNames> = {};
  if ((prev === 'bride' || prev === 'groom') && prev !== next) {
    const { first, last } = SIDE_KEYS[prev];
    if (names[first].trim() === self.first) out[first] = names[first] = '';
    if (self.last && names[last].trim() === self.last) out[last] = names[last] = '';
  }
  return { ...out, ...seatSelf(next, selfName, names) };
}
