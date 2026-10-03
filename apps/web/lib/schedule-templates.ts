/**
 * Coordinator P2 — schedule templates (Coordinator_Whats_Next_2026-07-18 §P2).
 *
 * A small starter set of wedding run-of-show SKELETONS the host (or their
 * coordinator, via the moderator schedule-edit grant) can load into an EMPTY
 * schedule. Template load is strictly additive-into-empty: the server action
 * refuses when any block exists, so a template can never overwrite or merge
 * over rows the couple already authored.
 *
 * Deliberately a sibling of — not a replacement for — the two existing seeds:
 *   • buildScheduleSeed (lib/schedule.ts) — the ceremony-type-aware wedding
 *     spine (parent/child hierarchy), offered here as FAITH_TEMPLATE_ID.
 *   • buildRunOfShowSeed (lib/schedule-run-of-show.ts) — the per-type
 *     NON-wedding program, auto-seeded on first schedule open.
 * Templates are the EXPLICIT-choice path: flat top-level skeletons the host
 * picks from a menu, then reshapes. Rows carry no responsible-party values,
 * so the insert payload only uses columns that exist pre-migration.
 *
 * Pure data + pure builders; unit-tested in schedule-templates.test.ts.
 */

import {
  anchorIso,
  buildScheduleSeed,
  DANCE_BLOCK_TYPES,
  riteIsDanceFree,
  type ScheduleBlockType,
  type SeedCeremonyType,
} from '@/lib/schedule';
import type { CeremonyOverlayInput } from '@/lib/chinese-wedding';

export type ScheduleTemplateRow = {
  label: string;
  block_type: ScheduleBlockType;
  /** Event-local wall-clock start, anchored to the event date. */
  startHour: number;
  startMinute: number;
  /** null = open-ended row (no end_at). */
  durationMinutes: number | null;
  /** Guest-visible on the invitation site? Mirrors the seeds' posture:
   *  guest-facing beats public, crew/prep logistics private. */
  is_public: boolean;
};

export type ScheduleTemplate = {
  id: string;
  label: string;
  description: string;
  /** events.event_type values this template is offered to. */
  eventTypes: readonly string[];
  rows: readonly ScheduleTemplateRow[];
};

/** Starter set — wedding run-of-show skeletons (P2 scope). Flat top-level
 *  rows with gap-10 sort_order; the host layers sub-parts afterwards. */
export const SCHEDULE_TEMPLATES: readonly ScheduleTemplate[] = [
  {
    id: 'wedding_classic_full_day',
    label: 'Classic wedding day',
    description:
      'The full church-wedding arc — preparations through send-off. Nine blocks to reshape, retitle, and retime.',
    eventTypes: ['wedding'],
    rows: [
      { label: 'Hair & makeup / preparations', block_type: 'pre_ceremony', startHour: 8, startMinute: 0, durationMinutes: 240, is_public: false },
      { label: 'Supplier ingress & styling', block_type: 'pre_ceremony', startHour: 10, startMinute: 0, durationMinutes: 180, is_public: false },
      { label: 'Guests arrive', block_type: 'pre_ceremony', startHour: 13, startMinute: 30, durationMinutes: 30, is_public: true },
      { label: 'Ceremony', block_type: 'ceremony', startHour: 14, startMinute: 0, durationMinutes: 90, is_public: true },
      { label: 'Post-ceremony photos', block_type: 'custom', startHour: 15, startMinute: 30, durationMinutes: 30, is_public: false },
      { label: 'Cocktail hour', block_type: 'cocktails', startHour: 16, startMinute: 0, durationMinutes: 60, is_public: true },
      { label: 'Reception & dinner', block_type: 'reception', startHour: 17, startMinute: 0, durationMinutes: 240, is_public: true },
      { label: 'Dancing & open floor', block_type: 'dancing', startHour: 21, startMinute: 0, durationMinutes: 60, is_public: true },
      { label: 'Send-off', block_type: 'send_off', startHour: 22, startMinute: 0, durationMinutes: 30, is_public: true },
    ],
  },
  {
    id: 'wedding_civil_intimate',
    label: 'Civil & intimate',
    description:
      'A short civil ceremony with a celebration lunch — five blocks for a close-circle wedding.',
    eventTypes: ['wedding'],
    rows: [
      { label: 'Guests arrive', block_type: 'pre_ceremony', startHour: 10, startMinute: 30, durationMinutes: 30, is_public: true },
      { label: 'Civil ceremony', block_type: 'ceremony', startHour: 11, startMinute: 0, durationMinutes: 45, is_public: true },
      { label: 'Photos & congratulations', block_type: 'custom', startHour: 11, startMinute: 45, durationMinutes: 45, is_public: true },
      { label: 'Celebration lunch', block_type: 'dinner', startHour: 12, startMinute: 30, durationMinutes: 150, is_public: true },
      { label: 'Send-off', block_type: 'send_off', startHour: 15, startMinute: 0, durationMinutes: null, is_public: true },
    ],
  },
  {
    id: 'wedding_reception_only',
    label: 'Reception program',
    description:
      'Evening reception only — doors to send-off, for couples whose ceremony is planned elsewhere.',
    eventTypes: ['wedding'],
    rows: [
      { label: 'Doors open / cocktails', block_type: 'cocktails', startHour: 17, startMinute: 0, durationMinutes: 60, is_public: true },
      { label: 'Grand entrance', block_type: 'reception', startHour: 18, startMinute: 0, durationMinutes: 30, is_public: true },
      { label: 'Dinner service', block_type: 'dinner', startHour: 18, startMinute: 30, durationMinutes: 60, is_public: true },
      { label: 'Program & toasts', block_type: 'program', startHour: 19, startMinute: 30, durationMinutes: 90, is_public: true },
      { label: 'Dancing & open floor', block_type: 'dancing', startHour: 21, startMinute: 0, durationMinutes: 60, is_public: true },
      { label: 'Send-off', block_type: 'send_off', startHour: 22, startMinute: 0, durationMinutes: 30, is_public: true },
    ],
  },
];

