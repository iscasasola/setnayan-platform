/**
 * quick-add-tips.ts — what the Guests add boxes say they understand.
 *
 * ⚖ Owner 2026-10-01 (via the controller): *"And tips on adding names with the +
 * or other grouping or information they can do for quick add"*. The grammar
 * already ships — `lib/guest-parse.ts` — so these words only say what it reads,
 * and only what THIS event can use: a side word only where the event has sides,
 * a role word only where the event's role set offers that role (the parser
 * quietly falls back to "Guest" otherwise, and a tip must not promise it).
 *
 * ⚖ Owner 2026-11-01: every search and add box shows ROTATING example hints, like
 * a shopping app's search bar — `examples` is that list (`lib/use-rotating-hint.ts`
 * cycles it). Each line comes from what the box does and from THIS event's own
 * data — the roles it offers (in the couple's own words when they renamed one),
 * its real one-word group names — never a person's data: the names are made up.
 * The owner's own example leads the role lines: "Mr. Roman Atkinson +2 +Groomsmen".
 *
 * Pure, so `quick-add-tips.test.ts` runs every line through the real parser.
 */

import type { GuestRole } from './guests';
import { ROLE_LABELS } from './guests';
import type { RoleNames } from './role-names';

export type QuickAddTips = {
  /** One short line under "Type a name…" — the first of `examples`, with "e.g.". */
  example: string;
  /** Lines a box cycles through as its hint, each one the parser reads exactly as written. No "e.g.". */
  examples: string[];
  /** The Tips ▾ fold, one line each. */
  tips: string[];
};

/** The roles an example may show as `+Word`, best first — the entourage words a host types most. */
const EXAMPLE_ROLES: readonly GuestRole[] = [
  'groomsman',
  'bridesmaid',
  'principal_sponsor_ninang',
  'flower_girl',
  'vip',
  'host',
  'family',
  'helper',
];

/** How a role is typed after `+`: the couple's word or the usual one, plural where a group word reads better. */
const PLURAL: Partial<Record<GuestRole, string>> = { groomsman: 'Groomsmen', bridesmaid: 'Bridesmaids' };

function plusWord(role: GuestRole, names: RoleNames | null | undefined): string {
  const mine = names?.[role]?.many ?? names?.[role]?.one;
  const label = ROLE_LABELS[role];
  const paren = /\(([^)]*)\)/.exec(label)?.[1];
  const word = mine ?? PLURAL[role] ?? paren ?? label;
  // "Bride's Crew" → "BridesCrew", "Flower Girl" → "FlowerGirl": one token, the way the parser reads it back.
  return word
    .replace(/['’]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map((w) => (w === w.toUpperCase() ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join('');
}

/** A real group name a host can type as `#Name` — one word, short. */
function typableGroups(names: readonly string[] | undefined): string[] {
  return (names ?? []).map((n) => n.trim()).filter((n) => /^[\p{L}\p{N}_-]{2,20}$/u.test(n));
}

export function quickAddTips({
  hasSides,
  offeredRoles,
  groupNames,
  roleNames,
}: {
  hasSides: boolean;
  offeredRoles: readonly GuestRole[];
  /** This event's own group names (`guest_groups.label`); only one-word names are used. */
  groupNames?: readonly string[];
  /** The couple's own role words (`events.role_names`). */
  roleNames?: RoleNames | null;
}): QuickAddTips {
  const vip = offeredRoles.includes('vip' as GuestRole);
  const ninong = offeredRoles.includes('principal_sponsor_ninong' as GuestRole);
  const ninang = offeredRoles.includes('principal_sponsor_ninang' as GuestRole);
  const groups = typableGroups(groupNames);
  const g1 = groups[0] ?? 'Barkada';
  const g2 = groups[1] ?? groups[0] ?? 'Barkada';
  const roles = EXAMPLE_ROLES.filter((r) => offeredRoles.includes(r)).map((r) => plusWord(r, roleNames));

  const first = ['Ana Cruz +1', hasSides ? 'groom' : null, ninang ? 'ninang' : null, `#${g1}`].filter(Boolean).join(' ');
  const examples = [
    first,
    ...(roles[0] ? [`Mr. Roman Atkinson +2 +${roles[0]}`] : []),
    `Dr. Lea Santos #${g2}`,
    ...(roles[1] ? [`Atty. Rosa Reyes +${roles[1]}`] : []),
    'Engr. Paolo Lim +3',
    ...(roles[2] ? [`Ms. Joy Tan +${roles[2]} #${g1}`] : []),
  ];

  const bareWords = [vip ? 'vip' : null, ninong ? 'ninong' : null, ninang ? 'ninang' : null].filter((w): w is string => Boolean(w));
  // "+Groomsmen" joins the bare words — unless it only repeats one ("vip / +VIP").
  const plusTip = roles[0] && !bareWords.includes(roles[0].toLowerCase()) ? `+${roles[0]}` : null;
  const roleWords = [...bareWords, ...(plusTip ? [plusTip] : [])];
  const tips = [
    '+1 / +2 adds their guests',
    '#Name puts them in a group (use several)',
    'Mr. / Ms. / Dr. / Atty. / Engr. is kept as their title',
    ...(hasSides ? ['bride / groom / both sets the side'] : []),
    ...(roleWords.length ? [`${roleWords.join(' / ')} sets the role`] : []),
  ];
  return { example: `e.g. ${first}`, examples, tips };
}
