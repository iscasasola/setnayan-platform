/**
 * The day-of shot list — the pure half (DAY-10).
 *
 * A booked photo/video supplier keeps a must-get shot list per event on the On
 * the Day console. Since migration 20271234188149 the list lives in
 * `public.event_shot_list_items`, so it follows the supplier to a second device
 * AND reaches the couple, who read it on their vendor workspace.
 *
 * Everything that can be got wrong without a database lives here, so the tests
 * EXECUTE it rather than grep for it: label normalisation, the default seed,
 * row → view mapping, and the one decision that matters on first open — which
 * list to show, and whether it has reached the couple yet.
 */

/** The shipped input's maxLength, and the table's CHECK. One number. */
export const SHOT_LABEL_MAX = 140;

export const DEFAULT_SHOTS: readonly string[] = [
  'Getting-ready details (rings, shoes, invite, perfume)',
  'Bride portrait',
  'Groom portrait',
  'First look',
  'Processional / entrance',
  'Ceremony wide + the vows',
  'The kiss',
  'Recessional',
  'Family & principal-sponsor groupings',
  'Full entourage',
  'Couple portraits (golden hour)',
  'Reception room, empty',
  'Grand entrance',
  'First dance',
  'Toasts / speeches',
  'Cake cutting',
  'Bouquet & garter toss',
  'Candid guest moments',
  'Send-off',
];

/** One shot as the console holds it. `id` is the DB `item_id` once saved. */
export type Shot = { id: string; label: string; done: boolean };

/** One row as the table returns it. */
export type ShotRow = {
  item_id: string;
  vendor_profile_id: string;
  label: string;
  position: number;
  captured_at: string | null;
};

/** Trim, collapse to the column's limit; `null` when nothing is left. */
export function normalizeShotLabel(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().slice(0, SHOT_LABEL_MAX).trim();
  return t.length > 0 ? t : null;
}

export function shotFromRow(row: ShotRow): Shot {
  return { id: row.item_id, label: row.label, done: row.captured_at != null };
}

/** Rows in display order: position, then label as a stable tiebreak. */
export function sortShotRows<T extends Pick<ShotRow, 'position' | 'label'>>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => a.position - b.position || a.label.localeCompare(b.label));
}

/**
 * Parse whatever the device-local cache holds. Anything malformed is dropped,
 * never thrown — a corrupt cache must not blank a wedding-day list.
 */
export function parseLocalShots(raw: string | null): Shot[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const out: Shot[] = [];
    for (const s of parsed) {
      if (!s || typeof s !== 'object') continue;
      const label = normalizeShotLabel((s as { label?: unknown }).label);
      if (!label) continue;
      const id = (s as { id?: unknown }).id;
      out.push({
        id: typeof id === 'string' && id ? id : `local_${out.length}`,
        label,
        done: Boolean((s as { done?: unknown }).done),
      });
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * Where the list the console shows came from, and therefore whether the
 * couple can see it. The UI must say so — a list that is only on this phone
 * must never look like one the couple has.
 *
 *  - `server`    — read from the table; this IS what the couple sees.
 *  - `unsaved`   — the table has nothing yet for this supplier. What is shown
 *                  (a device-local list from before the sync, or the default
 *                  seed) has NOT reached the couple; the first save sends it.
 *  - `offline`   — the table could not be read. Showing the device copy; the
 *                  couple may be seeing something older.
 */
export type ShotListSource = 'server' | 'unsaved' | 'offline';

export type ServerRead =
  | { state: 'ok'; rows: ShotRow[] }
  | { state: 'unreadable' };

export function decideInitialShots(
  server: ServerRead,
  local: Shot[] | null,
  seed: () => Shot[],
): { shots: Shot[]; source: ShotListSource } {
  if (server.state === 'unreadable') {
    return { shots: local ?? seed(), source: 'offline' };
  }
  if (server.rows.length > 0) {
    return { shots: sortShotRows(server.rows).map(shotFromRow), source: 'server' };
  }
  // Nothing saved yet. A list the supplier built on this device before the
  // sync existed is theirs — keep it rather than replacing it with the seed.
  return { shots: local && local.length > 0 ? local : seed(), source: 'unsaved' };
}
