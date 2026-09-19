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
 * NFC Forum URI Record Type Definition — the abbreviation table. The record's
 * first payload byte names a prefix, and the rest is the URL with that prefix
 * removed. Order matters: the longest matching prefix wins.
 */
const URI_PREFIXES: readonly string[] = [
  'https://www.',
  'http://www.',
  'https://',
  'http://',
];

const TEXT_BYTES = (s: string): number => new TextEncoder().encode(s).length;

/**
 * Bytes the whole NDEF message occupies on a Type 2 tag (the NTAG family
 * every cheap sticker is): the NDEF TLV wrapper + one URL record + the
 * terminator. Long-record and 3-byte-length forms kick in past 255 bytes.
 */
export function ndefUrlTagBytes(url: string): number {
  const prefix = URI_PREFIXES.find((p) => url.startsWith(p)) ?? '';
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
    case 'mismatch':
      return 'The tag holds something else. Hold it still and try again.';
    case 'unexpected':
      return 'Something unexpected stopped the write. Try again.';
  }
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

/**
 * `NDEFReader` exists in Chrome on Android (and Chromium WebViews that expose
 * it). Takes the global as a parameter so the answer can be tested without a
 * DOM.
 */
export function nfcWriteSupported(globalObject: object | undefined | null): boolean {
  return !!globalObject && 'NDEFReader' in globalObject;
}
