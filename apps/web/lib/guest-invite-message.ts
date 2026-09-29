/**
 * THE MESSAGE A COUPLE SENDS ONE GUEST — one guest, one link, one builder.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * Measured on a real event, 2026-09-16: **75 of 77 guests have no email AND no
 * mobile**. V1 sends no SMS and delivers no Viber message itself, so what the
 * couple actually does is open Messenger or Viber on their own phone and send.
 * This module writes what they send.
 *
 * ── THE OWNER'S WORDS (2026-09-29) ─────────────────────────────────────────
 * *"maybe we can create a copy text. Hi XXX! Here is our RSVP for our wedding!
 * To successfully lock your RSVP Please type "XXX XXXX" as your name. Here is
 * the link: XXX"* → each guest gets their PERSONAL link, so nobody types a
 * name → *"Here is the link: / Here is your QR Code for the event: (link here)
 * / Save it to access our website anytime?"* — approved. And: *"something we
 * can copy and send to them via third party apps like messenger"*.
 *
 * 🔒 UI COPY NEVER SAYS "website" — it is an **Event Hub** (owner 2026-09-24).
 * The owner's own draft said "website"; the message says "Event Hub". The
 * tests hold it.
 *
 * ── ONE BUILDER, FOUR CALLERS ──────────────────────────────────────────────
 *   · the guest card's "Send invite" / "Copy message" (guest list, phone + desktop)
 *   · "Send invites one by one" (`guests/send`)
 *   · the Invitation page's per-guest Send modal
 *   · a guest's "Send their invite" to their own plus-one (voice: 'guest')
 * plus `buildGroupInviteMessage` for the ONE shared link (Invite panel).
 *
 * 🔑 IT CARRIES THE GUEST'S OWN LINK OR IT IS NOT BUILT. A message without the
 * door is not a weaker invitation, it is a broken one — the couple only finds
 * out after pressing send. No link → `null`, and callers offer no Send button.
 *
 * ── THE COUPLE CAN REWORD IT, ONCE, FOR EVERYBODY ──────────────────────────
 * The stored template (`events.print_details.invite_message`, the Maker's
 * Details › Words jsonb — see `print-pieces.ts`) is plain text with four
 * placeholders that fill themselves: {name} · {event} · {date} · {link}. NULL
 * = our wording. Filling is ONE pass with a function replacer, so a guest named
 * "{link}" or "$&" is printed as typed and never expands into anything.
 */

/** Who is sending: the couple/hosts ("our Event Hub"), or a guest passing a
 *  plus-one their own key ("the Event Hub"). */
export type InviteVoice = 'hosts' | 'guest';

/** The event's own facts — everything a message needs that is not the guest. */
export type InviteEventFacts = {
  /** `events.display_name` — "Indalecio & Claire". */
  hostsName?: string | null;
  /** The event type's word — 'wedding' · 'birthday' · 'debut' · 'event' · 'wake'. */
  eventWord?: string | null;
  /** The solemn register (a wake). No "!", no 💌, no "you're invited". */
  solemn?: boolean;
  /** ISO `YYYY-MM-DD`, or null. */
  eventDate?: string | null;
  /** `events.event_date_precision` — only a DAY is written as a date. */
  datePrecision?: string | null;
};

export type GuestInviteContext = InviteEventFacts & {
  /** `guests.first_name` — the greeting. Falls back to the first word of guestName. */
  firstName?: string | null;
  /** The display name, used only when there is no first name. */
  guestName?: string | null;
  /** THE GUEST'S OWN invitation URL. Blank → no message at all. */
  inviteUrl: string;
  /** The couple's reworded text (placeholders {name} {event} {date} {link}); null/blank = ours. */
  template?: string | null;
  voice?: InviteVoice;
  /** The share sheet is attaching the QR image to this message. Default wording only. */
  qrAttached?: boolean;
  /** For the "same year → no year" rule; tests pass a fixed date. */
  now?: Date;
};

/** The cap on a couple's own wording — a chat message, not a letter. */
export const INVITE_TEMPLATE_MAX = 1000;

/** The four placeholders, as the editor lists them. */
export const INVITE_PLACEHOLDERS = [
  { token: '{name}', says: 'their first name' },
  { token: '{event}', says: 'your event, by name' },
  { token: '{date}', says: 'the date' },
  { token: '{link}', says: 'their own link' },
] as const;

