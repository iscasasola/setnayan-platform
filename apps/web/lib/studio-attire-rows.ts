/**
 * lib/studio-attire-rows.ts — THE ROWS STUDIO › MOOD BOARD & DRESS CODE DRAWS, from the guest list.
 *
 * Moved out of `mood-board-editor.tsx` (a server file) on 2026-10-19 so the dev lab and the guards build the rows with
 * the SAME function the Maker does, instead of a hand-typed copy of what it returned.
 *
 * The Attire tab's people, in the Mood Board order (owner 2026-10-06: couple → parents → sponsors → entourage →
 * bearers → guests). The couple and the guests are a ROLE's own line in the shipped dress code (`roles`); everyone
 * else is their GROUP's line (`groups`) — the coarse tier the shipped editor offers. Only the people this guest list
 * has; the guests always.
 *
 * 👯 THE HONOUR ATTENDANTS (owner 2026-10-19, DECISION_LOG "THE HONOUR ATTENDANTS GET THEIR OWN DRESS-CODE ROWS"):
 * *"Best man and best woman share a row like principal sponsors. same goes to maid and matron of honor"*. Two rows at
 * the head of the entourage — "Maid of Honor & Matron of Honor" (one person) and "Best Man & Best Woman" (for men ·
 * for women) — each only when the guest list has one of its roles (`HONOUR_ROW_ROLES`: `maid_of_honor` ·
 * `matron_of_honor`, `best_man` · `best_woman`), named in the couple's words, and the Bridesmaids /
 * Groomsmen counts no longer include them. A group row whose only people are honour attendants is not drawn.
 *
 * 🤵‍♂️ THE MAN OF HONOR (owner 2026-10-19, DECISION_LOG "A MAN OF HONOR"): the maid's row gains a FOR MEN column, drawn
 * when a man of honor is on the guest list (or the column already holds a pick — `shownColumns`), and then the row is
 * named for him too: "Maid, Matron & Man of Honor".
 *
 * Pure, client-safe.
 */
import { ATTIRE_ROWS, HONOUR_ROW_OF, HONOUR_ROW_ROLES, honourRowLabel, isHonourRole, isHonourRowKey, shownColumns } from './attire-rows';
import type { GuestRole } from './guests';
import type { PaletteKey } from './mood-board';
import { formatCallTime } from './role-dress-code';
import { roleGroupLabel, roleGroupOf, type RoleGroup } from './role-groups';
import type { RoleNames } from './role-names';

export type StudioAttireRowData = {
  /** `roles` (one role's own line) or `groups` (a whole group's). */
  tier: 'roles' | 'groups';
  key: string;
  label: string;
  /** The palette key that colours them — null for one with no palette (a celebrant). */
  paletteKey: PaletteKey | null;
  /** The shipped call time, already in words ("2:00 PM"). */
  arrives: string | null;
  /** How many on the guest list hold it — "8 people" (absent: not counted). */
  people?: number;
  /**
   * 👯 An honour row's people still wear their group's look until their Wear is picked here (`honourRowSpeaks`) —
   * the group's heading, so the Studio can say so ("Until you pick what they wear, they dress as the Bridesmaids").
   */
  fallsBackTo?: string;
  /** 👯 The honour row's columns whose people are on the guest list (the best woman's is 1, the man of honor's 1). */
  honourColumns?: Array<0 | 1>;
  /** 🤵‍♂️ The columns the Studio draws (`shownColumns`) — absent: every column of the row. */
  columns?: Array<0 | 1>;
};

const STUDIO_ATTIRE_GROUPS: ReadonlyArray<{ group: RoleGroup; paletteKey: PaletteKey | null }> = [
  { group: 'vip_family', paletteKey: 'parents_immediate_family' },
  { group: 'principal_sponsors', paletteKey: 'principal_sponsors' },
  { group: 'secondary_sponsors', paletteKey: 'secondary_sponsors' },
  { group: 'muslim_principals', paletteKey: 'muslim_principals' },
  { group: 'bridesmaids', paletteKey: 'bridesmaids' },
  { group: 'groomsmen', paletteKey: 'groomsmen' },
  { group: 'bearers_flower_girl', paletteKey: 'bearers_flower_girl' },
  { group: 'officiants', paletteKey: 'officiants' },
];

/** The two honour rows, in `ATTIRE_ROWS` order (the maid of honor's, then the best man's). */
const HONOUR_ROWS = ATTIRE_ROWS.filter((r) => r.tier === 'roles' && isHonourRowKey(r.key));

export function studioAttireRows(
  tally: ReadonlyArray<{ role: GuestRole; count?: number }>,
  config: object | null,
  names?: RoleNames | null,
): StudioAttireRowData[] {
  const roles = new Set<string>(tally.map((t) => t.role));
  /* A group is drawn for the people it dresses — an honour attendant has a row of their own. */
  const groups = new Set(tally.filter((t) => !isHonourRole(t.role)).map((t) => roleGroupOf(t.role)));
  /* 👗 How many hold it — "8 people" under the role's name (2026-10-14 blocks). */
  const countOf = (match: (role: GuestRole) => boolean) => tally.reduce((n, t) => n + (match(t.role) ? (t.count ?? 0) : 0), 0) || undefined;
  const callOf = (tier: 'roles' | 'groups', key: string) =>
    formatCallTime((((config as Record<string, unknown> | null)?.[tier] ?? {}) as Record<string, { callTime?: string }>)[key]?.callTime ?? null);
  const out: StudioAttireRowData[] = [];
  if (roles.has('celebrant')) out.push({ tier: 'roles', key: 'celebrant', label: 'The celebrant', paletteKey: null, arrives: callOf('roles', 'celebrant') });
  out.push({ tier: 'roles', key: 'bride', label: 'The bride', paletteKey: 'bride', arrives: callOf('roles', 'bride') });
  out.push({ tier: 'roles', key: 'groom', label: 'The groom', paletteKey: 'groom', arrives: callOf('roles', 'groom') });
  for (const { group, paletteKey } of STUDIO_ATTIRE_GROUPS) {
    /* 👯 The honour rows stand at the head of the entourage — just before the Bridesmaids and the Groomsmen. */
    if (group === 'bridesmaids') {
      for (const row of HONOUR_ROWS) {
        const key = row.key as 'best_man' | 'maid_of_honor';
        const pair = HONOUR_ROW_ROLES[key];
        if (!pair.some((r) => roles.has(r))) continue;
        const own = roleGroupOf(pair[0]!);
        const honourColumns = [...new Set(pair.filter((r) => roles.has(r)).map((r) => HONOUR_ROW_OF[r]!.index))];
        const columns = shownColumns(config as Record<string, unknown> | null, row, honourColumns);
        out.push({
          tier: 'roles',
          key,
          label: honourRowLabel(key, names, row.optionalSecond ? columns.includes(1) : false),
          paletteKey: row.paletteKey,
          arrives: callOf('roles', key),
          people: countOf((r) => pair.includes(r)),
          honourColumns,
          columns,
          ...(own !== 'guest' && groups.has(own) ? { fallsBackTo: roleGroupLabel(own, names) } : {}),
        });
      }
    }
    if (!groups.has(group)) continue;
    out.push({
      tier: 'groups',
      key: group,
      label: roleGroupLabel(group, names),
      paletteKey,
      arrives: callOf('groups', group),
      people: countOf((r) => roleGroupOf(r) === group && !isHonourRole(r)),
    });
  }
  out.push({ tier: 'roles', key: 'guest', label: 'Guests', paletteKey: 'guest', arrives: null, people: countOf((r) => r === 'guest') });
  return out;
}
