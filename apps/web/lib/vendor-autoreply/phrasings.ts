// lib/vendor-autoreply/phrasings.ts
//
// PRECOMPUTE — the Advanced voice-match phrasing library (build plan § 7).
//
// PURE: no I/O, no clock, no env, NO MODEL CALL. `precompute.ts` is the thin
// server module that writes what this file builds into `vendor_reply_templates`.
//
// ── THE ENVELOPE MODEL (why per-reply cost is structurally ₱0) ──────────────
// A phrasing is an ENVELOPE, not an answer: `"<greeting> <lead-in> {{answer}}
// <signoff>"`. The `{{answer}}` slot is filled at reply time by the existing
// deterministic `buildAnswer()` output — every number in it comes from a live
// vendor row. So:
//   • the vendor's VOICE is precomputed once per voice edit;
//   • the FACTS are resolved live per reply;
//   • the reply path does string substitution only → ₱0 marginal cost, forever.
// A model call per reply is FORBIDDEN (owner-locked "Setnayan AI is
// deterministic and free"), and this shape makes it unnecessary rather than
// merely discouraged.
//
// ── WHY A CATALOG EDIT DOES NOT INVALIDATE THE LIBRARY ──────────────────────
// § 7 describes phrasings per (intent × service/package). Because the envelope
// carries NO facts, it stays correct across catalog edits — the answer it wraps
// is rebuilt from the new rows on the very next reply. Rows are therefore stored
// per-INTENT (`service_id`/`package_id` NULL, which the schema allows), and only
// a VOICE edit triggers regeneration. This is a deliberate simplification of the
// spec; it removes a whole class of staleness bug (a precomputed phrasing
// quoting last month's price) by construction. Flagged for owner sign-off.
//
// ── THE NO-FACTS INVARIANT ──────────────────────────────────────────────────
// `assertFactFree()` drops any envelope containing a digit, ₱, '@' or a URL,
// AND any envelope that trips the off-platform-contact filter. It re-asserts
// what `sanitizeVoiceFragment` already enforces on stored fragments, so even a
// hand-edited `voice_profile` / `vendor_reply_templates` row cannot make the bot
// state a fact it did not read from the catalog, or route a couple off-platform.
// This is the check on the SERVE path (`coercePhrasings` + `renderPhrasing`), so
// it is the one that actually decides what a couple receives.

import { evaluateMessage } from '../chat-contact-filter';
import {
  isHouseVoice,
  type VoiceLanguageMix,
  type VoiceProfile,
} from '../vendor-voice-profile';
import type { Intent } from './types';

/** The one slot an envelope may carry. */
export const ANSWER_SLOT = '{{answer}}';

/** § 7 caps the library at ~20 phrasings per row; we build well under it. */
export const MAX_PHRASINGS_PER_INTENT = 20;

/** Intents the deterministic engine can actually ANSWER — the handoff intents
 *  (`customization` / `booking` / `unknown`) never produce text, so they never
 *  need a voice. Keeping the two lists aligned is what stops the library from
 *  implying the bot answers something it hands off. */
export const VOICED_INTENTS: readonly Intent[] = [
  'price',
  'availability',
  'inclusions',
  'capability',
  'coverage',
  'lead_time',
  'discount',
  'social_proof',
];

/** Facts belong in the answer, never in the envelope. */
const FACTUAL = /[0-9₱@]|https?:\/\/|www\./i;

/**
 * Drop any envelope that smuggles a fact / contact route. PURE.
 *
 * Also requires EXACTLY ONE `{{answer}}` slot: zero would post pure decoration
 * with no facts at all, and two would leave a literal `{{answer}}` in the
 * message (or repeat the answer) — both are broken replies, not styling.
 *
 * ⚠ Only the ENVELOPE is screened, never the answer: the deterministic answer
 * legitimately carries ₱ and digits from live catalog rows, and running the
 * contact filter over it would block the bot's own correct quote.
 */
export function assertFactFree(envelope: string): boolean {
  if (envelope.split(ANSWER_SLOT).length !== 2) return false;
  const withoutSlot = envelope.split(ANSWER_SLOT).join(' ');
  if (FACTUAL.test(withoutSlot)) return false;
  // The off-platform-contact lock — "Add us on Viber" carries no digit, no ₱,
  // no '@' and no URL, so FACTUAL alone waves it through. Same engine the
  // chatroom runs on a human vendor's own message.
  return !evaluateMessage(withoutSlot).blocked;
}

