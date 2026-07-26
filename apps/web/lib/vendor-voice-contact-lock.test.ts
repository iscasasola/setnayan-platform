import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOUSE_VOICE,
  VOICE_EMOJI_LEVELS,
  VOICE_LANGUAGE_MIXES,
  VOICE_WARMTHS,
  coerceVoiceProfile,
  parseVoiceProfileForm,
  sanitizeVoiceFragment,
  type VoiceProfile,
} from './vendor-voice-profile';
import {
  VOICED_INTENTS,
  assertFactFree,
  buildPhrasingsForIntent,
  coercePhrasings,
  renderPhrasing,
} from './vendor-autoreply/phrasings';

/**
 * THE OFF-PLATFORM-CONTACT LOCK for Advanced voice-match.
 *
 * The defect these pin: a voice fragment is DECORATION the vendor types once and
 * the bot then ships on EVERY auto-reply, inserted by the service-role client —
 * which never passes through the chatroom send gate. "Add us on Viber" carries
 * no digit, no ₱, no '@' and no URL, so the character screen waved it through
 * while `chat-contact-filter.ts` blocks a HUMAN vendor typing the same words.
 * That made voice-match a laundering route around the filter, in an AI-AUTHORED
 * message.
 *
 * Two independent gates are pinned here:
 *   • `sanitizeVoiceFragment` — the AUTHORING gate (My Shop save + stored-row
 *     coercion);
 *   • `assertFactFree` — the SERVE gate (`coercePhrasings` + `renderPhrasing`),
 *     the one that decides what a couple actually receives, so a hand-edited
 *     `vendor_reply_templates` row is caught too.
 *
 * And the other half of the bargain: NONE of the legitimate closed-vocabulary
 * greetings/sign-offs, and none of the envelopes the library actually builds,
 * may be blocked by it.
 */

/** Every attack string that laundered past the old character-only screen. */
const OFF_PLATFORM_FRAGMENTS = [
  'Add us on Viber',
  'Message us on Messenger',
  'Text us on WhatsApp',
  'Find us on Facebook',
  'Hi! Follow us on Instagram',
  'Chat with us on Telegram',
  'Reach me on the blue app',
  'Hello po, message me on Viber',
];

/** The closed greeting + sign-off vocabularies `vendor-voice-derive.ts` may
 *  produce, plus the hand-typed shapes the panel invites. All must survive. */
const LEGITIMATE_FRAGMENTS = [
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
  'Maraming salamat po',
  'Maraming salamat',
  'Daghang salamat',
  'Salamat po',
  'Salamat',
  'Thank you po',
  'Thank you so much',
  'Thank you',
  'Thanks',
  'Warm regards',
  'Talk soon',
  'See you po',
];

// ── 1. the AUTHORING gate ───────────────────────────────────────────────────

test('sanitizeVoiceFragment REFUSES every off-platform-contact fragment', () => {
  for (const raw of OFF_PLATFORM_FRAGMENTS) {
    const res = sanitizeVoiceFragment(raw, 'Greeting');
    assert.equal(res.ok, false, `should be refused: ${raw}`);
  }
});

test('the refusal names the real reason, not "numbers and links"', () => {
  const res = sanitizeVoiceFragment('Add us on Viber', 'Greeting');
  assert.equal(res.ok, false);
  if (!res.ok) assert.match(res.error, /another app|outside contact/i);
});

test('sanitizeVoiceFragment BREAKS NO legitimate greeting or sign-off', () => {
  for (const raw of LEGITIMATE_FRAGMENTS) {
    const res = sanitizeVoiceFragment(raw, 'Greeting');
    assert.equal(res.ok, true, `should be allowed: ${raw}`);
    if (res.ok) assert.equal(res.value, raw);
  }
});

test('the My Shop form save refuses an off-platform greeting AND sign-off', () => {
  for (const key of ['greeting', 'signoff']) {
    const form = new Map<string, string>([[key, 'Message us on Messenger']]);
    const res = parseVoiceProfileForm({ get: (k) => form.get(k) ?? null });
    assert.equal(res.ok, false, key);
  }
});

test('a stored row carrying an off-platform fragment coerces to NO decoration', () => {
  const p = coerceVoiceProfile({
    greeting: 'Add us on Viber',
    signoff: 'Text us on WhatsApp',
    language_mix: 'taglish_light',
  });
  assert.equal(p.greeting, '');
  assert.equal(p.signoff, '');
});

// ── 2. the SERVE gate — what a couple actually receives ─────────────────────

test('assertFactFree REFUSES an envelope carrying an off-platform contact', () => {
  for (const raw of OFF_PLATFORM_FRAGMENTS) {
    assert.equal(assertFactFree(`${raw}! {{answer}}`), false, raw);
    assert.equal(assertFactFree(`{{answer}} ${raw}.`), false, raw);
  }
});

test('a hand-edited vendor_reply_templates row is DROPPED at serve time', () => {
  const stored = ['{{answer}}', 'Hi po! {{answer}} Add us on Viber.'];
  const usable = coercePhrasings(stored);
  assert.deepEqual(usable, ['{{answer}}']);
});

test('renderPhrasing refuses to render an off-platform envelope', () => {
  assert.equal(renderPhrasing('Hi! {{answer}} Message us on Messenger.', 'Rates: ₱48,000.'), null);
});

test('the ANSWER is never screened — a real ₱ quote still renders', () => {
  const answer = 'Our starting rates — Full-Day Coverage from ₱48,000; Half-Day from ₱28,000.';
  const out = renderPhrasing('Hi po! {{answer}} Salamat po.', answer);
  assert.ok(out && out.includes(answer), 'the deterministic answer is never rewritten');
});

// ── 3. the lock breaks nothing the library actually builds ──────────────────

test('EVERY envelope the library builds, for every profile, survives the lock', () => {
  let built = 0;
  for (const languageMix of VOICE_LANGUAGE_MIXES) {
    for (const emojiLevel of VOICE_EMOJI_LEVELS) {
      for (const warmth of VOICE_WARMTHS) {
        for (const honorifics of [true, false]) {
          for (const greeting of ['', 'Kumusta', 'Magandang araw', 'Hello']) {
            for (const signoff of ['', 'Salamat', 'Maraming salamat', 'Thank you']) {
              const profile: VoiceProfile = {
                ...HOUSE_VOICE,
                greeting,
                signoff,
                languageMix,
                emojiLevel,
                warmth,
                honorifics,
              };
              for (const intent of VOICED_INTENTS) {
                for (const envelope of buildPhrasingsForIntent(profile, intent)) {
                  built += 1;
                  assert.equal(assertFactFree(envelope), true, `${languageMix}/${intent}: ${envelope}`);
                }
              }
            }
          }
        }
      }
    }
  }
  assert.ok(built > 500, `expected a wide sweep, built ${built}`);
});
