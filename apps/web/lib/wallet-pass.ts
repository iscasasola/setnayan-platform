/**
 * apps/web/lib/wallet-pass.ts — THE GUEST'S APPLE WALLET PASS, the pure half.
 *
 * Owner ruling, DECISION_LOG 2026-10-13: *"YES TO APPLE WALLET + GOOGLE WALLET
 * PASSES FOR GUESTS"* (Google deferred by the owner the same day: "do google
 * wallet next time"). Plan of record:
 * controller-2026-10-12/WALLET_PASS_PLAN_2026-10-13.md (Phase A — "tap again
 * to update", no endpoint, no table).
 *
 * 🔑 THE PASS IS THE TICKET, NOT A SECOND TICKET. Every fact on it comes from the
 * SAME kit the saved PNG is drawn from (`loadPassCardKit` → `passCardPass`, in
 * lib/wallet-pass.server.ts), and its code is the SAME string the PNG's code
 * encodes (`passCardQrUrl` = `buildInvitationUrl` with the arguments
 * `renderPassCardFor` gives `renderInvitationQrPng`) — so the door desk, Papic
 * tagging and the landing page read a Wallet pass exactly as they read the PNG.
 *
 * This file decides and shapes, and touches nothing: no I/O, no env, no clock.
 *   · WHO MAY ADD ONE (`decideWalletPassAccess`) — the guest, for themselves;
 *   · WHAT IS ON IT (`walletPassContent`) — the ticket's facts, venue NAME only;
 *   · THE APPLE FILE'S JSON (`applePassJson`).
 * Signing and zipping: lib/wallet-pass-pkpass.ts. Reads: lib/wallet-pass.server.ts.
 */
import { createHash } from 'node:crypto';
import { inAppHandoff } from './guest-landing';
import { APPLE_WALLET_ROUTE, PASS_CARD_REFUSED, PASS_CARD_WORDS, decidePassCardAccess, type PassCardRow, type PassCardVerdict } from './pass-card';
import { printLookFor, CLASSIC_PRINT_THEME } from './print-pieces';
import { publicEventUrl } from './public-event-url';
import { buildInvitationUrl } from './qr';

// ─── Who may add one ────────────────────────────────────────────────────────

/**
 * 🔒 THE WALLET ROUTE'S WHOLE GATE. Narrower than the PNG's on purpose:
 *   · the guest's OWN seat only — no `?guest=` for a plus-one (plan Q3: each
 *     plus-one adds their own from their own link) and never a host (Q9: a
 *     Wallet pass is for the guest's own phone);
 *   · only a ticket that EXISTS — a "Request pending" seat has no real ticket
 *     to put in Wallet yet.
 * Every refusal after sign-in is the PNG's ONE 404 with ONE body.
 */
export function decideWalletPassAccess(input: {
  session: { guest_id: string; event_id: string } | null;
  target: PassCardRow | null;
  bringer: PassCardRow | null;
  readFailed: boolean;
}): PassCardVerdict {
  const verdict = decidePassCardAccess({ ...input, isHost: false });
  if (!verdict.allow) return verdict;
  if (verdict.pending || verdict.as !== 'guest' || !input.session || input.target?.guest_id !== input.session.guest_id) {
    return { allow: false, status: 404, message: PASS_CARD_REFUSED };
  }
  return verdict;
}

// ─── What is on it ──────────────────────────────────────────────────────────

