// lib/vendor-voice-profile.ts
//
// The voice-profile SCHEMA for Vendor AI ADVANCED voice-match — build plan
// `Vendor_Front_Desk_Chatbot_Build_Plan_2026-07-18.md` § 6. Stored as the jsonb
// `vendor_bot_config.voice_profile` (migration 20270822679405) in the snake_case
// shape the spec pins; this module is the ONLY place that shape is read/written.
//
// PURE — no I/O, no clock, no env. The flag lives in `vendor-voice-match-flag.ts`.
//
// ── THE SAFETY INVARIANT (load-bearing) ─────────────────────────────────────
// A voice fragment (greeting / signoff) is DECORATION, never data. It is
// concatenated around a deterministic answer whose every number comes from a
// live vendor row, so the "structurally cannot misquote" guarantee (§ 2/§ 3)
// survives voice-match ONLY IF no fragment can smuggle a fact in. Hence
// `sanitizeVoiceFragment` rejects digits, ₱, '@', and URLs outright:
//   • a digit in a greeting could read as a price / date / phone number;
//   • '@' or a URL could move the conversation off-platform (and past the
//     off-platform-contact filter) inside an AI-authored message.
// The rule is re-asserted independently at phrasing-build time
// (`vendor-autoreply/phrasings.ts`), so a bypass here still cannot ship text.
//
// ── THE OFF-PLATFORM-CONTACT LOCK (2026-07-26) ──────────────────────────────
// The character screen above is NOT sufficient. "Add us on Viber", "Message us
// on Messenger", "Text us on WhatsApp" carry no digit, no ₱, no '@' and no URL,
// yet they are exactly the disintermediation the chat filter exists to stop.
// A HUMAN vendor typing those into chat is BLOCKED by `chat-contact-filter.ts`
// (PR #3606) — but the auto-reply bot inserts via the service-role client and
// never passes through that gate, so a voice fragment would be a laundering
// route: set once, shipped on every auto-reply to every couple, in an
// AI-AUTHORED message. So every vendor-typed fragment is run through the SAME
// `evaluateMessage()` engine, unconditionally — deliberately NOT behind
// `chatContactFilterEnabled()`, because a bot-authored contact route is our own
// output, not a vendor's message, and must never depend on another feature's
// launch flag. Re-asserted on the built envelope in `phrasings.ts` so a
// hand-edited `voice_profile` / `vendor_reply_templates` row cannot ship either.

import { evaluateMessage } from './chat-contact-filter';

export const VOICE_LANGUAGE_MIXES = [
  'english',
  'taglish_light',
  'taglish_heavy',
  'cebuano',
] as const;
export type VoiceLanguageMix = (typeof VOICE_LANGUAGE_MIXES)[number];

export const VOICE_EMOJI_LEVELS = ['none', 'light', 'rich'] as const;
export type VoiceEmojiLevel = (typeof VOICE_EMOJI_LEVELS)[number];

export const VOICE_WARMTHS = ['concise', 'friendly', 'effusive'] as const;
export type VoiceWarmth = (typeof VOICE_WARMTHS)[number];

export type VoiceProfile = {
  greeting: string;
  signoff: string;
  languageMix: VoiceLanguageMix;
  honorifics: boolean;
  emojiLevel: VoiceEmojiLevel;
  warmth: VoiceWarmth;
};

/**
 * The neutral HOUSE voice — what Basic renders through, and the fallback for
 * every unreadable / absent / half-filled profile. Empty greeting + signoff mean
 * the envelope collapses to the bare deterministic answer, i.e. today's text.
 */
export const HOUSE_VOICE: VoiceProfile = {
  greeting: '',
  signoff: '',
  languageMix: 'english',
  honorifics: false,
  emojiLevel: 'none',
  warmth: 'concise',
};

/** Longest a greeting/signoff may be. Anything longer is a sentence, not a
 *  fragment — and a sentence is where a stray fact would hide. */
export const VOICE_FRAGMENT_MAX = 40;

/** Everything a voice fragment may NOT contain (see the safety invariant). */
const FORBIDDEN_FRAGMENT = /[0-9₱@]|https?:\/\/|www\./i;

export type VoiceFragmentResult = { ok: true; value: string } | { ok: false; error: string };

/**
 * Validate + normalize one vendor-typed voice fragment. PURE.
 *
 * Empty is VALID and means "don't decorate" — a vendor clearing their greeting
 * must land back on the house voice, not on a validation wall.
 */
export function sanitizeVoiceFragment(raw: unknown, label: string): VoiceFragmentResult {
  if (raw == null) return { ok: true, value: '' };
  const s = String(raw).replace(/\s+/g, ' ').trim();
  if (s === '') return { ok: true, value: '' };
  if (s.length > VOICE_FRAGMENT_MAX) {
    return { ok: false, error: `${label} must be ${VOICE_FRAGMENT_MAX} characters or fewer.` };
  }
  if (FORBIDDEN_FRAGMENT.test(s)) {
    return {
      ok: false,
      error: `${label} can't contain numbers, ₱, an email address or a link — those belong in your catalog, not your greeting.`,
    };
  }
  // The off-platform-contact lock. Same engine the chatroom uses on a human
  // vendor's own message, so the bot cannot say what its author may not.
  if (evaluateMessage(s).blocked) {
    return {
      ok: false,
      error: `${label} can't point couples to another app or an outside contact — keep the conversation here on Setnayan.`,
    };
  }
  return { ok: true, value: s };
}

