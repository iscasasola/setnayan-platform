/**
 * A THREAD OPENS WITH ITS LAST-KNOWN MESSAGES, AT ONCE (owner 2026-10-27, "CHAT MUST BE EFFICIENT AND FAST": *"the
 * inbox and a thread open with no blank wait (last-known messages shown at once, fresh ones after)"*).
 *
 * The thread page is a server render with a dozen reads; until it answers, the route's `loading.tsx` used to draw a
 * grey feed skeleton. Now the stream remembers the last {@link KEEP} messages of each thread it showed, and the
 * thread's `loading.tsx` (`app/_components/chat/thread-arrival.tsx`) paints them in the thread's own shape the moment
 * the row is tapped; the server's fresh copy replaces them when it lands.
 *
 * 🔒 WHOSE WORDS. Kept in `sessionStorage` (this tab only, gone when it closes), tagged with the viewer's user id, and
 * painted ONLY when the same viewer is marked in this page's memory ({@link markChatViewer}, set by the inbox and the
 * stream). A sign-out is a full page load, which wipes that memory — so a different person signing in on the same
 * tab never sees the last person's messages, even for the second before the server answers.
 */

export const KEEP = 30;
const PREFIX = 'sn-chat-last:';

export type LastKnownRow = {
  id: string;
  mine: boolean;
  body: string;
  at: string;
  /** A card in the flow (quote, meeting…) — painted as a quiet placeholder, never re-drawn from memory. */
  card: boolean;
  file: string | null;
};

export type LastKnown = {
  uid: string;
  label: string;
  rows: LastKnownRow[];
  savedAt: number;
};

declare global {
  interface Window {
    __snChatViewer?: string;
  }
}

/** The signed-in viewer of this page, in memory only. */
export function markChatViewer(uid: string): void {
  if (typeof window !== 'undefined' && uid) window.__snChatViewer = uid;
}

type Remembered = {
  message_id: string;
  sender_role: string;
  body: string | null;
  created_at: string;
  proposal_id?: string | null;
  appointment_id?: string | null;
  change_order_id?: string | null;
  amendment_id?: string | null;
  attachment_name?: string | null;
};

/** Pure: the slice that is stored. */
export function lastKnownOf(
  rows: readonly Remembered[],
  viewerRole: string,
  uid: string,
  label: string,
  now: number,
): LastKnown {
  return {
    uid,
    label,
    savedAt: now,
    rows: rows.slice(-KEEP).map((m) => ({
      id: m.message_id,
      mine: m.sender_role === viewerRole,
      body: m.body ?? '',
      at: m.created_at,
      card: Boolean(m.proposal_id || m.appointment_id || m.change_order_id || m.amendment_id),
      file: m.attachment_name ?? null,
    })),
  };
}

export function rememberThread(
  threadId: string,
  rows: readonly Remembered[],
  who?: { viewerRole: string; uid: string; label: string },
): void {
  if (typeof window === 'undefined' || !who?.uid) return;
  try {
    window.sessionStorage.setItem(PREFIX + threadId, JSON.stringify(lastKnownOf(rows, who.viewerRole, who.uid, who.label, Date.now())));
  } catch {
    /* Private mode / full storage: the next open draws the skeleton, as before. */
  }
}

/** The remembered thread — only for the same viewer this page has marked. */
export function recallThread(threadId: string): LastKnown | null {
  if (typeof window === 'undefined') return null;
  const viewer = window.__snChatViewer;
  if (!viewer) return null;
  try {
    const raw = window.sessionStorage.getItem(PREFIX + threadId);
    if (!raw) return null;
    const v = JSON.parse(raw) as LastKnown;
    if (!v || v.uid !== viewer || !Array.isArray(v.rows)) return null;
    return v;
  } catch {
    return null;
  }
}