/** The facts a pass is built from — shaped by lib/wallet-pass.server.ts from the ticket's kit. */
export type WalletPassFacts = {
  guestId: string;
  qrToken: string;
  /** In the event's Name style (`passCardGuestName`) — the PNG's own line. */
  guestName: string;
  /** Named companions coming ("and 1 guest"). */
  party: number;
  /** "Table 7" — EMPTY before 00:00 Manila on the event's date (`readTicketSeats`). */
  table: string | null;
  seatNumber: string | null;
  /** "Maria & Jose". */
  couple: string;
  /** "The wedding of". */
  eyebrow: string;
  /** "Wedding". */
  eventWord: string | null;
  /** `YYYY-MM-DD`. */
  eventDate: string | null;
  /** "3:00 PM" — the PNG's ARRIVE. */
  arriveLabel: string | null;
  /** The first public block's start, the venue's wall-clock PARKED IN UTC (`…T15:00:00Z` = 3 PM there). */
  arriveAt: string | null;
  /** A venue NAME — never an address. */
  venue: string | null;
  /** The event's street address, given ONLY so the builder can refuse to print it. */
  venueAddress: string | null;
  appUrl: string;
  slug: string;
  ownerSlug: string | null;
  look: { paper: string; ink: string; accent: string };
};

export type WalletField = { key: string; label: string; value: string };

export type WalletPassContent = {
  serialNumber: string;
  /** The exact string the PNG's code encodes — a sign-in credential, never printed as text. */
  qrMessage: string;
  organizationName: string;
  description: string;
  /** `2026-12-18T15:00:00+08:00`, or null with no date. */
  relevantDate: string | null;
  colors: { background: string; foreground: string; label: string };
  header: WalletField[];
  primary: WalletField[];
  secondary: WalletField[];
  auxiliary: WalletField[];
  back: WalletField[];
};

/**
 * THE SERIAL — stable per guest, so pressing "Add to Apple Wallet" again
 * REPLACES the pass (iOS says "Update"), and never derived from the code: a
 * rotated `qr_token` is the same pass with a new code, and the serial (which
 * Wallet shows nobody, but a Phase-B update service would be asked by) must
 * not carry the credential.
 */
export function walletSerial(guestId: string): string {
  return 'g-' + createHash('sha256').update(`setnayan-wallet-pass:v1:${guestId}`).digest('hex').slice(0, 32);
}

