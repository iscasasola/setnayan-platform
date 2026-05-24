import type { SupabaseClient } from '@supabase/supabase-js';

export type ScheduleBlockType =
  | 'pre_ceremony'
  | 'ceremony'
  | 'cocktails'
  | 'reception'
  | 'dinner'
  | 'program'
  | 'dancing'
  | 'send_off'
  | 'after_party'
  | 'custom';

export const SCHEDULE_BLOCK_TYPES: ReadonlyArray<ScheduleBlockType> = [
  'pre_ceremony',
  'ceremony',
  'cocktails',
  'reception',
  'dinner',
  'program',
  'dancing',
  'send_off',
  'after_party',
  'custom',
];

export const SCHEDULE_BLOCK_LABEL: Record<ScheduleBlockType, string> = {
  pre_ceremony: 'Pre-ceremony',
  ceremony: 'Ceremony',
  cocktails: 'Cocktails',
  reception: 'Reception',
  dinner: 'Dinner',
  program: 'Program',
  dancing: 'Dancing',
  send_off: 'Send-off',
  after_party: 'After-party',
  custom: 'Custom',
};

export type ScheduleBlockRow = {
  block_id: string;
  public_id: string;
  event_id: string;
  label: string;
  block_type: ScheduleBlockType;
  start_at: string;
  end_at: string | null;
  location: string | null;
  notes: string | null;
  is_public: boolean;
  sort_order: number;
  /** Self-FK · NULL = top-level wedding-day block; non-NULL = part within
   *  a parent (e.g., "Procession" inside "Ceremony"). Added via migration
   *  20260619000000 per 2026-05-24 owner directive on Card 15 restructure.
   *  Depth is one-level only — no grandchildren. */
  parent_block_id: string | null;
  created_at: string;
};

const SELECT =
  'block_id,public_id,event_id,label,block_type,start_at,end_at,location,notes,is_public,sort_order,parent_block_id,created_at';

export async function fetchScheduleBlocks(
  supabase: SupabaseClient,
  eventId: string,
): Promise<ScheduleBlockRow[]> {
  const { data, error } = await supabase
    .from('event_schedule_blocks')
    .select(SELECT)
    .eq('event_id', eventId)
    .order('start_at', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) throw new Error(`fetchScheduleBlocks failed: ${error.message}`);
  return (data ?? []) as ScheduleBlockRow[];
}

export async function fetchPublicScheduleBlocks(
  supabase: SupabaseClient,
  eventId: string,
): Promise<ScheduleBlockRow[]> {
  const { data, error } = await supabase
    .from('event_schedule_blocks')
    .select(SELECT)
    .eq('event_id', eventId)
    .eq('is_public', true)
    .order('start_at', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) throw new Error(`fetchPublicScheduleBlocks failed: ${error.message}`);
  return (data ?? []) as ScheduleBlockRow[];
}

/**
 * Group blocks into the two-level hierarchy for Card 15 + /schedule page
 * rendering. Top-level blocks (parent_block_id IS NULL) are returned in
 * order; children of each top-level are returned in order under their
 * parent's `block_id` key.
 *
 * Stable + pure · safe to call repeatedly during a render pass. Orphan
 * children (a child whose parent_block_id doesn't match any returned
 * top-level row · e.g., parent was deleted but cascade hasn't fired) are
 * silently dropped — the FK constraint with ON DELETE CASCADE makes
 * orphans impossible in practice, but the safety check costs nothing.
 */
export function groupScheduleBlocksByParent(
  rows: ReadonlyArray<ScheduleBlockRow>,
): {
  topLevel: ScheduleBlockRow[];
  childrenByParent: Record<string, ScheduleBlockRow[]>;
} {
  const topLevel: ScheduleBlockRow[] = [];
  const childrenByParent: Record<string, ScheduleBlockRow[]> = {};

  for (const row of rows) {
    if (row.parent_block_id === null) {
      topLevel.push(row);
    } else {
      const bucket = childrenByParent[row.parent_block_id] ?? [];
      bucket.push(row);
      childrenByParent[row.parent_block_id] = bucket;
    }
  }

  topLevel.sort((a, b) => a.sort_order - b.sort_order);
  for (const parentId of Object.keys(childrenByParent)) {
    childrenByParent[parentId]!.sort((a, b) => a.sort_order - b.sort_order);
  }

  return { topLevel, childrenByParent };
}

// ───────────────────  default schedule seed (Card 15)  ───────────────────
//
// 2026-05-24 owner directive: Card 15 opens with 4 top-level blocks
// pre-seeded (Ceremony · Cocktail Hour · Reception · After Party) with
// ceremony-type-aware sub-blocks under Ceremony AND universal Filipino
// reception parts under Reception. Seed fires server-side the FIRST time
// the host opens Card 15 if event_schedule_blocks is empty for the event.
// Idempotent · running again is a no-op because the second call sees rows
// already exist and skips the seed.

