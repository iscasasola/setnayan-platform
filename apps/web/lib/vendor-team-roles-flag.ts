/**
 * vendor-team-roles-flag.ts — the NEXT_PUBLIC flag that decides whether the new
 * vendor team scope (Secretary, locked model § 7) and the agent assignment
 * notification are live.
 *
 * (The model's other new scope, Financial, is DESCOPED — see the header of
 * `lib/vendor-team-roles.ts`. This flag does not gate it into existence.)
 *
 * NEXT_PUBLIC so the role picker rendered on the client and the server action
 * that parses its submission agree — a role the picker offers must be a role
 * the action accepts.
 *
 * Default OFF → the role picker offers exactly today's Admin/Agent/Viewer, the
 * actions parse exactly today's role set, and no assignment notification is
 * ever emitted. The DB enum value exists (migration
 * 20271004566590_vendor_team_role_secretary) but nothing can write it until the
 * owner flips this.
 *
 * Kept in its own module so `lib/vendor-team-roles.ts` stays env-free and
 * `tsx --test`-friendly.
 */
export function isVendorTeamRolesV2Enabled(): boolean {
  const v = process.env.NEXT_PUBLIC_VENDOR_TEAM_ROLES_V2;
  return v === '1' || v === 'true';
}
