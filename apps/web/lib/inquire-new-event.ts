/**
 * 🆕 OWN-02 (live 14 Nov): back from "Start a new event" on a shop's Inquire sheet, the event just made is the one
 * picked. create-event follows `?next=` and names no event, so the sheet remembers the events the couple ALREADY had as
 * they leave, and on return picks the one event that is new. Two new (or none) → nothing is guessed.
 *
 * sessionStorage, wrapped: a private window or blocked storage reads as "nothing remembered", and the sheet behaves as
 * it did before (one event → picked; several → they choose).
 */
const KEY = 'setnayan:inquire:known-events';

export function newlyMadeEvent(known: readonly string[] | null, now: readonly string[]): string | null {
  if (!known) return null;
  const fresh = now.filter((id) => !known.includes(id));
  return fresh.length === 1 ? fresh[0]! : null;
}

export function rememberKnownEvents(ids: readonly string[]): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* nothing remembered — the sheet asks, as before */
  }
}

export function readKnownEvents(): string[] | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null;
  } catch {
    return null;
  }
}

export function forgetKnownEvents(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to forget */
  }
}
