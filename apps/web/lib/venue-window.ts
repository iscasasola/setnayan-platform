/**
 * venue-window.ts — 🏛 THE VENUE'S WINDOW ON THE DAY: ingress · event · egress (Unichat part F, owner 2026-11-20,
 * drawing `build-sessions/UNICHAT-LIVE-2026-11-19.html` `venueBar` / `outside`).
 *
 * ONE FACT, ONE HOME: the window is the chapter's own shipped hours — `start_at` · `end_at` ·
 * `ingress_minutes_before` · `egress_minutes_after` (set by the venue booked to the chapter, approved by the hosts —
 * migration 20271307658341). Nothing here is stored; this module only reads those four as one span and says where a
 * moment falls in it. Wall clocks in UTC columns, so pure UTC arithmetic — never a zone (lib/schedule-chapters.ts).
 *
 * 🎭 BACKSTAGE INSIDE THE WINDOW APPLIES AT ONCE (owner 2026-11-20, DECISION_LOG "A supplier sets its own BACKSTAGE
 * moments without the host's OK"): a supplier's own backstage moment (`isBackstage` — guests never see it) that falls
 * INSIDE ingress → egress goes straight in. Anything guests see, and any backstage time OUTSIDE the window, still waits
 * for the host or coordinator. `backstageVerdict` is that rule, read by the screen (to say what will happen) AND by the
 * server's settle (`settleAfterAsking`, from the rows it reads itself — never from what the screen posted).
 * 🔒 lib/venue-window.test.ts
 */
import { momentSection } from './chapter-section';
import { clockWords, egressAt, ingressAt } from './schedule-chapters';

export type WindowChapter = {
  start_at: string | null;
  end_at: string | null;
  time_tba?: boolean | null;
  ingress_minutes_before: number | null;
  egress_minutes_after: number | null;
};

export type VenueWindow = {
  /** When the venue lets suppliers in: ingress, else the chapter's start. */
  open: string;
  /** The event itself. */
  start: string;
  end: string | null;
  /** When everybody must be out: egress, else the chapter's end, else its start. */
  close: string;
  hasIngress: boolean;
  hasEgress: boolean;
};

/** The chapter's window, or null when there is none to draw (no clock yet, or Time TBA). */
export function venueWindowOf(c: WindowChapter | null | undefined): VenueWindow | null {
  if (!c || !c.start_at || c.time_tba) return null;
  const start = c.start_at;
  if (!Number.isFinite(Date.parse(start))) return null;
  const end = c.end_at && Date.parse(c.end_at) > Date.parse(start) ? c.end_at : null;
  const ingress = ingressAt({ start_at: start, ingress_minutes_before: c.ingress_minutes_before });
  const egress = egressAt({ start_at: start, egress_minutes_after: c.egress_minutes_after });
  const hasIngress = Boolean(ingress && Date.parse(ingress) < Date.parse(start));
  // An egress typed before the chapter ends is flagged elsewhere (`chapterWindowFlags`); the window never ends before
  // the event does.
  const lastOfEvent = end ?? start;
  const hasEgress = Boolean(egress && Date.parse(egress) > Date.parse(lastOfEvent));
  return {
    open: hasIngress ? (ingress as string) : start,
    start,
    end,
    close: hasEgress ? (egress as string) : lastOfEvent,
    hasIngress,
    hasEgress,
  };
}

