/**
 * admin-approvals — shared metadata for the two-admin (four-eyes) approval
 * queue (iteration 0023 §4 / §9.1). Pure constants + types, importable by both
 * the server component (apps/web/app/admin/approvals/page.tsx) and the server
 * actions (apps/web/app/admin/approvals/actions.ts). The DB executor lives in
 * actions.ts (it writes via the service-role client).
 *
 * V1 action types are the canonical privilege-escalation grants — simple,
 * reversible single-column updates on public.users. Other §4.2 "major
 * decisions" opt into the same primitive later via new action_type entries.
 */

export type ApprovalActionType =
  | 'grant_internal_account'
  // 'grant_team_pool' is RETIRED (owner 2026-11-05: "retire. we already have our pool = papic credits").
  // No pool table or monthly draw was ever built, so the grant gave nothing a team member could use. It is
  // no longer offered or executed; the database CHECK still allows the value so old rows stay readable.
  | 'promote_to_admin'
  // Vendor Agreement § 9.1 — "Promote a user to any admin role". Sets
  // users.is_team_member = TRUE, which isAdminProfile (lib/admin/admin-predicate.ts)
  // treats as admin. Opened by "Add to team" on the Users list (toggleTeamMember)
  // or from the picker; "Remove from team" stays single-admin, on purpose.
  | 'grant_team_member'
  | 'approve_vendor_partnership'
  | 'approve_comp_grant'
  // Anti-fraud § 5 — the irreversible fraud wipe + permanent ban routes through
  // this gate. NOT offered in the manual new-request picker (APPROVAL_ACTIONS
  // below); initiated from /admin/fraud and confirmed by a second admin in
  // /admin/approvals. target_id carries the vendor_profile_id.
  | 'approve_fraud_wipe_ban'
  // Sponsored journal spotlight — initiated AND confirmed from
  // /admin/journal-spotlights (its own executor), never offered in the picker.
  // target_id carries the spotlight_id. LAU-20: a CHECK rebuild once dropped
  // this value in prod; tests/db/every-approval-type-the-code-writes-is-allowed
  // now inserts every member of this union against the replayed schema.
  | 'approve_journal_spotlight'
  // Vendor Agreement § 9.1 — "Refund any single transaction > ₱25,000".
  // Initiated from /admin/payments by the admin filling the refund form and
  // confirmed by a second admin in /admin/approvals; never offered in the
  // picker, because a refund only makes sense against a specific paid order.
  // target_id carries the order_id; the amount, reason and proof ride in the
  // payload. The threshold itself lives in lib/two-admin-promise.ts.
  | 'approve_large_refund'
  // Vendor Agreement § 9.1 — "Modify Setnayan's static BDO / GCash
  // payment-receiving account numbers". Initiated from
  // /admin/settings/payment-methods, either by editing the account fields or
  // by uploading a new payment QR (a QR IS a destination), and confirmed by a
  // second admin. Never in the picker: there is nothing to propose in the
  // abstract, only a specific new destination. No target_id — the subject is
  // the platform_settings row; the destination rides in the payload.
  | 'approve_payment_account_change'
  // Vendor Agreement § 9.1 — "Mid-quarter price change on any in-app SKU".
  // Initiated from /admin/pricing when a save changes what a customer pays,
  // confirmed by a second admin. Never in the picker: there is nothing to
  // propose in the abstract, only a specific new price on a specific SKU.
  // target_id carries the service_code; the figures ride in the payload.
  | 'approve_retail_price_change'
  // DECISION_LOG 2026-11-13 — AREAS × LEVELS. Giving an admin the Escalated
  // level in one or more areas ("gives or takes something") is itself a
  // two-admin act; the owner gives it typed + 24 h. Raised from /admin/team,
  // never the picker. target_user_id = the admin; payload.areas = the areas.
  | 'grant_admin_escalated'
  // Owner 2026-11-13 ("Yes, add both") — what a supplier plan INCLUDES (vendor_plan_contents), changed "like a price".
  // Initiated from /admin/pricing?tab=plan-contents, confirmed by a second admin. Never in the picker. target_id
  // carries `<plan>:<key>`; the new number rides in the payload.
  | 'approve_plan_contents_change';

/**
 * Display labels for action types that are NOT in the manual picker
 * (APPROVAL_ACTIONS) but DO appear on approval rows in /admin/approvals. Keeps
 * the pending/decided lists readable without exposing them as creatable grants.
 */
const NON_PICKER_ACTION_LABEL: Record<string, string> = {
  grant_team_pool: 'Team Pool eligibility (retired)',
  approve_vendor_partnership: 'Approve supplier partnership',
  approve_comp_grant: 'Approve comp grant (money)',
  approve_fraud_wipe_ban: 'Confirm fraud wipe + permanent ban',
  approve_journal_spotlight: 'Publish sponsored journal spotlight',
  approve_large_refund: 'Approve refund over ₱25,000 (money)',
  approve_payment_account_change: 'Change a receiving account (money)',
  approve_retail_price_change: 'Change what a customer pays for a SKU (money)',
  grant_admin_escalated: 'Give an admin the Escalated level',
  approve_plan_contents_change: 'Change what a supplier plan includes',
};

export type ApprovalActionMeta = {
  type: ApprovalActionType;
  /** Short label for the picker + list rows. */
  label: string;
  /** One-line brand-voice description of what executing does. */
  description: string;
  /** Badge shown on the request row. */
  badge: string;
};

export const APPROVAL_ACTIONS: ApprovalActionMeta[] = [
  {
    type: 'grant_internal_account',
    label: 'Grant Internal account',
    description:
      'Owner/spouse tier (§10a) — permanent unlimited-use grant, bypasses billing. Sets the account internal and clears the team-member flag.',
    badge: '🟣 Internal',
  },
  {
    type: 'promote_to_admin',
    label: 'Promote to admin',
    description:
      'Sets account type to admin — full console access (and is_admin() RLS). Privilege escalation; irreversible damage potential.',
    badge: 'Admin',
  },
  {
    type: 'grant_team_member',
    label: 'Add to team',
    description:
      'Sets the team-member flag — full Setnayan HQ console access, the same as an admin. Privilege escalation under § 9.1. Removing someone from the team needs only one admin.',
    badge: '🟢 Team',
  },
];

const BY_TYPE = new Map(APPROVAL_ACTIONS.map((a) => [a.type, a]));

export function isApprovalActionType(v: unknown): v is ApprovalActionType {
  return typeof v === 'string' && BY_TYPE.has(v as ApprovalActionType);
}

export function approvalActionMeta(type: string): ApprovalActionMeta | null {
  return BY_TYPE.get(type as ApprovalActionType) ?? null;
}

export function approvalActionLabel(type: string): string {
  return approvalActionMeta(type)?.label ?? NON_PICKER_ACTION_LABEL[type] ?? type;
}

export function approvalActionBadge(type: string): string {
  if (type === 'approve_fraud_wipe_ban') return '⛔ Fraud ban';
  if (type === 'approve_vendor_partnership') return '🤝 Partnership';
  if (type === 'approve_comp_grant') return '💸 Comp';
  if (type === 'grant_team_pool') return 'Retired';
  if (type === 'grant_admin_escalated') return '🔐 Escalated';
  return approvalActionMeta(type)?.badge ?? type;
}
