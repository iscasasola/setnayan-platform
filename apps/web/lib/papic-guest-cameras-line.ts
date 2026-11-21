/**
 * lib/papic-guest-cameras-line.ts — 📷 THE ONE STATE LINE UNDER "Papic" ON MEMORIES (owner 2026-11-20, "memories
 * approved" — `prototypes/memories_redesign_2026-11-20/`, DECISION_LOG 2026-11-20 "EVENT › MEMORIES — PAPIC ON TOP +
 * FIVE OPENED PAGES, APPROVED"; controller calls under owner delegation the same day):
 *
 *   "Guests’ cameras open Fri 18 Dec"  ·  "Guests’ cameras are open now"  ·  "Guests’ cameras are off"
 *
 * 🔑 COMPUTED FROM THE GATE, NEVER A FIXED DATE. Each line is what `guestCaptureGate` (the SAME resolver the guest page
 * renders by and the upload route refuses by) answers for the head's position — so the line can never promise a camera
 * the route would refuse. "Open <day>" names the instant the gate opens: the event day (On — event day). On — everyone,
 * now is open from the moment it is picked (2026-11-22).
 *
 * ⚡ LIVE (owner 2026-11-22, "THE PAPIC DROPDOWN IN MEMORIES IS LIVE — NO APPLY"): the head writes `papic_on` live, so the
 * line is what guests have NOW and never says "after you Apply". An unread fact is "Couldn’t check just now" — never a
 * position nobody measured.
 *
 * 🔁 THE HEAD'S PICKER SAYS ITS OWN WORDS (`papicHeadLine`) the moment it is pressed, and its behaviour is frozen. So the
 * server also hands the card `byHead` — the line for every position, keyed by the words the picker says — and the card
 * shows this file's line for whatever the picker said. One fact, one wording.
 *
 * Pure — no I/O. Held by `papic-guest-cameras-line.test.ts`.
 */
import { guestCaptureGate } from '@/lib/papic-guest-window';
import { manilaDate } from '@/lib/papic-window';
import { PAPIC_HEAD_OPTIONS, papicHeadLine, papicHeadPosition, type PapicHeadFacts } from '@/lib/papic-shoot-now';

export const CAMERAS_UNREAD = 'Couldn’t check just now';

/** The event's dates the gate reads — the raw columns, exactly as the guest page and the upload route pass them. */
export type CamerasGateDates = {
  eventDate: string | null;
  windowStart: string | null;
  windowEnd: string | null;
};

/** "Fri 18 Dec" (Manila) — the year only when it is not this year's. null when the date is unreadable. */
export function camerasDayWords(value: string | null, nowMs: number): string | null {
  const day = manilaDate(value);
  if (!day) return null;
  const at = Date.parse(`${day}T12:00:00+08:00`);
  if (!Number.isFinite(at)) return null;
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(new Date(at));
  const part = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? '';
  const thisYear = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', year: 'numeric' }).format(new Date(nowMs));
  return `${part('weekday')} ${part('day')} ${part('month')}${part('year') === thisYear ? '' : ` ${part('year')}`}`;
}

/** What the gate answers for guests whose cameras are switched on, with the early switch at `early`. */
function gateLine(early: boolean, d: CamerasGateDates, nowMs: number): string {
  const gate = guestCaptureGate({ earlyAllowed: early, eventDate: d.eventDate, windowStart: d.windowStart, windowEnd: d.windowEnd, nowMs });
  if (gate.state === 'open') return 'Guests’ cameras are open now';
  if (gate.state === 'closed') return 'Guests’ cameras have closed';
  // Not open yet: only the event-day position can say this (early is open from now) — the event day.
  const opens = camerasDayWords(gate.eventDay, nowMs);
  return opens ? `Guests’ cameras open ${opens}` : 'Guests’ cameras open on your event day';
}

/** The line for the head's facts — what guests have now. */
export function papicGuestCamerasLine(f: PapicHeadFacts, d: CamerasGateDates, nowMs: number): string {
  const at = papicHeadPosition(f);
  if (at === null) return CAMERAS_UNREAD;
  if (at === 'off') return 'Guests’ cameras are off';
  return gateLine(at === 'now', d, nowMs);
}

/**
 * The line now, and the line for every position the picker can say — keyed by the picker's own words
 * (`papicHeadLine`), so the card can follow a pick before the server answers. Each position says its own words.
 */
export function papicGuestCamerasLines(f: PapicHeadFacts, d: CamerasGateDates, nowMs: number): { now: string; byHead: Record<string, string> } {
  const byHead: Record<string, string> = {};
  if (f.live !== null && f.early !== null) {
    for (const o of PAPIC_HEAD_OPTIONS) {
      const facts: PapicHeadFacts = { live: o.key !== 'off', early: o.key === 'off' ? f.early : o.key === 'now' };
      byHead[papicHeadLine(facts)] = papicGuestCamerasLine(facts, d, nowMs);
    }
  }
  return { now: papicGuestCamerasLine(f, d, nowMs), byHead };
}

/**
 * 📷 THE PICKER'S SUB-LINES (the approved drawing, "Proposed · the switch, opened", owner "memories approved" 20 Nov):
 * under each choice, what it does to guests' cameras — "guests’ cameras stay closed" · "cameras open Fri 18 Dec" ·
 * "cameras open on the Event Hub now". Computed from the SAME gate as the state line, never a fixed date; a position
 * the gate has already closed says so ("cameras have closed"). null dates → no sub-lines (the picker shows its words alone).
 */
export function papicHeadHints(d: CamerasGateDates | null, nowMs: number): Partial<Record<'off' | 'eventday' | 'now', string>> {
  if (!d) return {};
  const sub = (line: string) => line.replace(/^Guests’ cameras/, 'cameras');
  const now = guestCaptureGate({ earlyAllowed: true, eventDate: d.eventDate, windowStart: d.windowStart, windowEnd: d.windowEnd, nowMs });
  return {
    off: 'guests’ cameras stay closed',
    eventday: sub(gateLine(false, d, nowMs)),
    now: now.state === 'open' ? 'cameras open on the Event Hub now' : sub(gateLine(true, d, nowMs)),
  };
}
