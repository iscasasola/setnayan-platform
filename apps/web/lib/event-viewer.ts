/**
 * WHO IS LOOKING AT THIS EVENT — the pure half.
 *
 * 🔑 SPLIT FROM `event-viewer.server.ts` FOR THE SAME REASON `delegate-areas.ts`
 * was split from `event-moderators.ts` (2026-08-06): that file starts with
 * `import 'server-only'`, so nothing in it can be imported by a unit test, and
 * the permission RULE is the one thing here that must never be wrong. The
 * database read stays server-side; the question "what may they see" lives
 * here, where it can be exercised directly.
 */
import { resolveAreaLevel, type AreaLevel, type DelegateArea, type ModeratorPermissions } from './delegate-areas';

export type EventViewer = {
  /** A `couple` member of this event — the host. */
  isCouple: boolean;
  /** Their accepted delegate grant, or null when they hold none. */
  delegatePermissions: ModeratorPermissions | null;
};

/**
 * What this viewer may do in one area.
 *
 * The couple are not delegates and never pass through `moderator_area_level` —
 * their access to their own event has never depended on a grant. Everyone
 * else gets exactly what the host named.
 */
export function viewerAreaLevel(viewer: EventViewer, area: DelegateArea): AreaLevel {
  if (viewer.isCouple) return 'edit';
  return resolveAreaLevel(viewer.delegatePermissions, area);
}

/**
 * Is this a delegate the host has NOT shared `area` with?
 *
 * 🔑 THE QUESTION A SCREEN ACTUALLY NEEDS. "Can they read it" is not enough,
 * because a stranger and a delegate-without-the-grant both read nothing and
 * the screen must say different things to them. This is true only for the
 * second: somebody who IS on this event and was not given this part of it.
 */
export function isDelegateWithoutArea(viewer: EventViewer, area: DelegateArea): boolean {
  if (viewer.isCouple) return false;
  if (viewer.delegatePermissions === null) return false;
  return resolveAreaLevel(viewer.delegatePermissions, area) === null;
}
