'use server';

/**
 * people-add-actions.ts — putting people you already know onto this guest list.
 *
 * Owner, 2026-08-21: *"we want them to be able to add people from the people's
 * list as well and not just names."*
 *
 * The candidates and every privacy decision behind them live in
 * `lib/people-you-can-invite.ts` — read its header before changing anything
 * here, especially the note about `couple_writes_guest` carrying
 * `OR is_admin()`.
 *
 * ── THE INSERT IS NOT A NEW ONE ───────────────────────────────────────────
 * Each pick goes through `quickAddGuest`, the canonical single-add. That is
 * deliberate and it is the same reason `inline-actions.ts` gives: the names
 * check, the side check, the event's offered-role set, the post-finalize lock
 * and the friendly single-bride/single-groom message all live there, and a
 * second insert path is a second place for them to drift softer. The only
 * thing this file adds is the loop and the address.
 *
 * ── ⛔ THE CLIENT NEVER NAMES A PERSON ────────────────────────────────────
 * No `person_id` crosses this boundary in either direction. A host may say
 * "this name, at this address"; the `set_guest_person` trigger decides which
 * person node that is. Letting the browser post a `person_id` would let a
 * couple bind a stranger's identity to their event — the `row is yours, the
 * field is not` family, and the picker has no need of it.
 *
 * ── PARTIAL SUCCESS IS REPORTED, NOT SWALLOWED ────────────────────────────
 * Ten picks where the eighth trips the single-bride rule must not read as
 * "nothing happened" — nine of them DID happen. The result carries what landed
 * and the first real reason the rest did not, and the sheet says both.
 */

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { getPeopleYouCanInvite } from '@/lib/people-you-can-invite';
import { quickAddGuest } from './quick-add-actions';
import type { GuestSide } from '@/lib/guests';

const SIDE_VALUES: GuestSide[] = ['bride', 'groom', 'both'];

/** How many people one press may add. The number is unchanged; what changed is
 *  that going past it is now REPORTED rather than dropped in silence. */
const MAX_PICKS_PER_ADD = 200;

export type PeoplePick = {
  /** The `key` from `getPeopleYouCanInvite` — the only handle the client holds. */
  key: string;
  /** Supplied by the host ONLY for a one-word name the source could not split.
   *  Ignored whenever the server already knows a surname. */
  lastName?: string;
};

export type AddFromPeopleResult =
  | { ok: true; added: number; failed: number; firstError: string | null }
  | { ok: false; error: string };

export async function addGuestsFromPeople(
  eventId: string,
  picks: PeoplePick[],
  side: GuestSide,
): Promise<AddFromPeopleResult> {
  if (!eventId) return { ok: false, error: 'Missing event.' };
  if (!Array.isArray(picks) || picks.length === 0) {
    return { ok: false, error: 'Pick at least one person.' };
  }
  if (!SIDE_VALUES.includes(side)) return { ok: false, error: 'Pick a side first.' };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'Your session expired — sign in again.' };

  /*
    🔒 THE CANDIDATE LIST IS REBUILT SERVER-SIDE AND THE POSTED KEYS ARE LOOKED
    UP IN IT. The client sends keys, never names or addresses — so a forged or
    stale key finds nothing and is skipped, and there is no way to post a name
    at an address the host was never offered. This read is also what applies
    the couple-scoped `.in(event_ids)` fence a second time, on the write path.
  */
  const { people } = await getPeopleYouCanInvite(eventId, user.id);
  const byKey = new Map(people.map((p) => [p.key, p]));

  let added = 0;
  let failed = 0;
  let firstError: string | null = null;

  /*
    🪤 THE CAP USED TO DROP THE OVERFLOW IN SILENCE. `picks.slice(0, 200)` has
    always been here, and `failed` was only ever incremented INSIDE the loop —
    so picks 201..N were neither added nor counted, and the call returned
    `{ added: 200, failed: 0, firstError: null }`. The sheet only speaks when
    `failed` is non-zero, so it closed as if everything had worked: 140 people
    simply not invited, and the first anybody hears of it is a relative who
    never got their invitation.
    It became reachable in one tap on 2026-08-25, when a "Choose all N shown"
    control landed on a list that reads up to 500 candidates. NO SILENT CAPS —
    the overflow is counted and named.
  */
  const overflow = Math.max(0, picks.length - MAX_PICKS_PER_ADD);
  if (overflow > 0) {
    failed += overflow;
    firstError =
      `Only ${MAX_PICKS_PER_ADD} can go on at once — ${overflow} were not added. ` +
      'Add the rest in a second batch.';
  }

  for (const pick of picks.slice(0, MAX_PICKS_PER_ADD)) {
    const person = byKey.get(pick?.key ?? '');
    if (!person || person.alreadyHere) {
      failed += 1;
      firstError ??= 'Some of those were already on your list.';
      continue;
    }
    // The surname the SOURCE knows always wins; the typed one is only ever the
    // missing half of a one-word name.
    const last = person.lastName || (pick.lastName ?? '').trim();
    if (!last) {
      failed += 1;
      firstError ??= `${person.name} needs a last name.`;
      continue;
    }
    const res = await quickAddGuest(eventId, {
      first_name: person.firstName,
      last_name: last,
      side,
      role: 'guest',
      email: person.email,
    });
    if (res.ok) {
      added += 1;
    } else {
      failed += 1;
      firstError ??= res.error;
    }
  }

  if (added > 0) revalidatePath(`/dashboard/${eventId}/guests`);
  if (added === 0) {
    return { ok: false, error: firstError ?? 'Couldn’t add anybody just now.' };
  }
  return { ok: true, added, failed, firstError };
}

/**
 * The sheet's read, fetched ON OPEN rather than rendered into the page.
 *
 * The guest list is the most-loaded screen in a couple's dashboard and this
 * picker is a menu item behind a `⋯`. Serving its four queries to everybody who
 * looks at their guest list would be four reads per page view to answer a
 * question almost nobody asked yet.
 *
 * Returns the display shape only — `key`, the names, where they are known
 * from, and whether they are already here. **The email is stripped**: the
 * client has no use for it, the add path re-reads it server-side from the same
 * function, and an address that never reaches a browser cannot leak from one.
 */
export async function listPeopleYouCanInvite(eventId: string): Promise<{
  people: Array<{
    key: string;
    name: string;
    /** Empty means we only know one word and the row must ask for the rest. */
    lastName: string;
    from: string;
    source: 'event' | 'people' | 'samahan';
    alreadyHere: boolean;
    /** Every samahan this person is in — what the group chips filter on. The
     *  `from` line shows at most one and is not a membership fact. */
    groups: string[];
  }>;
  partial: boolean;
}> {
  const user = await getCurrentUser();
  if (!user || !eventId) return { people: [], partial: false };
  const { people, partial } = await getPeopleYouCanInvite(eventId, user.id);
  return {
    people: people.map((p) => ({
      key: p.key,
      name: p.name,
      lastName: p.lastName,
      from: p.from,
      source: p.source,
      alreadyHere: p.alreadyHere,
      groups: p.groups ?? [],
    })),
    partial,
  };
}
