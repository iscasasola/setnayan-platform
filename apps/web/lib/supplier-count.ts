/**
 * 🧮 WHO A SUPPLIER COUNTS (owner 2026-11-04, DECISION_LOG "2026-11-04 WHO A SUPPLIER COUNTS…"; migration
 * 20271307968824). Owner, verbatim: *"this way, a supplier can count what they need to give. so for example. exclusive
 * for principal sponsors. we only count the attending principal sponsors."* · *"not counted for will be for service
 * cards with pax only. if they offer a service without pax, then no need to count"*.
 *
 * Two ways to leave someone out, one count:
 *   · a RULE per per-head service (`event_vendor_count_rules`): Everyone attending · Only… · Everyone except… over
 *     guest roles and guest groups;
 *   · a TICK on one guest's card ("Not counted for ▾", `guest_not_counted_for`).
 * The supplier gets one number, never who.
 *
 * PURE — the words and the arithmetic. `countFor` mirrors the SQL (`event_vendor_left_out` + `event_vendor_headcount`)
 * exactly, so the rule sheet's "<shop> counts N" moves as the couple ticks and lands on the number the supplier reads.
 * 🔒 lib/who-a-supplier-counts.test.ts · tests/db/who-a-supplier-counts.db.test.ts
 */
import type { GuestRole } from './guests';
import { ROLE_IMPORTANCE, roleGroupLabel, roleGroupOf, type RoleGroup } from './role-groups';
import type { RoleNames } from './role-names';
import { VENDOR_CATEGORY_LABEL, type VendorCategory } from './vendors';

export type CountMode = 'all' | 'only' | 'except';
export const COUNT_MODES: readonly CountMode[] = ['all', 'only', 'except'];

/** The PickMenu's three words (the prototype's `ruleSheet`). */
export const COUNT_MODE_WORDS: Record<CountMode, string> = {
  all: 'Everyone attending',
  only: 'Only…',
  except: 'Everyone except…',
};
export const COUNT_MODE_HINTS: Record<CountMode, string | undefined> = {
  all: undefined,
  only: 'e.g. principal sponsors only',
  except: 'e.g. no kids, no crew',
};

export type CountRule = { mode: CountMode; roles: GuestRole[]; groupIds: string[] };
/** One ATTENDING guest the readers count — their roles, groups and ticks. No id, no name. */
export type RosterEntry = { r: GuestRole[]; g: string[]; t: string[] };
export type CountGroup = { id: string; label: string };
export type Breakdown = { attending: number; notCounted: number; outsideRule: number; counted: number };

/** One per-head service on the event, as the couple reads it (`get_event_service_counts`). */
export type CountedService = Breakdown & {
  id: string;
  category: string | null;
  /** "Catering" — the trade in the app's own words. */
  label: string;
  shop: string | null;
  booked: boolean;
  rule: CountRule;
};
/** `names` = the couple's own words for roles (`events.role_names`) — a rule says "Only Bride's Crew" when they renamed her. */
export type ServiceCounts = { services: CountedService[]; groups: CountGroup[]; roster: RosterEntry[]; names?: RoleNames | null };

export const ALL_ATTENDING: CountRule = { mode: 'all', roles: [], groupIds: [] };

/** Outside the rule: `only` and they hold none of it; `except` and they hold some of it. Mirrors the SQL. */
export function isOutsideRule(rule: CountRule, roles: readonly string[], groupIds: readonly string[]): boolean {
  if (rule.mode === 'all') return false;
  const inRule = roles.some((r) => (rule.roles as readonly string[]).includes(r)) || groupIds.some((g) => rule.groupIds.includes(g));
  return rule.mode === 'only' ? !inRule : inRule;
}

/**
 * The count for one service under a rule — the same split the supplier's ⓘ reads: attending · not counted by the
 * couple (ticked, inside the rule) · outside their rule · counted. Each guest once, however many picks they match.
 */
