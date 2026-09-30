/**
 * apps/web/lib/find-me.ts
 *
 * 🔎 THE GENERIC QR FINDS YOU (owner, DECISION_LOG 2026-09-30 — amends
 * 2026-09-26 "NOBODY WITHOUT A KEY GETS INSIDE" and 2026-09-29 "A GUEST ACCEPTED
 * FROM THE GENERIC LINK…"). Owner, verbatim: *"if they write it correctly, say
 * we found you first"* · *"if there is a mobile number then add that security.
 * if not then dont"*.
 *
 * Only on an "Anyone, I approve" event (the generic QR). The person types their
 * name in the five boxes and the server looks for EXACTLY that person on the
 * couple's list:
 *
 *   · one match WITH a mobile on file → "We found you!" asks the last 4 digits
 *     of that mobile → correct = in as that guest, through the SAME redeem hop
 *     their personal QR takes (`app/[slug]/redeem/route.ts`);
 *   · one match with NO mobile, or more than one match → "We found you! Your
 *     hosts will confirm it's you." → an ordinary request, which the Requests
 *     page shows pre-matched (`exactNameMatches` below) so the couple taps Link;
 *   · no match → the ask-to-join form, unchanged.
 *
 * 🔒 WHAT MAY BE MATCHED (`isFindable`): a row the COUPLE put on the list
 * (`host_seeded`), not removed, not marked passed away, not a couple seat
 * (bride · groom · celebrant, primary OR extra role — lib/seat-binding.ts), and
 * not already held by an account (that person signs in). A pending REQUEST is
 * never matchable: otherwise anyone could ask to join under a guest's name with
 * their OWN mobile, then "find" that request and walk in past the couple.
 *
 * 🔒 NOTHING BEFORE THE CHECK. This module returns ids and a verdict, never a
 * detail: no digit of the mobile, no +N, no outfit. The screens say only
 * "We found you!" — the one reveal the owner approved.
 *
 * Pure — no I/O — so the rules carry a unit suite (find-me.test.ts).
 */
import { timingSafeEqual } from 'node:crypto';
import { normalizeName } from '@/lib/guest-claim-core';
import { isCoupleSeat } from '@/lib/seat-binding';
import type { FormalName } from '@/lib/formal-name';

/** Wrong-digit budget per matched guest (every IP together) — owner example, "5 tries / 15 min". */
export const FIND_ME_ROW_LIMIT = 5;
/**
 * Wrong-digit budget per event per connection. A little wider than the row's:
 * a reception is often ONE shared Wi-Fi address, and running out here only
 * sends a real guest to the couple's Link (never a lock-out).
 */
export const FIND_ME_IP_LIMIT = 10;
/** Name look-ups per event per connection before the door stops looking (it then just shows the form). */
export const FIND_ME_NAME_LIMIT = 20;
/** One window for all three budgets — 15 minutes. */
export const FIND_ME_WINDOW_SECS = 15 * 60;

/** The parts of a name that are compared. Prefix is never compared ("Mr." vs "Atty." is not identity). */
export type FindableName = Pick<FormalName, 'first_name' | 'middle_name' | 'last_name' | 'name_suffix'>;

export type FindableRow = {
  guest_id: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  name_suffix: string | null;
  role: string | null;
  extra_roles: readonly (string | null)[] | null;
  entry_source: string | null;
  deleted_at: string | null;
  passed_away?: boolean | null;
  mobile: string | null;
  qr_token: string | null;
};

const norm = (s: string | null | undefined): string => normalizeName(s ?? '');

/**
 * EXACT name match (normalized: case, spacing, accents and punctuation do not
 * count). First and Last are required and must equal the row's. Middle and
 * Suffix, when TYPED, must equal the row's too; left blank they are not
 * compared. Prefix is never compared.
 */
export function namesMatchExactly(typed: FindableName, row: FindableName): boolean {
  const first = norm(typed.first_name);
  const last = norm(typed.last_name);
  if (!first || !last) return false;
  if (first !== norm(row.first_name) || last !== norm(row.last_name)) return false;
  const middle = norm(typed.middle_name);
  if (middle && middle !== norm(row.middle_name)) return false;
  const suffix = norm(typed.name_suffix);
  if (suffix && suffix !== norm(row.name_suffix)) return false;
  return true;
}

/** May this row be found by a typed name on the generic QR? See the header. */
export function isFindable(row: FindableRow, boundGuestIds: ReadonlySet<string>): boolean {
  if (row.entry_source !== 'host_seeded') return false;
  if (row.deleted_at) return false;
  if (row.passed_away) return false;
  if (isCoupleSeat(row.role, row.extra_roles)) return false;
  if (boundGuestIds.has(row.guest_id)) return false;
  return true;
}

/**
 * The last four digits of a mobile on file, or NULL when there is no real
 * number to ask about (fewer than 7 digits — the last 4 would be most of it).
 */
export function lastFourOf(mobile: string | null | undefined): string | null {
  const digits = (mobile ?? '').replace(/\D/g, '');
  return digits.length >= 7 ? digits.slice(-4) : null;
}

/** Exactly four digits typed (spaces/dashes ignored), else NULL. */
export function readTypedLastFour(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/[\s-]/g, '');
  return /^\d{4}$/.test(digits) ? digits : null;
}

/** Constant-time: does the typed last-4 equal the one on file? */
export function lastFourMatches(mobile: string | null | undefined, typed: string | null): boolean {
  const onFile = lastFourOf(mobile);
  if (!onFile || !typed || typed.length !== 4) return false;
  return timingSafeEqual(Buffer.from(onFile), Buffer.from(typed));
}

export type FindOutcome =
  | { kind: 'none' }
  /** One findable match with a mobile — ask the last 4. */
  | { kind: 'digits'; guestId: string }
  /** One match with no mobile (guestId), or several (null) — the couple confirms. */
  | { kind: 'confirm'; guestId: string | null };

/** Every findable row whose name matches exactly. */
export function exactNameMatches<R extends FindableRow>(
  typed: FindableName,
  rows: readonly R[],
  boundGuestIds: ReadonlySet<string>,
): R[] {
  return rows.filter((r) => isFindable(r, boundGuestIds) && namesMatchExactly(typed, r));
}

/** The verdict for a typed name. Several matches are treated as the no-mobile case. */
export function findOutcome(
  typed: FindableName,
  rows: readonly FindableRow[],
  boundGuestIds: ReadonlySet<string>,
): FindOutcome {
  const hits = exactNameMatches(typed, rows, boundGuestIds);
  if (hits.length === 0) return { kind: 'none' };
  if (hits.length > 1) return { kind: 'confirm', guestId: null };
  const hit = hits[0]!;
  if (lastFourOf(hit.mobile) && hit.qr_token) return { kind: 'digits', guestId: hit.guest_id };
  return { kind: 'confirm', guestId: hit.guest_id };
}

/**
 * THE PRE-MATCH on Guest List → Requests: the one guest on the list whose name
 * a request's name matches EXACTLY (same rule as the door). NULL when none or
 * several — the page then falls back to its fuzzy suggestion.
 */
export function preMatchFor<C extends { guest_id: string } & FindableName>(
  request: FindableName,
  candidates: readonly C[],
): C | null {
  const hits = candidates.filter((c) => namesMatchExactly(request, c));
  return hits.length === 1 ? hits[0]! : null;
}
