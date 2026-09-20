/**
 * nfc-tag.ts — the pure half of "Write to NFC".
 *
 * Every QR on the site that is a LINK can also be a TAP: the same URL the QR
 * encodes, written as one NDEF URL record onto a blank NFC sticker. A phone
 * touching the sticker opens the page exactly as a scan would — iPhone and
 * Android alike, no app needed. Only the WRITING is platform-bound (Web NFC is
 * Chrome-on-Android only; the iOS shell reaches CoreNFC in a follow-up PR).
 *
 * This module has no DOM in it on purpose. It decides:
 *   • whether a QR payload is even a link a tag can hold (`nfcTagEligibility`)
 *     — a GCash/QR Ph payment string is not, and must never get the button;
 *   • how many bytes the NDEF record takes and which sticker fits it
 *     (`ndefUrlTagBytes`, `smallestTagFor`) — a per-guest invitation link with
 *     its token is longer than a shop link, and "the tag was too small" must
 *     be said BEFORE the tap, not discovered as a cryptic write error;
 *   • what a thrown DOMException MEANS in one plain sentence
 *     (`classifyNfcError`, `nfcFailureCopy`) — every exit says "Write failed"
 *     with a reason, never a blank sheet;
 *   • whether the read-back matches what was meant (`readBackMatches`) — the
 *     browser saying it wrote is not the tag holding the link. The screen says
 *     "Tag written" only when the read-back agrees.
 *
 * FLAG: `NEXT_PUBLIC_NFC_WRITE_ENABLED` is read by `lib/nfc-write-flag.ts`
 * and asked by the button component. Nothing in here reads it.
 */

// ── Eligibility ────────────────────────────────────────────────────────────

export type NfcEligibility =
  | { eligible: true; url: string }
  | { eligible: false; reason: 'not-a-link' | 'custom-scheme' | 'empty' };

/**
 * Only an http(s) URL goes on a tag. A bank payment payload (EMVCo string) is
 * not a link and a phone would do nothing useful with it; a custom
 * `setnayan://` scheme is refused because iPhone ignores non-https tags on a
 * background read — it would "work" on one platform and be a dead sticker on
 * the other, which is the exact shape of false-green this project hunts.
 */
export function nfcTagEligibility(payload: string | null | undefined): NfcEligibility {
  const raw = (payload ?? '').trim();
  if (!raw) return { eligible: false, reason: 'empty' };
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { eligible: false, reason: 'not-a-link' };
  }
  if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
    return { eligible: true, url: raw };
  }
  return { eligible: false, reason: 'custom-scheme' };
}

// ── Byte budget ────────────────────────────────────────────────────────────

/**
 * NFC Forum URI Record Type Definition — the identifier-code table. The
 * record's first payload byte is an INDEX into this list; the rest is the URL
 * with that prefix removed. Index = code, so the order is fixed by the spec.
 */
export const NDEF_URI_PREFIXES: readonly string[] = [
  '', 'http://www.', 'https://www.', 'http://', 'https://', 'tel:', 'mailto:',
  'ftp://anonymous:anonymous@', 'ftp://ftp.', 'ftps://', 'sftp://', 'smb://',
  'nfs://', 'ftp://', 'dav://', 'news:', 'telnet://', 'imap:', 'rtsp://', 'urn:',
  'pop:', 'sip:', 'sips:', 'tftp:', 'btspp://', 'btl2cap://', 'btgoep://',
  'tcpobex://', 'irdaobex://', 'file://', 'urn:epc:id:', 'urn:epc:tag:',
  'urn:epc:pat:', 'urn:epc:raw:', 'urn:epc:', 'urn:nfc:',
];

const TEXT_BYTES = (s: string): number => new TextEncoder().encode(s).length;

/** The identifier code that abbreviates this URL best (longest prefix wins). */
function uriPrefixCode(url: string): number {
  let best = 0;
  NDEF_URI_PREFIXES.forEach((p, code) => {
    if (p && url.startsWith(p) && p.length > (NDEF_URI_PREFIXES[best] ?? '').length) best = code;
  });
  return best;
}

/**
 * Bytes the whole NDEF message occupies on a Type 2 tag (the NTAG family
 * every cheap sticker is): the NDEF TLV wrapper + one URL record + the
 * terminator. Long-record and 3-byte-length forms kick in past 255 bytes.
 */
