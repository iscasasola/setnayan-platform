import type { VendorTeamRole } from '@/lib/vendor-team';

/**
 * 🧑‍🤝‍🧑 THE SIX SUPPLIER ROLES (owner 19 Nov 2026 — map + drawing in iscasasola/setnayan-platform#8013).
 *
 * Shop Manager · Branch Manager · Account Manager · Marketing · Event Crew · Helper. ONE role per person (owner: "no" to
 * two). The database keeps its one-dimensional RANK (`vendor_team_members.role`, read by every policy through
 * `current_vendor_ids(min_role)`) and DERIVES it from the role (`vendor_team_members.duty`) in
 * `vendor_team_duty_rank_trg` — `VENDOR_DUTY_RANK` below is that trigger's mirror, pinned by a test.
 *
 * Every gate in the supplier pages asks {@link dutyMay} for ONE capability, so a new role is mapped everywhere or not at
 * all (owner rule): the matrix below is the whole answer, and `vendor-duties.test.ts` reads every row of it.
 *
 * PURE — no network, no React — so the client controls and the tests import it.
 */

export type VendorDuty =
  | 'shop_manager'
  | 'branch_manager'
  | 'account_manager'
  | 'marketing'
  | 'event_crew'
  | 'helper';

/** In the order a Shop Manager reads them (the drawing's (a) Roles page). */
export const VENDOR_DUTIES: ReadonlyArray<VendorDuty> = [
  'shop_manager',
  'branch_manager',
  'account_manager',
  'marketing',
  'event_crew',
  'helper',
];

const DUTY_SET: ReadonlySet<string> = new Set(VENDOR_DUTIES);

export function isVendorDuty(raw: unknown): raw is VendorDuty {
  return typeof raw === 'string' && DUTY_SET.has(raw);
}

/** The fixed names — a shop may rename each (`vendor_role_names`), never the role behind it. */
export const VENDOR_DUTY_NAME: Record<VendorDuty, string> = {
  shop_manager: 'Shop Manager',
  branch_manager: 'Branch Manager',
  account_manager: 'Account Manager',
  marketing: 'Marketing',
  event_crew: 'Event Crew',
  helper: 'Helper',
};

/** One line each — the drawing's (a), copied. */
export const VENDOR_DUTY_LINE: Record<VendorDuty, string> = {
  shop_manager: 'Sees everything, including branches',
  branch_manager: 'Runs one branch, like a Shop Manager',
  account_manager: 'Their own clients, from booking to event day',
  marketing: 'Shop page, cards, photos, promos and ads',
  event_crew: 'Hub and photos for the events they’re given',
  helper: 'Sees the schedule, changes nothing',
};

/** Behind ⓘ — the drawing's (a), copied. */
export const VENDOR_DUTY_DETAIL: Record<VendorDuty, string> = {
  shop_manager: 'Can: the team, the plan, branches, money settings, every client and every event day.',
  branch_manager:
    'Can: that branch’s clients, bookings, payments, event days and team. Can’t: the plan, other branches, shop-wide money settings.',
  account_manager:
    'Can: take bookings, chat, log payments and run event day — for their own clients, on their branch. Can’t: other people’s clients, the shop page, the plan.',
  marketing: 'Can: edit the shop page, cards, photos, promos, ads. Can’t: bookings, clients, money.',
  event_crew: 'Can: on the events you give them — the Hub and its photos. Can’t: any other event, clients, money.',
  helper: 'One Helper is free on every plan. Sees the schedule; changes nothing.',
};

/** Mirror of `public.vendor_duty_rank` — the RLS rank each role carries. */
export const VENDOR_DUTY_RANK: Record<VendorDuty, Exclude<VendorTeamRole, 'owner'>> = {
  shop_manager: 'admin',
  branch_manager: 'agent',
  account_manager: 'agent',
  marketing: 'viewer',
  event_crew: 'viewer',
  helper: 'viewer',
};

/** Mirror of `public.vendor_duty_of_rank` — a legacy rank's role (rows written before the six, or by a vote). */
export function dutyOfRank(role: VendorTeamRole | string | null | undefined): VendorDuty {
  if (role === 'owner' || role === 'admin') return 'shop_manager';
  if (role === 'agent') return 'account_manager';
  return 'helper';
}

/** Shop Manager and Marketing cover the whole shop — every other role works at one location. */
export function dutyWorksAtABranch(duty: VendorDuty): boolean {
  return duty !== 'shop_manager' && duty !== 'marketing';
}

/** What a Branch Manager may give (at or below their level, owner map §1). */
export const BRANCH_MANAGER_MAY_GIVE: ReadonlyArray<VendorDuty> = ['account_manager', 'event_crew', 'helper'];

// ── WHAT EACH ROLE OPENS — the one matrix every gate reads ─────────────────────────────────────────────────────────

export type VendorCapability =
  /** Team page: invite, change, remove (a Branch Manager: their branch, at or below their level). */
  | 'team'
  /** Rename the six roles (Team › Roles · Save names). */
  | 'role_names'
  /** The plan, add-ons, seats — anything that buys. */
  | 'plan'
  /** Shop-wide money settings: payment options, fees, payouts. */
  | 'money_settings'
  /** Add / edit branches (a Branch Manager: their own branch's details). */
  | 'branches'
  /** The shop page, cards, photos, promos, ads. */
  | 'shop_page'
  /** Clients, bookings, chat and payments — scoped further by RLS to the person's cards. */
  | 'clients'
  /** Every client of the shop, not only their own. */
  | 'all_clients'
  /** Event day — the console and the Hub — for events the person may act on (RLS + `mayActForShopHere` decide which). */
  | 'event_day'
  /** Analytics, track record, theft watch — the shop's own numbers. */
  | 'insights'
  /** Today: the schedule. */
  | 'schedule';

