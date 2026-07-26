// lib/vendor-voice-derive.ts
//
// Derive a § 6 voice profile from the vendor's OWN outgoing replies.
// Build plan `Vendor_Front_Desk_Chatbot_Build_Plan_2026-07-18.md` § 6 / § 7B.
//
// PURE — takes an array of message bodies, returns a profile. No I/O, no clock,
// no env. The reader that supplies those bodies (`vendor-autoreply/voice-learning.ts`)
// is the only place that touches the database, and it scopes the read to ONE
// vendor's own `sender_role='vendor'` rows.
//
// ── WHY THIS IS DETERMINISTIC AND NOT A MODEL CALL ──────────────────────────
// "Setnayan AI is deterministic and free" is owner-locked (Rule 1). Voice-match
// therefore learns by COUNTING — honorific rate, emoji rate, Tagalog/Cebuano
// marker density, message length, and the vendor's most-used opener/closer —
// not by asking a model to describe someone's tone. Cost is ₱0 at derive time
// as well as at reply time, and the result is reproducible and auditable, which
// is what makes the "view & edit your voice" panel (§ 7B) honest.
//
// ── THE DATA-ISOLATION LOCK (§ 2A) ──────────────────────────────────────────
// The caller passes the vendor's OWN sent messages. Nothing here can reach
// another vendor's or a couple's text — and, critically, NOTHING FREE-FORM FROM
// A MESSAGE IS EVER COPIED INTO THE PROFILE. The greeting/sign-off come from the
// CLOSED vocabularies below: the derivation only decides WHICH known phrase the
// vendor uses most, so a customer's name, phone number, or address in a past
// reply can never end up quoted back to a different couple.

import {
  HOUSE_VOICE,
  type VoiceEmojiLevel,
  type VoiceLanguageMix,
  type VoiceProfile,
  type VoiceWarmth,
} from './vendor-voice-profile';

/** Below this many of the vendor's own replies, a derived profile is a guess —
 *  the UI must present it as a suggestion to approve, never auto-apply it. */
export const VOICE_MIN_SAMPLE = 5;

/** Hard ceiling on how many replies the reader may hand us. Bounded work, and
 *  bounded exposure of message text to the derivation. */
export const VOICE_SAMPLE_LIMIT = 300;

/** CLOSED greeting vocabulary — the only openers a derived profile may contain. */
const GREETINGS: readonly string[] = [
  'Magandang araw po',
  'Magandang araw',
  'Maayong adlaw po',
  'Maayong adlaw',
  'Kumusta po',
  'Kumusta',
  'Good day po',
  'Good day',
  'Hello po',
  'Hello',
  'Hi po',
  'Hi',
  'Hey',
];

/** CLOSED sign-off vocabulary — same reasoning as the greetings. */
const SIGNOFFS: readonly string[] = [
  'Maraming salamat po',
  'Maraming salamat',
  'Daghang salamat',
  'Salamat po',
  'Salamat',
  'Thank you po',
  'Thank you so much',
  'Thank you',
  'Thanks',
];

/** Tagalog/Taglish markers — frequency drives `language_mix`. */
const TAGALOG_MARKERS: readonly string[] = [
  'po', 'opo', 'ho', 'salamat', 'kayo', 'ninyo', 'ang', 'mga', 'naman', 'lang',
  'yung', 'meron', 'pwede', 'kami', 'natin', 'kasi', 'sana', 'ito', 'ninyong',
  'para', 'kung', 'maganda', 'ganito', 'sige', 'talaga',
];

/** Cebuano markers — a distinct dialect answer, not "more Tagalog". */
const CEBUANO_MARKERS: readonly string[] = [
  'kaayo', 'gyud', 'palihug', 'unsa', 'maayong', 'kanang', 'nimo', 'ninyo',
  'daghang', 'lagi', 'buhaton', 'naa', 'wala', 'kini',
];

const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const HONORIFIC_RE = /(^|[^a-z])(po|opo|ho)([^a-z]|$)/i;

function stripTrailingDecoration(s: string): string {
  return s.replace(EMOJI_RE, '').replace(/[\s.!?,;:~\-–—]+$/u, '').trim();
}