export function countFor(roster: readonly RosterEntry[], rule: CountRule, serviceId: string): Breakdown {
  let notCounted = 0;
  let outsideRule = 0;
  for (const g of roster) {
    if (isOutsideRule(rule, g.r, g.g)) outsideRule += 1;
    else if (g.t.includes(serviceId)) notCounted += 1;
  }
  return { attending: roster.length, notCounted, outsideRule, counted: roster.length - notCounted - outsideRule };
}

/** Every role a role group holds ("Principal Sponsors" → ninong · ninang · the retired principal_sponsor). */
export function rolesOfGroup(group: RoleGroup): GuestRole[] {
  return ROLE_IMPORTANCE.filter((r) => roleGroupOf(r) === group);
}

/** One line of the tick list: a role group or a guest group, with how many of it are attending. */
export type AudienceOption = { key: string; label: string; type: 'Role' | 'Group'; n: number };

/** The tick list, roles first (in importance order, in the couple's words), then the couple's own groups. */
export function audienceOf(
  roster: readonly RosterEntry[],
  groups: readonly CountGroup[],
  keep: readonly string[] = [],
  names: RoleNames | null = null,
): AudienceOption[] {
  const roleN = new Map<RoleGroup, number>();
  for (const g of roster) {
    const mine = new Set(g.r.map(roleGroupOf).filter((x): x is RoleGroup => x !== 'guest'));
    for (const rg of mine) roleN.set(rg, (roleN.get(rg) ?? 0) + 1);
  }
  // Sponsors first, as the prototype draws them — a per-head giveaway is most often "only the sponsors"; the rest
  // follow the roster's own importance order.
  const ranked = [...new Set(ROLE_IMPORTANCE.map(roleGroupOf))].filter((x): x is RoleGroup => x !== 'guest');
  const first: RoleGroup[] = ['principal_sponsors', 'secondary_sponsors'];
  const order = [...first.filter((rg) => ranked.includes(rg)), ...ranked.filter((rg) => !first.includes(rg))];
  const roles: AudienceOption[] = order
    .filter((rg) => roleN.has(rg) || keep.includes(`r:${rg}`))
    .map((rg) => ({ key: `r:${rg}`, label: roleGroupLabel(rg, names), type: 'Role' as const, n: roleN.get(rg) ?? 0 }));
  const own: AudienceOption[] = groups.map((gr) => ({
    key: `g:${gr.id}`,
    label: gr.label,
    type: 'Group' as const,
    n: roster.filter((g) => g.g.includes(gr.id)).length,
  }));
  return [...roles, ...own];
}

/** The rule as tick keys ("r:principal_sponsors", "g:<group id>"). */
export function keysOfRule(rule: CountRule): string[] {
  const roleKeys = [...new Set(rule.roles.map(roleGroupOf).filter((x) => x !== 'guest'))].map((rg) => `r:${rg}`);
  return [...roleKeys, ...rule.groupIds.map((id) => `g:${id}`)];
}

/** The ticks → the rule stored (a role group's every role; a group's id). `all` keeps nothing. */
export function ruleOfKeys(mode: CountMode, keys: readonly string[]): CountRule {
  if (mode === 'all') return ALL_ATTENDING;
  const roles = keys.filter((k) => k.startsWith('r:')).flatMap((k) => rolesOfGroup(k.slice(2) as RoleGroup));
  const groupIds = keys.filter((k) => k.startsWith('g:')).map((k) => k.slice(2));
  return { mode, roles: [...new Set(roles)], groupIds: [...new Set(groupIds)] };
}

/** "Everyone attending" · "Only Principal Sponsors" · "Everyone except Kids, Crew & helpers". */
export function ruleWords(mode: CountMode, labels: readonly string[]): string {
  if (mode === 'all') return COUNT_MODE_WORDS.all;
  const names = labels.length > 0 ? labels.join(', ') : '—';
  return mode === 'only' ? `Only ${names}` : `Everyone except ${names}`;
}