export function ndefUrlTagBytes(url: string): number {
  const prefix = NDEF_URI_PREFIXES[uriPrefixCode(url)] ?? '';
  const payloadBytes = 1 + TEXT_BYTES(url.slice(prefix.length)); // prefix id + rest
  // Record header: flags(1) + type length(1) + payload length(1 or 4) + type "U"(1)
  const recordBytes = (payloadBytes > 255 ? 7 : 4) + payloadBytes;
  // TLV: tag(1) + length(1 or 3) + message + terminator(1)
  const tlvBytes = (recordBytes >= 255 ? 4 : 2) + recordBytes + 1;
  return tlvBytes;
}

/** User memory available for the NDEF message, per common sticker chip. */
export const NFC_TAG_CAPACITY_BYTES = {
  NTAG213: 144,
  NTAG215: 504,
  NTAG216: 888,
} as const;

export type NfcTagChip = keyof typeof NFC_TAG_CAPACITY_BYTES;

/** The cheapest sticker this URL fits on, or null when none of the three do. */
export function smallestTagFor(url: string): NfcTagChip | null {
  const need = ndefUrlTagBytes(url);
  for (const chip of ['NTAG213', 'NTAG215', 'NTAG216'] as const) {
    if (need <= NFC_TAG_CAPACITY_BYTES[chip]) return chip;
  }
  return null;
}

/** One line under the button: which sticker to buy. */
export function tagSizeCopy(url: string): string {
  const chip = smallestTagFor(url);
  if (chip === 'NTAG213') return 'Fits any standard NFC sticker.';
  if (chip === 'NTAG215' || chip === 'NTAG216') return `This link is long — use an ${chip} sticker or larger.`;
  return 'This link is too long for a standard NFC sticker.';
}

// ── Failure classification ─────────────────────────────────────────────────

export type NfcFailureReason =
  | 'permission-denied'
  | 'nfc-off'
  | 'tag-moved'
  | 'tag-locked'
  | 'tag-too-small'
  | 'unsupported-tag'
  | 'timed-out'
  | 'cancelled'
  | 'unsupported-browser'
  | 'no-nfc'
  | 'mismatch'
  | 'unexpected';

/**
 * Turn whatever `NDEFReader.write()` threw into one named reason. Message
 * text is checked FIRST for the two conditions that matter most to the person
 * holding the sticker (read-only, too small), because browsers file those
 * under names that also mean other things; then the DOMException name decides.
 */
export function classifyNfcError(
  err: unknown,
  ctx: { timedOut?: boolean; cancelled?: boolean } = {},
): NfcFailureReason {
  const name = typeof err === 'object' && err && 'name' in err ? String((err as { name: unknown }).name) : '';
  const message =
    typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : String(err ?? '');
  if (/read[- ]?only|locked|not writable|write[- ]?protected/i.test(message)) return 'tag-locked';
  if (/capacity|too (large|big|long)|not enough|insufficient|exceed/i.test(message)) return 'tag-too-small';
  switch (name) {
    case 'AbortError':
      if (ctx.timedOut) return 'timed-out';
      if (ctx.cancelled) return 'cancelled';
      return 'timed-out';
    case 'NotAllowedError':
      return 'permission-denied';
    case 'NotReadableError':
      return 'nfc-off';
    case 'NetworkError':
      return 'tag-moved';
    case 'NotSupportedError':
      return 'unsupported-tag';
    case 'SecurityError':
    case 'ReferenceError':
    case 'TypeError':
      return 'unsupported-browser';
    default:
      return 'unexpected';
  }
}

