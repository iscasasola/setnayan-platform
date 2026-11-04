// ============================================================================
// lib/virtual-meeting.ts
//
// A VIRTUAL meeting happens on the proposer's OWN app — never inside Setnayan
// (owner 2026-10-28 "remove both voice and video call"; 2026-11-04 "In-person /
// Virtual … they can pick an option like via google meetings, viber,
// messenger"). This module is the whole of it: which apps, the ONE value each
// needs (Jitsi: a link Setnayan makes itself), how that value is validated,
// how it is stored, and the hand-off a
// "Join" button opens.
//
// 🗄 STORAGE — NO NEW SCHEMA. `event_appointments.location` was only ever used
// by in-person meetings; for a Virtual one it now holds `"<via>|<value>"`
// (`meet|https://meet.google.com/abc-defg-hij`, `viber|+639171234567`). An
// empty value (`"meet|"`) is "app chosen, no link yet". `parseVirtualLocation`
// also reads an older bare link, inferring the app from its host.
//
// 🔌 SEAM FOR LINK AUTO-CREATION. "Create a Google Meet link" opens
// meet.google.com/new in the person's OWN account and they paste the link back
// (`createLinkHref`). Creating it for them through a Google / Zoom API (OAuth)
// is an open owner choice — when it lands, it replaces `createLinkHref` with an
// action that returns a link, and everything downstream (validate → store →
// hand-off) stays as it is.
//
// Pure module — safe on the server and the client.
// ============================================================================

export type VirtualVia = 'jitsi' | 'meet' | 'zoom' | 'messenger' | 'viber' | 'phone';

/** Owner-approved list and order, 2026-11-04. */
export const VIRTUAL_VIAS: ReadonlyArray<VirtualVia> = ['jitsi', 'meet', 'zoom', 'messenger', 'viber', 'phone'];

/** Viber and Phone call — only once the shop is booked on the event (owner 2026-11-04). */
export const BOOKED_ONLY_VIAS: ReadonlyArray<VirtualVia> = ['viber', 'phone'];

/** The apps a meeting may use: unbooked → Jitsi · Google Meet · Zoom · Messenger; booked → all six. */
export function viasFor(booked: boolean): ReadonlyArray<VirtualVia> {
  return booked === true ? VIRTUAL_VIAS : VIRTUAL_VIAS.filter((v) => !BOOKED_ONLY_VIAS.includes(v));
}

/** The ⓘ line shown to an unbooked pair. */
export const BOOKED_ONLY_NOTE = 'Viber and phone calls open once this supplier is booked for your event.';

export const VIRTUAL_VIA_META: Record<
  VirtualVia,
  {
    label: string;
    field: string;
    placeholder: string;
    inputMode: 'url' | 'tel';
    /** A short free-plan limit, shown under the field (owner 2026-11-04). */
    freeNote?: string;
  }
> = {
  jitsi: { label: 'Jitsi Meet', field: 'Meeting link', placeholder: '', inputMode: 'url' },
  meet: {
    label: 'Google Meet',
    field: 'Meeting link',
    placeholder: 'https://meet.google.com/abc-defg-hij',
    inputMode: 'url',
    freeNote: 'Free · 60 min for 3 or more people',
  },
  zoom: {
    label: 'Zoom',
    field: 'Meeting link',
    placeholder: 'https://zoom.us/j/1234567890',
    inputMode: 'url',
    freeNote: 'Free Zoom ends at 40 min',
  },
  messenger: { label: 'Messenger', field: 'Messenger link', placeholder: 'm.me/yourpage', inputMode: 'url' },
  viber: { label: 'Viber', field: 'Viber number', placeholder: '0917 123 4567', inputMode: 'tel' },
  phone: { label: 'Phone call', field: 'Phone number', placeholder: '0917 123 4567', inputMode: 'tel' },
};

/** Owner 2026-11-04: "if voice call, via phone number. but this means only 1 person". */
export const PHONE_IS_ONE_PERSON =
  'A phone call is one person — pick one person, or use Viber or Google Meet for a group.';

/**
 * 🆓 JITSI — the one app Setnayan makes the link for itself, with no API and no
 * account: a room name nobody can guess on the public meet.jit.si
 * (`https://meet.jit.si/Setnayan-<10 Crockford chars>`, the same alphabet as our
 * public ids). Free, no time limit.
 */
export const JITSI_MADE_NOTE = 'Setnayan made this link · free, no time limit';
export const JITSI_HOST_TIP =
  'Whoever opens the meeting first signs in with Google or Facebook. Everyone else just taps Join.';
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const JITSI_LINK = /^https:\/\/meet\.jit\.si\/Setnayan-[0-9A-HJKMNP-TV-Z]{10}$/;

export function makeJitsiLink(random: (n: number) => Uint8Array = defaultRandom): string {
  const bytes = random(10);
  let body = '';
  for (let i = 0; i < 10; i++) body += CROCKFORD[bytes[i]! % 32];
  return `https://meet.jit.si/Setnayan-${body}`;
}

function defaultRandom(n: number): Uint8Array {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
}

