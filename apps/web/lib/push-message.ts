/**
 * push-message.ts — THE ONE TEMPLATE EVERY PHONE NOTIFICATION IS WRITTEN WITH.
 *
 * Owner, 2026-10-31, verbatim: *"Also fix the way how the notification messages
 * the phones"* — and, for guest replies, *"instant, but each new RSVP
 * notification replaces the last one on the lock screen instead of stacking."*
 *
 * Every push — Web Push today, APNs next — is a `PushMessage`, and a
 * `PushMessage` can only be made HERE (`pushMessage()`; the brand below makes an
 * inline `{ title, body }` a type error at every sender). The rules:
 *
 *   · TITLE — who or what it is about, in a few words: the event's display name
 *     ("Indalecio & Claire") for an event notice, the shop's name for a shop
 *     notice, "Setnayan" for an account notice.
 *   · BODY — one plain sentence saying what happened, in the house voice: short,
 *     "event" never "celebration", money through `formatPhp`, counts through
 *     `formatCount`. "Maria + 2 others replied · 34 coming so far".
 *   · NO INTERNAL WORDS — ids, uuids, snake_case type names and raw links are
 *     scrubbed out of both lines before they can reach a lock screen.
 *   · TAP — `url` is the exact screen (a same-origin path), never a generic home.
 *   · COLLAPSE — one key per kind (`tag` for Web Push + the `Topic` header,
 *     `apns-collapse-id` for APNs): a repeat REPLACES the last one instead of
 *     stacking.
 *   · LENGTH — what a lock screen shows: ~40 characters of title and ~110 of body,
 *     cut at a word, never through a name.
 *   · BADGE — the unread count, where the platform draws one.
 *
 * Pure: no I/O. `lib/push-send.server.ts` reads the facts (the event's name, the
 * unread count) and hands them in. 🔒 lib/push-message.test.ts ·
 * lib/every-push-goes-through-the-template.test.ts
 */
import { formatCount } from './format-number';
import { formatPhp } from './php';

/** What a lock screen shows before it cuts. */
export const PUSH_TITLE_MAX = 40;
export const PUSH_BODY_MAX = 110;

export type PushSubject =
  | { kind: 'event'; name: string | null }
  | { kind: 'shop'; name: string | null }
  | { kind: 'account' };

declare const PUSH_MESSAGE: unique symbol;

/** A finished phone notification. Only `pushMessage()` can make one. */
export type PushMessage = {
  readonly title: string;
  readonly body: string;
  /** Same-origin path the tap opens. */
  readonly url: string;
  /** Per-kind collapse key: Web Push `tag`, APNs `apns-collapse-id`. */
  readonly collapseKey: string;
  /** Web Push `Topic` header — ≤32 URL-safe characters, derived from the collapse key. */
  readonly topic: string;
  /** Unread count for the app badge, or null to leave the badge alone. */
  readonly badge: number | null;
  readonly [PUSH_MESSAGE]: true;
};

// ── the lines ────────────────────────────────────────────────────────────────

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const PUBLIC_ID = /\bS89[A-Z]-[0-9A-Z]{10}\b/g;
const LINK = /\bhttps?:\/\/\S+/gi;
const SNAKE = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g;

/** Takes out what a person should never read on a lock screen, and says "event". */
export function scrubInternal(text: string): string {
  return text
    .replace(UUID, '')
    .replace(PUBLIC_ID, '')
    .replace(LINK, '')
    .replace(SNAKE, '')
    .replace(/\bcelebrations\b/gi, 'events')
    .replace(/\bcelebration\b/gi, 'event')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/\(\s*\)/g, '')
    .trim();
}

/** Cut to `max` at a word — never through a name — with an ellipsis when it cut. */
export function fitWords(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const room = t.slice(0, max - 1);
  const space = room.lastIndexOf(' ');
  const cut = space >= Math.floor(max / 2) ? room.slice(0, space) : room;
  return `${cut.replace(/[\s,;:·—-]+$/, '')}…`;
}

function titleFor(subject: PushSubject): string {
  if (subject.kind === 'account') return 'Setnayan';
  const name = scrubInternal(subject.name ?? '');
  return name || 'Setnayan';
}

/** Short stable hash → the Web Push `Topic` (URL-safe base64 alphabet, ≤32 chars). */
export function topicFor(collapseKey: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < collapseKey.length; i += 1) {
    const c = collapseKey.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  const kind = (collapseKey.split(':')[0] ?? 'n').replace(/[^a-z]/g, '').slice(0, 10) || 'n';
  return `${kind}${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`.slice(0, 32);
}

function safePath(url: string | null | undefined, fallback: string): string {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : fallback;
}

/** THE template. Every phone notification in the product is made by this one function. */
export function pushMessage(input: {
  subject: PushSubject;
  sentence: string;
  url: string | null | undefined;
  collapseKey: string;
  badge?: number | null;
  /** Where a tap goes when `url` is missing or off-site. Never "/". */
  fallbackUrl?: string;
}): PushMessage {
  const body = fitWords(scrubInternal(input.sentence), PUSH_BODY_MAX);
  return {
    title: fitWords(titleFor(input.subject), PUSH_TITLE_MAX),
    body,
    url: safePath(input.url, input.fallbackUrl ?? '/dashboard'),
    collapseKey: input.collapseKey,
    topic: topicFor(input.collapseKey),
    badge: typeof input.badge === 'number' && input.badge >= 0 ? Math.floor(input.badge) : null,
  } as PushMessage;
}