export function getScheduleTemplate(id: string): ScheduleTemplate | null {
  return SCHEDULE_TEMPLATES.find((t) => t.id === id) ?? null;
}

/**
 * ⛪ THE CEREMONY'S OWN DAY — `buildScheduleSeed` (lib/schedule.ts), revived
 * (P6a, 2026-10-01). Its per-rite ceremony parts (all 18 rites,
 * `ceremony-seed-covers-every-faith.db.test.ts`) and the quiet reception spine
 * had been imported and never called since the first-open seed was deleted
 * (2026-09-03). It now loads the way every template does — chosen by the host,
 * into an empty schedule only (`loadScheduleTemplate`) — as the FIRST choice
 * on a wedding. Its `rows` are the seed's top-level blocks (what the menu
 * counts); the load writes their parts underneath.
 */
export const FAITH_TEMPLATE_ID = 'wedding_ceremony_spine';

function hourMinuteOf(iso: string): { h: number; m: number } {
  const t = /T(\d{2}):(\d{2})/.exec(iso);
  return { h: t ? Number(t[1]) : 0, m: t ? Number(t[2]) : 0 };
}

function faithTemplate(rites: CeremonyOverlayInput | null | undefined): ScheduleTemplate {
  const seed = buildScheduleSeed((rites?.ceremony_type as SeedCeremonyType | null) ?? null, null, rites ?? null);
  return {
    id: FAITH_TEMPLATE_ID,
    label: 'Your ceremony’s day',
    description: riteIsDanceFree(rites)
      ? 'Your rite’s order of the ceremony, then a prayer-led reception — no cocktail hour, no dancing.'
      : 'Your rite’s order of the ceremony, then the reception — each with its parts ready to reshape.',
    eventTypes: ['wedding'],
    rows: seed.topLevel.map((b) => {
      const start = hourMinuteOf(b.start_at);
      const end = hourMinuteOf(b.end_at);
      return {
        label: b.label,
        block_type: b.block_type,
        startHour: start.h,
        startMinute: start.m,
        durationMinutes: end.h * 60 + end.m - (start.h * 60 + start.m),
        is_public: b.is_public,
      };
    }),
  };
}

/**
 * Templates offered for an event type (null/unknown type → none — non-wedding
 * events already auto-seed their per-type program on first open).
 *
 * `rites` = the wedding's two rite columns. A dance-free rite on EITHER column
 * (`riteIsDanceFree` — INC · Muslim · LDS · SDA) gets every template without
 * its cocktail, dancing and after-party blocks, so no menu choice hands that
 * couple a "Cocktail hour". The menu and the load read this ONE function, so
 * the block count shown is the count written.
 */
export function templatesForEventType(
  eventType: string | null,
  rites?: CeremonyOverlayInput | null,
): ScheduleTemplate[] {
  if (!eventType) return [];
  const offered = SCHEDULE_TEMPLATES.filter((t) => t.eventTypes.includes(eventType));
  const shaped = riteIsDanceFree(rites)
    ? offered.map((t) => ({ ...t, rows: t.rows.filter((r) => !DANCE_BLOCK_TYPES.has(r.block_type)) }))
    : offered;
  return eventType === 'wedding' ? [faithTemplate(rites), ...shaped] : shaped;
}

/** Anchor a wall-clock time to the event date — THE SAME anchor as the seed
 *  (`anchorIso`, lib/schedule.ts): event date when set, else six months out as
 *  the planning-runway placeholder the host edits once they pick a date.
 *
 *  ⏱ This used to be its own copy of the old `new Date(date).setHours(h, m)`
 *  form — LOCAL setters, so the digits it stored depended on the machine that
 *  ran it. On Vercel (UTC) that happens to write the venue wall clock the rest
 *  of the product reads (13:30 → `13:30Z` = 1:30 PM); anywhere else it moved
 *  every templated block by that machine's offset. One anchor, built from
 *  components, cannot drift. */
function templateAnchorIso(eventDate: string | null, hour: number, minute: number): string {
  return anchorIso(eventDate, hour, minute);
}

export type TemplateInsertRow = {
  label: string;
  block_type: ScheduleBlockType;
  start_at: string;
  end_at: string | null;
  is_public: boolean;
  sort_order: number;
  parent_block_id: null;
};

/** Materialize a template into INSERT rows for one event. Flat top-level
 *  rows, gap-10 sort_order in template order. Only columns that predate
 *  migration 20270825042743 — the payload works on any environment. */
export function buildTemplateInsertRows(
  template: ScheduleTemplate,
  eventDate: string | null,
): TemplateInsertRow[] {
  return template.rows.map((row, idx) => {
    const start = templateAnchorIso(eventDate, row.startHour, row.startMinute);
    const end =
      row.durationMinutes === null
        ? null
        : new Date(new Date(start).getTime() + row.durationMinutes * 60_000).toISOString();
    return {
      label: row.label,
      block_type: row.block_type,
      start_at: start,
      end_at: end,
      is_public: row.is_public,
      sort_order: (idx + 1) * 10,
      parent_block_id: null,
    };
  });
}
