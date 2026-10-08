import type { GuestRole, GuestSide } from '@/lib/guests';
import type { GuestActions } from '@/app/dashboard/[eventId]/guests/_components/guest-actions-context';

/**
 * The lab's stand-ins for the guest list's writes (see `lab-guest-actions.tsx`) — a plain module with NO action imported,
 * so a guard can load it and prove what they answer.
 */
let seq = 0;
const labId = () => `lab-${++seq}`;

export const LAB_GUEST_ACTIONS: Partial<GuestActions> = {
  bulkApplyRoleAndGroup: async () => undefined as never,
  createGuestGroup: async () => undefined as never,
  addSingleGuest: async (_eventId, draft) => ({
    ok: true,
    guest: {
      guest_id: labId(),
      first_name: draft.firstName || 'Lab',
      last_name: draft.lastName || 'Guest',
      side: draft.side,
      role: 'guest',
    },
  }),
  quickAddGuest: async (_eventId, input) => ({
    ok: true,
    guest: {
      guest_id: labId(),
      first_name: input.first_name,
      last_name: input.last_name,
      side: input.side as GuestSide,
      role: input.role as GuestRole,
    },
  }),
  quickCreateGroup: async (_eventId, label) => ({ ok: true, group: { group_id: labId(), label }, created: true }),
  addRoleToGuest: async (_eventId, guestId, role) => ({ ok: true, guest: { guest_id: guestId, role: role as GuestRole, extra_roles: [role as GuestRole] } }),
  setGuestPrimaryRole: async (_eventId, guestId, role) => ({ ok: true, guest: { guest_id: guestId, role: role as GuestRole, extra_roles: [] } }),
  listPeopleYouCanInvite: async () => ({
    people: [
      { key: 'lab-p1', name: 'Tita Baby Santos', lastName: 'Santos', from: 'Your people', source: 'people', alreadyHere: false, groups: [] },
      { key: 'lab-p2', name: 'Kuya Migs', lastName: '', from: 'Barkada', source: 'samahan', alreadyHere: false, groups: ['Barkada'] },
      { key: 'lab-p3', name: 'Ate Joy Reyes', lastName: 'Reyes', from: 'Your people', source: 'people', alreadyHere: true, groups: [] },
    ],
    partial: false,
  }),
  addGuestsFromPeople: async (_eventId, picks) => ({ ok: true, added: picks.length, failed: 0, firstError: null }),
  /* "Invite N" opens the lab's own one-by-one run (the REAL run on fixtures), not a real route. */
  sendRunHref: (_eventId, ids) => `/dev/guests-lab?part=run&ids=${ids.join(',')}`,
  /* Guests › Setup: the asks / how guests get in (the Maker's draft door), Reply by, Finalize — all local. */
  hubDraftAction: async () => ({ ok: true, intent: 'save', applied: 0, held: [] }),
  updatePaxSettings: async () => ({ ok: true }),
  setGuestListFinalized: async (_eventId, finalized) => ({ ok: true, locked: finalized }),
  setGuestInvitationSent: async (_eventId, _guestId, sent) => ({ ok: true, sentAt: sent ? new Date().toISOString() : null }),
};


/**
 * `?refuse=1`: Setup's three writes REFUSE with the database's own words, on purpose — so a guard (and a look at 375) can
 * prove the host never reads them: the row says one plain sentence of the page's own.
 */
export const LAB_SETUP_REFUSALS: Partial<GuestActions> = {
  hubDraftAction: async () => ({ ok: false, intent: 'save', error: 'new row violates row-level security policy for table "events"' }),
  updatePaxSettings: async () => ({ ok: false, code: 'db_error', message: 'invalid input syntax for type date: "2027-02-30"' }),
  setGuestListFinalized: async () => ({ ok: false, error: 'column events.final_pax does not exist' }),
};
