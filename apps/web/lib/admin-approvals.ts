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
  | 'grant_team_pool'
  | 'promote_to_admin'
  | 'approve_vendor_partnership'
  // Self-contained four-eyes flow (Account-Access Model Phase 3, 2026-06-22):
  // initiated + confirmed from /admin/users (the takeover surface), NOT executed
  // by the generic approvals page. See GENERIC_EXECUTABLE_ACTION_TYPES below.
  | 'start_account_takeover';

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
      'Owner/spouse tier (§10a) — permanent unlimited-use grant, bypasses billing. Sets the account internal and clears any team-pool eligibility.',
    badge: '🟣 Internal',
  },
  {
    type: 'grant_team_pool',
    label: 'Grant Team Pool eligibility',
    description:
      'Non-owner team member (§10b) — ongoing shared-pool draw rights. Sets the account team-pool eligible and clears any internal flag.',
    badge: '🟢 Team Pool',
  },
  {
    type: 'promote_to_admin',
    label: 'Promote to admin',
    description:
      'Sets account type to admin — full console access (and is_admin() RLS). Privilege escalation; irreversible damage potential.',
    badge: 'Admin',
  },
];

/**
 * Action types the GENERIC /admin/approvals queue can execute itself via
 * approveRequest()→executeApproved() (the privilege-escalation grants). Other
 * action_types — `approve_vendor_partnership`, `start_account_takeover` — are
 * SELF-CONTAINED flows: they reuse admin_approval_requests for the four-eyes
 * handshake but are initiated AND confirmed from their own surface (which knows
 * how to execute them), so the generic page must NOT show a one-click
 * "Approve & execute" for them (executeApproved throws on those types). The
 * generic page filters its pending list to this set; approveRequest() also
 * hard-guards on it as defense-in-depth.
 */
export const GENERIC_EXECUTABLE_ACTION_TYPES: readonly ApprovalActionType[] = [
  'grant_internal_account',
  'grant_team_pool',
  'promote_to_admin',
];

export function isGenericExecutableActionType(v: unknown): v is ApprovalActionType {
  return (
    typeof v === 'string' &&
    (GENERIC_EXECUTABLE_ACTION_TYPES as readonly string[]).includes(v)
  );
}

const BY_TYPE = new Map(APPROVAL_ACTIONS.map((a) => [a.type, a]));

/**
 * Display label/badge for the SELF-CONTAINED action types that aren't in the
 * privilege-grant picker (APPROVAL_ACTIONS) but still appear on the queue's
 * pending + recently-decided lists, so they render readable text instead of the
 * raw enum string.
 */
const EXTERNAL_ACTION_DISPLAY: Record<string, { label: string; badge: string }> = {
  approve_vendor_partnership: { label: 'Verify vendor partnership', badge: 'Partnership' },
  start_account_takeover: { label: 'Start account takeover', badge: '⚠ Takeover' },
};

export function isApprovalActionType(v: unknown): v is ApprovalActionType {
  return typeof v === 'string' && BY_TYPE.has(v as ApprovalActionType);
}

export function approvalActionMeta(type: string): ApprovalActionMeta | null {
  return BY_TYPE.get(type as ApprovalActionType) ?? null;
}

export function approvalActionLabel(type: string): string {
  return approvalActionMeta(type)?.label ?? EXTERNAL_ACTION_DISPLAY[type]?.label ?? type;
}

export function approvalActionBadge(type: string): string {
  return approvalActionMeta(type)?.badge ?? EXTERNAL_ACTION_DISPLAY[type]?.badge ?? type;
}
