'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { bulkApplyRoleAndGroup, createGuestGroup } from '../groups-actions';
import { addSingleGuest } from '../inline-actions';
import { addRoleToGuest, quickAddGuest, quickCreateGroup, setGuestPrimaryRole } from '../quick-add-actions';
import { addGuestsFromPeople, listPeopleYouCanInvite } from '../people-add-actions';
import { setGuestInvitationSent } from '../../invitation/actions';
import { hubDraftAction } from '../../website/hub-draft-actions';
import { updatePaxSettings } from '../../actions';
import { setGuestListFinalized } from '../finalize-actions';
import { releaseGuestClaim } from '../[guestId]/actions';

/**
 * The guest list's writes that a plain press reaches — the SHIPPED server actions by default.
 *
 * Why this exists: the dev lab (`/dev/guests-lab`) draws the REAL screen on fixture data, and every one of these buttons
 * used to reach the real action — a lab press could reach the database (controller, 2026-10-09: the lab's Delete had called
 * the real action; nothing was harmed only because Postgres refused the id). The lab hands in stand-ins that succeed
 * LOCALLY (`app/dev/guests-lab/lab-guest-actions.tsx`); nothing in the app ever provides this context, so production runs
 * the real thing — `useGuestActions()` falls back to `REAL_GUEST_ACTIONS` for every name the provider does not override.
 *
 * Call sites keep the action's OWN name (`const { quickAddGuest } = useGuestActions();`), so every call reads — and every
 * guard that pins "the sheet calls quickAddGuest(…)" still reads — as the real call.
 * (The removal's two writes ride their own context in `guest-delete.tsx`.)
 */
export type GuestActions = {
  bulkApplyRoleAndGroup: typeof bulkApplyRoleAndGroup;
  createGuestGroup: typeof createGuestGroup;
  addSingleGuest: typeof addSingleGuest;
  quickAddGuest: typeof quickAddGuest;
  quickCreateGroup: typeof quickCreateGroup;
  addRoleToGuest: typeof addRoleToGuest;
  setGuestPrimaryRole: typeof setGuestPrimaryRole;
  addGuestsFromPeople: typeof addGuestsFromPeople;
  listPeopleYouCanInvite: typeof listPeopleYouCanInvite;
  setGuestInvitationSent: typeof setGuestInvitationSent;
  /** Guests › Setup's three writes: the asks and how guests get in (the Maker's draft door), Reply by, Finalize. */
  hubDraftAction: typeof hubDraftAction;
  updatePaxSettings: typeof updatePaxSettings;
  setGuestListFinalized: typeof setGuestListFinalized;
  /** The guest card's ⋯: New QR · Unlink account (one door, `new_qr` / `unlink_account`). */
  releaseGuestClaim: typeof releaseGuestClaim;
  /** Where "Invite N" goes: the one-by-one run, with the selected guests who still need an invitation. */
  sendRunHref: (eventId: string, ids: string[]) => string;
  /** Guests › Setup's two doors: "Send to N" (the run, for everyone still to invite) and "Pick who" (the list, in Select mode). */
  setupDoorHref: (eventId: string, door: 'send' | 'pick-who') => string;
};

export const REAL_GUEST_ACTIONS: GuestActions = {
  bulkApplyRoleAndGroup,
  createGuestGroup,
  addSingleGuest,
  quickAddGuest,
  quickCreateGroup,
  addRoleToGuest,
  setGuestPrimaryRole,
  addGuestsFromPeople,
  listPeopleYouCanInvite,
  setGuestInvitationSent,
  hubDraftAction,
  updatePaxSettings,
  setGuestListFinalized,
  releaseGuestClaim,
  sendRunHref: (eventId, ids) => `/dashboard/${eventId}/guests/send?ids=${ids.join(',')}`,
  setupDoorHref: (eventId, door) => (door === 'send' ? `/dashboard/${eventId}/guests/send` : `/dashboard/${eventId}/guests?select=to-invite`),
};

export const GuestActionsContext = createContext<Partial<GuestActions> | null>(null);

export function GuestActionsProvider({ actions, children }: { actions: Partial<GuestActions>; children: ReactNode }) {
  return <GuestActionsContext.Provider value={actions}>{children}</GuestActionsContext.Provider>;
}

export function useGuestActions(): GuestActions {
  const over = useContext(GuestActionsContext);
  return useMemo(() => (over ? { ...REAL_GUEST_ACTIONS, ...over } : REAL_GUEST_ACTIONS), [over]);
}