/** "Setup from 12:00 PM · Event 4:00 PM – 9:30 PM · Out by 11:00 PM" — only the parts that are set. */
export function venueWindowWords(w: VenueWindow): string {
  return [
    w.hasIngress ? `Setup from ${clockWords(w.open)}` : null,
    `Event ${clockWords(w.start)}${w.end ? ` – ${clockWords(w.end)}` : ' onward'}`,
    w.hasEgress ? `Out by ${clockWords(w.close)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** A moment (its start, and its end when it has one) sits inside open → close. */
export function insideWindow(w: VenueWindow, startIso: string, endIso?: string | null): boolean {
  const t = Date.parse(startIso);
  if (!Number.isFinite(t)) return false;
  if (t < Date.parse(w.open) || t > Date.parse(w.close)) return false;
  if (endIso) {
    const e = Date.parse(endIso);
    if (Number.isFinite(e) && e > Date.parse(w.close)) return false;
  }
  return true;
}

/**
 * What happens to a supplier's own moment at this time:
 *   · `at_once`    — backstage, inside the venue's hours: it applies at once (20 Nov);
 *   · `guests_see` — in the Event part: guests see it / it touches the programme, so it waits for the host;
 *   · `outside`    — backstage but outside the venue's hours (or the venue set none on that side): it waits, in amber;
 *   · `no_window`  — the chapter has no clock yet: it waits.
 */
export type BackstageVerdict = 'at_once' | 'guests_see' | 'outside' | 'no_window';

export function backstageVerdict(c: WindowChapter | null | undefined, startIso: string | null | undefined, endIso?: string | null): BackstageVerdict {
  const w = venueWindowOf(c);
  if (!w || !startIso || !Number.isFinite(Date.parse(startIso))) return 'no_window';
  const section = momentSection(startIso, { start_at: w.start, end_at: w.end, time_tba: false });
  if (section === 'Event') return 'guests_see';
  // Backstage is only "inside" on a side the venue gave hours for: no setup time set = no setup window to be inside.
  if (section === 'Ingress' && !w.hasIngress) return 'outside';
  if (section === 'Egress' && !w.hasEgress) return 'outside';
  return insideWindow(w, startIso, endIso) ? 'at_once' : 'outside';
}

/** The one line under the supplier's moment sheet for each verdict (drawing: the `mnote` under + My moment). */
export const VERDICT_WORDS: Readonly<Record<BackstageVerdict, string>> = {
  at_once: 'Backstage, inside the venue’s hours. It goes straight in.',
  guests_see: 'Guests see this part of the day, so the host or coordinator approves it.',
  outside: 'Outside the venue’s hours. The host or coordinator approves it.',
  no_window: 'The host or coordinator approves it.',
};

export const OUTSIDE_WORDS = 'Outside the venue’s hours';

/**
 * 🔒 THE SERVER'S RULE for a request already written (RLS has said it is the supplier's own item / linked chapter).
 * `request` is the row as read back from the database; `chapter` the chapter it sits in; `current` the moment it
 * changes (an adjust). Applies at once ONLY when:
 *   · it is the supplier's own request (`to_host`), a `new` or an `adjust` — a delete still waits;
 *   · where the moment ENDS UP is backstage inside the window; and
 *   · for an adjust, where it IS NOW is backstage too — moving a moment guests see out of the programme waits.
 * Anything unreadable is "waits": the request stays with a person, never the other way round.
 */
export function backstageAppliesAtOnce(input: {
  request: { kind: string; direction?: string | null; proposed_start_at: string | null; proposed_end_at: string | null };
  chapter: WindowChapter | null;
  current?: { start_at: string | null; end_at: string | null } | null;
}): boolean {
  const { request: r, chapter, current } = input;
  if (r.direction === 'to_supplier') return false;
  if (r.kind !== 'new' && r.kind !== 'adjust') return false;
  if (!chapter) return false;
  if (r.kind === 'new') {
    return backstageVerdict(chapter, r.proposed_start_at, r.proposed_end_at) === 'at_once';
  }
  if (!current?.start_at) return false;
  if (backstageVerdict(chapter, current.start_at, current.end_at) === 'guests_see') return false;
  const start = r.proposed_start_at ?? current.start_at;
  const end = r.proposed_start_at ? r.proposed_end_at : (r.proposed_end_at ?? current.end_at);
  return backstageVerdict(chapter, start, end) === 'at_once';
}

/**
 * 🏛 Who set the window, in the drawing's words: "Set by Fernwood Gardens · confirmed by the hosts". A venue holds the
 * hours only after the hosts approved them (`apply_venue_hours`), so "confirmed by the hosts" is a fact, not a hope.
 * `heldBy`: the venue's name · `undefined` = a venue holds it, name unread (never a blank, never a guess) · `null` = no
 * venue holds the chapter, so the hosts set the hours themselves.
 */
export function windowSetByWords(heldBy: string | null | undefined): string {
  if (heldBy === null) return 'Set by the hosts';
  return `Set by ${heldBy ?? 'the venue'} · confirmed by the hosts`;
}

/* ── The bar ─────────────────────────────────────────────────────────────────────────────────────────────────────── */

const HOUR = 3_600_000;

/** The drawing's fixed axis on the event day: 10 AM … midnight (`VEN.lo = 600`, `VEN.hi = 1440`, in minutes). */
export const AXIS_FROM_MIN = 10 * 60;
export const AXIS_TO_MIN = 24 * 60;

/**
 * The bar's time axis: FIXED at 10 AM … midnight of the event's day (drawing `venueBar`, ruled 20 Nov: "a fixed
 * 10 AM–midnight axis"), so every chapter's bar reads on the same ruler. It widens to whole hours ONLY when the venue's
 * own window falls outside those hours (a 7 AM breakfast, an after-midnight pack-up) — a band is never cut off. A
 * moment (`_also`) outside the axis is clamped to its edge, as the drawing clamps it; its words still say the time.
 */
export function windowAxis(w: VenueWindow, _also: readonly (string | null | undefined)[] = []): { lo: number; hi: number } {
  const start = Date.parse(w.start);
  const day = Math.floor(start / (24 * HOUR)) * 24 * HOUR;
  let lo = day + AXIS_FROM_MIN * 60_000;
  let hi = day + AXIS_TO_MIN * 60_000;
  const open = Date.parse(w.open);
  const close = Date.parse(w.close);
  if (Number.isFinite(open) && open < lo) lo = Math.floor(open / HOUR) * HOUR;
  if (Number.isFinite(close) && close > hi) hi = Math.ceil(close / HOUR) * HOUR;
  return { lo, hi };
}

/** 0–100 along the axis, clamped. */
export function axisPercent(axis: { lo: number; hi: number }, iso: string): number {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.min(100, ((t - axis.lo) / (axis.hi - axis.lo)) * 100));
}

export type WindowBand = { kind: 'ingress' | 'event' | 'egress'; left: number; width: number };

/** The bar's three bands — hatched setup, solid event, hatched pack-up — as left/width percents. */
export function windowBands(w: VenueWindow, axis: { lo: number; hi: number }): WindowBand[] {
  const band = (kind: WindowBand['kind'], a: string, b: string): WindowBand => {
    const left = axisPercent(axis, a);
    return { kind, left, width: Math.max(0, axisPercent(axis, b) - left) };
  };
  const out: WindowBand[] = [];
  if (w.hasIngress) out.push(band('ingress', w.open, w.start));
  const eventEnd = w.end ?? (w.hasEgress ? w.close : new Date(Date.parse(w.start) + HOUR).toISOString());
  out.push(band('event', w.start, eventEnd));
  if (w.hasEgress && w.end) out.push(band('egress', w.end, w.close));
  return out;
}

/** The axis's two ends, as the drawing labels them ("10 AM" · "midnight"). */
export function axisEndWords(t: number): string {
  const d = new Date(t);
  const h = d.getUTCHours();
  if (h === 0) return 'midnight';
  if (h === 12) return 'noon';
  return `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;
}
