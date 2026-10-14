/**
 * lib/song-heard.ts — "Your song is ready" takes Home's Next card ONCE, until it
 * is heard (owner "approve all", 2026-10-14 — services prototype: "Hearing it
 * once hands the card back").
 *
 * 🔑 HEARD IS KEPT ON THE DEVICE, like Home's "Later" (`HomeLater`): a press of
 * "Hear your song" — on the card or the row — or the song starting to play on
 * the Music page marks it, and Home hands the card to the next step. No column,
 * no server write: opening never writes, and nothing else needs to know. A
 * cleared site or another phone shows the card once more — the safe direction
 * (the song is announced again, never missed).
 *
 * Pure and client-safe; every storage touch is try/caught (a refused store
 * keeps the card, which is the honest default).
 */
export function songHeardKey(eventId: string): string {
  return `song-heard:${eventId}`;
}

export function markSongHeard(eventId: string): void {
  try {
    window.localStorage.setItem(songHeardKey(eventId), '1');
  } catch {
    /* storage refused — the card shows once more, never missed */
  }
}

export function songWasHeard(eventId: string): boolean {
  try {
    return window.localStorage.getItem(songHeardKey(eventId)) === '1';
  } catch {
    return false;
  }
}
