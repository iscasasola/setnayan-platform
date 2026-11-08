/**
 * 🧾 DETAILS = WHAT IS AGREED NOW (Supplier Build 3 · lane B; DECISION_LOG 📌 2026-11-08, "the chat is the record").
 *
 * Owner: the chat is the record of every change; Details is the AGREED RESULT — one row per fact, its value now, and
 * "Changed N×" that opens the history (who, when, from → to), newest first. Same rows for host, coordinator and
 * supplier. A row with no history says "No changes" — it is never hidden, and a fact nobody set says so in words.
 *
 * Pure: the reads are the page's (`_pages/details.tsx`); this turns them into rows. History comes from where each fact
 * is already kept — quote VERSIONS (`lib/quote-versions.ts`, every sent quote is a row), and `booking_changes` for the
 * facts overwritten in place (event date · guest count · meeting time — `lib/booking-changes.ts`).
 */
import { changesFor, type BookingChange } from './booking-changes';
import { formatPhp } from './php';
import type { QuoteVersion } from './quote-versions';
import type { ChatTopic } from './topic-icons';

export type AgreedHistory = {
  /** ISO. */
  at: string;
  /** "You" · a first name · "Someone" (a name we could not read) · "Setnayan" (a system write). */
  who: string;
  from: string | null;
  to: string | null;
};

export type AgreedRow = {
  key: string;
  topic: ChatTopic;
  label: string;
  /** The value now, in words. Never blank, never "—". */
  value: string;
  /** Newest first. Empty = "No changes". */
  history: AgreedHistory[];
};

export type AgreedOutcome = { kind: 'won' | 'lost' | 'open'; line: string };

export type AgreedInputs = {
  viewerUserId: string;
  /** The supplier's quote versions on this event (any order) — `orderQuoteVersions` output for this pair. */
  quotes: readonly QuoteVersion[];
  event: { eventDate: string | null; estimatedPax: number | null; finalPax: number | null };
  /** `booking_changes` rows, or null when the read was refused (the rows then say they could not load). */
  changes: readonly BookingChange[] | null;
  meetings: readonly { appointmentId: string; title: string; scheduledAt: string; status: string }[];
  /** user id → first name (missing = "Someone"). */
  names: ReadonlyMap<string, string>;
  /** `event_vendors` state for this supplier. */
  booking: { isBooked: boolean; declined: boolean };
  /** Who sends a quote, as this reader says it — "You" for the supplier, the shop's name for the hosts. */
  quoteBy: string;
};

export const COULD_NOT_LOAD = "Couldn't load the history";

const dateFmt = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** "Nov 23, 2026" from yyyy-mm-dd (read as a Manila day). */
export function dayWords(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  if (!m) return null;
  const ms = Date.parse(`${m[1]}T12:00:00+08:00`);
  return Number.isFinite(ms) ? dateFmt.format(ms) : null;
}

export function momentWords(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? timeFmt.format(ms) : null;
}

function who(changedBy: string | null, viewer: string, names: ReadonlyMap<string, string>): string {
  if (!changedBy) return 'Setnayan';
  if (changedBy === viewer) return 'You';
  return names.get(changedBy) ?? 'Someone';
}

function paxWords(n: string | number | null | undefined): string | null {
  if (n == null || n === '') return null;
  const v = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(v) ? `${v} guests` : null;
}

function historyOf(
  rows: readonly BookingChange[],
  viewer: string,
  names: ReadonlyMap<string, string>,
  show: (v: string | null) => string | null,
): AgreedHistory[] {
  return rows.map((c) => ({ at: c.changedAt, who: who(c.changedBy, viewer, names), from: show(c.fromValue), to: show(c.toValue) }));
}

/** Won / lost is automatic (owner 8 Nov) — never a (+) row. */
export function agreedOutcome(b: AgreedInputs['booking'], quotes: readonly QuoteVersion[]): AgreedOutcome {
  if (b.isBooked) return { kind: 'won', line: 'Booked · you won this booking' };
  if (b.declined) return { kind: 'lost', line: 'Not booked · this booking went elsewhere' };
  const latest = [...quotes].sort((a, b2) => b2.version - a.version)[0];
  if (latest && latest.status === 'declined') return { kind: 'lost', line: 'Not booked · they turned the quote down' };
  return { kind: 'open', line: 'Not booked yet' };
}

export function agreedRows(i: AgreedInputs): AgreedRow[] {
  const rows: AgreedRow[] = [];
  const v = i.viewerUserId;
  const changes = i.changes ?? [];

  // Quote — the agreed one when accepted, else the newest sent; history = every earlier version.
  const versions = [...i.quotes].sort((a, b) => b.version - a.version);
  const accepted = versions.find((q) => q.status === 'accepted');
  const shown = accepted ?? versions[0];
  rows.push({
    key: 'quote',
    topic: 'quote',
    label: accepted ? 'Agreed quote' : 'Quote',
    value: shown
      ? `Version ${shown.version} · ${formatPhp(shown.totalCentavos / 100)}${accepted ? '' : ` · ${shown.status === 'viewed' ? 'seen' : shown.status}`}`
      : 'No quote sent yet',
    history: versions
      .filter((q) => q.previous)
      .map((q) => ({
        at: q.at,
        who: i.quoteBy,
        from: q.previous ? `Version ${q.previous.version} · ${formatPhp(q.previous.totalCentavos / 100)}` : null,
        to: `Version ${q.version} · ${formatPhp(q.totalCentavos / 100)}`,
      })),
  });

  rows.push({
    key: 'event_date',
    topic: 'details',
    label: 'Event date',
    value: dayWords(i.event.eventDate) ?? 'No date set yet',
    history: historyOf(changesFor(changes, 'event_date'), v, i.names, dayWords),
  });

  const finalSet = i.event.finalPax != null;
  rows.push({
    key: 'guest_count',
    topic: 'details',
    label: finalSet ? 'Guest count · final' : 'Guest count · estimate',
    value: paxWords(finalSet ? i.event.finalPax : i.event.estimatedPax) ?? 'No count yet',
    history: historyOf(
      [...changesFor(changes, 'guest_count_final'), ...changesFor(changes, 'guest_estimate')].sort(
        (a, b) => Date.parse(b.changedAt) - Date.parse(a.changedAt) || b.changeId - a.changeId,
      ),
      v,
      i.names,
      paxWords,
    ),
  });

  const live = i.meetings.filter((m) => m.status === 'confirmed' || m.status === 'proposed');
  if (live.length === 0) {
    rows.push({ key: 'meetings', topic: 'schedule', label: 'Meetings', value: 'No meeting set', history: [] });
  } else {
    for (const m of live) {
      rows.push({
        key: `meeting:${m.appointmentId}`,
        topic: 'schedule',
        label: m.title || 'Meeting',
        value: `${momentWords(m.scheduledAt) ?? 'Time not set'}${m.status === 'proposed' ? ' · not agreed yet' : ''}`,
        history: historyOf(changesFor(changes, 'meeting_time', m.appointmentId), v, i.names, momentWords),
      });
    }
  }
  return rows;
}

/** "Changed 2×" / "No changes" / the could-not-load line — the row's one quiet tail. */
export function changedLabel(history: readonly AgreedHistory[], loaded: boolean): string {
  if (!loaded) return COULD_NOT_LOAD;
  return history.length === 0 ? 'No changes' : `Changed ${history.length}×`;
}