export function isVirtualVia(v: unknown): v is VirtualVia {
  return typeof v === 'string' && (VIRTUAL_VIAS as readonly string[]).includes(v);
}

/**
 * "Create a … link" — opens the app's own new-meeting page in the person's OWN
 * account (new tab); they paste the link back. See the SEAM note above.
 */
export function createLinkHref(via: VirtualVia): string | null {
  if (via === 'meet') return 'https://meet.google.com/new';
  if (via === 'zoom') return 'https://zoom.us/start/videomeeting';
  return null;
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

export { phPhoneToE164, formatPhPhone } from './ph-dial';
import { phPhoneToE164, formatPhPhone } from './ph-dial';
import { bookedTelHref, bookedViberHref, bookedCallLabel } from './booked-handoff';

export type VirtualValueCheck = { ok: true; value: string } | { ok: false; error: string };

/**
 * Validate + normalise the ONE value a Virtual meeting needs for its app.
 * Empty is allowed — the link can be added later ("no link yet").
 */
export function normalizeVirtualValue(via: VirtualVia, raw: string): VirtualValueCheck {
  const t = raw.trim();
  if (t === '') return { ok: true, value: '' };
  if (via === 'jitsi') {
    // Only a link Setnayan made — never a free-typed room on someone else's server.
    if (!JITSI_LINK.test(t)) return { ok: false, error: 'Pick Jitsi Meet again to make a fresh link.' };
    return { ok: true, value: t };
  }
  if (via === 'meet' || via === 'zoom' || via === 'messenger') {
    const u = asHttpUrl(t);
    if (!u) {
      return {
        ok: false,
        error:
          via === 'messenger'
            ? 'That is not a link — paste a Messenger link, like m.me/yourpage.'
            : 'That is not a link — paste the full meeting link, starting with https://',
      };
    }
    return { ok: true, value: u.toString() };
  }
  const e164 = phPhoneToE164(t);
  if (via === 'viber') {
    if (!e164 || !/^\+639\d{9}$/.test(e164)) {
      return { ok: false, error: 'Viber needs a PH mobile number, like 0917 123 4567.' };
    }
    return { ok: true, value: e164 };
  }
  if (!e164) return { ok: false, error: 'Enter a PH phone number, like 0917 123 4567.' };
  return { ok: true, value: e164 };
}

/** Stored form of a Virtual meeting's app + value (in `event_appointments.location`). */
export function encodeVirtualLocation(via: VirtualVia, value: string): string {
  return `${via}|${value}`;
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
 * The hand-off OUT of Setnayan — never an in-app call. Jitsi / Meet / Zoom /
 * Messenger → the http(s) link in a new tab. Viber / Phone only for a shop with
 * a confirmed booking on the event (owner 2026-11-04 "Viber and phone call
 * booked suppliers") — those links are made ONLY by `lib/booked-handoff.ts`,
 * which returns null without `booked`. Null when there is nothing safe to open.
 */
export function virtualHandoff(place: VirtualPlace, booked: boolean): VirtualHandoff | null {
  const { via, value } = place;
  if (!value) return null;
  if (via === 'viber') {
    const href = bookedViberHref(booked, value);
    return href ? { href, label: 'Open in Viber', newTab: false } : null;
  }
  if (via === 'phone') {
    const href = bookedTelHref(booked, value);
    return href ? { href, label: bookedCallLabel(value), newTab: false } : null;
  }
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

/** The read-only words for the value ("0917 123 4567", or the link). */
export function virtualValueText(place: VirtualPlace): string {
  if (!place.value) return '';
  if (place.via === 'viber' || place.via === 'phone') {
    const e164 = phPhoneToE164(place.value);
    return e164 ? formatPhPhone(e164) : place.value;
  }
  return place.value;
}

/** "Virtual · Google Meet", or "Virtual" when the app is not known. */
export function virtualSummary(place: VirtualPlace): string {
  return place.via ? `Virtual · ${VIRTUAL_VIA_META[place.via].label}` : 'Virtual';
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
 * Server-side read of a composer's Virtual fields (`via`, `virtual_value`).
 * ok:false → the caller saves NOTHING.
 */
export function readVirtualFields(
  formData: { get(name: string): unknown },
  /** The booking check's answer for this (event, shop) — `shopIsBookedOnEvent`. Viber / Phone are refused without it. */
  booked: boolean,
): { ok: true; location: string | null } | { ok: false; error: string } {
  const viaRaw = formData.get('via');
  const valueRaw = formData.get('virtual_value');
  const value = typeof valueRaw === 'string' ? valueRaw.slice(0, 500) : '';
  if (!isVirtualVia(viaRaw)) {
    if (value.trim() === '') return { ok: true, location: null };
    return { ok: false, error: 'Pick the app first.' };
  }
  if (!viasFor(booked).includes(viaRaw)) {
    return { ok: false, error: 'Viber and phone calls open once this supplier is booked. Pick another app.' };
  }
  const check = normalizeVirtualValue(viaRaw, value);
  if (!check.ok) return check;
  return { ok: true, location: encodeVirtualLocation(viaRaw, check.value) };
}
