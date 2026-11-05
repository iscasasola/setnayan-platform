// ============================================================================
// lib/virtual-meeting.ts
//
// A VIRTUAL meeting is a JITSI meeting, and Setnayan makes its link itself —
// never a call inside Setnayan (owner 2026-10-28 "remove both voice and video
// call"), and never another app (owner 2026-11-04, DECISION_LOG "VIRTUAL = JITSI
// ONLY", verbatim: "let's go with jitsi" · "just jitsi"). No menu, no field, no
// API, no account: `https://meet.jit.si/Setnayan-<10 Crockford chars>` on the
// public meet.jit.si — a room name nobody can guess. Free, no time limit.
//
// 🗄 STORAGE — NO NEW SCHEMA. `event_appointments.location` of a Virtual row
// holds `"jitsi|<link>"`. Rows saved while other apps were offered (or an older
// bare link) still READ — `parseVirtualLocation` keeps every app's name, and a
// Meet / Zoom / Messenger link still opens on Join, read-only. Nothing new is
// ever written for them: `virtualLocationFromForm` stores only a link of ours.
//
// Pure module — safe on the server and the client.
// ============================================================================

import { formatPhPhone, phPhoneToE164 } from './ph-dial';

/** Every app a stored row may name — READ only. A new meeting is always 'jitsi'. */
export type VirtualVia = 'jitsi' | 'meet' | 'zoom' | 'messenger' | 'viber' | 'phone';
const KNOWN_VIAS: ReadonlyArray<VirtualVia> = ['jitsi', 'meet', 'zoom', 'messenger', 'viber', 'phone'];

export const VIRTUAL_VIA_LABEL: Record<VirtualVia, string> = {
  jitsi: 'Jitsi Meet',
  meet: 'Google Meet',
  zoom: 'Zoom',
  messenger: 'Messenger',
  viber: 'Viber',
  phone: 'Phone call',
};

/** The words beside the link, and the ⓘ (owner 2026-11-04, "VIRTUAL = JITSI ONLY"). */
export const JITSI_MADE_NOTE = 'Setnayan made this link · free, no time limit';
export const JITSI_HOST_TIP =
  'The person who opens it first signs in once (Google, Facebook or GitHub). Everyone else joins without an account. Free, no time limit.';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const JITSI_LINK = /^https:\/\/meet\.jit\.si\/Setnayan-[0-9A-HJKMNP-TV-Z]{10}$/;

export function makeJitsiLink(random: (n: number) => Uint8Array = defaultRandom): string {
  const bytes = random(10);
  let body = '';
  for (let i = 0; i < 10; i++) body += CROCKFORD[bytes[i]! % 32];
  return `https://meet.jit.si/Setnayan-${body}`;
}

/** Only a link Setnayan made — never a free-typed room, never another server. */
export function isSetnayanJitsiLink(v: unknown): v is string {
  return typeof v === 'string' && JITSI_LINK.test(v.trim());
}

function defaultRandom(n: number): Uint8Array {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

function isVirtualVia(v: unknown): v is VirtualVia {
  return typeof v === 'string' && (KNOWN_VIAS as readonly string[]).includes(v);
}

function asHttpUrl(raw: string): URL | null {
  const t = raw.trim();
  if (!t || /\s/.test(t)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!u.hostname.includes('.')) return null;
    return u;
  } catch {
    return null;
  }
}

/** Stored form of a Virtual meeting (in `event_appointments.location`). */
export function encodeJitsiLocation(link: string): string {
  return `jitsi|${link}`;
}

export type VirtualPlace = { via: VirtualVia | null; value: string };

/** `location` of a Virtual row → its app + value (also reads an older bare link). */
export function parseVirtualLocation(location: string | null): VirtualPlace {
  const raw = (location ?? '').trim();
  if (!raw) return { via: null, value: '' };
  const bar = raw.indexOf('|');
  if (bar > 0) {
    const head = raw.slice(0, bar);
    if (isVirtualVia(head)) return { via: head, value: raw.slice(bar + 1).trim() };
  }
  const u = asHttpUrl(raw);
  if (u) {
    const h = u.hostname.toLowerCase();
    const via: VirtualVia | null = h === 'meet.jit.si'
      ? 'jitsi'
      : h.endsWith('meet.google.com')
      ? 'meet'
      : h === 'zoom.us' || h.endsWith('.zoom.us')
        ? 'zoom'
        : h === 'm.me' || h.endsWith('messenger.com')
          ? 'messenger'
          : null;
    return { via, value: u.toString() };
  }
  return { via: null, value: raw };
}