/** What goes over the wire to the service worker (`public/sw.js` reads exactly these). */
export function pushWireBody(m: PushMessage): string {
  return JSON.stringify({ title: m.title, body: m.body, url: m.url, tag: m.collapseKey, badge: m.badge });
}

// ── the sentences, one per kind ──────────────────────────────────────────────

/** The guest's name from the bell title `app/[slug]/actions.ts` writes ("Maria RSVP'd: …" / "Maria updated their details"). */
export function guestNameFromRsvpTitle(title: string): string {
  const m = /^(.+?) (?:RSVP'd: .+|updated their details)$/.exec(title.trim());
  const name = m?.[1]?.trim();
  return name && name.length > 0 ? name : 'A guest';
}

/** "Maria replied" · "Maria + 1 other replied" · "Maria + 5 others replied", then "· 34 coming so far". */
export function rsvpSentence(f: { latestGuest: string; others: number; coming: number | null }): string {
  const who =
    f.others <= 0 ? f.latestGuest : `${f.latestGuest} + ${formatCount(f.others)} ${f.others === 1 ? 'other' : 'others'}`;
  const coming = typeof f.coming === 'number' && f.coming >= 0 ? ` · ${formatCount(f.coming)} coming so far` : '';
  return `${who} replied${coming}`;
}

/** "Luz Photography: Can we move the shoot to 3pm?" — or just the message when the sender is unknown. */
export function chatSentence(f: { from: string | null; preview: string | null }): string {
  const text = (f.preview ?? '').trim();
  if (f.from && text) return `${f.from}: ${text}`;
  if (f.from) return `${f.from} sent you a message`;
  return text || 'You have a new message';
}

/** A supplier's new inquiry — the couple's own words, quoted. */
export function inquirySentence(f: { preview: string | null; returning?: boolean; founder?: boolean }): string {
  const lead = f.founder ? 'New inquiry from a Setnayan founder' : f.returning ? 'A past client wants to book you again' : 'New inquiry';
  const text = (f.preview ?? '').trim();
  return text ? `${lead}: “${text}”` : lead;
}

export function acceptedSentence(f: { shop: string }): string {
  return `${f.shop} accepted your inquiry — say hello.`;
}

/** Words drafted for the owner's OK — payments are NOT on the push list (see notification-emit.ts). */
export function paymentSentence(f: { payer: string; amountPhp: number }): string {
  return `${f.payer} paid ${formatPhp(f.amountPhp)}`;
}

/** Words drafted for the owner's OK — bookings are NOT on the push list. */
export function bookingSentence(f: { shop: string; dateLabel: string | null }): string {
  return f.dateLabel ? `${f.shop} is booked for ${f.dateLabel}` : `${f.shop} is booked`;
}

function firstSentence(text: string | null | undefined): string {
  const t = (text ?? '').trim();
  const m = /^(.+?[.!?])(\s|$)/.exec(t);
  return (m?.[1] ?? t).trim();
}

/**
 * THE BRIDGE FROM A BELL ROW TO A PHONE SENTENCE, for every pushed type except
 * `rsvp_received` (which counts its unread rows — `lib/rsvp-push.server.ts`).
 * The bell's title/body were written for a tray; the phone gets the sentence and
 * the collapse key its kind earns. The titles parsed here are the ones the emit
 * sites write, held by `lib/push-message.test.ts`.
 */
export function noticeSentence(n: {
  type: string;
  title: string;
  body: string | null;
  relatedUrl: string | null;
  eventId: string | null;
}): { sentence: string; collapseKey: string } {
  const url = n.relatedUrl ?? '';
  switch (n.type) {
    case 'chat_message': {
      const from = /^New message from (.+)$/.exec(n.title.trim())?.[1]?.trim() ?? null;
      const thread = /\/messages\/([^/?#]+)/.exec(url)?.[1] ?? url;
      return { sentence: chatSentence({ from, preview: n.body }), collapseKey: `chat:${thread}` };
    }
    case 'vendor_inquiry_received': {
      const founder = /founder/i.test(n.title);
      // "A past client wants to book you again" (lib/reusable-bookings.server.ts) — its body is our copy, not theirs.
      const rebook = /past client/i.test(n.title);
      const returning = rebook || /returning client/i.test(n.title);
      const preview = rebook
        ? null
        : (n.body ?? '')
            .replace(/^This inquiry comes from a founder of Setnayan\.\s*/, '')
            .replace(/^This couple previously booked you for [^.]*\.\s*/, '');
      return { sentence: inquirySentence({ preview, returning, founder }), collapseKey: `inquiry:${url}` };
    }
    case 'inquiry_accepted': {
      const shop = /^(.+?) accepted your inquiry$/.exec(n.title.trim())?.[1] ?? 'Your supplier';
      return { sentence: acceptedSentence({ shop }), collapseKey: `accepted:${url}` };
    }
    case 'security_alert':
      // An event-scoped alert (a guest replaced their QR) says its title; an
      // account alert says what happened — its body's first sentence.
      return {
        sentence: n.eventId ? n.title : firstSentence(n.body) || n.title,
        collapseKey: `security:${n.eventId ?? 'account'}`,
      };
    default:
      return { sentence: firstSentence(n.body) || n.title, collapseKey: `${n.type.split('_')[0] ?? 'notice'}:${url}` };
  }
}