const SHOP_MANAGER: ReadonlySet<VendorCapability> = new Set<VendorCapability>([
  'team',
  'role_names',
  'plan',
  'money_settings',
  'branches',
  'shop_page',
  'clients',
  'all_clients',
  'event_day',
  'insights',
  'schedule',
]);

export const VENDOR_DUTY_MAY: Record<VendorDuty, ReadonlySet<VendorCapability>> = {
  shop_manager: SHOP_MANAGER,
  branch_manager: new Set<VendorCapability>(['team', 'branches', 'clients', 'event_day', 'schedule']),
  account_manager: new Set<VendorCapability>(['clients', 'event_day', 'schedule']),
  marketing: new Set<VendorCapability>(['shop_page', 'schedule']),
  event_crew: new Set<VendorCapability>(['event_day', 'schedule']),
  helper: new Set<VendorCapability>(['clients', 'schedule']),
};

/** May this role do this? Total and fail-closed: an unknown or missing role may do nothing. */
export function dutyMay(duty: VendorDuty | null | undefined, capability: VendorCapability): boolean {
  if (!duty || !isVendorDuty(duty)) return false;
  return VENDOR_DUTY_MAY[duty].has(capability);
}

/** Who to ask when a role cannot — the "Solution" half of a 🔒. */
export function whoCanOpen(capability: VendorCapability): string {
  const names = VENDOR_DUTIES.filter((d) => VENDOR_DUTY_MAY[d].has(capability)).map((d) => VENDOR_DUTY_NAME[d]);
  if (names.length <= 1) return names[0] ?? VENDOR_DUTY_NAME.shop_manager;
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

/** What a capability is, in the supplier's words — the "Problem" half of a 🔒. */
export const VENDOR_CAPABILITY_WORDS: Record<VendorCapability, string> = {
  team: 'the team',
  role_names: 'the role names',
  plan: 'the plan and add-ons',
  money_settings: 'money settings',
  branches: 'branches',
  shop_page: 'the shop page, cards and photos',
  clients: 'clients and bookings',
  all_clients: 'every client of the shop',
  event_day: 'event day',
  insights: 'the shop’s numbers',
  schedule: 'the schedule',
};

// ── THE SHOP'S OWN NAMES ───────────────────────────────────────────────────────────────────────────────────────────

export type VendorRoleNames = Partial<Record<VendorDuty, string>>;

/** The shop's word for a role, else the fixed name. A blank box keeps the fixed name. */
export function roleNameOf(names: VendorRoleNames | null | undefined, duty: VendorDuty): string {
  const own = names?.[duty]?.trim();
  return own && own.length > 0 ? own : VENDOR_DUTY_NAME[duty];
}

/** True when the shop renamed this role — the card then shows the fixed role behind ⓘ. */
export function roleIsRenamed(names: VendorRoleNames | null | undefined, duty: VendorDuty): boolean {
  const own = names?.[duty]?.trim();
  return !!own && own !== VENDOR_DUTY_NAME[duty];
}

/** The role pick's option — "COO · Shop Manager" when renamed, the fixed name otherwise (drawing (c)). */
export function roleOptionLabel(names: VendorRoleNames | null | undefined, duty: VendorDuty): string {
  return roleIsRenamed(names, duty) ? `${roleNameOf(names, duty)} · ${VENDOR_DUTY_NAME[duty]}` : VENDOR_DUTY_NAME[duty];
}

/**
 * The card's second line (drawing (b)): "Makati branch · 2 cards · Front desk". The role name is drawn on its own,
 * gold, above it — this is where they work and what they do.
 */
export function memberWhereLine(input: {
  duty: VendorDuty;
  branchLabel: string | null;
  cardCount?: number | null;
  teamLabel?: string | null;
  isSelf?: boolean;
}): string {
  const parts: string[] = [];
  parts.push(dutyWorksAtABranch(input.duty) ? (input.branchLabel ?? 'Main location') : 'Whole shop');
  if ((input.duty === 'account_manager' || input.duty === 'branch_manager') && typeof input.cardCount === 'number') {
    parts.push(`${input.cardCount} card${input.cardCount === 1 ? '' : 's'}`);
  }
  if (input.teamLabel?.trim()) parts.push(input.teamLabel.trim());
  if (input.isSelf) parts.push('You');
  return parts.join(' · ');
}

/** Clean a typed role name: trimmed, ≤ 40, blank → null (keeps the fixed name). Mirrors the table's CHECK. */
export function cleanRoleName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.replace(/\s+/g, ' ').trim().slice(0, 40);
  return t.length > 0 ? t : null;
}

/**
 * The Team screen's Roles row: the first three role names, then "and N more" — N counted from the list, never typed
 * (final check A5-G5-10: it read "· and 3 more" whatever the list held). Three or fewer names show them all.
 */
export function rolesRowLine(names: ReadonlyArray<string>, shown = 3): string {
  const head = names.slice(0, shown).join(' · ');
  const rest = names.length - Math.min(shown, names.length);
  return rest > 0 ? `${head} · and ${rest} more` : head;
}
