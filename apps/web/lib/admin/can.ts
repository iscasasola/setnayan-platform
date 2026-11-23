/**
 * can(area, level) — the PURE rule. The server half that reads the caller's
 * powers is `can.server.ts`; this file has no dependencies so it can be tested.
 *
 *   · isAdminProfile (admin-predicate.ts) stays THE GATE for opening /admin.
 *   · can() decides what an admin may DO there, area by area.
 *   · The owner can do everything, always.
 *   · Escalated in an area includes Basic in that area.
 *   · Anything unknown — an unknown area, an unreadable scope list — is NO.
 *     (Inside actions an absence denies; failing closed is correct there.)
 */
import { isAdminArea, isAdminLevel, type AdminArea, type AdminLevel, adminAreaLabel } from './areas';

export type AdminScopeRow = { area: string; level: string };

export type AdminPowers = {
  userId: string;
  isOwner: boolean;
  /** NULL means the scopes could not be read — every can() then says no. */
  scopes: ReadonlyArray<AdminScopeRow> | null;
};

export function canWith(powers: AdminPowers, area: AdminArea | string, level: AdminLevel): boolean {
  if (!isAdminArea(area) || !isAdminLevel(level)) return false;
  if (powers.isOwner) return true;
  if (!powers.scopes) return false;
  return powers.scopes.some(
    (s) => s.area === area && (s.level === level || (level === 'basic' && s.level === 'escalated')),
  );
}

/** The level an admin holds in an area: 'escalated' · 'basic' · null. */
export function levelIn(powers: AdminPowers, area: AdminArea | string): AdminLevel | null {
  if (canWith(powers, area, 'escalated')) return 'escalated';
  if (canWith(powers, area, 'basic')) return 'basic';
  return null;
}

/**
 * The sentence an admin reads when a button is greyed or an action refuses —
 * the ⓘ on the drawing. Plain words, and it says what to do instead.
 */
export function refusalFor(powers: AdminPowers, area: AdminArea | string, level: AdminLevel): string {
  const label = adminAreaLabel(area);
  if (!powers.scopes && !powers.isOwner) {
    return `Couldn’t read your admin areas just now, so nothing was changed. Reload and try again.`;
  }
  if (level === 'escalated') {
    return levelIn(powers, area) === 'basic'
      ? `This is Escalated in ${label} — you have Basic there. Escalate ▸ sends it to an Escalated admin or the owner with your note.`
      : `This is Escalated in ${label}, which isn’t one of your areas. Ask the owner to add it on the Team screen.`;
  }
  return `${label} isn’t one of your areas. Ask the owner to add it on the Team screen.`;
}
