// Exclusive seating-editor lock (PR 2 · owner lock 2026-06-13) — shared error
// type. Lives in its OWN module (not actions.ts) because a 'use server' file may
// only export async functions; a class export there is a build error. Importing
// it into actions.ts keeps the lock guard's typed, recoverable error reusable by
// any caller / future RLS-cutover path without violating the server-action rule.
export class SeatingLockError extends Error {
  readonly code = 'seating_lock_not_held';
  constructor() {
    super('Editing is locked by someone else on this event. Refresh to take over once they pause.');
    this.name = 'SeatingLockError';
  }
}
