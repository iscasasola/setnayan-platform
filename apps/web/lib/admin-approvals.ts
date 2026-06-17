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
  | 'approve_vendor_partnership';

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

const BY_TYPE = new Map(APPROVAL_ACTIONS.map((a) => [a.type, a]));

export function isApprovalActionType(v: unknown): v is ApprovalActionType {
  return typeof v === 'string' && BY_TYPE.has(v as ApprovalActionType);
}

export function approvalActionMeta(type: string): ApprovalActionMeta | null {
  return BY_TYPE.get(type as ApprovalActionType) ?? null;
}

export function approvalActionLabel(type: string): string {
  return approvalActionMeta(type)?.label ?? type;
}

export function approvalActionBadge(type: string): string {
  return approvalActionMeta(type)?.badge ?? type;
}