const APOS = '’';

function possessive(noun: string): string {
  return /s$/i.test(noun) ? `${noun}${APOS}` : `${noun}${APOS}s`;
}

/**
 * "Friday, December 18" — the year only when it is not this year. Parsed and
 * formatted in UTC so a `YYYY-MM-DD` never slides a day in any time zone.
 * Anything unreadable, or a date the couple set only to the month or year, is
 * `null` — the sentence elides cleanly rather than pasting "Invalid Date".
 */
export function formatInviteDate(
  raw: string | null | undefined,
  precision?: string | null,
  now: Date = new Date(),
): string | null {
  if (!raw) return null;
  if (precision && precision !== 'day') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime()) || d.getUTCMonth() !== Number(m[2]) - 1) return null;
  const sameYear = d.getUTCFullYear() === now.getUTCFullYear();
  return d.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/**
 * "{event}" — the event named the way a person says it.
 *
 *   hosts + word        → "Indalecio & Claire’s wedding" · "Mia’s birthday"
 *   the name has the word already → "Mia’s 7th Birthday" (never "…Birthday’s birthday")
 *   the generic word 'event'      → just the name ("Movie Night", never "Movie Night’s event")
 *   no name             → "our wedding" (hosts) · "the wedding" (a guest sending)
 *   solemn              → "the wake for Lola Nena"
 */
export function inviteEventPhrase(facts: InviteEventFacts, voice: InviteVoice = 'hosts'): string {
  const hosts = (facts.hostsName ?? '').trim();
  const word = (facts.eventWord ?? '').trim() || 'celebration';
  const hasWord = hosts.toLowerCase().includes(word.toLowerCase());
  if (facts.solemn) {
    if (!hosts) return `the ${word}`;
    return hasWord ? hosts : `the ${word} for ${hosts}`;
  }
  if (!hosts) return `${voice === 'guest' ? 'the' : 'our'} ${word}`;
  if (hasWord || word === 'event') return hosts;
  return `${possessive(hosts)} ${word}`;
}

/**
 * OUR wording. What the couple sees in the editor before they change anything,
 * and what every guest gets until they do.
 *
 * ⚖ THE QR LINE IS TRUE IN BOTH PATHS. On a phone whose share sheet takes a
 * file, the QR image travels with the message and the line says "(attached)";
 * everywhere else (a copy, a desktop, a share sheet that refuses files) nothing
 * is attached, so the line says where the QR IS — on the page the link opens.
 */
export function defaultInviteTemplate(opts: {
  solemn?: boolean;
  voice?: InviteVoice;
  qrAttached?: boolean;
} = {}): string {
  const hub = opts.voice === 'guest' ? 'the Event Hub' : 'our Event Hub';
  const qr = opts.qrAttached
    ? `Here${APOS}s your QR code for the event (attached). Save it — it opens ${hub} anytime, and it${APOS}s your pass at the door.`
    : `Your QR code for the event is on that page too. Save it — it opens ${hub} anytime, and it${APOS}s your pass at the door.`;
  const keep = `This link is just for you, so please don${APOS}t forward it.`;
  if (opts.solemn) {
    return [
      'Hi {name}. We would be grateful to have you with us at {event} on {date}.',
      '',
      `Here are the details — tap to let us know if you can come:`,
      '{link}',
      '',
      qr,
      '',
      keep,
    ].join('\n');
  }
  return [
    `Hi {name}! 💌 You${APOS}re invited to {event} on {date}.`,
    '',
    `Here${APOS}s your invitation — tap to reply:`,
    '{link}',
    '',
    qr,
    '',
    keep,
  ].join('\n');
}

/**
 * A couple's own wording → what may be stored. Line endings normalised, control
 * characters dropped (a paste from a PDF carries them), capped. Blank → null,
 * which means OUR wording — so improving ours later reaches every couple who
 * never changed theirs.
 */
export function sanitizeInviteTemplate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .slice(0, INVITE_TEMPLATE_MAX)
    .trim();
  return s ? s : null;
}