/**
 * Neutral, fact-free lead-ins per intent, PER LANGUAGE MIX. Never a claim —
 * only a signpost.
 *
 * `language_mix` is the one § 6 field that would otherwise be inert: greeting,
 * sign-off, honorifics, emoji and warmth all visibly shape the envelope, but a
 * vendor who picks "Cebuano" must not get an English-only reply that reads
 * exactly like the `english` setting. These tables are what make the selector
 * honest — the preview in My Shop renders through this very function, so the
 * vendor sees the language they chose before they save.
 *
 * ⚠ NO `po` IN ANY LEAD-IN. Honorifics are applied ONLY to the greeting and
 * sign-off (`honorify()`); baking `po` in here would contradict a vendor who
 * turned honorifics OFF, and would double up on one who turned them on.
 */
type LeadInTable = Record<string, readonly string[]>;

/** English is also the FALLBACK table, so it is named rather than inlined. */
const ENGLISH_LEAD_INS: LeadInTable = {
  price: ['Here are our rates —', 'On pricing —'],
  availability: ['On availability —', 'About your date —'],
  inclusions: ['Here’s what’s included —', 'On inclusions —'],
  capability: ['On what we do —'],
  coverage: ['On what we cover —'],
  lead_time: ['On timing —'],
  discount: ['On current offers —'],
  social_proof: ['A little about our work —'],
};

const LEAD_INS_BY_LANGUAGE: Record<VoiceLanguageMix, LeadInTable> = {
  english: ENGLISH_LEAD_INS,
  taglish_light: {
    price: ['Sa rates namin —', 'Here are our rates —'],
    availability: ['Sa availability —', 'About your date —'],
    inclusions: ['Ito ang kasama —', 'On inclusions —'],
    capability: ['Sa ginagawa namin —'],
    coverage: ['Sa saklaw namin —'],
    lead_time: ['Sa timing —'],
    discount: ['Sa mga promo namin —'],
    social_proof: ['Tungkol sa trabaho namin —'],
  },
  taglish_heavy: {
    price: ['Ito ang aming mga rate —', 'Tungkol sa presyo —'],
    availability: ['Tungkol sa petsa ninyo —', 'Sa availability —'],
    inclusions: ['Ito ang mga kasama —'],
    capability: ['Tungkol sa aming serbisyo —'],
    coverage: ['Tungkol sa aming saklaw —'],
    lead_time: ['Tungkol sa timing —'],
    discount: ['Tungkol sa aming mga alok —'],
    social_proof: ['Tungkol sa aming mga gawa —'],
  },
  cebuano: {
    price: ['Ania ang among mga rate —', 'Bahin sa presyo —'],
    availability: ['Bahin sa inyong petsa —'],
    inclusions: ['Ania ang mga apil —'],
    capability: ['Bahin sa among serbisyo —'],
    coverage: ['Bahin sa among sakop —'],
    lead_time: ['Bahin sa timing —'],
    discount: ['Bahin sa among mga alok —'],
    social_proof: ['Bahin sa among mga trabaho —'],
  },
};

/** Emoji the envelope may carry, by level. Decoration only. */
const EMOJI_BY_LEVEL: Record<string, readonly string[]> = {
  none: [''],
  light: ['', '💛'],
  rich: ['💛', '✨', '🙌'],
};

/** Extra warm closers for the `effusive` warmth, per language. Fact-free by
 *  construction, and `po`-free for the same reason as the lead-ins. */
const ENGLISH_EFFUSIVE_CLOSERS: readonly string[] = [
  'Excited to hear from you!',
  'We’d love to be part of your day!',
];

const EFFUSIVE_CLOSERS_BY_LANGUAGE: Record<VoiceLanguageMix, readonly string[]> = {
  english: ENGLISH_EFFUSIVE_CLOSERS,
  taglish_light: ['Excited kami to hear from you!', 'We’d love to be part of your day!'],
  taglish_heavy: ['Excited kaming makasama kayo!', 'Sana mapabilang kami sa inyong araw!'],
  cebuano: ['Excited kaayo mi nga makadungog ninyo!', 'Gusto kaayo mi nga makauban kamo!'],
};

function honorify(fragment: string, honorifics: boolean): string {
  if (!fragment || !honorifics) return fragment;
  return /\bpo\b/i.test(fragment) ? fragment : `${fragment} po`;
}

function punctuateGreeting(greeting: string, warmth: string): string {
  if (!greeting) return '';
  if (/[!.?]$/.test(greeting)) return greeting;
  return warmth === 'concise' ? `${greeting}.` : `${greeting}!`;
}