/** The sentence under "Write failed". Every reason has one; none is generic. */
export function nfcFailureCopy(reason: NfcFailureReason): string {
  switch (reason) {
    case 'permission-denied':
      return 'Your phone did not allow this site to use NFC. Allow it when asked and try again.';
    case 'nfc-off':
      return 'NFC is switched off on this phone. Turn it on in Settings and try again.';
    case 'tag-moved':
      return 'The tag moved away before the write finished. Hold it still against the phone and try again.';
    case 'tag-locked':
      return 'This tag is locked or read-only. Use a blank, unlocked sticker.';
    case 'tag-too-small':
      return 'This tag is too small for the link. Use an NTAG215 or NTAG216 sticker.';
    case 'unsupported-tag':
      return 'This tag cannot hold a web link. Use an NDEF sticker such as NTAG213.';
    case 'timed-out':
      return 'No tag was found in 30 seconds. Tap Try again and hold the sticker to the top of the phone.';
    case 'cancelled':
      return 'Cancelled. Nothing was written.';
    case 'unsupported-browser':
      return 'This browser cannot write NFC tags. Use Chrome on an Android phone, or copy the link and write it with a free NFC app.';
    case 'no-nfc':
      return 'This phone has no NFC reader, so it cannot write tags. Copy the link and write it from another phone.';
    case 'mismatch':
      return 'The tag holds something else. Hold it still and try again.';
    case 'unexpected':
      return 'Something unexpected stopped the write. Try again.';
  }
}

/**
 * The same reasons, worded for READING a tag at a desk. Only the reasons a
 * read can actually hit are distinct; the rest fall back to a plain line.
 */
export function nfcReadFailureCopy(reason: NfcFailureReason): string {
  switch (reason) {
    case 'permission-denied':
      return 'This phone did not allow the site to use NFC. Allow it when asked, or scan the QR instead.';
    case 'nfc-off':
      return 'NFC is switched off on this phone. Turn it on in Settings, or scan the QR instead.';
    case 'no-nfc':
      return 'This phone has no NFC reader. Scan the QR instead.';
    case 'unsupported-browser':
      return 'This browser cannot read NFC tags. Use the Setnayan app or Chrome on Android, or scan the QR.';
    case 'timed-out':
      return 'The tag reader stopped after a minute with no tag. Tap Read a tag again when the next guest arrives.';
    default:
      return 'The tag reader stopped. Tap Read a tag to start it again, or scan the QR.';
  }
}

/**
 * What a desk does with one tag: the first record that decodes to a Setnayan
 * guest token, or why not. `parse` is the desk's existing QR parser, passed in
 * so a tag and a QR are judged by the ONE rule.
 */
export function guestTokenFromTag(
  urls: readonly string[],
  parse: (raw: string) => string | null,
): { token: string } | { token: null; reason: 'empty' | 'not-a-guest-code' } {
  if (urls.length === 0) return { token: null, reason: 'empty' };
  for (const u of urls) {
    const token = parse(u);
    if (token) return { token };
  }
  return { token: null, reason: 'not-a-guest-code' };
}

// ── Whose job is this? ────────────────────────────────────────────────────
//
// Writing a tag is a PHONE job: the phone's own radio touches the sticker.
// No desktop browser can do it, and no desktop ever will — a laptop has no
// NFC writer the web can reach. So a desktop is not "unsupported browser",
// it is the wrong device, and the sheet should say so.

export type NfcDevice = 'phone' | 'desktop';

/**
 * Pure: is this a phone-shaped device? Takes what the caller read from the
 * browser so it can be tested without one. A coarse pointer (finger) plus a
 * small screen is the honest signal; the user-agent is the fallback for
 * desktop browsers that lie about neither.
 */
export function nfcDeviceKind(env: {
  coarsePointer: boolean;
  maxTouchPoints: number;
  userAgent: string;
  screenWidth: number;
}): NfcDevice {
  const ua = env.userAgent;
  if (/iPhone|iPod|Android.*Mobile/i.test(ua)) return 'phone';
  // iPadOS reports a Mac user-agent; it is still a touch device, and it can
  // run the app. Treat any touch device with a phone/tablet-sized screen as
  // a phone for this purpose.
  if (env.coarsePointer && env.maxTouchPoints > 0 && env.screenWidth <= 1180) return 'phone';
  return 'desktop';
}

/**
 * What the sheet says when this device cannot write. Separate from
 * `nfcFailureCopy` because "you are on a laptop" is not a failure — nothing
 * went wrong, the job simply belongs on the phone in your pocket.
 */
