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
 * it, `every-fact-has-one-editor.test.ts` holds the page to it). Several rows
 * may open one editor — "How guests get in", "What to ask" and "Reply by" are
 * three keys of the one RSVP settings panel the Maker draws.
 *
 * Pure (no I/O): the page reads it, the guards read it.
 */

/** The four groups — phone: four folds, one open at a time; desktop: all open. */
export const RECORD_GROUPS = [
  { key: 'looks', title: 'How it looks' },
  { key: 'works', title: 'How it works' },
  { key: 'event', title: 'Your event' },
  { key: 'guests-money', title: 'Guests & money' },
] as const;
export type RecordGroupKey = (typeof RECORD_GROUPS)[number]['key'];

/**
 * The editors a row can open — each is a component the Maker already mounts for
 * that fact, named here so a guard can hold the page to it.
 */
export const RECORD_EDITOR_COMPONENT = {
  /** Look › Font — the Colors panel's font part (`pro-panels.tsx`). */
  font: 'ColorsPanel',
  /** Look › Colours — the Colors panel's colours part. */
  colours: 'ColorsPanel',
  /** Look › Buttons (`buttons-look-row.tsx`). */
  buttons: 'ButtonsLookRow',
  /** Details › RSVP — who gets in, what to ask, reply by (`maker-rsvp-ask.tsx`). */
  rsvp: 'MakerRsvpSettings',
  /** Your info's answers — one dropdown each over its column (`details-answers.tsx`). */
  papic: 'AnswerPicker',
  gifts: 'AnswerPicker',
  'logo-answer': 'AnswerPicker',
  'cover-answer': 'AnswerPicker',
  /** Details › Your event (`details-your-event.tsx`). */
  names: 'NamesEditor',
  date: 'DateEditor',
  venues: 'VenuesEditor',
  /** Details › Love Story — the instant words panel (`love-story-live.tsx`). */
  'love-story': 'LiveStoryPanel',
  /** Details › Special message (`special-message-field.tsx`). */
  'special-message': 'SpecialMessageField',
  /** Event settings — saves LIVE, its own Save (`event-settings-editor.tsx`, the /details/change page's). */
  settings: 'EventSettingsEditor',
} as const;
export type RecordEditorKey = keyof typeof RECORD_EDITOR_COMPONENT;

/**
 * Every row that OPENS ITS FIELD → the one editor it opens. A row not here is
 * either read-only (money, suppliers, the guest names — the Guest list owns
 * them) or listed in `RECORD_ROW_TOOL`.
 */
export const RECORD_ROW_EDITOR = {
  fonts: 'font',
  colours: 'colours',
  buttons: 'buttons',
  'guests-get-in': 'rsvp',
  'rsvp-questions': 'rsvp',
  'reply-by': 'rsvp',
  'papic-answer': 'papic',
  'gifts-answer': 'gifts',
  'logo-answer': 'logo-answer',
  'cover-answer': 'cover-answer',
  names: 'names',
  kind: 'settings',
  area: 'settings',
  date: 'date',
  'ceremony-time': 'date',
  venues: 'venues',
  'reception-venue': 'venues',
  'love-story': 'love-story',
  'special-message': 'special-message',
  estimate: 'settings',
  'list-closes': 'settings',
  'costs-view': 'settings',
} as const satisfies Record<string, RecordEditorKey>;
export type RecordRowKey = keyof typeof RECORD_ROW_EDITOR;

/**
 * Facts whose field is a whole STUDIO (a media library, a palette board, the
 * programme, the logo canvas): in this build the row opens that studio as
 * itself — never an "edit it over there ↗" line. Named here, with the studio,
 * so the list cannot grow quietly; each is a later step of the study (§ 7
 * PR-3/PR-9 carry the studios into the same sheet).
 */
export const RECORD_ROW_TOOL = {
  cover: 'Look › Background (the media library)',
  logo: 'The Logo studio',
  music: 'Background music',
  arrive: 'The Schedule',
  'reception-time': 'The Schedule',
  wears: 'The Mood Board',
} as const;
export type RecordToolRowKey = keyof typeof RECORD_ROW_TOOL;

/** The row an address names — anything else is not ours and opens nothing. */
export function parseRecordRow(raw: unknown): RecordRowKey | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(RECORD_ROW_EDITOR, v) ? (v as RecordRowKey) : null;
}

/**
 * The address that opens a row's field — a plain GET, so opening writes
 * nothing. From the record it is INTERCEPTED into the page's `@field` slot
 * (`details/@field/(.)field/[row]`): the record stays exactly as it is, folds
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

/** The group a row sits in (the fold that must be open while its field is). */
export const RECORD_ROW_GROUP: Readonly<Record<RecordRowKey | RecordToolRowKey, RecordGroupKey>> = {
  fonts: 'looks',
  colours: 'looks',
  buttons: 'looks',
  cover: 'looks',
  logo: 'looks',
  music: 'looks',
  'guests-get-in': 'works',
  'rsvp-questions': 'works',
  'reply-by': 'works',
  'papic-answer': 'works',
  'gifts-answer': 'works',
  'logo-answer': 'works',
  'cover-answer': 'works',
  names: 'event',
  kind: 'event',
  area: 'event',
  date: 'event',
  'ceremony-time': 'event',
  arrive: 'event',
  'reception-time': 'event',
  venues: 'event',
  'reception-venue': 'event',
  'love-story': 'event',
  'special-message': 'event',
  wears: 'event',
  estimate: 'guests-money',
  'list-closes': 'guests-money',
  'costs-view': 'guests-money',
};

/**
 * A fold's one-line summary: the first few filled values of its rows, in
 * order — "Classic · Cormorant · Wine, Sand". Empty values are skipped; nothing
 * filled reads "Not set yet".
 */
export function foldSummary(values: ReadonlyArray<string | null | undefined>, max = 4): string {
  const shown = values.map((v) => (typeof v === 'string' ? v.trim() : '')).filter((v) => v !== '');
  return shown.length === 0 ? 'Not set yet' : shown.slice(0, max).join(' · ');
}
