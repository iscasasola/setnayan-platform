/**
 * event-for-whom.ts — WHO an event is for, as STORED on the event (`events.for_whom`).
 *
 * ⚖ OWNER, 2026-11-23 (specs DECISION_LOG "Free booking fee only on 'For you' events, locked once a supplier
 * joins"): *"you can only get free booking fee if the event is for self (you are the celebrant) once a supplier comes
 * in, it is locked that way."* So the "For ▾" answer every create path already asks is now KEPT on the event:
 *
 *   · `self`     — the account that made the event is its celebrant (the shipped self-celebrant lock,
 *                  app/_components/self-celebrant-lock.tsx). The ONLY answer on which a booking fee may be waived.
 *   · `someone` · `memorial` · `business` — made for someone else. Every free path charges.
 *   · NULL       — never recorded (events made before 23 Nov that are not weddings). Charges: the free paths fail
 *                  toward the fee.
 *
 * The words are `FOR_WHOM_MODES` (lib/create-subjects.ts, the same four words `event_type_vocab.for_whom` uses) —
 * no second vocabulary. The SQL reader is `public.booking_fee_event_is_for_you` (migration 20271360986087); this file
 * is its twin, and `tests/db/free-fee-only-for-you-events.db.test.ts` fails the moment they disagree.
 *
 * 🔒 LOCKED ONCE A SUPPLIER JOINS: the `events_for_whom_locked` trigger refuses any change to the column once an
 * `event_vendors` row exists — for every role, the service role included. No screen offers a change after create, and
 * `authenticated` holds no grant on the column, so the trigger is the last word for every writer.
 *
 * Pure, no I/O — the create actions (server) and the tests import it.
 */
import { FOR_WHOM_MODES, type ForWhomMode } from './create-subjects';

/** Parse a stored / posted value. Anything that is not one of the four words is null (never recorded). */
export function readForWhom(raw: unknown): ForWhomMode | null {
  return typeof raw === 'string' && (FOR_WHOM_MODES as readonly string[]).includes(raw) ? (raw as ForWhomMode) : null;
}

/** Twin of `public.booking_fee_event_is_for_you`: true ONLY for a stored `'self'`. */
export function isForYouEvent(forWhom: unknown): boolean {
  return forWhom === 'self';
}

/**
 * The answer a create path STORES, from what its form posted plus the honoree it is about to write.
 *
 * "For you" is believed only when the event names nobody else: a blank honoree is the account holder's own slot
 * (lib/onboarding/honoree-handoff.ts), so `'self'` beside a typed name, a linked alaga or a group is a contradiction
 * and is stored as `'someone'` — toward the fee, never away from it. A claim of "someone else" is always taken as said.
 */
export function forWhomToStore(args: {
  /** The posted "For ▾" word (`for_whom` field), or null when the form sent none. */
  claimed: unknown;
  honoreeLabel: string | null | undefined;
  honoreeDependentId: string | null | undefined;
  communityId?: string | null;
}): ForWhomMode | null {
  const claimed = readForWhom(args.claimed);
  if (claimed !== 'self') return claimed;
  const namesSomeone =
    Boolean(args.honoreeLabel?.trim()) || Boolean(args.honoreeDependentId?.trim()) || Boolean(args.communityId?.trim());
  return namesSomeone ? 'someone' : 'self';
}

/**
 * A wedding's answer is the role its creator picked on "Which one is you?" (the shipped `role`, also written to
 * `event_moderators.role_subtype`): the bride or the groom is the celebrant; a helper is planning it for someone
 * else; no pick is not recorded. The migration backfilled existing weddings with exactly this mapping.
 */
export function forWhomForWeddingRole(role: 'bride' | 'groom' | 'helper' | null | undefined): ForWhomMode | null {
  if (role === 'bride' || role === 'groom') return 'self';
  if (role === 'helper') return 'someone';
  return null;
}
