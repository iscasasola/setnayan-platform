/**
 * The admin AREAS × LEVELS (DECISION_LOG 2026-11-13 — "ADMIN TEAM: AREAS ×
 * LEVELS — AI FIRST, THEN BASIC, THEN ESCALATED"). Pure and dependency-free so
 * the page, the actions and the tests all read ONE list.
 *
 * The list and its words are ported from the approved drawing
 * (Setnayan-specs `prototypes/admin_pub/admin.js` → `AREAS`), not invented.
 * Its SQL twin is `public.admin_areas()` (migration
 * 20271343355752_admin_team_areas_levels_and_owner_self_approval.sql); the test
 * beside this file fails if the two disagree.
 *
 *   BASIC     = answering and simple, reversible steps that give nothing.
 *   ESCALATED = gives something or takes it away (money, refunds, comps,
 *               prices, promos, bans and suspensions, deletions, plan changes).
 *
 * Escalated INCLUDES Basic in the same area: someone trusted to refund may also
 * confirm a payment. The owner has every area at both levels and cannot be
 * narrowed (lib/admin/owner.ts).
 */

export const ADMIN_LEVELS = ['basic', 'escalated'] as const;
export type AdminLevel = (typeof ADMIN_LEVELS)[number];

export type AdminAreaMeta = {
  key: string;
  label: string;
  /** What Basic lets you do, in the drawing's words. */
  basic: string;
  /** What Escalated adds — null where nothing in the area gives or takes anything. */
  escalated: string | null;
};

export const ADMIN_AREA_LIST = [
  { key: 'payments', label: 'Payments', basic: 'confirm a logged payment · ask for a clearer proof', escalated: 'refund · reverse · record a payment by hand' },
  { key: 'verification', label: 'Verification', basic: 'check documents · ask for more', escalated: 'approve · reject · hide a listing' },
  { key: 'disputes', label: 'Disputes', basic: 'read both sides · message both', escalated: 'decide — deposits, fee waivers' },
  { key: 'help', label: 'Help & messages', basic: 'reply · close · reopen', escalated: null },
  { key: 'chat_flags', label: 'Chat flags', basic: 'mark reviewed · dismiss', escalated: 'block a sender' },
  { key: 'photo_reports', label: 'Photo reports', basic: 'dismiss a report · hide a photo (undoable)', escalated: 'block an uploader' },
  { key: 'refunds', label: 'Refunds', basic: 'read · note', escalated: 'record a refund (over ₱25,000 waits for a second admin)' },
  { key: 'prices_promos', label: 'Prices & promos', basic: 'read', escalated: 'change a price · codes · launch offer · free windows' },
  { key: 'plans', label: 'Plans', basic: 'read', escalated: 'plan contents · set a supplier tier' },
  { key: 'gifts_comps', label: 'Gifts & comps', basic: 'read', escalated: 'give or revoke a comp · founder seats' },
  { key: 'fraud', label: 'Fraud, bans & suspensions', basic: 'read the case · dismiss a signal', escalated: 'suspend · unsuspend · ban · wipe' },
  { key: 'deletions', label: 'Deletions', basic: 'read the request', escalated: 'approve a deletion · remove an event' },
  { key: 'catalogue', label: 'Catalogue', basic: 'categories · services · words', escalated: 'hide for everyone · combine · retire' },
  { key: 'insights', label: 'Insights', basic: 'read every number', escalated: null },
  { key: 'receiving_accounts', label: 'Receiving accounts', basic: 'read', escalated: 'add or change an account or a QR' },
  { key: 'team', label: 'Team', basic: 'read', escalated: 'add an admin · set areas and levels' },
] as const satisfies readonly AdminAreaMeta[];

export type AdminArea = (typeof ADMIN_AREA_LIST)[number]['key'];

export const ADMIN_AREAS: readonly AdminArea[] = ADMIN_AREA_LIST.map((a) => a.key);

