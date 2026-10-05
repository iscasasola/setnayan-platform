import { ceremonyBlock, type ScheduleBlockRow } from '@/lib/print-pieces';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '@/lib/schedule-datetime-local';
import { HUB_DRAFT_CEREMONY_TIME, HUB_DRAFT_FACT_COLUMNS, type HubDraftEvents } from '@/lib/hub-draft';

/**
 * 🕒 THE DRAFTED CEREMONY TIME, LAID OVER THE SCHEDULE — what the Maker's
 * invitation preview prints BEFORE Apply ("Ceremony at 3:00 PM"; owner
 * 2026-10-04, "YES TO ALL" — "the preview above shows the new time at once").
 *
 * Pure, and the same placement Apply makes for real
 * (`placeCeremonyBlock`, lib/ceremony-time.server.ts): the earliest top-level
 * Ceremony takes the drafted wall clock on the event's day; with no Ceremony a
 * new one stands there. Every other block is untouched. A new array; nothing
 * the caller holds is mutated. An unusable time returns the blocks as they are.
 */
export function blocksWithDraftedCeremony<T extends ScheduleBlockRow>(
  blocks: readonly T[],
  time: unknown,
  /** YYYY-MM-DD the event stands on (drafted or live), or null when it is not one day. */
  day: string | null,
): T[] {
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return [...blocks];
  const block = ceremonyBlock(blocks);
  const on = day ?? (block ? toDatetimeLocalValue(block.start_at).slice(0, 10) : null);
  const start = on ? fromDatetimeLocalValue(`${on}T${time}`) : null;
  if (!start) return [...blocks];
  // A new Ceremony carries only what a schedule row needs to be read; it is public, as the Schedule seeds it.
  if (!block) return [...blocks, { label: 'Ceremony', block_type: 'ceremony', start_at: start, parent_block_id: null, location: null, is_public: true } as unknown as T];
  return blocks.map((b) => (b === block ? { ...b, start_at: start } : b));
}

/**
 * ✍ THE DRAFTED KEYS A PRINT PREVIEW DRAWS — the names, the date, the name
 * style, 🕒 the ceremony time and the typed venue names. ONE list: the Maker
 * hashes exactly these into each preview's address (`draft=`) and the print
 * route lays exactly these over the live row, so a preview can never show a
 * drafted value its address does not name.
 */
export const PRINT_DRAFTED_KEYS = [
  ...HUB_DRAFT_FACT_COLUMNS,
  HUB_DRAFT_CEREMONY_TIME,
  'std_film_ceremony_name',
  'std_film_venue_name',
  // 🎨 The Mood Board colours a theme pick fills (owner 2026-10-05) — the
  // print wears them (`themeColours`), so its address names them too.
  'role_palette',
] as const;

/** The draft's printed keys only — null when the draft holds none of them. */
export function printDraftOf(events: Record<string, unknown> | null | undefined): HubDraftEvents | null {
  if (!events) return null;
  const out: HubDraftEvents = {};
  for (const k of PRINT_DRAFTED_KEYS) if (k in events) out[k] = events[k];
  return Object.keys(out).length > 0 ? out : null;
}
