/**
 * A CHAT THAT IS OPEN IS READ — even for the message that arrives while it is open (chat gaps, owner 8 Nov 2026:
 * "yes build them").
 *
 * ── WHAT WAS TRUE BEFORE ─────────────────────────────────────────────────────
 * `markThreadRead` ran only when the server drew a thread (the full-screen route) or when the picked client's Chat
 * page mounted (`MarkReadWhenShown`). A message that arrived LIVE on `chat-${threadId}` while the chat sat open on
 * screen was drawn — and stayed UNREAD, for the badge and for the other side's "Seen", until the chat was opened
 * again. And "Seen" itself was a prop read once at render, so it froze there.
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────────
 * The pure half, client-safe, that the stream (`chat-message-stream.tsx`) runs:
 *   · {@link countsAsUnreadFor} — the one rule for "does this row make the thread unread for me": a PERSON wrote it
 *     (a NULL sender — a Setnayan line, the auto-reply — never counts, for anyone), it is not mine, and it is not a
 *     private line to somebody else. The SQL counters say the same since migration
 *     `20271336137492_a_line_nobody_wrote_is_never_unread`.
 *   · {@link createReadDebouncer} — ONE mark per burst of live arrivals, and only while the page is in view; an arrival
 *     in a hidden tab waits and is marked when the tab comes back.
 *   · {@link CHAT_READ_BROADCAST} — the stream tells the other side "I read it" over its OWN presence channel (no new
 *     socket), so their "Seen" moves while they look at it.
 *
 * 🔑 WHO MAY MARK IS UNCHANGED. Only the Chat view marks (coordinator ruling, 8 Nov). The stream is mounted only where
 * the Chat view is on screen — the full-screen thread route, or the picked client's / picked supplier's Chat page (the
 * shell mounts `bodies[page]` only, and the chat box lives in the Chat node alone). A picked client's Details or
 * Quotation mounts no stream, so nothing there marks — exactly as before. What the server drew is not "live": only a
 * row that ARRIVES after the stream mounted is marked.
 */

/** The presence channel's broadcast event a side sends when it has read the thread. */
export const CHAT_READ_BROADCAST = 'read';
/** One burst of live messages → one write, this long after the last of them. */
export const LIVE_READ_DEBOUNCE_MS = 1200;

type UnreadRow = { sender_user_id?: string | null; recipient?: string | null };

/**
 * Does this row make the thread unread for `viewerUserId`? A person wrote it, that person is not the viewer, and it is
 * addressed to everyone or to the viewer (`recipient`: the row's private recipient, or null). A NULL sender is a
 * system line or the auto-reply: never unread, for anyone.
 */
export function countsAsUnreadFor(row: UnreadRow, viewerUserId: string): boolean {
  const sender = row.sender_user_id ?? null;
  if (sender === null) return false;
  if (sender === viewerUserId) return false;
  const to = row.recipient ?? null;
  return to === null || to === viewerUserId;
}

/** The later of two ISO stamps (either may be null). */
export function latestRead(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(b) > Date.parse(a) ? b : a;
}

export type ReadDebouncer = {
  /** A live message from somebody else arrived. */
  arrived(): void;
  /** The page came back into view: a mark that waited while it was hidden goes now. */
  shown(): void;
  /** Unmount: nothing pending is written. */
  cancel(): void;
};

/**
 * ONE debounced mark per burst of live arrivals. Pure (the timer and the visibility test are passed in), so the rule —
 * one write, never while hidden, a hidden arrival marked on return — is held by a unit test.
 */
export function createReadDebouncer(opts: {
  mark: () => void;
  isVisible: () => boolean;
  delayMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}): ReadDebouncer {
  const delay = opts.delayMs ?? LIVE_READ_DEBOUNCE_MS;
  const setT = opts.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearT = opts.clearTimer ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>));
  let timer: unknown = null;
  let owed = false;
  let gone = false;

  const fire = () => {
    timer = null;
    if (gone) return;
    if (!opts.isVisible()) return; // stays owed; `shown()` pays it
    owed = false;
    opts.mark();
  };

  return {
    arrived() {
      if (gone) return;
      owed = true;
      if (timer !== null) clearT(timer);
      timer = setT(fire, delay);
    },
    shown() {
      if (gone || !owed || timer !== null) return;
      timer = setT(fire, delay);
    },
    cancel() {
      gone = true;
      if (timer !== null) clearT(timer);
      timer = null;
    },
  };
}
