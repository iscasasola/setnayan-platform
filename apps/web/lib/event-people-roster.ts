/**
 * event-people-roster — one screen that answers "who is in my event?".
 *
 * ─── WHY IT EXISTS ────────────────────────────────────────────────────────
 * The answer was spread across five separate routes and never assembled: the
 * hosts and delegates on `/hosts`, the invited on `/guests`, hired helpers on
 * `/manpower`, the suppliers on `/vendors`, and whoever is holding a camera on
 * `/studio/papic/crew`. A couple could count each of those and nobody could
 * count them together.
 *
 * ⛔ THIS BUILDS ABOVE THEM, IT DOES NOT REPLACE THEM. Every group links into
 * the route that already owns it; nothing here duplicates an editor, a form or
 * a control. Rebuilding a working screen is the failure this repo pays for most.
 *
 * ⛔ ROSTER ONLY — no compose, no send, no recipient list anywhere in this
 * module. ⚠ THE REASON WAS WRONG WHEN THIS SHIPPED, AND THE RULE IS RIGHT.
 * This said messaging the guests was "an owner decision". It is not: the
 * announcement SHIPS and is live end to end — `coordinator-broadcast-card.tsx`
 * composes it on the couple's day-of screen, guests read it on the Event Hub
 * (`loadDayOfBroadcast` → `<DayOfAnnouncement>`), and only the couple or a
 * delegate holding `schedule: 'edit'` may write one, enforced by the
 * `coordinator_broadcasts` INSERT policy. So "may a coordinator nobody
 * promoted message all the guests?" was already answered — no, because
 * nobody promoted them.
 *
 * 🔑 THE ROSTER STILL HAS NO COMPOSE BOX, FOR A BETTER REASON: the composer
 * already has a home on the day-of screen, and a second one here would be a
 * second way to write the same row. A roster is for reading who is here.
 *
 * ─── TWO RULES THIS MODULE EXISTS TO HOLD ─────────────────────────────────
 *
 * 1 · A ROW YOU CANNOT OPEN IS A DEAD END. Each of those five routes enforces
 *     its own rule — three are couple-only, and two admit a delegate only for
 *     the matching area. Listing a group to somebody the route will redirect
 *     shows them a control that refuses them, which reads as a broken product.
 *     So a group the viewer cannot open is not listed at all. Visibility here
 *     MIRRORS each route's own gate; it never widens one, and every route keeps
 *     its own check.
 *
 * 2 · AN UNREAD COUNT IS NOT ZERO. A refused or failed Supabase read resolves
 *     with `{ error }` and no rows — identical to an empty event. On a roster
 *     that difference is the whole message: "no guests yet" invites the couple
 *     to add some; "we couldn't count them" tells them the list is fine and the
 *     screen is not. `null` therefore travels all the way to the copy, and this
 *     module refuses to fold it into 0 anywhere. It also means the headline
 *     total says how many groups it could not reach, rather than quietly
 *     understating the number of people at somebody's wedding.
 */
import { resolveAreaLevel, type ModeratorPermissions } from './delegate-areas';

/** The five groups, in the order a host thinks about them. */
export type PeopleGroupKey = 'hosts' | 'guests' | 'suppliers' | 'helpers' | 'photo_crew';

export type PeopleGroup = {
  key: PeopleGroupKey;
  /** What this group is called on screen — plain words, never a table name. */
  label: string;
  /** One line saying who is in it. */
  blurb: string;
  /** The route that already owns this group. */
  href: string;
  /** How many are in it — or null when the read did not answer. NEVER 0 for a
   *  failed read; see rule 2 in the module doc. */
  count: number | null;
};

/** Who is asking, resolved by the page from the caller's own rows. */
export type PeopleViewer = {
  /** A `couple` member of this event. */
  isCouple: boolean;
  /** Their accepted delegate grant, or null when they hold none. */
  delegatePermissions: ModeratorPermissions | null;
};

/**
 * Which groups may this viewer open?
 *
 * Each answer restates the gate the destination route already applies:
 *   · `/hosts`               — any host, couple or accepted delegate
 *   · `/guests`              — couple, or a delegate holding `guest_list`
 *   · `/vendors`             — couple, or a delegate holding `vendors`
 *   · `/manpower`            — couple only (its own redirect)
 *   · `/studio/papic/crew`   — couple only (its own redirect)
 *
 * ⚠ `resolveAreaLevel`'s tail FAILS OPEN for an area it does not name, so this
 * function must only ever pass area names that function answers explicitly.
 * `guest_list` and `vendors` are both in its explicit list. Read
 * `lib/delegate-areas.ts` before adding a third.
 */
