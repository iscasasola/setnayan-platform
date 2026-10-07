/**
 * EVENT DETAILS — THE ONE RECORD, EDITED ON THE PAGE (the pure half).
 *
 * ⚖ Owner 2026-10-04 (DECISION_LOG "YES TO ALL" — *"Event Details rows are
 * edited in place (money/supplier rows read-only with their link) — supersedes
 * the 2026-10-01 'information only' line"* — and "EVENT DETAILS / MAKER: FOUR
 * FIXES BEFORE BUILD" (2): *"Event Details on the phone = four folded groups
 * with one-line summaries (How it looks · How it works · Your event · Guests &
 * money); tap opens a group"*). Study: `EVENT_DETAILS_STUDY_2026-10-04_fable.md`
 * § 1, § 4, § 6 rows 4·5·19, § 7 PR-1; prototype screens 4 and 5.
 *
 * 🔑 ONE EDITOR PER FACT. A row never gets an editor of its own: it opens the
 * SAME component the Maker opens for that fact (`RECORD_EDITOR_COMPONENT` names
 * it, `every-fact-has-one-editor.test.ts` holds the page to it). Since
 * 2026-10-08 the page is three segments (`lib/event-details-segments.ts`) and
 * the only editor left is the live Event settings one.
 *
 * Pure (no I/O): the page reads it, the guards read it.
 */

/**
 * The ONE editor a row can open (since 2026-10-08, DECISION_LOG "EVENT DETAILS
 * IS THREE SEGMENTS"): Event settings, which saves LIVE. The thirteen Maker
 * editors (Font · Colours · Buttons · RSVP · the four answers · Names · Date ·
 * Venues · Love Story · Special message) wrote the Event Hub draft, which is
 * why the Maker's Undo · Apply sat on this page; their rows left for their
 * homes (the Maker, Suppliers, Guests) and Undo · Apply left with them.
 */
export const RECORD_EDITOR_COMPONENT = {
  /** Event settings — saves LIVE, its own Save (`event-settings-editor.tsx`, the /details/change page's). */
  settings: 'EventSettingsEditor',
} as const;
export type RecordEditorKey = keyof typeof RECORD_EDITOR_COMPONENT;

/**
 * Every row that OPENS ITS FIELD → the editor it opens. Kind and the guest
 * estimate open it while no booking holds them (once one does, they sit in
 * Settled and open nothing); `area` is the address /details/change lands on.
 * Every other row on the page is a › jump to the fact's home, or a control
 * that saves at once (Area · Costs shown · Plan it myself).
 */
export const RECORD_ROW_EDITOR = {
  kind: 'settings',
  area: 'settings',
  estimate: 'settings',
} as const satisfies Record<string, RecordEditorKey>;
export type RecordRowKey = keyof typeof RECORD_ROW_EDITOR;

/** The row an address names — anything else is not ours and opens nothing. */
export function parseRecordRow(raw: unknown): RecordRowKey | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(RECORD_ROW_EDITOR, v) ? (v as RecordRowKey) : null;
}

/**
 * The address that opens a row's field — a plain GET, so opening writes
 * nothing. From the record it is INTERCEPTED into the page's `@field` slot
 * (`details/@field/(.)field/[row]`): the record stays exactly as it is, segment
 * and scroll included, and only the field arrives; loaded on its own it draws
 * the record with the field open (`details/field/[row]`).
 */
export function recordFieldHref(eventId: string, row: RecordRowKey): string {
  return `/dashboard/${eventId}/details/field/${encodeURIComponent(row)}`;
}

/** The row whose field an address shows (`…/details/field/<row>`), or null. */
export function recordRowOfPath(pathname: string | null | undefined): RecordRowKey | null {
  const m = /\/details\/field\/([^/?#]+)/.exec(pathname ?? '');
  return m ? parseRecordRow(decodeURIComponent(m[1]!)) : null;
}

/** The record with nothing open — where × and Back return. */
export function recordHref(eventId: string): string {
  return `/dashboard/${eventId}/details`;
}

/**
 * A fold's one-line summary: the first few filled values of its rows, in
 * order — "Classic · Cormorant · Wine, Sand". Empty values are skipped; nothing
 * filled reads "Not set yet".
 */
export function foldSummary(values: ReadonlyArray<string | null | undefined>, max = 4): string {
  const shown = values.map((v) => (typeof v === 'string' ? v.trim() : '')).filter((v) => v !== '');
  return shown.length === 0 ? 'Not set yet' : shown.slice(0, max).join(' · ');
}
