/**
 * 🔒 "UNLIMITED" = ONE REGISTERED BUSINESS — the words and the decision.
 *
 * ⚖ OWNER, 2026-11-22 (DECISION_LOG "SUPPLIER PLAN ANTI-ABUSE RULES LOCKED", owner: "Lock all three"; build spec
 * SUPPLIER_SUBSCRIPTIONS_BUILD_SPEC_2026-11-22 § ★ I): Pro and Ultra give unlimited cards, people and branches for ONE
 * registered business (one DTI/SEC number) and its own staff.
 *   · one verified shop per registration number;
 *   · every branch carries the shop's DTI/SEC registration number (a branch has none of its own);
 *   · one shop per person (`vendor_profiles.user_id` is UNIQUE — one account, one shop).
 *
 * The rule itself lives in the database (migration 20271359913146): `registration_number_verified_holder` is the ONE
 * predicate, and two triggers refuse the write. This module is PURE (no database): the plain sentences people read and
 * the small decision the server takes before it writes, so an approval never half-writes. The server half is
 * `lib/one-registered-business.server.ts`.
 */

/** The check the database answers before an approval: who else is verified under this shop's number. */
export type VerifiedElsewhere =
  /** No other real shop is verified under this number (or this shop has no number). */
  | { kind: 'clear' }
  /** Another real shop is already verified under this number. */
  | { kind: 'held'; holderId: string; holderName: string | null }
  /** The check could not run — never read as "clear" (fail closed). */
  | { kind: 'unreadable' };

/** The constraint names the two triggers raise with — how a refusal is recognised. */
export const ONE_VERIFIED_SHOP_CONSTRAINT = 'vendor_profiles_one_verified_per_registration';
export const BRANCH_CARRIES_REGISTRATION_CONSTRAINT = 'vendor_branches_carry_shop_registration';

/** The admin's sentence when an approval is refused. Names the shop that holds the number so both can be opened. */
export function oneVerifiedShopRefusal(holderName: string | null): string {
  const holder = holderName?.trim() ? `“${holderName.trim()}”` : 'another shop';
  return (
    `This registration number already belongs to ${holder}, which is verified. ` +
    'One registered business has one verified shop — nothing was changed. ' +
    'More places for the same business are added as branches of that shop.'
  );
}

/** When the check itself could not run: the approval waits, nothing is written. */
export const VERIFIED_ELSEWHERE_UNREADABLE =
  "Couldn't check whether another verified shop holds this registration number — nothing was changed. Try again.";

/** The supplier's sentence when a branch is refused because the shop holds no registration number yet. */
export const BRANCH_NEEDS_REGISTRATION_MESSAGE =
  'A branch carries your shop’s DTI or SEC registration number, and your shop has none yet. ' +
  'Send your papers on Shop first, then add the branch.';

/** When the shop's number could not be read for a branch: no branch is added. */
export const BRANCH_REGISTRATION_UNREADABLE =
  "Couldn't check your shop's registration number just now — no branch was added. Try again.";

/**
 * Should an approval that would make this shop verified be refused? Returns the sentence, or `null` to go on.
 *
 * A shop that is ALREADY verified is never refused (a renewal re-approval, or a pair verified before 22 Nov 2026):
 * nothing already given is taken back — the trigger reads the same way. Everything else asks the check; an unread
 * check refuses (fail closed).
 */
export function approvalRefusal(fromState: string | null | undefined, check: VerifiedElsewhere): string | null {
  if (fromState === 'verified') return null;
  if (check.kind === 'clear') return null;
  if (check.kind === 'held') return oneVerifiedShopRefusal(check.holderName);
  return VERIFIED_ELSEWHERE_UNREADABLE;
}

/** Did the database refuse a write under one of these two rules? (errcode 23514 + the trigger's constraint name.) */
export function isOneRegisteredBusinessRefusal(error: unknown): 'verified_elsewhere' | 'branch_needs_registration' | null {
  if (!error || typeof error !== 'object') return null;
  const e = error as { code?: unknown; message?: unknown; details?: unknown; constraint?: unknown };
  if (e.code !== '23514') return null;
  const text = [e.constraint, e.message, e.details].filter((v) => typeof v === 'string').join(' ');
  if (text.includes(ONE_VERIFIED_SHOP_CONSTRAINT) || /already belongs to another verified shop/i.test(text)) {
    return 'verified_elsewhere';
  }
  if (text.includes(BRANCH_CARRIES_REGISTRATION_CONSTRAINT) || /branch carries its shop/i.test(text)) {
    return 'branch_needs_registration';
  }
  return null;
}