export type VirtualHandoff = { href: string; label: string; newTab: boolean };

/**
 * The hand-off OUT of Setnayan — never an in-app call: the meeting's https link
 * in a new tab (Jitsi, or an older row's Meet / Zoom / Messenger link). A number
 * is never dialled from a meeting — null, and the card shows it read-only.
 */
export function virtualHandoff(place: VirtualPlace): VirtualHandoff | null {
  const { via, value } = place;
  if (!value || via === 'viber' || via === 'phone') return null;
  const u = asHttpUrl(value);
  if (!u) return null;
  const label =
    via === 'jitsi'
      ? 'Join on Jitsi Meet'
      : via === 'meet'
      ? 'Join on Google Meet'
      : via === 'zoom'
        ? 'Join on Zoom'
        : via === 'messenger'
          ? 'Open in Messenger'
          : 'Join meeting';
  return { href: u.toString(), label, newTab: true };
}

/** The read-only words for the value (the link, or an older row's number). */
export function virtualValueText(place: VirtualPlace): string {
  if (!place.value) return '';
  if (place.via === 'viber' || place.via === 'phone') {
    const e164 = phPhoneToE164(place.value);
    return e164 ? formatPhPhone(e164) : place.value;
  }
  return place.value;
}

/** "Virtual · Jitsi Meet", or "Virtual" when the app is not known. */
export function virtualSummary(place: VirtualPlace): string {
  return place.via ? `Virtual · ${VIRTUAL_VIA_LABEL[place.via]}` : 'Virtual';
}

/** Join shows from 15 minutes before start (an untimed meeting: any time). */
export const JOIN_OPENS_MIN_BEFORE = 15;
export function joinIsOpen(scheduledAt: string | null, now = Date.now()): boolean {
  if (!scheduledAt) return true;
  const t = new Date(scheduledAt).getTime();
  if (Number.isNaN(t)) return true;
  return now >= t - JOIN_OPENS_MIN_BEFORE * 60_000;
}

/**
 * Server-side: the `location` a NEW Virtual meeting is saved with — always a
 * Jitsi link of ours. The one the composer showed (`virtual_value`) is kept when
 * it is a link Setnayan made, so the person saw the link that is saved; anything
 * else (missing, tampered, another app's link) is replaced by a fresh one made
 * here. Nothing another app's is ever written.
 */
export function virtualLocationFromForm(formData: { get(name: string): unknown }): string {
  const posted = formData.get('virtual_value');
  return encodeJitsiLocation(isSetnayanJitsiLink(posted) ? posted.trim() : makeJitsiLink());
}

// ── ONE BUTTON THAT SAYS WHAT THE ROOM NEEDS (owner 2026-11-04, DECISION_LOG row of that name, verbatim: "if a
// link shows. we can have a button conference room created. you can enter. no conference room created, create
// one") ──────────────────────────────────────────────────────────────────────────────────────────────────────────
// From 15 min before the start, ONE button for everyone on the meeting: "Create the room" until somebody presses it
// (`event_appointments.room_created_at`, set once — migration 20271311895322), then "Room created · Enter the room".
// The proposer (`initiated_by`) is offered Create first — the filled button; the other side sees it outlined with a
// note, and may still create it if the proposer has not.
export const CREATE_ROOM_TIP = 'You open the room — sign in once with Google, Facebook or GitHub.';
export const ENTER_ROOM_TIP = 'No account needed.';
export const OTHER_SIDE_CREATE_NOTE = 'They usually open it — you can too if they have not.';

export type RoomButton = {
  kind: 'create' | 'enter';
  label: string;
  tip: string;
  /** "Room created" before the Enter button. */
  lead: string | null;
  /** The filled (first-offered) button. */
  primary: boolean;
  note: string | null;
};

export function roomButtonFor(roomCreatedAt: string | null, isProposer: boolean): RoomButton {
  if (roomCreatedAt) {
    return { kind: 'enter', label: 'Enter the room', tip: ENTER_ROOM_TIP, lead: 'Room created', primary: true, note: null };
  }
  return {
    kind: 'create',
    label: 'Create the room',
    tip: CREATE_ROOM_TIP,
    lead: null,
    primary: isProposer,
    note: isProposer ? null : OTHER_SIDE_CREATE_NOTE,
  };
}

/** A room is Setnayan's to create on a Jitsi meeting, or one with no link yet; an older app's link just opens. */
export function meetingHasRoom(place: VirtualPlace): boolean {
  return place.via === 'jitsi' || !place.value;
}