/** Ceremony type variants for the per-type seed dispatcher. Mirrors the
 *  `events.ceremony_type` CHECK constraint values from iteration 0043. */
export type SeedCeremonyType =
  | 'catholic'
  | 'civil'
  | 'inc'
  | 'christian'
  | 'muslim'
  | 'cultural'
  | 'mixed';

/** Default sub-blocks under the Ceremony parent · ceremony-type-aware so
 *  Catholic couples see liturgy parts, Civil see judge/registrar flow,
 *  Muslim see nikah parts, etc. Host can rearrange + add + delete any
 *  part after the seed. */
const CEREMONY_PARTS: Record<SeedCeremonyType, string[]> = {
  catholic: [
    'Procession',
    'Opening prayer',
    'Liturgy of the Word',
    'Homily',
    'Vows + ring exchange',
    'Veil ceremony',
    'Cord ceremony',
    'Arrhae (coin ceremony)',
    'Candle lighting',
    'Communion',
    'Signing of marriage contract',
    'Recessional',
  ],
  civil: [
    'Procession',
    'Welcome by judge or registrar',
    'Vows + ring exchange',
    'Signing of marriage contract',
    'Closing remarks',
    'Recessional',
  ],
  inc: [
    'Opening hymn',
    "Minister's message",
    'Vows + ring exchange',
    'Signing of marriage contract',
    'Closing prayer',
    'Recessional',
  ],
  christian: [
    'Opening worship',
    "Pastor's message",
    'Vows + ring exchange',
    'Signing of marriage contract',
    'Closing prayer',
    'Recessional',
  ],
  muslim: [
    "Imam's opening",
    'Mahr (dowry)',
    'Nikah (wedding contract)',
    'Signing of marriage contract',
    "Closing du'a",
  ],
  cultural: [
    'Procession',
    'Tribal / cultural opening',
    'Vows + ring exchange',
    'Signing of marriage contract',
    'Closing',
    'Recessional',
  ],
  mixed: [
    'Procession',
    'Opening prayer',
    'Vows + ring exchange',
    'Signing of marriage contract',
    'Closing',
    'Recessional',
  ],
};

/** Default sub-blocks under the Reception parent · universal Filipino
 *  reception spine. Catholic, civil, INC, Muslim, etc. all run the same
 *  reception program (grand entrance → first dance → dinner → toasts →
 *  cake → money dance → open floor → closing). Per-faith adaptations
 *  (e.g., no alcohol toasts at INC, no money dance at conservative
 *  Muslim) happen via host editing after the seed. */
const RECEPTION_PARTS: ReadonlyArray<string> = [
  'Grand entrance',
  'Opening prayer',
  'Welcome remarks',
  'First dance',
  'Dinner / catering service',
  'Toasts',
  'Cake cutting',
  'Father-daughter dance',
  'Mother-son dance',
  'Money dance',
  'Garter + bouquet toss',
  'Anniversary dance',
  'Open floor / DJ set',
  'Closing remarks',
];

/** Build the seed payload for a NEW event. Anchors top-level blocks to a
 *  reasonable PH wedding-day timing (2pm ceremony · 4pm cocktails · 5pm
 *  reception · 10pm after-party) and evenly splits sub-block windows
 *  within each parent. All times are returned as ISO strings anchored to
 *  the event_date passed in; if no event_date is set yet, the seed
 *  defaults to placeholder times the host will edit when they pick a date.
 *
 *  Returns the rows to INSERT in two passes:
 *    1. topLevelRows  — 4 inserts, get back block_ids
 *    2. childRows(parentIds) — sub-blocks for Ceremony + Reception keyed
 *       to the parent block_ids from pass 1
 *
 *  The two-pass shape avoids the chicken-and-egg of inserting children
 *  before their parent's UUID is known. Server action wires both passes
 *  in a single transaction.
 */
export type ScheduleSeedTopLevel = {
  key: 'ceremony' | 'cocktails' | 'reception' | 'after_party';
  label: string;
  block_type: ScheduleBlockType;
  start_at: string;
  end_at: string;
  sort_order: number;
  is_public: boolean;
};

export type ScheduleSeedChild = {
  parent_key: 'ceremony' | 'reception';
  label: string;
  block_type: ScheduleBlockType;
  start_at: string;
  end_at: string;
  sort_order: number;
  is_public: boolean;
};

/** Anchor date = events.event_date if set, else 6 months from today as a
 *  reasonable PH-wedding planning runway. The host re-edits these times
 *  as soon as they set their actual date. */