const AREA_BY_KEY = new Map<string, AdminAreaMeta>(ADMIN_AREA_LIST.map((a) => [a.key, a]));

export function isAdminArea(v: unknown): v is AdminArea {
  return typeof v === 'string' && AREA_BY_KEY.has(v);
}

export function isAdminLevel(v: unknown): v is AdminLevel {
  return v === 'basic' || v === 'escalated';
}

export function adminAreaMeta(area: string): AdminAreaMeta | null {
  return AREA_BY_KEY.get(area) ?? null;
}

export function adminAreaLabel(area: string | null | undefined): string {
  if (!area) return 'No area';
  return AREA_BY_KEY.get(area)?.label ?? area;
}

/** Does this area have an Escalated level at all? (Help and Insights do not.) */
export function areaHasEscalated(area: string): boolean {
  return Boolean(AREA_BY_KEY.get(area)?.escalated);
}

/**
 * The area each two-admin request belongs to. Deciding a request takes the
 * ESCALATED level in its area — every one of these gives or takes something.
 * A Record over the full union, so adding an action type without an area is a
 * type error, never a silent "anyone may approve it".
 */
export const APPROVAL_ACTION_AREA = {
  grant_internal_account: 'team',
  grant_team_pool: 'team',
  promote_to_admin: 'team',
  grant_team_member: 'team',
  grant_admin_escalated: 'team',
  approve_vendor_partnership: 'catalogue',
  approve_fraud_wipe_ban: 'fraud',
  approve_journal_spotlight: 'prices_promos',
  approve_comp_grant: 'gifts_comps',
  approve_large_refund: 'refunds',
  approve_payment_account_change: 'receiving_accounts',
  approve_retail_price_change: 'prices_promos',
} as const satisfies Record<string, AdminArea>;

export function areaForApprovalAction(actionType: string): AdminArea | null {
  return (APPROVAL_ACTION_AREA as Record<string, AdminArea>)[actionType] ?? null;
}

/**
 * Rows written before 2026-11-13 carry no area (the log is append-only and is
 * never backfilled). This reads one from the action NAME, for display and the
 * Area filter only. First match wins; an unknown action stays unplaced rather
 * than guessed.
 */
// `approval_<verb>:<action_type>` rows are placed by their action type first.
const AUDIT_ACTION_AREA: ReadonlyArray<readonly [RegExp, AdminArea]> = [
  [/refund/, 'refunds'],
  [/payment_account|receiving_account|payment_qr|payment_method/, 'receiving_accounts'],
  [/payment|order_|proof/, 'payments'],
  [/verif|permit|document/, 'verification'],
  [/dispute/, 'disputes'],
  [/help|ticket|support/, 'help'],
  [/chat_flag|flag_/, 'chat_flags'],
  [/photo_report|report/, 'photo_reports'],
  [/price|pricing|discount|promo|launch_offer|free_window|spotlight/, 'prices_promos'],
  [/tier|plan/, 'plans'],
  [/comp|gift|founder_seat/, 'gifts_comps'],
  [/fraud|ban|suspend|blacklist|wipe/, 'fraud'],
  [/delet|erasure|remove_event/, 'deletions'],
  [/taxonomy|category|catalog|service_|partnership/, 'catalogue'],
  [/team|admin_scope|escalat|internal|promote/, 'team'],
];

export function areaForAuditAction(action: string | null | undefined): AdminArea | null {
  if (!action) return null;
  const a = action.toLowerCase();
  const approval = /^approval_[a-z_]+:(.+)$/.exec(a);
  if (approval) return areaForApprovalAction(approval[1]) ?? 'team';
  for (const [re, area] of AUDIT_ACTION_AREA) {
    if (re.test(a)) return area;
  }
  return null;
}

/** The area of an audit row: what it recorded, else what its action implies. */
export function auditRowArea(row: { area?: string | null; action?: string | null }): AdminArea | null {
  if (row.area && isAdminArea(row.area)) return row.area;
  return areaForAuditAction(row.action);
}
