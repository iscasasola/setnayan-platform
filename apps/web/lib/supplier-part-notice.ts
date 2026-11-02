/**
 * 🔔 A HOST OR COORDINATOR CHANGED A SUPPLIER'S PART — what changed, and the words (supplier gate audit D6,
 * 2026-11-02; DECISION_LOG 2026-11-02 "A SUPPLIER'S SCHEDULE BASICS FOR THIS WEEK" (6), owner verbatim: *"getting
 * notifications if they are changed by user"*).
 *
 * Pure (no I/O): `lib/supplier-part-notify.server.ts` reads the moments BEFORE and AFTER one save and hands both
 * snapshots here. A moment matters to a supplier when it names them (`responsible_vendor_ids`) on EITHER side, so a
 * supplier taken off a moment, and a moment deleted outright, are both told — the after-side alone would miss them.
 *
 * ONE SAVE → ONE NOTICE PER SUPPLIER, however many of their moments it touched (a chapter move carries every moment
 * in it; a retime moves a span). Grouping per supplier is `changesByVendor`; one notice per PERSON (an owner of two
 * shops is told once) is the server's.
 */

/** The fields of one moment a supplier works to. `is_public` (shown to guests) and `sort_order` are NOT here on
 *  purpose: neither changes when, where or what the supplier does, so a save that only touches them tells nobody. */
export const PART_FIELDS = [
  'label',
  'start_at',
  'end_at',
  'time_tba',
  'location',
  'spot',
  'notes',
  'block_type',
  'ingress_minutes_before',
  'egress_minutes_after',
  'call_lead_minutes',
  // ⏭ Which moment a "right after" moment follows decides when it happens (20271302727358).
  'follows_block_id',
  // 🕑 "About 3:15" · "2:15/2:30" — how its clock is meant is when it happens (20271303051692).
  'time_shape',
  'time_or_minutes',
] as const;

export type PartMoment = {
  block_id: string;
  parent_block_id: string | null;
  label: string | null;
  responsible_vendor_ids: string[] | null;
} & Partial<Record<(typeof PART_FIELDS)[number], unknown>>;

export type PartChangeKind = 'changed' | 'removed' | 'added' | 'taken_off';

export type PartChange = { blockId: string; label: string; kind: PartChangeKind };

function fingerprint(m: PartMoment): string {
  return JSON.stringify(PART_FIELDS.map((f) => m[f] ?? null));
}

/**
 * What one save did to each supplier's moments. `before` is every moment the save could touch, read first; `after`
 * is the same ids read again (a deleted moment is simply absent). `touched` names moments changed in a way the
 * fields above cannot see (a crew line, a march) — each of their suppliers is told "changed".
 */
export function changesByVendor(
  before: readonly PartMoment[],
  after: readonly PartMoment[],
  touched: ReadonlySet<string> = new Set(),
): Map<string, PartChange[]> {
  const afterById = new Map(after.map((m) => [m.block_id, m]));
  const out = new Map<string, PartChange[]>();
  const add = (vendorId: string, change: PartChange) => {
    const list = out.get(vendorId) ?? [];
    if (!list.some((c) => c.blockId === change.blockId)) list.push(change);
    out.set(vendorId, list);
  };
  for (const was of before) {
    const now = afterById.get(was.block_id) ?? null;
    const label = (now?.label ?? was.label ?? '').trim() || 'A moment';
    const wasOn = new Set(was.responsible_vendor_ids ?? []);
    if (!now) {
      for (const v of wasOn) add(v, { blockId: was.block_id, label, kind: 'removed' });
      continue;
    }
    const nowOn = new Set(now.responsible_vendor_ids ?? []);
    const moved = touched.has(was.block_id) || fingerprint(was) !== fingerprint(now);
    for (const v of nowOn) {
      if (!wasOn.has(v)) add(v, { blockId: was.block_id, label, kind: 'added' });
      else if (moved) add(v, { blockId: was.block_id, label, kind: 'changed' });
    }
    for (const v of wasOn) if (!nowOn.has(v)) add(v, { blockId: was.block_id, label, kind: 'taken_off' });
  }
  return out;
}

const VERB: Record<PartChangeKind, (label: string) => string> = {
  changed: (l) => `changed “${l}”`,
  removed: (l) => `removed “${l}” from the day`,
  added: (l) => `put you on “${l}”`,
  taken_off: (l) => `took you off “${l}”`,
};

/** The notice's title: one line, what happened to their part. */
export function supplierPartTitle(changes: readonly PartChange[]): string {
  if (changes.length === 1) {
    const c = changes[0]!;
    if (c.kind === 'removed') return 'A moment of yours was removed';
    if (c.kind === 'added') return 'You were put on a moment';
    if (c.kind === 'taken_off') return 'You were taken off a moment';
  }
  return 'Your part changed';
}

/** The line under it: who did it, to which moment(s). */
export function supplierPartBody(eventName: string, changes: readonly PartChange[]): string {
  if (changes.length === 1) return `${eventName} ${VERB[changes[0]!.kind](changes[0]!.label)}. Open your schedule for the details.`;
  const first = changes[0]!.label;
  const more = changes.length - 1;
  return `${eventName} changed ${changes.length} of your moments: “${first}” and ${more} more. Open your schedule for the details.`;
}

/** Where it opens: the supplier's page for this event, where their day is. */
export function supplierPartHref(eventId: string): string {
  return `/vendor-dashboard/clients/${eventId}`;
}