/** The code's string — `buildInvitationUrl` with exactly the arguments `renderPassCardFor` passes. */
export function passCardQrUrl(f: Pick<WalletPassFacts, 'appUrl' | 'slug' | 'qrToken' | 'ownerSlug'>): string {
  return buildInvitationUrl({ appUrl: f.appUrl, slug: f.slug, qrToken: f.qrToken, ownerSlug: f.ownerSlug });
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** `2026-12-18` → "Dec 18, 2026" (a header field is narrow); anything else → null, never guessed. */
export function walletDateLabel(eventDate: string | null): string | null {
  const m = eventDate ? /^(\d{4})-(\d{2})-(\d{2})/.exec(eventDate) : null;
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${Number(m[3])}, ${m[1]}` : null;
}

/**
 * 🕗 WHEN THE PASS RISES ON THE LOCK SCREEN — the arrive time on the event's
 * date, in Manila. ⚠ The schedule stores the venue's wall-clock PARKED IN UTC
 * (`…T15:00:00Z` means 3 PM at the venue — the 8-hour bug `readArrive`
 * notes), so the instant is BUILT from its UTC hours, never passed through.
 * No arrive time → 09:00 on the date. No date → null.
 */
export function walletRelevantDate(eventDate: string | null, arriveAt: string | null): string | null {
  const day = eventDate && /^\d{4}-\d{2}-\d{2}/.test(eventDate) ? eventDate.slice(0, 10) : null;
  if (!day) return null;
  let hhmm = '09:00';
  if (arriveAt) {
    const t = new Date(arriveAt);
    if (!Number.isNaN(t.getTime())) hhmm = `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`;
  }
  return `${day}T${hhmm}:00+08:00`;
}

// ── Colours ──

type Rgb = [number, number, number];

function hexRgb(raw: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!m) return null;
  const h = m[1]!.length === 3 ? m[1]!.split('').map((c) => c + c).join('') : m[1]!;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function luminance([r, g, b]: Rgb): number {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

export function contrastRatio(a: string, b: string): number | null {
  const x = hexRgb(a);
  const y = hexRgb(b);
  if (!x || !y) return null;
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const rgbCss = ([r, g, b]: Rgb) => `rgb(${r}, ${g}, ${b})`;

/**
 * 🎨 THE COUPLE'S TICKET COLOURS: paper behind, ink for values, accent for
 * labels. A pair Wallet could not read falls back — the label to the ink
 * (accent below 3 : 1), the whole pass to Classic (ink below 4.5 : 1 or a
 * colour that is not a hex).
 */
export function walletColors(look: WalletPassFacts['look']): WalletPassContent['colors'] {
  const classic = printLookFor(CLASSIC_PRINT_THEME);
  const inkOk = (contrastRatio(look.ink, look.paper) ?? 0) >= 4.5;
  const base = inkOk ? look : { paper: classic.paper, ink: classic.ink, accent: classic.accent };
  const labelOk = (contrastRatio(base.accent, base.paper) ?? 0) >= 3;
  const paper = hexRgb(base.paper) ?? [255, 255, 255];
  const ink = hexRgb(base.ink) ?? [17, 17, 17];
  const label = labelOk ? hexRgb(base.accent) ?? ink : ink;
  return { background: rgbCss(paper), foreground: rgbCss(ink), label: rgbCss(label) };
}

/**
 * 🏠 A VENUE NAME, NEVER AN ADDRESS (owner ruling; plan §0.2 + Q5). A name that
 * carries the street address — the couple typed the address into the venue
 * box — is dropped rather than printed.
 */
export function walletVenueName(venue: string | null, address: string | null): string | null {
  const v = venue?.trim() || null;
  if (!v) return null;
  const a = address?.trim().toLowerCase();
  if (a && a.length >= 6) {
    const lv = v.toLowerCase();
    if (lv.includes(a) || a.includes(lv)) return null;
  }
  return v;
}

function partyWords(n: number): string | null {
  return n > 0 ? `and ${n} ${n === 1 ? 'guest' : 'guests'}` : null;
}

/** Every line a pass carries, platform-neutral. */
export function walletPassContent(f: WalletPassFacts): WalletPassContent {
  const word = (f.eventWord ?? '').trim().toLowerCase() || 'celebration';
  const couple = f.couple.trim() || 'the couple';
  const date = walletDateLabel(f.eventDate);
  const venue = walletVenueName(f.venue, f.venueAddress);
  const party = partyWords(f.party);
  const table = f.table?.trim() ? f.table.trim().replace(/^Table\s+/i, '') : null;

  const field = (key: string, label: string, value: string | null | undefined): WalletField[] =>
    value && value.trim() ? [{ key, label, value: value.trim() }] : [];

  return {
    serialNumber: walletSerial(f.guestId),
    qrMessage: passCardQrUrl(f),
    organizationName: couple,
    description: `${PASS_CARD_WORDS.noun.charAt(0).toUpperCase()}${PASS_CARD_WORDS.noun.slice(1)} to ${couple}’s ${word}`,
    relevantDate: walletRelevantDate(f.eventDate, f.arriveAt),
    colors: walletColors(f.look),
    header: field('date', 'DATE', date),
    primary: field('couple', f.eyebrow.trim() || 'The celebration of', couple),
    secondary: [...field('guest', 'GUEST', f.guestName), ...field('with', 'WITH', party)],
    auxiliary: [
      ...field('arrive', 'ARRIVE', f.arriveLabel),
      ...field('venue', 'VENUE', venue),
      ...field('table', 'TABLE', table),
      ...field('seat', 'SEAT', table ? f.seatNumber : null),
    ],
    back: [
      { key: 'door', label: PASS_CARD_WORDS.yours, value: PASS_CARD_WORDS.walletAtTheDoor },
      ...(table ? [] : [{ key: 'table-later', label: 'Your table', value: PASS_CARD_WORDS.walletTableLater }]),
      // The event's PUBLIC address — never the personal link (that is the code).
      { key: 'hub', label: 'Event Hub', value: publicEventUrl(f.appUrl, f.slug, f.ownerSlug) },
      { key: 'remove', label: 'To remove', value: PASS_CARD_WORDS.walletRemove },
    ],
  };
}

// ─── The Apple file's JSON ──────────────────────────────────────────────────

export type AppleWalletIds = { passTypeIdentifier: string; teamIdentifier: string };

/**
 * `pass.json` for an `eventTicket`. No `locations` (coordinates are the
 * address in another form, plan Q5), no `expirationDate` (a keepsake whose code
 * still opens the hub, Q7), no `altText` under the code (it is a sign-in
 * credential), and `sharingProhibited` — Wallet's Share button would hand the
 * guest's own key to someone else.
 */
export function applePassJson(c: WalletPassContent, ids: AppleWalletIds): Record<string, unknown> {
  return {
    formatVersion: 1,
    passTypeIdentifier: ids.passTypeIdentifier,
    teamIdentifier: ids.teamIdentifier,
    serialNumber: c.serialNumber,
    organizationName: c.organizationName,
    description: c.description,
    backgroundColor: c.colors.background,
    foregroundColor: c.colors.foreground,
    labelColor: c.colors.label,
    sharingProhibited: true,
    ...(c.relevantDate ? { relevantDate: c.relevantDate } : {}),
    barcodes: [{ format: 'PKBarcodeFormatQR', message: c.qrMessage, messageEncoding: 'iso-8859-1' }],
    eventTicket: {
      headerFields: c.header,
      primaryFields: c.primary,
      secondaryFields: c.secondary,
      auxiliaryFields: c.auxiliary,
      backFields: c.back,
    },
  };
}

/** `Maria-Santos-ticket-….pkpass` — the PNG's own name with the Wallet extension. */
export function walletPassFileName(pngName: string): string {
  return pngName.replace(/\.png$/i, '') + '.pkpass';
}

/**
 * The value of a `*_B64` env var as PEM text: base64 of the PEM file (the
 * owner's set-up step 8), or — forgiving a paste of the file itself — the PEM.
 */
export function pemFromEnvValue(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  if (v.includes('-----BEGIN')) return v;
  try {
    const text = Buffer.from(v, 'base64').toString('utf8');
    return text.includes('-----BEGIN') ? text : null;
  } catch {
    return null;
  }
}

// ─── Who is offered the button ──────────────────────────────────────────────

/**
 * 🍎 iPhone, iPad and Mac Safari can add a `.pkpass`. iPadOS reports a Mac;
 * Chrome/Firefox/Edge on a Mac cannot. Android and everything else: no button
 * (Google Wallet is deferred).
 */
export function appleWalletDevice(userAgent: string | null | undefined): boolean {
  const ua = userAgent ?? '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  if (/Macintosh/i.test(ua)) return /Safari\//.test(ua) && !/Chrome\/|CriOS|Chromium|Firefox\/|FxiOS|Edg\//.test(ua);
  return false;
}

/** What the ticket section offers: Apple's button, or (inside Messenger on an iPhone) the Safari hand-off. */
export type AppleWalletLink = { href: string; label: string; handoff: boolean };

/**
 * The link beside "Save my ticket", or null. `offered` is the server's answer
 * (`appleWalletOffered`: the switch ON and every Apple value present). Inside an
 * iPhone's in-app browser the Add-pass sheet does not open, so the link is the
 * SAME Safari hand-off "Save my ticket" already uses there (`inAppHandoff`) —
 * the guest's own link, which signs them in on the Safari side.
 */
export function appleWalletLink(userAgent: string | null | undefined, personalLink: string, offered: boolean): AppleWalletLink | null {
  if (!offered) return null;
  const inApp = inAppHandoff(userAgent, personalLink);
  if (inApp.kind === 'ios') return { href: inApp.safariHref, label: PASS_CARD_WORDS.appleWalletInApp, handoff: true };
  if (inApp.kind !== 'none') return null;
  return appleWalletDevice(userAgent) ? { href: APPLE_WALLET_ROUTE, label: PASS_CARD_WORDS.appleWallet, handoff: false } : null;
}
