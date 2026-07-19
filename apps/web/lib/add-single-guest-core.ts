/**
 * Capture-bar single-add orchestration core (T18 — orphan-groups on-failed-add).
 *
 * Extracted from app/dashboard/[eventId]/guests/inline-actions.ts › addSingleGuest
 * so the failure-after-fresh-group flow has a deterministic, DB-free seam that
 * the repo's `tsx --test` lib unit-test glob can drive (a test beside the
 * 'use server' action under app/ is never collected by that glob). The real
 * `addSingleGuest` is now a THIN wrapper that injects the live server actions as
 * `deps`, so runtime behaviour and the verbatim quickAddGuest-reuse contract are
 * preserved — only the wiring moved.
 *
 * The load-bearing addition vs. the pre-T18 flow: on `addGuest` failure we now
 * delete exactly the groups this call FRESHLY minted (never a pre-existing one)
 * and revalidate, closing the persistent orphan window. Which ids are eligible
 * is decided by `collectCreatedGroupIds`, unit-pinned separately.
 */

import type { ParsedGuestDraft } from './guest-parse';
import type { GuestRole } from './guests';
// Type-only imports from the 'use server' actions — fully erased at compile
// time, so this core pulls in no server runtime and stays unit-testable. Using
// the real result types (not re-declared clones) means the shapes can never
// drift from quick-add-actions.ts.
import type {
  QuickAddInput,
  QuickAddResult,
  QuickGroupResult,
} from '@/app/dashboard/[eventId]/guests/quick-add-actions';
import { normalizeGuestName } from './guest-name';
import { collectCreatedGroupIds } from './guest-group-compensation';

/**
 * The side-effecting dependencies `runAddSingleGuest` needs. The production
 * wrapper injects the real server actions; tests inject deterministic fakes.
 *
 * `deleteEmptyGroup` is the compensation primitive: the wrapper's real
 * implementation guards it with a memberships-count check (never cascade-delete
 * a group a concurrent same-couple tab just populated) and the couple-scoped
 * `.eq('group_id').eq('event_id')` delete pattern.
 */
export interface AddSingleGuestDeps {
  createGroup(eventId: string, name: string): Promise<QuickGroupResult>;
  addGuest(eventId: string, input: QuickAddInput): Promise<QuickAddResult>;
  resolveOfferedRoles(eventId: string): Promise<GuestRole[]>;
  attachMembership(groupId: string, guestId: string): Promise<void>;
  setPlusOne(guestId: string): Promise<void>;
  deleteEmptyGroup(groupId: string, eventId: string): Promise<void>;
  revalidate(eventId: string): void;
}

export async function runAddSingleGuest(
  eventId: string,
  draft: ParsedGuestDraft,
  deps: AddSingleGuestDeps,
): Promise<QuickAddResult> {
  // Guard the clearly-failing add BEFORE creating any `#groups` — the common
  // capture-bar miss is a mononym like "Ana #Barkada". Mirrors quickAddGuest's
  // exact normalize + message so this path never drifts softer. (Any OTHER
  // failure that slips past here is caught by the compensation block below.)
  if (!normalizeGuestName(draft.firstName) || !normalizeGuestName(draft.lastName)) {
    return { ok: false, error: 'Add both a first and last name.' };
  }

  // Resolve/create the parsed group names → ids up front (order preserved),
  // tracking every result so the compensation step can delete ONLY the groups
  // this call freshly minted. `groupIds` is byte-identical to the pre-T18 logic.
  const groupIds: string[] = [];
  const groupResults: QuickGroupResult[] = [];
  for (const name of draft.groups) {
    const res = await deps.createGroup(eventId, name);
    groupResults.push(res);
    if (res.ok && !groupIds.includes(res.group.group_id)) {
      groupIds.push(res.group.group_id);
    }
    // A group we couldn't create/find just isn't attached — the add proceeds.
  }
  const createdGroupIds = collectCreatedGroupIds(groupResults);

  // Map the role hint to a real role only when the event offers it (else guest).
  let role: GuestRole = 'guest';
  if (draft.roleHint) {
    const offeredRoles = await deps.resolveOfferedRoles(eventId);
    if (offeredRoles.includes(draft.roleHint)) role = draft.roleHint;
  }

  // Core insert + validation (names required, side valid, finalize gate, the
  // bride/groom singleton 23505 message, the auto-place reconcile) — verbatim.
  const added = await deps.addGuest(eventId, {
    first_name: draft.firstName,
    last_name: draft.lastName,
    side: draft.side,
    role,
    group_id: groupIds[0] ?? null,
  });

  if (!added.ok) {
    // ORPHAN COMPENSATION: the add failed after we may have minted groups up
    // front. Delete ONLY the ids this call freshly created (never a pre-existing
    // group), then revalidate so the removed groups don't linger in the Groups
    // sidebar (quickCreateGroup revalidated on mint; the failed add did not).
    // Best-effort: deleteEmptyGroup swallows/logs its own errors, and we always
    // return the REAL add failure so the user sees WHY the add bounced.
    for (const gid of createdGroupIds) {
      await deps.deleteEmptyGroup(gid, eventId);
    }
    if (createdGroupIds.length > 0) deps.revalidate(eventId);
    return added;
  }

  const guestId = added.guest.guest_id;

  // Extra groups beyond the first (which quickAddGuest already attached).
  // KNOWN NARROW GAP (pre-existing, out of the T18 insert-failure window): the
  // guest INSERT has already succeeded here, so we do NOT run orphan-group
  // compensation. If a freshly-minted extra group's membership attach fails
  // (a mid-sequence DB/RLS error on this second write), that group is left
  // empty. attachMembership swallows its error to keep the succeeded add intact;
  // closing this fully would mean error-checking each attach and cleaning up its
  // gid only when it is in createdGroupIds AND still empty. Left as-is because it
  // requires a failure strictly after a successful insert and never loses the
  // guest — tracked as a follow-up, not part of the orphan window this flow closes.
  for (const gid of groupIds.slice(1)) {
    await deps.attachMembership(gid, guestId);
  }

  // Plus-one permission from the parsed `+N`.
  if (draft.plusOnes > 0) {
    await deps.setPlusOne(guestId);
  }

  deps.revalidate(eventId);
  return added;
}
