/**
 * 🎭 SEE AS · ROLE ▾ — THE PREVIEW AS A WEDDING ROLE (owner 2026-10-17: *"i want to see how the palette changes
 * depending on the guest?"* … *"for example i want to view it as a father of the bride"*).
 *
 * The Maker's See as ▾ already draws the guest page as a SAMPLE guest (`lib/see-as.ts`,
 * `lib/simulated-guest-preview.ts`). This is the one thing it could not say: WHICH guest. A role pick dresses the same
 * fabricated seat-holder in a role from this event's own guest-list vocabulary (its role set, in the couple's words),
 * plus the man / woman half where the role does not say it — so the Dress Code, Me › What to wear, the figure and the
 * palette draw exactly what that role's guest reads. The guest page needs no new branch: it already answers a guest by
 * `guests.role` and `guests.attire`; the sample simply carries them.
 *
 * ⚖ RULED 2026-09-14 — the preview shows a GENERIC guest, never a real named one. So a role preview is NAMED for its
 * role ("A father of the bride") and reads NO guest row: `app/[slug]/page.tsx` does not call `loadPreviewPerson` when
 * a role is picked (`preview-role-is-a-sample.test.ts`).
 *
 * 🔒 THE PARAM IS NOT THE AUTHORITY. `?asrole=` is read only inside the See as branch, which is gated on a
 * server-verified `OwnerCapability`; a guest or stranger who types it gets the ordinary page. And the key is checked
 * here against the closed vocabulary — anything else is no role at all.
 *
 * Pure: no React, no DOM, no I/O.
 */
import { guestRoleLabel, type GuestAttire, type GuestRole } from './guests';
import { roleGroupLabel, roleGroupOf, type RoleGroup } from './role-groups';
import type { RoleNames } from './role-names';
import { SEE_AS_ANY_ROLE, type SeeAsRoleRow } from './see-as';

/** Which half of a two-person row the sample reader is. `f` wears the gown, `m` the suit. */
export type PreviewWho = 'f' | 'm';

/** One pick: the role, who, and what that means on the guest row. */
export type PreviewRolePick = {
  key: string;
  role: GuestRole;
  who: PreviewWho;
  attire: Exclude<GuestAttire, 'neutral'>;
  side: 'bride' | 'groom' | 'both';
  /** The generic name the sample wears — "A father of the bride". Never a person's. */
  name: string;
};

/** One row of Role ▾, as the Maker draws it (plain data — it crosses to the client). */
export type PreviewRoleOption = SeeAsRoleRow;

/** Roles that are not a GUEST's eyes: the couple / the celebrant / a host see their own page. */
const NOT_A_GUEST_VIEW: ReadonlySet<GuestRole> = new Set<GuestRole>(['bride', 'groom', 'celebrant', 'host', 'principal_sponsor']);

/** Roles that say who the reader is on their own (one row in the list). Mirrors the role's own word. */
const ROLE_SAYS_WHO: Partial<Record<GuestRole, PreviewWho>> = {
  maid_of_honor: 'f',
  matron_of_honor: 'f',
  bridesmaid: 'f',
  best_woman: 'f',
  principal_sponsor_ninang: 'f',
  flower_girl: 'f',
  best_man: 'm',
  groomsman: 'm',
  principal_sponsor_ninong: 'm',
  ring_bearer: 'm',
  bible_bearer: 'm',
  coin_bearer: 'm',
  wali: 'm',
  imam: 'm',
  wakil: 'm',
};

/** Family roles a person is called by in plain words — "Father of the Bride", never "Bride's Parents · man". */
const FAMILY_WORDS: Partial<Record<GuestRole, Record<PreviewWho, string>>> = {
  bride_parents: { m: 'Father of the Bride', f: 'Mother of the Bride' },
  groom_parents: { m: 'Father of the Groom', f: 'Mother of the Groom' },
  bride_grandparents: { m: 'Grandfather of the Bride', f: 'Grandmother of the Bride' },
  groom_grandparents: { m: 'Grandfather of the Groom', f: 'Grandmother of the Groom' },
};

