import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isChineseWedding,
  isChineseOverlay,
  type CeremonyOverlayInput,
} from '@/lib/chinese-wedding';

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
  | 'custom'
  // Travel itinerary classes (migration 20270825683668 · ai-travel-scheduling):
  // 'lodging' = a hotel NIGHT-BLOCK (check-in → check-out spanning days),
  // 'tour' = a tour/activity TIME-BLOCK. Deliberately NOT in
  // SCHEDULE_BLOCK_TYPES below — only the travel add-form offers them (see
  // TRAVEL_SCHEDULE_BLOCK_TYPES in lib/schedule-travel.ts) and the server
  // action rejects them on non-travel events, so every other event type's
  // schedule surface stays byte-identical.
  | 'lodging'
  | 'tour';

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
  lodging: 'Hotel stay',
  tour: 'Tour / activity',
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
  /** Day-of run-of-show (migration 20270321980372). run_state is advanced by
   *  advance_schedule_block; actual_start_at is when the block actually went
   *  live (drives the "running ±N min" header). Additive — defaults to
   *  'upcoming' / null on rows created before the run-of-show feature. */
  run_state: 'upcoming' | 'live' | 'done';
  actual_start_at: string | null;
  actual_end_at: string | null;
};

const SELECT =
  'block_id,public_id,event_id,label,block_type,start_at,end_at,location,notes,is_public,sort_order,parent_block_id,created_at,run_state,actual_start_at,actual_end_at';

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
  | 'aglipayan'
  | 'lds'
  | 'sda'
  | 'jw'
  | 'hindu'
  | 'sikh'
  | 'buddhist'
  | 'orthodox'
  | 'chinese'
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
  aglipayan: [
    'Procession',
    'Opening prayer',
    'Liturgy of the Word',
    'Homily',
    'Vows + ring exchange',
    'Veil ceremony',
    'Cord ceremony',
    'Arrhae (coin ceremony)',
    'Signing of marriage contract',
    'Recessional',
  ],
  lds: [
    'Prelude + welcome',
    "Officiant's message",
    'Vows + ring exchange',
    'Signing of marriage contract',
    'Closing prayer',
    'Recessional',
  ],
  sda: [
    'Opening hymn',
    "Pastor's message",
    'Vows + ring exchange',
    'Signing of marriage contract',
    'Closing prayer',
    'Recessional',
  ],
  jw: [
    'Opening song + prayer',
    'Marriage talk',
    'Vows + ring exchange',
    'Signing of marriage contract',
    'Closing prayer',
  ],
  hindu: [
    "Baraat (groom's procession)",
    'Ganesh puja',
    'Kanyadaan',
    'Mangal pheras (circling the fire)',
    'Saptapadi (seven steps)',
    'Sindoor + mangalsutra',
    'Ashirvad (blessings)',
    'Signing of marriage contract',
  ],
  sikh: [
    'Procession to the gurdwara',
    'Ardas (opening prayer)',
    'Palla ceremony',
    'Anand Karaj (four laavan)',
    'Karah prasad',
    'Signing of marriage contract',
  ],
  buddhist: [
    'Procession',
    'Offering to the monks',
    'Chanting + blessing',
    'Vows + ring exchange',
    'Water blessing',
    'Signing of marriage contract',
  ],
  orthodox: [
    'Betrothal (ring exchange)',
    'Candle lighting',
    'Crowning ceremony',
    'Common cup',
    'Dance of Isaiah',
    'Signing of marriage contract',
    'Recessional',
  ],
  // Chinese (Tsinoy) wedding-day spine when Chinese is the PRIMARY rite (e.g. a
  // Taoist/Buddhist temple ceremony). The 敬茶 Tea ceremony — the couple kneeling
  // to serve tea to elders, who return red envelopes / gold — is the defining
  // beat and sits at the heart of the spine. See the shared overlay predicate in
  // lib/chinese-wedding.ts and
  // 02_Specifications/Chinese_Wedding_Traditions_Reference_2026-06-28.md. For the
  // far-more-common church-primary + Chinese-secondary case, the tea beat is
  // INJECTED into the primary ceremony's parts via the overlay path in
  // buildScheduleSeed (see TEA_CEREMONY_PART) rather than replacing the primary
  // spine.
  chinese: [
    "Groom's door games (闯门 chuangmen)",
    'Bridal fetching + veiling',
    'Tea ceremony (敬茶)',
    'Hair-combing rites (上头)',
    'Ang pao + gold-giving by elders',
    'Vows + ring exchange',
    'Signing of marriage contract',
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

/** The single 敬茶 Tea-ceremony beat injected into a NON-Chinese primary
 *  ceremony's parts when Chinese is the *secondary* (overlay) rite — the common
 *  Tsinoy "church wedding + tea ceremony" case. We ADD this one beat rather than
 *  swapping in the whole `chinese` spine so the couple keeps their Catholic /
 *  civil / etc. liturgy AND gets the tea ceremony surfaced. Label matches the
 *  primary spine's own Tea-ceremony beat so both paths read identically. */
const TEA_CEREMONY_PART = 'Tea ceremony (敬茶)' as const;

/** Default sub-blocks under the Reception parent · universal Filipino
 *  reception spine. Catholic, civil, Christian, Muslim, etc. run the same
 *  reception program (grand entrance → first dance → dinner → toasts →
 *  cake → money dance → open floor → closing). Per-faith adaptations
 *  (e.g., no money dance at conservative Muslim) happen via host editing
 *  after the seed — EXCEPT INC, which seeds its own spine below. */
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

/** INC (Iglesia ni Cristo) reception spine · honors the Church's
 *  kapayakan (simplicity): a prayer-led, wholesome program WITHOUT the
 *  dance set (first dance / father-daughter / mother-son / money /
 *  anniversary / open-floor DJ) that the universal spine assumes. INC
 *  receptions are traditionally alcohol-free and dance-free — this seed
 *  starts the couple from that posture rather than the party spine. The
 *  host can still add any block back via the editor; some families decide
 *  differently. See 02_Specifications/INC_Wedding_Practices_Reference_2026-06-28.md § 4. */
const INC_RECEPTION_PARTS: ReadonlyArray<string> = [
  'Grand entrance',
  'Opening prayer',
  'Welcome remarks',
  'Dinner / catering service',
  'Program + special numbers',
  'Toasts / well-wishes',
  'Cake cutting',
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
 *  child rows once parent block_ids are known.
 *
 *  `overlay` carries the event's two ceremony columns so the seed can be
 *  OVERLAY-AWARE: the common Tsinoy case is a church/civil *primary* rite plus
 *  `secondary_ceremony_type='chinese'`, which `ceremonyType` (the primary
 *  column alone) can't see. When `isChineseWedding(overlay)` is true the tea
 *  ceremony is guaranteed into the ceremony parts — by running the dedicated
 *  `chinese` spine if Chinese is the primary rite, or by INJECTING a single
 *  Tea-ceremony beat into the primary spine when Chinese is the secondary
 *  overlay (Catholic spine kept intact, tea beat added). Omitting `overlay`
 *  (or passing null) reproduces the pre-overlay behaviour byte-for-byte, so
 *  every non-Chinese seed is unchanged. */
export function buildScheduleSeed(
  ceremonyType: SeedCeremonyType | null,
  eventDate: string | null,
  overlay?: CeremonyOverlayInput | null,
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

  // Base spine = the primary ceremony's parts (catholic default). When Chinese
  // is the PRIMARY rite, `ceremonyType` is already 'chinese' and that spine
  // carries the tea beat, so no injection is needed.
  const baseCeremonyParts =
    CEREMONY_PARTS[ceremonyType ?? 'catholic'] ?? CEREMONY_PARTS.catholic;

  // Overlay path: Chinese is the SECONDARY rite on a non-Chinese primary (the
  // common Tsinoy "church + tea ceremony" case). `isChineseWedding` reads BOTH
  // columns, so it fires here where `ceremonyType` (primary only) never would.
  // We keep the primary spine intact and ADD a single Tea-ceremony beat (right
  // after the vows/ring exchange when present, else appended) — never replacing
  // the Catholic/civil/etc. liturgy. `isChineseOverlay` excludes the
  // Chinese-primary case so the tea beat is never double-added to its own spine.
  let ceremonyParts: ReadonlyArray<string> = baseCeremonyParts;
  if (isChineseWedding(overlay) && isChineseOverlay(overlay)) {
    if (!baseCeremonyParts.includes(TEA_CEREMONY_PART)) {
      const vowsIdx = baseCeremonyParts.findIndex((p) =>
        p.startsWith('Vows + ring exchange'),
      );
      const injectAt = vowsIdx >= 0 ? vowsIdx + 1 : baseCeremonyParts.length;
      ceremonyParts = [
        ...baseCeremonyParts.slice(0, injectAt),
        TEA_CEREMONY_PART,
        ...baseCeremonyParts.slice(injectAt),
      ];
    }
  }

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

    const receptionParts =
      ceremonyType === 'inc' ? INC_RECEPTION_PARTS : RECEPTION_PARTS;
    const receptionDurationMs = 5 * 60 * 60 * 1000; // 5 hours
    const receptionStepMs = receptionDurationMs / receptionParts.length;
    const receptionChildren: ScheduleSeedChild[] = receptionParts.map(
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

// ── Overview schedule preview selection ──────────────────────────────────────
// Pure block-selection for the Overview's Schedule section (owner directive
// 2026-07-09: "add schedule there"). Lives here — not in the component — so the
// `tsx --test "lib/**/*.test.ts"` runner covers it. See schedule.test.ts.

const SCHEDULE_PREVIEW_LIMIT = 4;

export type SchedulePreviewSelection = {
  /** Up to SCHEDULE_PREVIEW_LIMIT top-level blocks to render. */
  display: ScheduleBlockRow[];
  /** Top-level blocks not shown in `display` (drives the "N more" footer). */
  moreCount: number;
  /** True when the event has no top-level schedule blocks at all. */
  isEmpty: boolean;
};

/**
 * Top-level blocks only (nested children would clutter a short preview);
 * prefer blocks still ahead of `now`, but fall back to the earliest blocks when
 * the whole program is already past so the card never reads empty while data
 * exists. Preserves the caller's ordering (fetchScheduleBlocks orders by
 * start_at then sort_order).
 */
export function selectSchedulePreviewBlocks(
  blocks: ScheduleBlockRow[],
  now: Date,
): SchedulePreviewSelection {
  const topLevel = blocks.filter((b) => b.parent_block_id === null);
  const nowMs = now.getTime();
  const upcoming = topLevel.filter(
    (b) => new Date(b.start_at).getTime() >= nowMs,
  );
  const source = upcoming.length > 0 ? upcoming : topLevel;
  const display = source.slice(0, SCHEDULE_PREVIEW_LIMIT);
  return {
    display,
    moreCount: Math.max(0, topLevel.length - display.length),
    isEmpty: topLevel.length === 0,
  };
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

// ── Viewer-local time (mirror of ~/Setnayan-Native/src/lib/timezone.ts) ────────
// Schedule times are stored as the naive event-local wall-clock at UTC
// (`…T14:00:00Z` = 2 PM at the venue). To show a viewer their OWN local time we
// reinterpret that wall-clock through the EVENT's timezone → true instant, then
// render it in the viewer's (browser) timezone. Client-safe: Intl only, no dep.
// The event timezone string comes from the venue coords (see
// lib/event-timezone.server.ts) — derived server-side, passed down as a prop.

/** Fallback when an event has no venue coordinates — most weddings are in PH. */
export const DEFAULT_EVENT_TZ = 'Asia/Manila';

function partsAsUTC(instantMs: number, tz: string): number {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of f.formatToParts(new Date(instantMs))) p[part.type] = part.value;
  let h = parseInt(p.hour!, 10);
  if (h === 24) h = 0;
  return Date.UTC(+p.year!, +p.month! - 1, +p.day!, h, +p.minute!, +p.second!);
}

/** Wall-clock (y, monthIndex, d, h, mi) in IANA `tz` → its true UTC instant (ms),
 *  or null if Intl/tz math is unavailable. */
export function wallClockToInstant(
  y: number,
  monthIndex: number,
  d: number,
  h: number,
  mi: number,
  tz: string,
): number | null {
  try {
    const asUTC = Date.UTC(y, monthIndex, d, h, mi);
    return asUTC + (asUTC - partsAsUTC(asUTC, tz));
  } catch {
    return null;
  }
}

/** A stored block time rendered in the VIEWER's (browser) local time ("5:00 AM"),
 *  or null if it can't be converted (callers then fall back to event-local). */
export function formatViewerTime(iso: string | null, eventTz: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const instant = wallClockToInstant(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    eventTz,
  );
  if (instant == null) return null;
  return new Date(instant).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "5:00 AM" or "5:00 AM – 6:30 AM" in the viewer's local time. */
export function formatViewerTimeRange(
  startIso: string,
  endIso: string | null,
  eventTz: string,
): string | null {
  const start = formatViewerTime(startIso, eventTz);
  if (!start) return null;
  if (!endIso) return start;
  const end = formatViewerTime(endIso, eventTz);
  return end ? `${start} – ${end}` : start;
}
