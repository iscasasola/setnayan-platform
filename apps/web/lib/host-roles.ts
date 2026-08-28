/**
 * host-roles.ts — WHICH host roles an event type actually has (Overview Phase 5).
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────────
 * The 13 host roles shipped with the multi-host invite system are, with two
 * exceptions, entirely WEDDING-shaped: bride, groom, parent_of_bride,
 * maid_of_honor, best_man, ninong, ninang, wedding_planner_external. The picker
 * in `hosts/page.tsx` iterated all 13 for all 16 event types, so a birthday
 * host adding their sister chose between "Maid of honor" and "Best man", and a
 * corporate organiser was offered "Parent of the bride". The only two that fit
 * every event — family_helper and viewer — sat at the bottom of a list of
 * eleven that did not.
 *
 * This is the same breadth gap the council verdict logged against the category
 * ladder (`plan-groups-by-event-type.ts`), and it is deliberately built in the
 * same shape, including the fail-open posture — see below.
 *
 * ── WHY THIS MODULE IS PURE ──────────────────────────────────────────────────
 * `event-moderators.ts` is `server-only` (it holds Supabase helpers and token
 * minting). The role VOCABULARY is neither server nor client business, so it
 * lives here with no imports at all and can be unit-tested directly — the same
 * reasoning that already split `delegate-areas.ts` out of that file. The
 * server module re-exports these names, so every existing consumer is
 * unchanged.
 *
 * ── FAIL-OPEN, DELIBERATELY ──────────────────────────────────────────────────
 * An event type this map has never heard of gets EVERY role. The cost of
 * wrongly offering a role is a slightly odd dropdown entry; the cost of wrongly
 * withholding one is a bride who cannot be recorded as the bride, on a list
 * whose whole job is recording who is who. When a new event type is added to
 * `event_type_vocab` and nobody remembers this file, the picker degrades to
 * "too many options", never to "the option you need is missing".
 *
 * ⚠ Adding a value here is NOT enough on its own: `event_moderators.role_subtype`
 * carries a CHECK constraint listing the legal strings. Widen both together or
 * the invite is REJECTED BY THE DATABASE and the host is shown a generic
 * failure — the constraint has no idea what the dropdown offered.
 * `host-roles-check-constraint.db.test.ts` fails if the two ever disagree.
 */

/**
 * Every legal `event_moderators.role_subtype`.
 *
 * The first 13 are the original wedding set and their order is preserved so the
 * wedding picker reads exactly as it always has. The last four are the generic
 * roles that let a non-wedding event describe itself at all.
 */
export const ROLE_SUBTYPES = [
  'bride',
  'groom',
  'partner1',
  'partner2',
  'parent_of_bride',
  'parent_of_groom',
  'maid_of_honor',
  'best_man',
  'wedding_planner_external',
  'ninong',
  'ninang',
  'family_helper',
  'viewer',
  // ── Phase 5 additions — generic across the other 15 event types ──────────
  'celebrant',
  'parent',
  'host',
  'co_host',
] as const;

export type RoleSubtype = (typeof ROLE_SUBTYPES)[number];

export function isRoleSubtype(value: unknown): value is RoleSubtype {
  return typeof value === 'string' && (ROLE_SUBTYPES as readonly string[]).includes(value);
}

/** Roles that make sense at literally any gathering. */
const UNIVERSAL: readonly RoleSubtype[] = ['family_helper', 'viewer'] as const;

/** The organiser pair — whoever is actually running the thing. */
const ORGANISERS: readonly RoleSubtype[] = ['host', 'co_host'] as const;

/** A couple's own event, where "partner" is the honest word. */
const COUPLE: readonly RoleSubtype[] = ['partner1', 'partner2'] as const;

/**
 * Per-event-type role sets, keyed by `event_type_vocab.event_type`.
 *
 * `wedding` is the original 13 in their original order and MUST stay that way —
 * `host-roles-by-event-type.test.ts` pins it, because silently shortening the
 * wedding list is the one regression here that would actually hurt: it is the
 * only event type with real hosts in production today.
 *
 * `ninong` / `ninang` are kept for `christening` on purpose. They are not
 * wedding-only words — a christening's principal sponsors are exactly who they
 * describe, and dropping them there would have been a breadth bug of its own.
 */
export const HOST_ROLES_BY_EVENT_TYPE: Readonly<
  Record<string, readonly RoleSubtype[]>
> = {
  wedding: ROLE_SUBTYPES.slice(0, 13) as readonly RoleSubtype[],

  // The child is the celebrant; the parents host; the sponsors are real roles.
  christening: ['celebrant', 'parent', 'ninong', 'ninang', ...ORGANISERS, ...UNIVERSAL],

  // One person is being celebrated, and often a parent is the one organising.
  birthday: ['celebrant', 'parent', ...ORGANISERS, ...UNIVERSAL],
  debut: ['celebrant', 'parent', ...ORGANISERS, ...UNIVERSAL],
  graduation: ['celebrant', 'parent', ...ORGANISERS, ...UNIVERSAL],

  // Expecting parents, not a celebrant — nobody is the guest of honour yet.
  gender_reveal: [...COUPLE, 'parent', ...ORGANISERS, ...UNIVERSAL],

  // A couple's own milestones.
  anniversary: [...COUPLE, ...ORGANISERS, ...UNIVERSAL],
  travel: [...COUPLE, ...ORGANISERS, ...UNIVERSAL],
  // Two people, no crew. A "family helper" on a dinner date is noise.
  date: [...COUPLE, 'viewer'],

  celebration: ['celebrant', ...ORGANISERS, ...UNIVERSAL],
  reunion: [...ORGANISERS, ...UNIVERSAL],
  hangout: [...ORGANISERS, ...UNIVERSAL],

  // A wake: the family organises, relatives help, others may look. NO
  // 'celebrant' — the person being honoured at a funeral is not a role anyone
  // claims — and none of the wedding cast. Without this entry the picker
  // fails open to the full wedding-shaped list at exactly the event where
  // "Maid of honor" would land worst.
  wake: [...ORGANISERS, ...UNIVERSAL],

  // Work events: an organiser and people who can look. No family vocabulary.
  corporate: [...ORGANISERS, 'viewer'],
  tournament: [...ORGANISERS, 'viewer'],
  gala_night: [...ORGANISERS, 'viewer'],
  simple_event: [...ORGANISERS, 'viewer'],
};

/**
 * PURE. The host roles a given event type actually offers.
 *
 * A null/unknown-to-the-column type is treated as a wedding, matching the
 * default the rest of the couple dashboard already uses when
 * `events.event_type` is missing. A type that exists but is absent from the map
 * fails OPEN to the full list.
 */
export function hostRolesForEventType(
  eventType: string | null | undefined,
): readonly RoleSubtype[] {
  const type = eventType ?? 'wedding';
  return HOST_ROLES_BY_EVENT_TYPE[type] ?? ROLE_SUBTYPES;
}