function oneOf<T extends string>(raw: unknown, allowed: readonly T[], fallback: T): T {
  const s = typeof raw === 'string' ? raw : '';
  return (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}

/**
 * Coerce the stored jsonb into a usable profile. PURE, TOTAL — never throws.
 *
 * Every unknown/invalid field degrades to its HOUSE_VOICE value independently,
 * so a partially-written or future-shaped row still yields a safe profile rather
 * than blanking the feature. A fragment that fails sanitation is DROPPED (not
 * an error): serving must never be blocked by a bad stored decoration.
 */
export function coerceVoiceProfile(raw: unknown): VoiceProfile {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...HOUSE_VOICE };
  const o = raw as Record<string, unknown>;
  const greeting = sanitizeVoiceFragment(o.greeting, 'Greeting');
  const signoff = sanitizeVoiceFragment(o.signoff, 'Sign-off');
  return {
    greeting: greeting.ok ? greeting.value : '',
    signoff: signoff.ok ? signoff.value : '',
    languageMix: oneOf(o.language_mix, VOICE_LANGUAGE_MIXES, HOUSE_VOICE.languageMix),
    honorifics: o.honorifics === true,
    emojiLevel: oneOf(o.emoji_level, VOICE_EMOJI_LEVELS, HOUSE_VOICE.emojiLevel),
    warmth: oneOf(o.warmth, VOICE_WARMTHS, HOUSE_VOICE.warmth),
  };
}

/** Serialize back to the § 6 snake_case jsonb shape. PURE. */
export function toVoiceProfileJson(p: VoiceProfile): Record<string, unknown> {
  return {
    greeting: p.greeting,
    signoff: p.signoff,
    language_mix: p.languageMix,
    honorifics: p.honorifics,
    emoji_level: p.emojiLevel,
    warmth: p.warmth,
  };
}

/** True when the profile carries no decoration at all → renders as today. PURE. */
export function isHouseVoice(p: VoiceProfile): boolean {
  return (
    p.greeting === '' &&
    p.signoff === '' &&
    p.emojiLevel === 'none' &&
    p.warmth === 'concise' &&
    p.honorifics === false
  );
}

export type VoiceProfileParse =
  | { ok: true; profile: VoiceProfile }
  | { ok: false; error: string };

/**
 * Parse the My Shop voice form into a full profile. PURE.
 *
 * Absent fields fall back to `current` (the vendor's stored profile) so a
 * partial form can't silently reset a field the vendor already approved.
 */
export function parseVoiceProfileForm(
  form: {
    get(key: string): FormDataEntryValue | null;
  },
  current: VoiceProfile = HOUSE_VOICE,
): VoiceProfileParse {
  const greetingRaw = form.get('greeting');
  const greeting =
    greetingRaw === null ? { ok: true as const, value: current.greeting } : sanitizeVoiceFragment(greetingRaw, 'Greeting');
  if (!greeting.ok) return { ok: false, error: greeting.error };

  const signoffRaw = form.get('signoff');
  const signoff =
    signoffRaw === null ? { ok: true as const, value: current.signoff } : sanitizeVoiceFragment(signoffRaw, 'Sign-off');
  if (!signoff.ok) return { ok: false, error: signoff.error };

  const honorificsRaw = form.get('honorifics');
  let honorifics = current.honorifics;
  if (honorificsRaw !== null) {
    const v = String(honorificsRaw).trim().toLowerCase();
    if (v !== 'true' && v !== 'false') {
      return { ok: false, error: 'Could not read the “po / opo” switch — try again.' };
    }
    honorifics = v === 'true';
  }

  const pick = <T extends string>(key: string, allowed: readonly T[], fallback: T, label: string):
    | { ok: true; value: T }
    | { ok: false; error: string } => {
    const raw = form.get(key);
    if (raw === null) return { ok: true, value: fallback };
    const s = String(raw).trim();
    if (!(allowed as readonly string[]).includes(s)) {
      return { ok: false, error: `Pick a valid ${label}.` };
    }
    return { ok: true, value: s as T };
  };

  const lang = pick('language_mix', VOICE_LANGUAGE_MIXES, current.languageMix, 'language');
  if (!lang.ok) return { ok: false, error: lang.error };
  const emoji = pick('emoji_level', VOICE_EMOJI_LEVELS, current.emojiLevel, 'emoji level');
  if (!emoji.ok) return { ok: false, error: emoji.error };
  const warmth = pick('warmth', VOICE_WARMTHS, current.warmth, 'tone');
  if (!warmth.ok) return { ok: false, error: warmth.error };

  return {
    ok: true,
    profile: {
      greeting: greeting.value,
      signoff: signoff.value,
      languageMix: lang.value,
      honorifics,
      emojiLevel: emoji.value,
      warmth: warmth.value,
    },
  };
}
