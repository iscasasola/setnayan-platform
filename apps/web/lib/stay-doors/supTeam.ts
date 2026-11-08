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
] as const;
export type SupTeamStayDoor = (typeof SUP_TEAM_STAY_DOORS)[number];
