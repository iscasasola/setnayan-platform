/**
 * seating-presence-peers.ts — the seat plan's presence list, rebuilt from a presence `sync` WITHOUT a render when
 * nothing about the others changed.
 *
 * 🔂 RENDERED ONCE ON OPEN (2026-10-22). Supabase fires `sync` whenever presence moves — including for THIS person's
 * own join and every re-`track` (the lock state on open, then the lock heartbeat every 30 s). The handler used to
 * answer every `sync` with a brand-new `Map`, and a new Map is a new value to React: the whole seat-plan editor
 * (thousands of lines, every table and chair) re-rendered after the first paint — two or three times on open for a
 * couple alone on the plan, and again every 30 s — with nobody else there and nothing on screen changed.
 * `nextPeers` hands back the SAME Map when the others are exactly as they were, so React skips the render; a real
 * arrival, departure, table pick or lock change still makes a new Map and is drawn at once.
 *
 * Pure (no React, no Supabase) so the node guard can drive it: `apps/web/lib/budget-and-seating-render-once.test.ts`.
 */

export type PresencePeer = {
  id: string;
  name: string;
  color: string;
  /** table_id this peer currently has selected (their popup is open on it) */
  table: string | null;
  /** last cursor position in canvas percent, with a freshness timestamp */
  cursor: { x: number; y: number; ts: number } | null;
  /**
   * Seating-editor lock (PR 2) — who this peer believes holds the exclusive
   * editor lock, and when that holder last heartbeated. Carried on presence so
   * every editor can render the "X is editing — view only" banner and compute
   * stale-takeover eligibility from the SERVER heartbeat without polling an RPC.
   * Null on all three when nobody is editing yet.
   */
  lockHolderId: string | null;
  lockHolderLabel: string | null;
  lockHeartbeatAt: string | null;
};

/** One person's presence payload, as `channel.presenceState()` hands it back. */
export type PresenceMeta = {
  name: string;
  table: string | null;
  lockHolderId?: string | null;
  lockHolderLabel?: string | null;
  lockHeartbeatAt?: string | null;
};

// Same earthy accents as guest groups — deterministic per user id.
const PEER_COLORS = ['#C97B4B', '#5B8FA0', '#7BA05B', '#A05B8F', '#C2913B', '#6B7FB0', '#B0655B', '#4FA08C'];
export function peerColor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return PEER_COLORS[Math.abs(h) % PEER_COLORS.length]!;
}

function samePeer(a: PresencePeer, b: PresencePeer): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.color === b.color &&
    a.table === b.table &&
    a.cursor === b.cursor &&
    a.lockHolderId === b.lockHolderId &&
    a.lockHolderLabel === b.lockHolderLabel &&
    a.lockHeartbeatAt === b.lockHeartbeatAt
  );
}

/**
 * The others on the plan after a presence `sync` — everyone in `state` except `meId`, each keeping the cursor last
 * seen for them. Returns `prev` ITSELF when that list is exactly what is already drawn.
 */
export function nextPeers(
  prev: ReadonlyMap<string, PresencePeer>,
  state: Record<string, readonly PresenceMeta[] | undefined>,
  meId: string,
): Map<string, PresencePeer> {
  const next = new Map<string, PresencePeer>();
  for (const [key, metas] of Object.entries(state)) {
    if (key === meId) continue;
    const meta = metas?.[0];
    if (!meta) continue;
    const old = prev.get(key);
    next.set(key, {
      id: key,
      name: meta.name || 'Someone',
      color: peerColor(key),
      table: meta.table ?? null,
      cursor: old?.cursor ?? null,
      lockHolderId: meta.lockHolderId ?? null,
      lockHolderLabel: meta.lockHolderLabel ?? null,
      lockHeartbeatAt: meta.lockHeartbeatAt ?? null,
    });
  }
  if (next.size !== prev.size) return next;
  for (const [key, peer] of next) {
    const old = prev.get(key);
    if (!old || !samePeer(old, peer)) return next;
  }
  // Nothing about the others changed: the same Map, so React does not re-render the editor.
  return prev as Map<string, PresencePeer>;
}
