/**
 * EVENT DETAILS — the one information-only sheet on Event Home (the pure half).
 *
 * ⚖ Owner 2026-10-01 (DECISION_LOG "EVENT DETAILS LIVES ON EVENT HOME" →
 * "EVENT DETAILS IS INFORMATION ONLY"): *"purchases, budget, dates, etc · no
 * suggestion for this page. just information. they can jump to the page where
 * that is handled if they need further customization · also the theme, font,
 * color · Technically, everything that is collected will be here."*
 * Approved design: `prototypes/event_details_one_page_2026-10-01_fable.html`;
 * build spec: `WEDDING_ONBOARDING_HUB_SETUP_EVENT_DETAILS_BUILD_SPEC_2026-10-01.md`
 * (THE MAP's "Event Details row" column).
 *
 * 🔑 NOTHING HERE STORES A FACT. Every row on the page reads the field its own
 * app writes (the Maker, the Guest list, the Budget, the Schedule, the orders…),
 * so this sheet and the app can never disagree. This module only names the
 * sections and the facts, and words a few of them.
 *
 * Pure (no I/O) so `event-details-sheet.test.ts` can exercise it directly.
 */
import { RSVP_ASK_FIELDS, RSVP_ASK_LABEL, WHO_CAN_RSVP_LABEL, readGuestsReply, readWhoCanRsvp, sanitizeRsvpAskConfig } from './rsvp-ask';

/** What an empty fact reads — the owner's words, everywhere on the sheet. */
export const NOT_SET_YET = 'Not set yet';

/** What a section reads when its read FAILED — never "Not set yet" (a failure is not emptiness). */
export const COULD_NOT_LOAD = 'Could not load this right now — refresh to try again.';

/** What a helper the couple did not share a part with reads in its place. */
export const HIDDEN_BY_THE_COUPLE = 'Hidden by the couple';

/**
 * The sheet's sections, in the order the page draws them (the approved
 * design's thirteen). `key` is what the page marks each section with.
 */
export const EVENT_DETAILS_SECTIONS = [
  { key: 'basics', title: 'The basics' },
  { key: 'key-dates', title: 'Key dates' },
  { key: 'venues', title: 'Venues' },
  { key: 'guests', title: 'Guests' },
  { key: 'budget', title: 'Budget' },
  { key: 'suppliers', title: 'Your suppliers' },
  { key: 'services', title: 'Services' },
  { key: 'purchases', title: 'Purchases' },
  { key: 'look', title: 'Your Event Hub look' },
  { key: 'love-story', title: 'Love Story' },
  { key: 'wears', title: 'What everyone wears' },
  { key: 'rsvp', title: 'RSVP' },
  { key: 'put-away', title: 'Put this away' },
] as const;
export type EventDetailsSectionKey = (typeof EVENT_DETAILS_SECTIONS)[number]['key'];

export function sectionTitle(key: EventDetailsSectionKey): string {
  return EVENT_DETAILS_SECTIONS.find((s) => s.key === key)!.title;
}

/**
 * THE MAP, as the page draws it: every build-spec row that has an "Event
 * Details row" column → the fact the page marks (`fact="…"`) and the section it
 * sits in. Copied from the spec's MAP table (2026-10-01), never derived from
 * the page — the guard reads the page against THIS.
 */
