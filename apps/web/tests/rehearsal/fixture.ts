/**
 * THE REHEARSAL FIXTURE — the one place its names and ids are written.
 *
 * `seed.mts` hands these to `seed.sql` as settings, and `journey.spec.ts`
 * walks to them — so the walk can never be looking for a guest the seed did
 * not make. Everything here exists only in the throw-away database a rehearsal
 * run starts and discards. No real person, no real address, no real account.
 */
export const FIXTURE = {
  hostEmail: 'host@rehearsal.test',
  /** Fixed so the walk can open the event without first reading the database. */
  eventId: 'e0e0e0e0-0000-4000-8000-000000000001',
  slug: 'rehearsal-maria-juan',
  eventName: 'Maria & Juan',
  brideName: 'Maria Santos',
  groomName: 'Juan Dela Cruz',
  /** What a guest must see on the door and the public page. */
  hostNames: ['Maria', 'Juan'],
  /** The one guest the walk invites: not yet invited, not yet replied. */
  invitedGuest: {
    id: '60606060-0000-4000-8000-000000000001',
    firstName: 'Andres',
    lastName: 'Bonifacio',
    fullName: 'Andres Bonifacio',
    qrToken: 'c0ffee00000000000000000000000001',
  },
  /** 30 guests in all: the couple, the invited guest, and 27 more. */
  otherGuests: 27,
  /** Of the 27: this many already said yes (so "coming" is not zero at the start). */
  attendingAtStart: 14,
  suppliers: 12,
  orders: 3,
} as const;