function anchorIso(eventDate: string | null, hour: number, minute = 0): string {
  const base = eventDate ? new Date(eventDate) : null;
  if (base && !Number.isNaN(base.getTime())) {
    base.setHours(hour, minute, 0, 0);
    return base.toISOString();
  }
  const fallback = new Date();
  fallback.setMonth(fallback.getMonth() + 6);
  fallback.setHours(hour, minute, 0, 0);
  return fallback.toISOString();
}

/** Build the seed payload · returns top-level rows + a builder fn for
 *  child rows once parent block_ids are known. */
export function buildScheduleSeed(
  ceremonyType: SeedCeremonyType | null,
  eventDate: string | null,
): {
  topLevel: ScheduleSeedTopLevel[];
  buildChildren: (parentIds: {
    ceremony: string;
    reception: string;
  }) => ScheduleSeedChild[];
} {
  const ceremonyStart = anchorIso(eventDate, 14, 0); // 14:00
  const ceremonyEnd = anchorIso(eventDate, 15, 30); // 15:30
  const cocktailsStart = anchorIso(eventDate, 16, 0); // 16:00
  const cocktailsEnd = anchorIso(eventDate, 17, 0); // 17:00
  const receptionStart = anchorIso(eventDate, 17, 0); // 17:00
  const receptionEnd = anchorIso(eventDate, 22, 0); // 22:00
  const afterPartyStart = anchorIso(eventDate, 22, 0); // 22:00
  // Same-day 23:59 cap · host edits to push past midnight if their venue
  // permits. Crossing into next day requires its own date input which
  // the V1 editor handles via the datetime-local field directly.
  const afterPartyEnd = anchorIso(eventDate, 23, 59);

  const topLevel: ScheduleSeedTopLevel[] = [
    {
      key: 'ceremony',
      label: 'Ceremony',
      block_type: 'ceremony',
      start_at: ceremonyStart,
      end_at: ceremonyEnd,
      sort_order: 100,
      is_public: true,
    },
    {
      key: 'cocktails',
      label: 'Cocktail Hour',
      block_type: 'cocktails',
      start_at: cocktailsStart,
      end_at: cocktailsEnd,
      sort_order: 200,
      is_public: true,
    },
    {
      key: 'reception',
      label: 'Reception',
      block_type: 'reception',
      start_at: receptionStart,
      end_at: receptionEnd,
      sort_order: 300,
      is_public: true,
    },
    {
      key: 'after_party',
      label: 'After Party',
      block_type: 'after_party',
      start_at: afterPartyStart,
      end_at: afterPartyEnd,
      sort_order: 400,
      is_public: true,
    },
  ];

  const ceremonyParts =
    CEREMONY_PARTS[ceremonyType ?? 'catholic'] ?? CEREMONY_PARTS.catholic;

  const buildChildren = (_parentIds: {
    ceremony: string;
    reception: string;
  }): ScheduleSeedChild[] => {
    const ceremonyDurationMs = 1.5 * 60 * 60 * 1000; // 90 min
    const ceremonyStepMs = ceremonyDurationMs / ceremonyParts.length;
    const ceremonyChildren: ScheduleSeedChild[] = ceremonyParts.map(
      (label, idx) => {
        const startMs = new Date(ceremonyStart).getTime() + idx * ceremonyStepMs;
        const endMs = startMs + ceremonyStepMs;
        return {
          parent_key: 'ceremony',
          label,
          block_type: 'ceremony',
          start_at: new Date(startMs).toISOString(),
          end_at: new Date(endMs).toISOString(),
          sort_order: (idx + 1) * 10,
          // Sub-blocks default to private (sensitive ritual / family-only
          // details don't leak to the public guest landing page). Host
          // can flip per-part via the editor.
          is_public: false,
        };
      },
    );

    const receptionDurationMs = 5 * 60 * 60 * 1000; // 5 hours
    const receptionStepMs = receptionDurationMs / RECEPTION_PARTS.length;
    const receptionChildren: ScheduleSeedChild[] = RECEPTION_PARTS.map(
      (label, idx) => {
        const startMs = new Date(receptionStart).getTime() + idx * receptionStepMs;
        const endMs = startMs + receptionStepMs;
        return {
          parent_key: 'reception',
          label,
          block_type: 'reception',
          start_at: new Date(startMs).toISOString(),
          end_at: new Date(endMs).toISOString(),
          sort_order: (idx + 1) * 10,
          // Same privacy default as ceremony parts · host edits per-part.
          is_public: false,
        };
      },
    );

    return [...ceremonyChildren, ...receptionChildren];
  };

  return { topLevel, buildChildren };
}

export function formatBlockTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatBlockTimeRange(startIso: string, endIso: string | null): string {
  const start = new Date(startIso);
  const startStr = start.toLocaleString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  if (!endIso) return startStr;
  const end = new Date(endIso);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  const endStr = end.toLocaleString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return sameDay ? `${startStr} – ${endStr}` : `${startStr} → ${end.toLocaleString()}`;
}
