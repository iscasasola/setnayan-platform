/** Team (Helpers) — `/vendor-dashboard/team`, and the same screen inside the Shop ⚙ (`team/actions.ts`). */
export const SUP_TEAM_STAY_DOORS = [
  'supTeam.inviteVendorTeamMember',
  'supTeam.updateVendorTeamMember',
  'supTeam.removeVendorTeamMember',
  'supTeam.setVendorAgentServices',
  'supTeam.proposeAdminMotion',
  'supTeam.voteAdminMotion',
  'supTeam.cancelAdminMotion',
  'supTeam.stepDownSelf',
  // Team › Roles — Save names (six supplier roles, 19 Nov 2026), and every d–h roles write that rides it (an `op`):
  // Keep · Give · Handled by ▾ (Clients), Adjust · Reset (Who gets new inquiries).
  'supTeam.setVendorRoleNames',
] as const;
export type SupTeamStayDoor = (typeof SUP_TEAM_STAY_DOORS)[number];