export const EVENT_DETAILS_MAP: ReadonlyArray<{ asked: string; question: string; fact: string; section: EventDetailsSectionKey }> = [
  { asked: 'A1', question: 'Who is getting married?', fact: 'names', section: 'basics' },
  { asked: 'A2', question: 'What kind of wedding?', fact: 'kind', section: 'basics' },
  { asked: 'A3', question: 'When is it?', fact: 'date', section: 'key-dates' },
  { asked: 'A4', question: 'Where will it be?', fact: 'area', section: 'basics' },
  { asked: 'A4b', question: 'We already have our venue', fact: 'venues', section: 'venues' },
  { asked: 'A5', question: 'How do guests get in?', fact: 'guests-get-in', section: 'guests' },
  { asked: 'A6', question: 'About how many guests?', fact: 'estimate', section: 'guests' },
  { asked: 'A7', question: 'About how much is your budget?', fact: 'budget-target', section: 'budget' },
  { asked: 'A-Hub', question: 'Cover photo', fact: 'cover', section: 'look' },
  { asked: 'A-Hub', question: 'Theme', fact: 'theme', section: 'look' },
  { asked: 'A-Hub', question: 'Colours', fact: 'colours', section: 'look' },
  { asked: 'A-Hub', question: 'Fonts', fact: 'fonts', section: 'look' },
  { asked: 'A-Hub', question: 'Music', fact: 'music', section: 'look' },
  { asked: 'A-C', question: 'Event Hub Pro · Setnayan AI · Papic', fact: 'services', section: 'services' },
  { asked: 'A-C', question: 'One bill', fact: 'purchases', section: 'purchases' },
  { asked: 'B1', question: 'When should guests arrive?', fact: 'arrive', section: 'key-dates' },
  { asked: 'B2', question: 'Parish / Reception', fact: 'venues', section: 'venues' },
  { asked: 'B3', question: 'Love Story', fact: 'love-story', section: 'love-story' },
  { asked: 'B4', question: 'What everyone wears', fact: 'wears', section: 'wears' },
  { asked: 'B5–6', question: 'What to ask guests', fact: 'rsvp-questions', section: 'rsvp' },
  { asked: 'B5–6', question: 'Reply-by', fact: 'reply-by', section: 'key-dates' },
  { asked: 'B7', question: 'Guest names', fact: 'listed', section: 'guests' },
];

/**
 * "How guests get in" — ONE fact, read in two places on the sheet (Guests and
 * RSVP "Who can reply"), from `events.rsvp_ask_config` through the shipped
 * readers. "Will guests reply? No" (a wake's default) is one QR for everyone.
 */
export function howGuestsGetIn(rawRsvpAskConfig: unknown): { value: string; chosen: boolean } {
  const cfg = sanitizeRsvpAskConfig(rawRsvpAskConfig);
  if (!readGuestsReply(rawRsvpAskConfig)) return { value: 'One QR for everyone · no reply needed', chosen: true };
  return { value: WHO_CAN_RSVP_LABEL[readWhoCanRsvp(rawRsvpAskConfig)], chosen: cfg.whoCanRsvp !== undefined };
}

/** The questions the RSVP asks — an absent key is ON, only an explicit `false` is off. */
export function rsvpQuestions(rawRsvpAskConfig: unknown): string[] {
  const cfg = sanitizeRsvpAskConfig(rawRsvpAskConfig);
  if (!readGuestsReply(rawRsvpAskConfig)) return [];
  return ['Coming?', ...RSVP_ASK_FIELDS.filter((f) => cfg[f] !== false).map((f) => RSVP_ASK_LABEL[f])];
}

/** `YYYY-MM-DD` → "Fri 4 Dec 2026" (a date column, read as a calendar day — no zone shift). */
export function sheetDate(ymd: string | null | undefined, withYear = true): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((ymd ?? '').trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-PH', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' as const } : {}),
  });
}

/** ₱ with thousands, no centavos — the sheet's one money shape. */
export function sheetPeso(php: number): string {
  return `₱${Math.round(php).toLocaleString('en-PH')}`;
}

/**
 * The date the way onboarding captured it: a committed date (to its
 * precision), a flexible window, a set of candidate dates, or null (not set
 * yet). Moved here from the Personalization page (now Event settings) so the
 * editor and this sheet word one fact one way.
 */
export function describeEventDate(e: Record<string, unknown>): string | null {
  const eventDate = typeof e.event_date === 'string' ? e.event_date : null;
  const precision = typeof e.event_date_precision === 'string' ? e.event_date_precision : 'day';
  if (eventDate) {
    const d = new Date(`${eventDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    if (precision === 'year') return String(d.getFullYear());
    if (precision === 'month') return d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
    return d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  const mode = typeof e.date_mode === 'string' ? e.date_mode : null;
  if (mode === 'window') {
    const start = typeof e.date_window_start === 'string' ? e.date_window_start : null;
    const end = typeof e.date_window_end === 'string' ? e.date_window_end : null;
    if (start && end) return `Flexible · ${shortDay(start)}–${shortDay(end)}`;
  }
  if (mode === 'specific' && Array.isArray(e.date_candidates)) {
    const n = (e.date_candidates as unknown[]).filter((c) => typeof c === 'string').length;
    if (n > 0) return `${n} candidate date${n === 1 ? '' : 's'}`;
  }
  return null;
}

function shortDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}