function punctuateSignoff(signoff: string, warmth: string): string {
  if (!signoff) return '';
  if (/[!.?]$/.test(signoff)) return signoff;
  return warmth === 'effusive' ? `${signoff}!` : `${signoff}.`;
}

function joinParts(parts: readonly string[]): string {
  return parts
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build the envelope library for ONE intent. PURE + DETERMINISTIC — the same
 * profile always yields the same list in the same order, which is what makes
 * the rotation at reply time reproducible and the library diffable.
 *
 * The bare `{{answer}}` envelope is ALWAYS first: it is the house voice, so an
 * empty/decoration-free profile produces a library whose every member renders
 * byte-identically to today's neutral reply.
 */
export function buildPhrasingsForIntent(profile: VoiceProfile, intent: Intent | string): string[] {
  const out: string[] = [ANSWER_SLOT];
  if (isHouseVoice(profile)) return out;

  const greeting = punctuateGreeting(honorify(profile.greeting, profile.honorifics), profile.warmth);
  const signoff = punctuateSignoff(honorify(profile.signoff, profile.honorifics), profile.warmth);
  // The `??` fallbacks are runtime belt-and-braces, not type narrowing: the
  // tables are keyed by the full VoiceLanguageMix union, but a hand-edited DB
  // row could still carry a value outside it, and an unknown language must fall
  // back to English rather than silently dropping the vendor's voice.
  const leadInTable = LEAD_INS_BY_LANGUAGE[profile.languageMix] ?? ENGLISH_LEAD_INS;
  const leadIns = profile.warmth === 'concise' ? [''] : ['', ...(leadInTable[intent] ?? [])];
  const emojis = EMOJI_BY_LEVEL[profile.emojiLevel] ?? [''];
  const closers =
    profile.warmth === 'effusive'
      ? [
          '',
          ...(EFFUSIVE_CLOSERS_BY_LANGUAGE[profile.languageMix] ?? ENGLISH_EFFUSIVE_CLOSERS),
        ]
      : [''];

  for (const leadIn of leadIns) {
    for (const closer of closers) {
      for (const emoji of emojis) {
        const envelope = joinParts([greeting, leadIn, ANSWER_SLOT, closer, signoff, emoji]);
        if (envelope === ANSWER_SLOT) continue; // already first
        if (!assertFactFree(envelope)) continue;
        if (!out.includes(envelope)) out.push(envelope);
        if (out.length >= MAX_PHRASINGS_PER_INTENT) return out;
      }
    }
  }
  return out;
}

export type PhrasingRow = { intent: Intent; phrasings: string[] };

/** The whole library — one row per answerable intent. PURE. */
export function buildPhrasingLibrary(profile: VoiceProfile): PhrasingRow[] {
  return VOICED_INTENTS.map((intent) => ({
    intent,
    phrasings: buildPhrasingsForIntent(profile, intent),
  }));
}

/**
 * Deterministic rotation index (FNV-1a over the key). PURE.
 *
 * "Rotate to avoid repetition" (§ 7) without storing a cursor: the same thread +
 * reply-count always maps to the same phrasing, so a retry can't produce two
 * differently-worded bot messages for one couple message.
 */
export function pickPhrasingIndex(count: number, rotationKey: string): number {
  if (count <= 0) return -1;
  let h = 0x811c9dc5;
  for (let i = 0; i < rotationKey.length; i += 1) {
    h ^= rotationKey.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % count;
}

/**
 * Fill an envelope with the deterministic answer. PURE.
 *
 * Returns null when the envelope is unusable, so the caller falls back to the
 * neutral answer rather than posting a mangled or fact-carrying reply.
 */
export function renderPhrasing(envelope: string, answer: string): string | null {
  if (!assertFactFree(envelope)) return null;
  const body = answer.trim();
  if (!body) return null;
  // Normalize only the ENVELOPE halves — never the answer, whose internal
  // spacing is the deterministic builder's business, not the voice layer's.
  const idx = envelope.indexOf(ANSWER_SLOT);
  const pre = envelope.slice(0, idx).replace(/\s+/g, ' ').trim();
  const post = envelope.slice(idx + ANSWER_SLOT.length).replace(/\s+/g, ' ').trim();
  const text = [pre, body, post].filter((p) => p.length > 0).join(' ');
  return text.length > 0 ? text : null;
}

/** Coerce a stored `phrasings` jsonb value to usable envelopes. PURE, TOTAL. */
export function coercePhrasings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => v.length > 0 && assertFactFree(v));
}
