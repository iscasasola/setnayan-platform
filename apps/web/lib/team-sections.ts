/**
 * Team's sections, opened IN PLACE inside the Team layer (final check B13 · B14): Roles one level under Team, Who gets
 * new inquiries one level under Roles. Their old addresses (`/team/roles`, `/team/roles/inquiries`) forward here.
 */
export const TEAM_HREF = '/vendor-dashboard/team';
export const TEAM_ROLES_HREF = `${TEAM_HREF}?section=roles`;
export const TEAM_INQUIRIES_HREF = `${TEAM_HREF}?section=inquiries`;
export type TeamSection = 'roles' | 'inquiries';
export function teamSectionOf(raw: unknown): TeamSection | null {
  return raw === 'roles' || raw === 'inquiries' ? raw : null;
}