function words(s: string): string[] {
  return s.toLowerCase().match(/[a-zñáéíóúü']+/gu) ?? [];
}

/**
 * Most-frequent member of a closed vocabulary matching a message, by a matcher.
 * Deterministic tie-break: higher count → longer phrase → earlier in the list,
 * so the same corpus always yields the same answer.
 */
function mostCommon(
  bodies: readonly string[],
  vocab: readonly string[],
  matches: (body: string, phrase: string) => boolean,
): { phrase: string; count: number } {
  const counts = new Map<string, number>();
  for (const body of bodies) {
    // Longest phrase first: "Maraming salamat po" must not be counted as "Salamat".
    const hit = vocab.find((p) => matches(body, p));
    if (hit) counts.set(hit, (counts.get(hit) ?? 0) + 1);
  }
  let best = '';
  let bestCount = 0;
  for (const phrase of vocab) {
    const c = counts.get(phrase) ?? 0;
    if (c > bestCount || (c === bestCount && c > 0 && phrase.length > best.length)) {
      best = phrase;
      bestCount = c;
    }
  }
  return { phrase: best, count: bestCount };
}

function startsWithPhrase(body: string, phrase: string): boolean {
  const head = body.trimStart().toLowerCase();
  const p = phrase.toLowerCase();
  if (!head.startsWith(p)) return false;
  const next = head.charAt(p.length);
  // A real greeting is followed by punctuation/space/end — never more letters
  // ("Hi" must not match "History").
  return next === '' || !/[a-zñ]/.test(next);
}

function endsWithPhrase(body: string, phrase: string): boolean {
  const tail = stripTrailingDecoration(body).toLowerCase();
  const p = phrase.toLowerCase();
  if (!tail.endsWith(p)) return false;
  const prev = tail.charAt(tail.length - p.length - 1);
  return prev === '' || !/[a-zñ]/.test(prev);
}

export type VoiceDerivation = {
  profile: VoiceProfile;
  /** How many of the vendor's own replies the derivation actually read. */
  sampleCount: number;
  /** `sampleCount >= VOICE_MIN_SAMPLE` — below it, present as a rough guess. */
  confident: boolean;
};

/**
 * Derive a voice profile by counting. PURE.
 *
 * An empty corpus returns the HOUSE voice with `confident:false`, which renders
 * exactly like Basic — the safe direction when we know nothing about a vendor.
 */
export function deriveVoiceProfile(bodies: readonly string[]): VoiceDerivation {
  const clean = bodies
    .map((b) => (typeof b === 'string' ? b.trim() : ''))
    .filter((b) => b.length > 0)
    .slice(0, VOICE_SAMPLE_LIMIT);

  if (clean.length === 0) {
    return { profile: { ...HOUSE_VOICE }, sampleCount: 0, confident: false };
  }

  const n = clean.length;

  // ── honorifics: does this vendor say "po"? ────────────────────────────────
  const honorificHits = clean.filter((b) => HONORIFIC_RE.test(b)).length;
  const honorifics = honorificHits / n >= 0.15;

  // ── emoji level: emoji per message ────────────────────────────────────────
  const emojiTotal = clean.reduce((acc, b) => acc + (b.match(EMOJI_RE)?.length ?? 0), 0);
  const emojiPerMsg = emojiTotal / n;
  const emojiLevel: VoiceEmojiLevel =
    emojiPerMsg === 0 ? 'none' : emojiPerMsg < 0.6 ? 'light' : 'rich';

  // ── language mix: marker density over all words ───────────────────────────
  let totalWords = 0;
  let tagalogHits = 0;
  let cebuanoHits = 0;
  for (const b of clean) {
    for (const w of words(b)) {
      totalWords += 1;
      if (CEBUANO_MARKERS.includes(w)) cebuanoHits += 1;
      else if (TAGALOG_MARKERS.includes(w)) tagalogHits += 1;
    }
  }
  const tagalogRatio = totalWords ? tagalogHits / totalWords : 0;
  const cebuanoRatio = totalWords ? cebuanoHits / totalWords : 0;
  let languageMix: VoiceLanguageMix;
  if (cebuanoRatio >= 0.03 && cebuanoRatio > tagalogRatio) languageMix = 'cebuano';
  else if (tagalogRatio >= 0.12) languageMix = 'taglish_heavy';
  else if (tagalogRatio >= 0.03) languageMix = 'taglish_light';
  else languageMix = 'english';

  // ── warmth: how much they write, and how brightly ─────────────────────────
  const avgLen = clean.reduce((acc, b) => acc + b.length, 0) / n;
  const bangRate = clean.filter((b) => b.includes('!')).length / n;
  let warmth: VoiceWarmth;
  if (avgLen < 90 && bangRate < 0.3) warmth = 'concise';
  else if (avgLen > 260 || (bangRate >= 0.6 && emojiLevel === 'rich')) warmth = 'effusive';
  else warmth = 'friendly';

  // ── opener / closer: WHICH known phrase, never a copied sentence ──────────
  const greeting = mostCommon(clean, GREETINGS, startsWithPhrase);
  const signoff = mostCommon(clean, SIGNOFFS, endsWithPhrase);
  // Require the habit to be real (used in ≥25% of replies) before adopting it —
  // one stray "Hey" is not a vendor's voice.
  const habitFloor = Math.max(1, Math.ceil(n * 0.25));

  return {
    profile: {
      greeting: greeting.count >= habitFloor ? greeting.phrase : '',
      signoff: signoff.count >= habitFloor ? signoff.phrase : '',
      languageMix,
      honorifics,
      emojiLevel,
      warmth,
    },
    sampleCount: n,
    confident: n >= VOICE_MIN_SAMPLE,
  };
}