function fill(template: string, values: { name: string; event: string; date: string | null; link: string }): string {
  let t = template;
  // An absent value takes its lead-in with it: "Hi {name}!" → "Hi!",
  // "…wedding on {date}." → "…wedding." — never "Hi !" or "on .".
  if (!values.name) t = t.replace(/[ \t]*\{name\}/gi, '');
  if (!values.date) t = t.replace(/[ \t]+on[ \t]+\{date\}/gi, '').replace(/[ \t]*\{date\}/gi, '');
  // ONE pass, function replacer: a value is never re-scanned, and `$&` in a
  // name is text, not a regex back-reference.
  return t.replace(/\{(name|event|date|link)\}/gi, (_m, key: string) => {
    switch (key.toLowerCase()) {
      case 'name':
        return values.name;
      case 'event':
        return values.event;
      case 'date':
        return values.date ?? '';
      default:
        return values.link;
    }
  });
}

function greetingName(ctx: Pick<GuestInviteContext, 'firstName' | 'guestName'>): string {
  const first = (ctx.firstName ?? '').trim();
  if (first) return first;
  return (ctx.guestName ?? '').trim().split(/\s+/)[0] ?? '';
}

/**
 * Build one guest's message, or return NULL when there is no link to put in it.
 *
 * 🔑 THE LINK IS ALWAYS IN IT. A couple's wording that drops `{link}` still
 * sends the door: the link is added on its own line at the end.
 */
export function buildGuestInviteMessage(ctx: GuestInviteContext): string | null {
  const link = (ctx.inviteUrl ?? '').trim();
  if (!link) return null;
  const voice = ctx.voice ?? 'hosts';
  const own = voice === 'hosts' ? sanitizeInviteTemplate(ctx.template) : null;
  const template =
    own ?? defaultInviteTemplate({ solemn: ctx.solemn, voice, qrAttached: ctx.qrAttached });
  const out = fill(template, {
    name: greetingName(ctx),
    event: inviteEventPhrase(ctx, voice),
    date: formatInviteDate(ctx.eventDate, ctx.datePrecision, ctx.now),
    link,
  });
  return out.includes(link) ? out : `${out}\n\n${link}`;
}

/**
 * THE GROUP-CHAT MESSAGE — for the ONE shared link, never a personal one.
 *
 * ⚖ DECISION_LOG 2026-09-26, "NOBODY WITHOUT A KEY GETS INSIDE UNTIL THE
 * COUPLE LINKS OR ACCEPTS THEM": a person who arrives by the shared link types
 * their name, fills the RSVP, and lands in the couple's Pending until they are
 * Linked or Accepted. So the message says exactly that — reply with your full
 * name, and we'll confirm you — and promises no QR (a pass comes after the
 * couple confirms, not from this link).
 */
export function buildGroupInviteMessage(
  ctx: InviteEventFacts & { joinUrl: string; now?: Date },
): string | null {
  const link = (ctx.joinUrl ?? '').trim();
  if (!link) return null;
  const opening = ctx.solemn
    ? 'Hi everyone. We would be grateful to have you with us at {event} on {date}.'
    : `Hi everyone! 💌 You${APOS}re invited to {event} on {date}.`;
  const template = [
    opening,
    '',
    `Tap the link, reply with your full name, and we${APOS}ll confirm you:`,
    '{link}',
  ].join('\n');
  return fill(template, {
    name: '',
    event: inviteEventPhrase(ctx, 'hosts'),
    date: formatInviteDate(ctx.eventDate, ctx.datePrecision, ctx.now),
    link,
  });
}

/**
 * WHICH WAY "SEND INVITE" GOES on this device — pure, so the three paths are
 * tested rather than trusted:
 *
 *   'files' — a share sheet that takes a file, and the QR is in hand: the
 *             message AND the QR image go together.
 *   'text'  — a share sheet, but no file (not supported, or the QR is not
 *             fetched yet): the message alone; its link's page shows the QR.
 *   'copy'  — no share sheet (most desktops): the message is copied, and
 *             Download QR + Mark as sent are offered beside it.
 */
export type InviteSendPath = 'files' | 'text' | 'copy';
export function inviteSendPath(device: { share: boolean; filesOk: boolean }): InviteSendPath {
  if (!device.share) return 'copy';
  return device.filesOk ? 'files' : 'text';
}
