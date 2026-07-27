/**
 * The day-of requests stream — all of its decision logic, none of its I/O.
 *
 * Build plan §10 #2 (vendor status updates) + #6 (requests inbox, couple/host
 * lanes). One stream, four lanes, one inbox; the table is
 * `public.event_day_requests` (migration 20271013100000).
 *
 * Everything here is pure so the rules that actually matter — what counts as
 * open work, who may triage, which lane a viewer writes as — can be tested
 * without a database, a session, or a browser.
 *
 * ── THE INVARIANT THIS FILE OWES RLS ───────────────────────────────────────
 * `canTriage` must never return true where the migration's policies would
 * refuse the UPDATE. A vendor has SELECT + INSERT on their own lane and no
 * UPDATE policy at all, so `canTriage` is false for every vendor, always. If
 * you widen one, widen the other in the same PR — a button that 403s is worse
 * than no button. Pinned by "the helper never offers what RLS refuses" in
 * day-requests.test.ts.
 */

export type DayRequestOrigin = 'couple' | 'vendor' | 'host' | 'coordinator';
export type DayRequestKind = 'issue' | 'request' | 'status_update';
export type DayRequestStatus = 'open' | 'acknowledged' | 'resolved';

/** Matches the shipped IssuesLog input maxLength AND the table's CHECK. */
export const DAY_REQUEST_BODY_MAX = 240;

export const DAY_REQUEST_ORIGINS: readonly DayRequestOrigin[] = [
  'couple',
  'vendor',
  'host',
  'coordinator',
];

/** A row as every reader sees it. Kept to what the inbox actually renders. */
export type DayRequestRow = {
  request_id: string;
  origin: DayRequestOrigin;
  kind: DayRequestKind;
  status: DayRequestStatus;
  body: string;
  preset_key: string | null;
  author_user_id: string | null;
  author_vendor_profile_id: string | null;
  created_at: string;
};

/**
 * Who is looking at the inbox. Three audiences, mirroring the migration's
 * three RLS audiences exactly:
 *
 *   • `event`      — couple / host / delegate moderator. `role` is what the
 *                    RLS INSERT guard checks against `origin`, so it is
 *                    modelled here rather than inferred.
 *   • `coordinator`— the booked coordinator VENDOR. The inbox is theirs. They
 *                    are not an event member, which is why the migration needs
 *                    `current_coordinator_booked_event_ids()` to reach them.
 *   • `vendor`     — every other booked supplier. Reports in, never triages.
 */
export type InboxViewer =
  | { side: 'event'; userId: string; role: 'couple' | 'host' | 'coordinator'; canEdit: boolean }
  | { side: 'coordinator'; userId: string; vendorProfileId: string }
  | { side: 'vendor'; userId: string; vendorProfileId: string };

// ─── 1. The one-tap vendor presets (§10 #2) ────────────────────────────────

export type VendorStatusPreset = {
  key: string;
  /** Button copy. */
  label: string;
  /** What lands in `body` — a full sentence, because the coordinator reads a
   *  list of these out of context and "Late" alone says nothing. */
  body: string;
  /**
   * Most presets are `status_update` and must NOT show up as open work — a
   * supplier saying "we're set up" is not a problem anyone has to clear. The
   * two that genuinely need the coordinator to DO something are `issue`.
   */
  kind: DayRequestKind;
};

export const VENDOR_STATUS_PRESETS: readonly VendorStatusPreset[] = [
  { key: 'on_site', label: 'On site', body: 'We have arrived on site.', kind: 'status_update' },
  { key: 'setup_done', label: 'Setup done', body: 'Our setup is complete and ready.', kind: 'status_update' },
  { key: 'ready', label: 'Ready to start', body: 'We are ready to start on cue.', kind: 'status_update' },
  { key: 'packed_up', label: 'Packed up', body: 'We have finished and packed up.', kind: 'status_update' },
  // The two that are real work for the coordinator:
  { key: 'running_late', label: 'Running late', body: 'We are running late — please adjust the timing.', kind: 'issue' },
  { key: 'need_help', label: 'Need help', body: 'We need help from the coordinator.', kind: 'issue' },
];

export function presetByKey(key: string | null | undefined): VendorStatusPreset | null {
  if (!key) return null;
  return VENDOR_STATUS_PRESETS.find((p) => p.key === key) ?? null;
}

/** What a one-tap press sends. `null` for an unknown key — never a guess. */
export type VendorStatusDraft = {
  origin: 'vendor';
  kind: DayRequestKind;
  body: string;
  preset_key: string;
};

export function buildVendorStatusDraft(key: string | null | undefined): VendorStatusDraft | null {
  const preset = presetByKey(key);
  if (!preset) return null;
  return { origin: 'vendor', kind: preset.kind, body: preset.body, preset_key: preset.key };
}

// ─── 2. Body normalization ─────────────────────────────────────────────────

/**
 * Trim, collapse runs of whitespace, cap at the column's CHECK. Returns null
 * when nothing survives, so a caller can reject before a round-trip instead of
 * eating a constraint violation.
 */
export function normalizeRequestBody(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (!collapsed) return null;
  return collapsed.slice(0, DAY_REQUEST_BODY_MAX);
}

