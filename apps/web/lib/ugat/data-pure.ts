/**
 * lib/ugat/data-pure.ts — the pure, DB-free helpers used by the Ugat data layer.
 *
 * Split out of lib/ugat/data.ts (which is `server-only`) so the ranking logic
 * is unit-testable in the node test runner without pulling the server client.
 * It is also the ONLY Ugat module a `'use client'` component may import a VALUE
 * from — `data.ts` cannot be, and doing so fails the production build.
 */

/**
 * The Ugat console's entity tables — ONE list, and the type derives from it.
 *
 * 🔴 There used to be three hand-typed copies of these nine keys: the type
 * union, `TABLE_META` in ugat-console.tsx (which renders the tabs), and
 * `VALID_TABLES` in ugat/actions.ts (which authorises the fetch).
 * **`VALID_TABLES` had eight.** `communities` was missing, so the Samahan tab
 * rendered, and clicking it threw `Unknown table` — or left the previous
 * table's rows sitting under the Samahan heading, which is worse, because it
 * looks like data.
 *
 * A runtime tuple is the fix: the type is now DERIVED from the array, so adding
 * a table in one place is the only way to add it at all. Two lists that must
 * agree eventually disagree — this repo has paid for that with a status
 * vocabulary spelled 15 times under 6 names, and a ceremony list that reached
 * the database and not the schedule.
 *
 * 🔑 It lives HERE, not in `data.ts`, because the tabs are rendered by a
 * `'use client'` component. A value imported from a `server-only` module is a
 * build failure that no local typecheck or unit test can see — `tsc` is not a
 * bundler, so CI was the only thing that caught it. `lint-server-only-boundary`
 * now catches it in seconds instead.
 */
export const UGAT_TABLE_KEYS = [
  'users',
  'events',
  'guests',
  'vendors',
  'services',
  'orders',
  'threads',
  'billing',
  'communities',
] as const;

export type UgatTableKey = (typeof UGAT_TABLE_KEYS)[number];

/**
 * Pure ranking helper for the ⌘K omnibox — higher is better. Exact
 * (case-insensitive) match wins, then prefix, then contained, then per-token
 * overlap. Deterministic + side-effect free so search ordering is testable.
 */
export function scoreUgatMatch(haystack: string, query: string): number {
  const h = haystack.toLowerCase().trim();
  const q = query.toLowerCase().trim();
  if (!q || !h) return 0;
  if (h === q) return 100;
  if (h.startsWith(q)) return 70;
  if (h.includes(q)) return 45;
  let s = 0;
  for (const tok of q.split(/\s+/).filter((t) => t.length > 1)) {
    if (h.includes(tok)) s += 8;
  }
  return s;
}

/* ═══════════════════════════════════════════════════════════════════════════
   FINDING A GUEST BY NAME — the pure half.
   ═══════════════════════════════════════════════════════════════════════════
   Owner ruling 2026-08-27, asked directly whether an admin should be able to
   search any guest by name across every celebration: **YES** — pairing with
   "we must be able to find them and have our actions as admin available when
   we find them."

   These helpers are DB-free on purpose. The filter string they build is handed
   straight to PostgREST, so the escaping below is the only thing standing
   between a name like `Dela Cruz, Maria` and a filter that parses as something
   else entirely. A pure function is the only version of that a unit test can
   actually attack.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Make a raw human query safe to interpolate into a PostgREST `ilike` value.
 *
 * TWO different escaping jobs, and missing either one is silent:
 *
 * 1. **LIKE wildcards** (`%`, `_`, `\`) are escaped, so searching for `100%`
 *    looks for that text instead of matching every row. The shipped search
 *    already did this half.
 *
 * 2. **PostgREST filter structure** (`,` `(` `)` `"`) is replaced with a space.
 *    This half was MISSING and it is not cosmetic: `.or()` splits its clauses
 *    on commas, so a search for `Dela Cruz, Maria` produced a malformed filter,
 *    PostgREST rejected the WHOLE query, and the read resolved with an error
 *    and no rows. The console showed "No matches" — the exact shape this repo
 *    keeps paying for: REJECTED, NOT THROWN, and the only symptom is an
 *    absence. Stripping beats escaping here because these characters carry no
 *    meaning inside a name search anyway.
 */
export function sanitizeIlikeTerm(raw: string): string {
  return raw
    // Backslash first — doing it after would double-escape what we just added.
    .replace(/[\\%_]/g, (m) => '\\' + m)
    .replace(/[(),"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The `.or()` filter that finds a guest by name, or `null` when the query is
 * too short to be worth a round trip.
 *
 * 🔑 **THE COLUMNS ARE `first_name` + `last_name`, NOT `display_name`.**
 * Measured against production rather than assumed: 40 of 40 guest rows carry a
 * first AND last name; **`display_name` is populated on ZERO of them.** A
 * search written against the obvious-looking `display_name` — the column the
 * events, users and vendors arms all match on — would have compiled, passed
 * review, returned nothing for every guest who exists, and looked exactly like
 * a feature nobody uses. `display_name` is still searched, because it is the
 * override when somebody sets one; it is simply never searched ALONE.
 *
 * The `and(...)` pairs are what make a FULL name work. `first_name` and
 * `last_name` are separate columns, so "Maria Santos" matches neither on its
 * own — the owner typing somebody's whole name is the expected case, not an
 * edge one. Both orders are offered because "Santos Maria" is how half a guest
 * list gets written down.
 */
export function guestNameOrFilter(query: string): string | null {
  const cleaned = sanitizeIlikeTerm(query);
  if (cleaned.length < 2) return null;

  const whole = `%${cleaned}%`;
  const clauses = [
    `display_name.ilike.${whole}`,
    `first_name.ilike.${whole}`,
    `last_name.ilike.${whole}`,
  ];

  const tokens = cleaned.split(' ').filter(Boolean);
  if (tokens.length >= 2) {
    const head = tokens[0];
    const tail = tokens.slice(1).join(' ');
    clauses.push(`and(first_name.ilike.%${head}%,last_name.ilike.%${tail}%)`);
    clauses.push(`and(first_name.ilike.%${tail}%,last_name.ilike.%${head}%)`);
  }

  return clauses.join(',');
}

/** What a guest is called, preferring an explicit override over the parts. */
export function guestDisplayName(g: {
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): string {
  const explicit = (g.display_name ?? '').trim();
  if (explicit) return explicit;
  const joined = [(g.first_name ?? '').trim(), (g.last_name ?? '').trim()]
    .filter(Boolean)
    .join(' ');
  return joined || 'Guest';
}

/**
 * The four labels `guests.rsvp_status` can actually hold, read out of the live
 * enum (`pending · attending · declined · maybe`) rather than remembered. The
 * shipped tally elsewhere in this module also accepts `yes/confirmed/no/regrets`,
 * none of which that enum has ever contained.
 *
 * An UNRECOGNISED value returns itself rather than falling back to "No reply
 * yet". A future enum label must look wrong on screen instead of quietly
 * reading as though the guest never answered.
 */
const GUEST_RSVP_LABEL: Record<string, string> = {
  pending: 'No reply yet',
  attending: 'Attending',
  declined: 'Declined',
  maybe: 'Maybe',
};

export function guestRsvpLabel(raw: string | null | undefined): string {
  const key = (raw ?? '').trim().toLowerCase();
  if (!key) return 'No reply yet';
  return GUEST_RSVP_LABEL[key] ?? key;
}