/** The labels of a rule's role groups, in the couple's words — the supplier's tile and `ruleLabels` say the same. */
export function ruleRoleLabels(roles: readonly GuestRole[], names: RoleNames | null = null): string[] {
  return [...new Set(roles.map(roleGroupOf).filter((x): x is RoleGroup => x !== 'guest'))].map((rg) => roleGroupLabel(rg, names));
}

/** The rule's labels for the couple's own rule (role groups first, then groups that still exist). */
export function ruleLabels(rule: CountRule, groups: readonly CountGroup[], names: RoleNames | null = null): string[] {
  const byId = new Map(groups.map((g) => [g.id, g.label] as const));
  const roleLabels = ruleRoleLabels(rule.roles, names);
  return [...roleLabels, ...rule.groupIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))];
}

/** "Juan's Kitchen · Booked" · "Lens & Light · Quoted · applies once booked" — the Not counted for list's hint. */
export function serviceHint(s: Pick<CountedService, 'shop' | 'booked'>): string {
  const state = s.booked ? 'Booked' : 'Quoted · applies once booked';
  return s.shop ? `${s.shop} · ${state}` : state;
}

/** The trade's words for one service ("Catering"). */
export function serviceLabel(category: string | null, shop: string | null): string {
  return (category && VENDOR_CATEGORY_LABEL[category as VendorCategory]) || shop?.trim() || 'Service';
}

/** Trades that serve food or drink count heads "to serve"; every other per-head service counts "to give". */
const SERVE: ReadonlySet<string> = new Set(['catering', 'crew_meals', 'cake_maker', 'mobile_bar', 'restaurant_reservation', 'venue']);
export function countNoun(category: string | null): 'to serve' | 'to give' {
  return category && SERVE.has(category) ? 'to serve' : 'to give';
}

/** The supplier tile's ⓘ: "180 attending · 12 not counted by the couple · 0 outside their rule". Numbers only. */
export function breakdownWords(b: Pick<Breakdown, 'attending' | 'notCounted' | 'outsideRule'>): string {
  return `${b.attending} attending · ${b.notCounted} not counted by the couple · ${b.outsideRule} outside their rule`;
}

/** The rule sheet's line under the ticks: "180 attending · 5 outside this rule · 11 ticked on guest cards". */
export function sheetWords(b: Breakdown, mode: CountMode): string {
  return `${b.attending} attending · ${mode === 'all' ? 'no rule' : `${b.outsideRule} outside this rule`} · ${b.notCounted} ticked on guest cards`;
}

/** What a supplier is told about their count — NUMBERS and the rule's words, never a guest. */
export type SupplierHeadcount = {
  attending: number;
  notCounted: number;
  outsideRule: number;
  counted: number;
  category: string | null;
  mode: CountMode;
  roles: GuestRole[];
  groups: string[];
};

/** This guest, as the readers see them: counted at all (attending, not passed away, not represented), roles, groups. */
export type CountSelf = { attending: boolean; roles: string[]; groupIds: string[]; firstName: string };

/**
 * The guest card's line under "Not counted for": "Juan's Kitchen counts 168, not 169 · Every other service still counts
 * Mia." Only for services where the tick moves the number — the guest is attending and inside that service's rule.
 * `saved` = the ticks the count was read with (so a saved tick is not subtracted twice). Null = nothing to say.
 */
export function notCountedResult(
  services: readonly CountedService[],
  picked: readonly string[],
  saved: readonly string[],
  self: CountSelf,
): string | null {
  if (!self.attending) return null;
  const parts = services
    .filter((s) => picked.includes(s.id) && !isOutsideRule(s.rule, self.roles, self.groupIds))
    .map((s) => {
      const n = s.counted - (saved.includes(s.id) ? 0 : 1);
      return `${s.shop ?? s.label} counts ${n}, not ${n + 1}`;
    });
  if (parts.length === 0) return null;
  return `${parts.join(' · ')} · Every other service still counts ${self.firstName}.`;
}