export function visibleGroupKeys(viewer: PeopleViewer): ReadonlySet<PeopleGroupKey> {
  const keys = new Set<PeopleGroupKey>();
  const { isCouple, delegatePermissions } = viewer;
  const isDelegate = delegatePermissions !== null;

  // Anybody the event admits at all is a host of some kind, and /hosts is where
  // they see who else is helping — including themselves.
  if (isCouple || isDelegate) keys.add('hosts');

  if (isCouple) {
    keys.add('guests');
    keys.add('suppliers');
    keys.add('helpers');
    keys.add('photo_crew');
    return keys;
  }

  if (!isDelegate) return keys;
  if (resolveAreaLevel(delegatePermissions, 'guest_list') !== null) keys.add('guests');
  if (resolveAreaLevel(delegatePermissions, 'vendors') !== null) keys.add('suppliers');
  // `helpers` and `photo_crew` are deliberately absent: both routes redirect a
  // delegate, and neither has a delegate area to consult. Adding them here
  // would be inventing a permission rather than mirroring one.
  return keys;
}

/** How a single group's count reads. */
export function groupCountLabel(count: number | null, noun: string, pluralNoun: string): string {
  // ⚠ Not "0" and not "none" — we did not look and must not imply we did.
  if (count === null) return `Couldn’t count them just now`;
  if (count === 0) return `No ${pluralNoun} yet`;
  return `${count.toLocaleString('en-PH')} ${count === 1 ? noun : pluralNoun}`;
}

export type RosterTotal = {
  /** The sum of every group that ANSWERED. */
  total: number;
  /** How many of the listed groups could not be counted. */
  unmeasured: number;
};

export function rosterTotal(groups: readonly PeopleGroup[]): RosterTotal {
  let total = 0;
  let unmeasured = 0;
  for (const g of groups) {
    if (g.count === null) unmeasured += 1;
    else total += g.count;
  }
  return { total, unmeasured };
}

/**
 * The headline sentence.
 *
 * 🔑 IT NAMES WHAT IT COULD NOT SEE. A total quietly missing a whole group is
 * worse than no total: the couple would read a confident number and plan around
 * it. When something is unmeasured the sentence says so, in words, on the same
 * line as the figure.
 */
export function rosterHeadline(groups: readonly PeopleGroup[]): string {
  if (groups.length === 0) {
    return 'Nothing here is shared with you yet.';
  }
  const { total, unmeasured } = rosterTotal(groups);
  if (unmeasured === groups.length) {
    return 'We couldn’t load anyone just now — nobody has been removed.';
  }
  const head = total === 1 ? '1 person so far' : `${total.toLocaleString('en-PH')} people so far`;
  if (unmeasured === 0) return head;
  return `${head}, and ${unmeasured === 1 ? 'one group' : `${unmeasured} groups`} we couldn’t count`;
}

/** Copy for each group, kept beside the rule that decides whether it shows. */
export const PEOPLE_GROUP_COPY: Readonly<
  Record<PeopleGroupKey, { label: string; blurb: string; noun: string; pluralNoun: string; path: string }>
> = {
  hosts: {
    label: 'Running the day with you',
    blurb: 'Co-hosts and helpers you gave access to.',
    noun: 'person',
    pluralNoun: 'people',
    path: 'hosts',
  },
  guests: {
    label: 'Invited',
    blurb: 'Everyone on your guest list.',
    noun: 'guest',
    pluralNoun: 'guests',
    path: 'guests',
  },
  suppliers: {
    label: 'Booked to be there',
    blurb: 'The suppliers you have locked in.',
    noun: 'supplier',
    pluralNoun: 'suppliers',
    path: 'vendors',
  },
  helpers: {
    label: 'Hired to help',
    blurb: 'Short jobs you posted for the day.',
    noun: 'job',
    pluralNoun: 'jobs',
    path: 'manpower',
  },
  photo_crew: {
    label: 'Holding a camera',
    blurb: 'Friends and family shooting your photos.',
    noun: 'camera',
    pluralNoun: 'cameras',
    path: 'studio/papic/crew',
  },
};

/** Build one group's model. Pure, so the ordering and copy are testable. */
export function buildPeopleGroups(
  eventId: string,
  viewer: PeopleViewer,
  counts: Readonly<Partial<Record<PeopleGroupKey, number | null>>>,
): PeopleGroup[] {
  const visible = visibleGroupKeys(viewer);
  const ORDER: readonly PeopleGroupKey[] = ['hosts', 'guests', 'suppliers', 'helpers', 'photo_crew'];
  return ORDER.filter((k) => visible.has(k)).map((key) => {
    const copy = PEOPLE_GROUP_COPY[key];
    return {
      key,
      label: copy.label,
      blurb: copy.blurb,
      href: `/dashboard/${encodeURIComponent(eventId)}/${copy.path}`,
      // `undefined` (never asked, because the group is not visible) and `null`
      // (asked and refused) must not be confused — an absent key here means the
      // page did not run that read at all, which is still "not counted".
      count: counts[key] ?? null,
    };
  });
}