/** The order Role ▾ lists its groups in — the wedding's own importance order, the guests last. */
const GROUP_ORDER: readonly (RoleGroup | 'guest')[] = [
  'vip_family',
  'principal_sponsors',
  'secondary_sponsors',
  'bridesmaids',
  'groomsmen',
  'bearers_flower_girl',
  'muslim_principals',
  'officiants',
  'other_roles',
  'guest',
];

const WHO_WORD: Record<PreviewWho, string> = { f: 'woman', m: 'man' };

export const PREVIEW_ROLE_NONE = SEE_AS_ANY_ROLE;

function keyOf(role: GuestRole, who: PreviewWho): string {
  return `${role}-${who}`;
}

function sideOf(role: GuestRole): 'bride' | 'groom' | 'both' {
  if (role.startsWith('bride_')) return 'bride';
  if (role.startsWith('groom_')) return 'groom';
  return 'both';
}

/** The words a row reads in Role ▾ — the couple's own word for the role (`guestRoleLabel`), plus "· woman / · man" where the role does not say it. */
function labelOf(role: GuestRole, who: PreviewWho, names: RoleNames | null | undefined, split: boolean): string {
  const family = FAMILY_WORDS[role];
  if (family) return family[who];
  const word = guestRoleLabel(role, names);
  return split ? `${word} · ${WHO_WORD[who]}` : word;
}

/** "A father of the bride" · "An officiant" — a role, never a person. */
function genericName(role: GuestRole, who: PreviewWho, names: RoleNames | null | undefined): string {
  const word = (FAMILY_WORDS[role]?.[who] ?? guestRoleLabel(role, names)).toLowerCase();
  return `${/^[aeiou]/.test(word) ? 'An' : 'A'} ${word}`;
}

function whoFor(role: GuestRole): readonly PreviewWho[] {
  const said = ROLE_SAYS_WHO[role];
  return said ? [said] : ['m', 'f'];
}

/**
 * Role ▾'s rows for THIS event — its role set's `offeredRoles` (the guest list's own vocabulary, ceremony-aware),
 * minus the roles that are not a guest's eyes, one row per role that says who, two (man · woman) otherwise. The
 * first row is "Any guest": the sample as it always was, no role.
 */
export function previewRoleOptions(
  offeredRoles: readonly GuestRole[],
  names?: RoleNames | null,
): PreviewRoleOption[] {
  const rows: Array<PreviewRoleOption & { rank: number; at: number }> = [];
  offeredRoles.forEach((role, at) => {
    if (NOT_A_GUEST_VIEW.has(role)) return;
    const group = roleGroupOf(role);
    const rank = GROUP_ORDER.indexOf(group);
    const heading = group === 'guest' ? 'Guests' : roleGroupLabel(group, names);
    const whos = whoFor(role);
    for (const who of whos) {
      rows.push({ key: keyOf(role, who), label: labelOf(role, who, names, whos.length > 1), group: heading, rank: rank < 0 ? GROUP_ORDER.length : rank, at });
    }
  });
  rows.sort((a, b) => a.rank - b.rank || a.at - b.at);
  return [{ key: PREVIEW_ROLE_NONE, label: 'Any guest', group: '' }, ...rows.map(({ key, label, group }) => ({ key, label, group }))];
}

/**
 * `?asrole=` read strictly: a key this event's Role ▾ could have offered, or null. A repeated param (an array), a role
 * outside the vocabulary, a role that is not a guest's eyes, or a "who" the role contradicts (a ninang as a man) are
 * all null — the sample as it always was.
 */
export function previewRoleOf(
  v: unknown,
  offeredRoles: readonly GuestRole[],
  names?: RoleNames | null,
): PreviewRolePick | null {
  if (typeof v !== 'string') return null;
  const m = /^([a-z_]+)-([fm])$/.exec(v.trim().toLowerCase());
  if (!m) return null;
  const role = m[1] as GuestRole;
  const who = m[2] as PreviewWho;
  if (!offeredRoles.includes(role) || NOT_A_GUEST_VIEW.has(role)) return null;
  if (!whoFor(role).includes(who)) return null;
  return {
    key: keyOf(role, who),
    role,
    who,
    attire: who === 'f' ? 'gown' : 'suit',
    side: sideOf(role),
    name: genericName(role, who, names),
  };
}
