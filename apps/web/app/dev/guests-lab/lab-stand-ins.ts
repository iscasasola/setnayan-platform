import type { GuestRole, GuestSide } from '@/lib/guests';
import type { GuestActions } from '@/app/dashboard/[eventId]/guests/_components/guest-actions-context';

/**
 * The lab's stand-ins for the guest list's writes (see `lab-guest-actions.tsx`) — a plain module with NO action imported,
 * so a guard can load it and prove what they answer.
 */
/** The lab asks its own provider to move a search param on the page (`LabGuestActions` listens and calls `router.replace`). */
export const LAB_NAVIGATE_EVENT = 'setnayan:lab-navigate';

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
  /* 👥 The one Group dropdown's ✎ / 🗑 — local; the count is the lab's fixture size (12, as the prototype's A5). */
  editGuestGroupInPlace: async (_eventId, groupId, edit) =>
    edit.op === 'count' ? { ok: true, n: 12 } : { ok: true, group: { group_id: groupId, label: edit.op === 'rename' ? edit.label.trim() : '' } },
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
  addGuestsFromPeople: async (_eventId, picks) => ({ ok: true, added: picks.length, failed: 0, firstError: null, guestIds: picks.map(() => labId()) }),
  /* "Invite N" opens the lab's own one-by-one run (the REAL run on fixtures), not a real route. */
  sendRunHref: (_eventId, ids) => `/dev/guests-lab?part=run&ids=${ids.join(',')}`,
  /* Setup's "Send to N" and "Pick who" stay in the lab: its own run, its own list. */
  setupDoorHref: (_eventId, door) => (door === 'send' ? '/dev/guests-lab?part=run' : '/dev/guests-lab?part=screen&select=to-invite'),
  /* Guests › Setup: the asks / how guests get in (the Maker's draft door), Reply by, Finalize — all local. */
  hubDraftAction: async () => ({ ok: true, intent: 'save', applied: 0, held: [] }),
  updatePaxSettings: async () => ({ ok: true }),
  /* A finalize that lands is SEEN: the lab's headcount comes from its `?hc=` fixture param, so the stand-in asks the lab to move
     the param with `router.replace` (a `replaceState` alone is not followed by `router.refresh()` — measured on :3480, 3.5 s later
     the row still read "Finalize now") and the server redraws the row: "Reopen guest list" and the locked headcount, and back. */
  setGuestListFinalized: async (_eventId, finalized) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(LAB_NAVIGATE_EVENT, { detail: { set: { hc: finalized ? 'locked' : 'open' } } }));
    }
    return { ok: true, locked: finalized };
  },
  /* The card's ⋯ (New QR · Unlink account): nothing is written; the sheet closes as it does when it lands. */
  releaseGuestClaim: async () => undefined,
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

/**
 * `?addMs=N` — the two adds (the name box's `addSingleGuest`, Quick add's `quickAddGuest`) answer after N ms, the way a
 * real add waits on the server; a name with "Refuse" in it is refused in plain words. Every add that starts is written, in
 * order, to `window.__labWrites` — so a walk can prove ten Enters made ten writes, in the order they were typed, with no
 * duplicate. Nothing leaves the machine.
 */
export function labTimedAdds(ms: number): Partial<GuestActions> {
  const wait = () => new Promise<void>((r) => setTimeout(r, Math.max(0, ms)));
  const log = (name: string, phase: 'start' | 'end') => {
    if (typeof window === 'undefined') return;
    const w = window as unknown as { __labWrites?: { name: string; phase: string; t: number }[] };
    (w.__labWrites ??= []).push({ name, phase, t: performance.now() });
  };
  return {
    addSingleGuest: async (eventId, draft, opts) => {
      const name = `${draft.firstName} ${draft.lastName}`.trim();
      log(name, 'start');
      await wait();
      log(name, 'end');
      if (/refuse/i.test(name)) return { ok: false, error: 'Couldn’t add that guest. Try again.' };
      return LAB_GUEST_ACTIONS.addSingleGuest!(eventId, draft, opts);
    },
    addGuestsFromPeople: async (eventId, picks, side, withPicks) => {
      const name = `People ${picks.map((p) => p.key).join(',')}`;
      log(name, 'start');
      await wait();
      log(name, 'end');
      return LAB_GUEST_ACTIONS.addGuestsFromPeople!(eventId, picks, side, withPicks);
    },
    quickAddGuest: async (eventId, input, opts) => {
      const name = `${input.first_name} ${input.last_name}`.trim();
      log(name, 'start');
      await wait();
      log(name, 'end');
      if (/refuse/i.test(name)) return { ok: false, error: 'Couldn’t add that guest. Try again.' };
      return LAB_GUEST_ACTIONS.quickAddGuest!(eventId, input, opts);
    },
  };
}
