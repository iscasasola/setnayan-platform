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

/**
 * 🧰 THE CHECKLIST TEMPLATE'S TOOLS (DECISION_LOG 2026-11-23, the most-shared unbuilt hub tools). The shot list was the
 * one checklist that shipped; three more hub tools are the same shape and ride its rows (`event_shot_list_items.tool_key`,
 * migration 20271361191665), its actions and its component. Each key is a `hub_tools` record (lib/hub-tools.ts).
 * The seed is where a new list starts — short, plain, and the supplier edits it on the spot.
 */
export const CHECKLIST_TOOL_KEYS = [
  'shot_list',
  'paperwork_checklist',
  'load_in_and_venue_access',
  'delivery_and_drop_off',
] as const;
export type ChecklistToolKey = (typeof CHECKLIST_TOOL_KEYS)[number];

/** The counter template's tool that also rides these rows: one row per serve (label `QUEUE_SERVED_LABEL`). */
export const QUEUE_TOOL_KEY = 'queue_counter' as const;
export const QUEUE_SERVED_LABEL = 'Served';

/** Every tool whose rows live in `event_shot_list_items` — what the actions accept. */
export type ListToolKey = ChecklistToolKey | typeof QUEUE_TOOL_KEY;

export function isListToolKey(v: unknown): v is ListToolKey {
  return v === QUEUE_TOOL_KEY || (typeof v === 'string' && (CHECKLIST_TOOL_KEYS as readonly string[]).includes(v));
}

export type ChecklistTool = {
  key: ChecklistToolKey;
  title: string;
  /** The line under the title. `{event}` is the event's name. */
  line: string;
  /** The word for a ticked row: "captured" · "done". */
  doneWord: string;
  /** The add box's placeholder. */
  addHint: string;
  seed: readonly string[];
};

export const CHECKLIST_TOOLS: Readonly<Record<ChecklistToolKey, ChecklistTool>> = {
  shot_list: {
    key: 'shot_list',
    title: 'Shot list',
    line: 'Your must-get shots for {event}. Tap to check them off as you go.',
    doneWord: 'captured',
    addHint: 'Add a shot',
    seed: DEFAULT_SHOTS,
  },
  paperwork_checklist: {
    key: 'paperwork_checklist',
    title: 'Paperwork checklist',
    line: 'The papers for {event}. Tick each one when it is in hand.',
    doneWord: 'done',
    addHint: 'Add a paper',
    seed: ['Valid IDs', 'Signed forms', 'Permits', 'Certificates', 'Copies given to the hosts'],
  },
  load_in_and_venue_access: {
    key: 'load_in_and_venue_access',
    title: 'Load-in & venue access',
    line: 'How you get in and set up at {event}. Tick each one when it is sorted.',
    doneWord: 'done',
    addHint: 'Add a step',
    seed: ['Gate pass', 'Parking for the van', 'Service elevator', 'Power near your spot', 'Load-in time', 'Load-out time'],
  },
  delivery_and_drop_off: {
    key: 'delivery_and_drop_off',
    title: 'Delivery & drop-off',
    line: 'What goes where for {event}. Tick each one when it is done.',
    doneWord: 'done',
    addHint: 'Add a delivery',
    seed: ['Delivery time agreed', 'Drop-off spot agreed', 'Who receives it', 'Delivered', 'Pick-up or return'],
  },
};

/** The checklist config for a key; anything else reads as the shot list (the column's default). */
export function checklistTool(key: unknown): ChecklistTool {
  return typeof key === 'string' && key in CHECKLIST_TOOLS ? CHECKLIST_TOOLS[key as ChecklistToolKey] : CHECKLIST_TOOLS.shot_list;
}

/**
 * 🔢 THE QUEUE COUNTER'S NUMBERS — served (rows) of coming (the RSVP's attending, the brief's own count). `coming`
 * null = the brief was not read: the "of" side is said unread, never drawn as 0. The bar is capped at full; serving
 * more than the guest count (seconds, walk-ins) still counts.
 */
export function queueCounterView(served: number, coming: number | null): { served: number; of: number | null; pct: number } {
  const s = Math.max(0, Math.floor(served));
  if (coming == null || coming <= 0) return { served: s, of: coming == null ? null : 0, pct: 0 };
  return { served: s, of: coming, pct: Math.min(100, Math.round((s / coming) * 100)) };
}

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

/* ── 🧰 THE STORE THE CHECKLIST AND THE COUNTER TALK TO ─────────────────────────────────────────────────────────────
 * The shipped actions (`on-the-day/shot-list-actions.ts`) by default. A dev lab hands `memoryListStore()` instead, so
 * every control can be pressed on sample data with no sign-in and no database (labs only — never a page). */

export type ListWrite = { ok: true } | { ok: false; error: string };
export type ListStore = {
  load: (eventId: string, tool?: ListToolKey) => Promise<ServerRead>;
  replace: (
    eventId: string,
    shots: ReadonlyArray<{ label: string; done: boolean }>,
    tool?: ListToolKey,
  ) => Promise<{ ok: true; shots: Shot[] } | { ok: false; error: string }>;
  add: (eventId: string, label: string, position: number, tool?: ListToolKey) => Promise<{ ok: true; shot: Shot } | { ok: false; error: string }>;
  setDone: (eventId: string, itemId: string, done: boolean) => Promise<ListWrite>;
  remove: (eventId: string, itemId: string) => Promise<ListWrite>;
};

/** An in-memory store with the actions' contract (labs and tests): rows per tool, `seed` saved up front. */
export function memoryListStore(seed: Partial<Record<ListToolKey, ReadonlyArray<{ label: string; done?: boolean }>>> = {}): ListStore {
  let n = 0;
  const id = () => `mem_${++n}`;
  type Row = ShotRow & { tool: ListToolKey };
  let rows: Row[] = [];
  const at = () => new Date().toISOString();
  for (const [tool, list] of Object.entries(seed) as Array<[ListToolKey, ReadonlyArray<{ label: string; done?: boolean }>]>) {
    list.forEach((s, i) => rows.push({ item_id: id(), vendor_profile_id: 'lab', label: s.label, position: i, captured_at: s.done ? at() : null, tool }));
  }
  return {
    async load(_e, tool = 'shot_list') {
      return { state: 'ok', rows: rows.filter((r) => r.tool === tool).map(({ tool: _t, ...r }) => r) };
    },
    async replace(_e, shots, tool = 'shot_list') {
      rows = rows.filter((r) => r.tool !== tool);
      const added = shots.map((s, i) => ({ item_id: id(), vendor_profile_id: 'lab', label: s.label, position: i, captured_at: s.done ? at() : null, tool }));
      rows.push(...added);
      return { ok: true, shots: added.map(shotFromRow) };
    },
    async add(_e, label, position, tool = 'shot_list') {
      const clean = normalizeShotLabel(label);
      if (!clean) return { ok: false, error: 'Write it first.' };
      const row: Row = { item_id: id(), vendor_profile_id: 'lab', label: clean, position, captured_at: tool === QUEUE_TOOL_KEY ? at() : null, tool };
      rows.push(row);
      return { ok: true, shot: shotFromRow(row) };
    },
    async setDone(_e, itemId, done) {
      const r = rows.find((x) => x.item_id === itemId);
      if (!r) return { ok: false, error: 'That row is no longer on the saved list.' };
      r.captured_at = done ? at() : null;
      return { ok: true };
    },
    async remove(_e, itemId) {
      const before = rows.length;
      rows = rows.filter((x) => x.item_id !== itemId);
      return rows.length < before ? { ok: true } : { ok: false, error: 'That row is no longer on the saved list.' };
    },
  };
}