// ─── 3. Open work ──────────────────────────────────────────────────────────

/**
 * THE counting rule. A `status_update` is never open work no matter its
 * status — that is what keeps §10 #2's one-tap presets from turning the
 * coordinator's "3 open" badge into noise the moment suppliers start checking
 * in. Only an unresolved issue/request counts.
 */
export function countsAsOpenWork(
  row: Pick<DayRequestRow, 'kind' | 'status'>,
): boolean {
  if (row.kind === 'status_update') return false;
  return row.status !== 'resolved';
}

export type InboxSummary = {
  total: number;
  /** Unresolved issues + requests. The badge number. */
  openWork: number;
  /** Status pings, any status — surfaced separately, never as work. */
  statusUpdates: number;
  resolved: number;
  byLane: Record<DayRequestOrigin, number>;
};

export function summarizeInbox(rows: readonly DayRequestRow[]): InboxSummary {
  const byLane: Record<DayRequestOrigin, number> = {
    couple: 0,
    vendor: 0,
    host: 0,
    coordinator: 0,
  };
  let openWork = 0;
  let statusUpdates = 0;
  let resolved = 0;

  for (const row of rows) {
    // Defensive: an origin added by a later ALTER TYPE reaches an older
    // bundle as a string this map has no key for. Count it in `total`, skip
    // the lane tally, never crash the inbox.
    if (row.origin in byLane) byLane[row.origin] += 1;
    if (countsAsOpenWork(row)) openWork += 1;
    if (row.kind === 'status_update') statusUpdates += 1;
    if (row.status === 'resolved') resolved += 1;
  }

  return { total: rows.length, openWork, statusUpdates, resolved, byLane };
}

// ─── 4. Triage ─────────────────────────────────────────────────────────────

/**
 * May this viewer move this row through the status machine?
 *
 * The event side with edit rights, and the booked coordinator — exactly the
 * two arms of `event_day_requests_event_update`. A plain vendor has no UPDATE
 * policy at all, so this is false for them on every row including their own.
 * A vendor reports; the floor triages.
 */
export function canTriage(viewer: InboxViewer, _row?: DayRequestRow): boolean {
  if (viewer.side === 'coordinator') return true;
  return viewer.side === 'event' && viewer.canEdit;
}

/**
 * The lane a viewer writes as. Mirrors the RLS INSERT origin guards: an event
 * member writes couple/host/coordinator, the booked coordinator writes
 * `coordinator`, any other booked vendor writes `vendor`.
 */
export function originForViewer(viewer: InboxViewer): DayRequestOrigin {
  if (viewer.side === 'vendor') return 'vendor';
  if (viewer.side === 'coordinator') return 'coordinator';
  return viewer.role;
}

/**
 * The taxonomy tile that makes a booked vendor the floor's coordinator.
 * MUST stay in step with `'coordinator' = ANY (vp.services)` inside
 * `current_coordinator_booked_event_ids()` (migration 20271013100000) — the UI
 * decides which controls to render from this, the DB decides whether the write
 * lands, and a drift between them is a button that 403s.
 */
export const COORDINATOR_TILE = 'coordinator';

/**
 * Which side of the inbox a booked vendor sits on: the coordinator runs it,
 * everyone else reports into it.
 */
export function vendorInboxSide(
  services: readonly string[] | null | undefined,
): 'coordinator' | 'vendor' {
  return services?.includes(COORDINATOR_TILE) ? 'coordinator' : 'vendor';
}

/** The status a tap advances to — the inbox's one-button machine. */
export function nextStatus(current: DayRequestStatus): DayRequestStatus {
  if (current === 'open') return 'acknowledged';
  if (current === 'acknowledged') return 'resolved';
  return 'open'; // resolved → reopen
}

// ─── 5. Ordering ───────────────────────────────────────────────────────────

const STATUS_RANK: Record<DayRequestStatus, number> = {
  open: 0,
  acknowledged: 1,
  resolved: 2,
};

/**
 * Open work first, then acknowledged, then resolved; newest first inside each
 * band. Pure and total — returns a new array, never sorts in place, so a
 * server component can hand the same rows to two views.
 */
export function sortInbox(rows: readonly DayRequestRow[]): DayRequestRow[] {
  return [...rows].sort((a, b) => {
    const rank = (STATUS_RANK[a.status] ?? 3) - (STATUS_RANK[b.status] ?? 3);
    if (rank !== 0) return rank;
    return b.created_at.localeCompare(a.created_at);
  });
}

// ─── 6. Labels ─────────────────────────────────────────────────────────────

const LANE_LABEL: Record<DayRequestOrigin, string> = {
  couple: 'Couple',
  vendor: 'Supplier',
  host: 'Host',
  coordinator: 'Coordinator',
};

/** Falls back to the raw value so a lane added later still renders readably. */
export function laneLabel(origin: DayRequestOrigin | string): string {
  return LANE_LABEL[origin as DayRequestOrigin] ?? String(origin);
}

const STATUS_LABEL: Record<DayRequestStatus, string> = {
  open: 'Open',
  acknowledged: 'Seen',
  resolved: 'Done',
};

export function statusLabel(status: DayRequestStatus | string): string {
  return STATUS_LABEL[status as DayRequestStatus] ?? String(status);
}
