/**
 * ↺ WHEN THE SERVER'S RSVP CONFIG IS THE TRUTH AGAIN — the RSVP stage after Undo · Restore · Reset.
 *
 * A tester, 2026-10-11 night: RSVP stage → ＋ below the question → Message → typed → ↺ ↺. ↺ and ✓ went grey (the two
 * steps were taken back), and the reply card on the canvas STILL SHOWED the added line — after 14 s, after another
 * stage and back; it left only when the Maker was reopened.
 *
 * WHY. Every change on the RSVP stage is drawn first and saved behind it with NO render of the Maker (`held`), so
 * the stage and its panel build on the Maker's own copy of the config (`lib/maker-draft-store.ts`) and the stage
 * re-posts that copy to each of its frames. ↺ is the opposite: the draft moves on the SERVER and one render brings
 * it. Nothing told the stage's frames about that render — and when the undone step was the only one of the visit,
 * the server was back at exactly the value the copy was built on, which the store reads as "no render has brought
 * anything newer": the panel kept the undone edit too, and the next save would have written it back.
 *
 * THE RULE (content cannot tell an undo from a render that left before a save landed — only the order of things
 * can). A write the canvas did not draw announces itself (`MAKER_UNHELD_WRITE_EVENT` — ↺, Restore, Reset, ✓ Apply,
 * a move) and FLUSHES every pick still waiting first, and the router runs writes and renders in the order they were
 * sent. So the first render that LANDS after such a write, with no RSVP write of ours still on its way, holds
 * everything of ours that was sent before it: it is the truth. The stage then drops its own copy and tells its
 * frames and its panel. A render that lands for any other reason is judged as before.
 *
 * Pure: the caller hands in what it sees. One instance for the session (`rsvpStageTruth`) — the RSVP stage is
 * unmounted while another stage is on show, and an undo pressed there must still be answered when it comes back.
 */

const NONE = Symbol('nothing owed');

export type RsvpStageTruth = {
  /** A write the canvas did not draw was announced: the next render that lands owes the truth. */
  unheld(): void;
  /**
   * The stage is rendered with this server config object (call on every render that hands a NEW object, and on
   * mount). True: that render is the truth — drop the Maker's own copy. `pending`: an RSVP write of ours is still on
   * its way (its own answer decides; nothing is owed after it).
   */
  lands(server: object | null, pending: boolean): boolean;
};

export function createRsvpStageTruth(): RsvpStageTruth {
  /** The server object on hand when the write was announced — a render is one that hands a DIFFERENT object. */
  let owedSince: object | null | typeof NONE = NONE;
  let last: object | null = null;
  return {
    unheld() {
      owedSince = last;
    },
    lands(server, pending) {
      const owed = owedSince !== NONE && server !== owedSince;
      last = server;
      if (!owed) return false;
      owedSince = NONE;
      return !pending;
    },
  };
}

export const rsvpStageTruth = createRsvpStageTruth();
