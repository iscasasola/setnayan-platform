/**
 * vendor-team-roles-flag.ts — the NEXT_PUBLIC flag that decides whether the two
 * NEW vendor team scopes (Financial · Secretary, locked model § 7) and the
 * agent assignment notification are live.
 *
 * NEXT_PUBLIC so the role picker rendered on the client and the server action
 * that parses its submission agree — a role the picker offers must be a role
 * the action accepts.
 *
 * Default OFF → the role picker offers exactly today's Admin/Agent/Viewer, the
 * actions parse exactly today's role set, and no assignment notification is
 * ever emitted. The DB enum values exist (migration
 * 20271003612974) but nothing can write them until the owner flips this.
 *
 * Kept in its own module so `lib/vendor-team-roles.ts` stays env-free and
 * `tsx --test`-friendly.
 */
export function isVendorTeamRolesV2Enabled(): boolean {
  const v = process.env.NEXT_PUBLIC_VENDOR_TEAM_ROLES_V2;
  return v === '1' || v === 'true';
}
