/**
 * released-song-requests.ts — A DELETED GUEST'S SONG REQUESTS, HELD FOR THE UNDO.
 *
 * ⚖ Owner 2026-10-03 (DECISION_LOG "A HOST CAN DELETE A GUEST WHO ALREADY
 * ACCEPTED"): the delete warning names what goes with a guest — "their reply
 * and answers, seat, +1, song request and the link to their account". So the
 * delete takes their `event_song_requests` rows away (`bulkSoftDeleteGuestsForUndo`)
 * and the Undo puts them back (`restoreDeletedGuests`), exactly like their seat.
 *
 * 🔑 THE UNDO'S COPY COMES BACK FROM THE BROWSER, and the restore writes it with
 * the service role (a host can never insert a request themselves). So this is
 * the ONE place each row is re-checked before it is written: only the guest
 * lane, only a guest the caller just restored, a real song id, a status the
 * table allows, and the decision stamp paired with the status exactly as the
 * table's CHECK pairs them. `event_id`, `origin` and `anon_key` are never taken
 * from the copy — the caller sets them.
 *
 * Pure.
 */

export type ReleasedSongRequest = {
  request_id: string;
  guest_id: string;
  song_id: number;
  requester_name: string | null;
  status: 'pending' | 'accepted' | 'declined';
  decided_by_vendor_profile_id: string | null;
  decided_at: string | null;
  created_at: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = new Set(['pending', 'accepted', 'declined']);
/** More than any guest list would ever hold back in one Undo. */
const MAX_ROWS = 500;

function isoOrNull(v: unknown): string | null {
  return typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null;
}

/** The rows that may be held / written back, each re-checked field by field. */
export function restorableSongRequests(rows: readonly unknown[], guestIds: ReadonlySet<string>): ReleasedSongRequest[] {
  const out: ReleasedSongRequest[] = [];
  const seen = new Set<string>();
  for (const raw of rows.slice(0, MAX_ROWS)) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const requestId = typeof r.request_id === 'string' && UUID.test(r.request_id) ? r.request_id : null;
    const guestId = typeof r.guest_id === 'string' ? r.guest_id : null;
    const songId = typeof r.song_id === 'number' ? r.song_id : typeof r.song_id === 'string' ? Number(r.song_id) : NaN;
    const status = typeof r.status === 'string' && STATUSES.has(r.status) ? (r.status as ReleasedSongRequest['status']) : null;
    if (!requestId || seen.has(requestId) || !guestId || !guestIds.has(guestId)) continue;
    if (!Number.isSafeInteger(songId) || songId <= 0 || !status) continue;
    const name = typeof r.requester_name === 'string' ? r.requester_name.trim().slice(0, 40) : '';
    const decidedBy =
      status !== 'pending' && typeof r.decided_by_vendor_profile_id === 'string' && UUID.test(r.decided_by_vendor_profile_id)
        ? r.decided_by_vendor_profile_id
        : null;
    // The table's CHECK: pending ⇔ no decided_at.
    const decidedAt = status === 'pending' ? null : (isoOrNull(r.decided_at) ?? new Date().toISOString());
    seen.add(requestId);
    out.push({
      request_id: requestId,
      guest_id: guestId,
      song_id: songId,
      requester_name: name || null,
      status,
      decided_by_vendor_profile_id: decidedBy,
      decided_at: decidedAt,
      created_at: isoOrNull(r.created_at) ?? new Date().toISOString(),
    });
  }
  return out;
}