export function nfcWrongDeviceCopy(device: NfcDevice, isIos: boolean): string {
  if (device === 'desktop') {
    return 'Writing an NFC tag happens on a phone — a computer has no NFC writer. Copy the link below, open this page on your phone, and write the tag there.';
  }
  if (isIos) {
    return 'On iPhone, tags are written from the Setnayan app. Open this page in the app, or copy the link and write it with a free NFC app such as NFC Tools.';
  }
  return 'This browser cannot write NFC tags. Use Chrome on this phone, or copy the link and write it with a free NFC app such as NFC Tools.';
}

/** Time to wait for a sticker before we call it. */
export const NFC_WRITE_TIMEOUT_MS = 30_000;
/** Time to wait for the read-back after a write. */
export const NFC_READBACK_TIMEOUT_MS = 6_000;

// ── Read-back ──────────────────────────────────────────────────────────────

/**
 * The decoded URL records found on the tag after writing, against what we
 * meant. Exact match — the NDEF URL record round-trips the string byte for
 * byte, so any difference means the tag holds something else.
 */
export function readBackMatches(found: readonly string[], expected: string): boolean {
  return found.some((u) => u === expected);
}

// ── Raw records (the native app's plugin speaks bytes) ─────────────────────

/** One NDEF record as the Capacitor NFC plugin passes it: every field is bytes. */
export type RawNdefRecord = { tnf: number; type: number[]; id: number[]; payload: number[] };

const TNF_WELL_KNOWN = 0x01;
const TNF_ABSOLUTE_URI = 0x03;
const RTD_URI = 0x55; // "U"

/** The well-known URI record for `url`, abbreviated per the identifier table. */
export function ndefUriRecord(url: string): RawNdefRecord {
  const code = uriPrefixCode(url);
  const rest = url.slice((NDEF_URI_PREFIXES[code] ?? '').length);
  return {
    tnf: TNF_WELL_KNOWN,
    type: [RTD_URI],
    id: [],
    payload: [code, ...new TextEncoder().encode(rest)],
  };
}

/**
 * Every URL a tag's records hold, decoded. Unknown records are skipped rather
 * than guessed at — a tag holding something else simply yields no match.
 */
export function decodeNdefUriRecords(records: readonly RawNdefRecord[] | null | undefined): string[] {
  const out: string[] = [];
  const dec = new TextDecoder();
  for (const r of records ?? []) {
    if (r.tnf === TNF_WELL_KNOWN && r.type.length === 1 && r.type[0] === RTD_URI && r.payload.length > 0) {
      const prefix = NDEF_URI_PREFIXES[r.payload[0] ?? -1];
      if (prefix === undefined) continue; // reserved code: not a URI we can read
      out.push(prefix + dec.decode(Uint8Array.from(r.payload.slice(1))));
    } else if (r.tnf === TNF_ABSOLUTE_URI && r.type.length > 0) {
      out.push(dec.decode(Uint8Array.from(r.type)));
    }
  }
  return out;
}

/**
 * The plugin's rejections carry a `code` (NO_NFC, NFC_DISABLED) and a message
 * written for developers. Fold them into the same reasons the web path uses.
 */
export function classifyNativeNfcError(err: unknown): NfcFailureReason {
  const code = typeof err === 'object' && err && 'code' in err ? String((err as { code: unknown }).code) : '';
  const message =
    typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : String(err ?? '');
  if (code === 'NFC_DISABLED' || /disabled/i.test(message)) return 'nfc-off';
  if (code === 'NO_NFC' || /not available|hardware/i.test(message)) return 'no-nfc';
  if (code === 'CANCELLED') return 'cancelled';
  if (/does not support NDEF|not support/i.test(message)) return 'unsupported-tag';
  if (/connect|connection lost|no active nfc session|no nfc tag/i.test(message)) return 'tag-moved';
  return classifyNfcError(err);
}

/** How the app's NFC session ended without a tag, as a reason. */
export function sessionEndReason(reason: string | null | undefined): NfcFailureReason {
  if (reason === 'userCancelled') return 'cancelled';
  if (reason === 'sessionTimeout') return 'timed-out';
  return 'unexpected';
}

/**
 * `NDEFReader` exists in Chrome on Android (and Chromium WebViews that expose
 * it). Takes the global as a parameter so the answer can be tested without a
 * DOM.
 */
export function nfcWriteSupported(globalObject: object | undefined | null): boolean {
  return !!globalObject && 'NDEFReader' in globalObject;
}
