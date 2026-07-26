import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOUSE_VOICE,
  VOICE_EMOJI_LEVELS,
  VOICE_FRAGMENT_MAX,
  VOICE_LANGUAGE_MIXES,
  VOICE_WARMTHS,
  coerceVoiceProfile,
  isHouseVoice,
  parseVoiceProfileForm,
  sanitizeVoiceFragment,
  toVoiceProfileJson,
  type VoiceProfile,
} from './vendor-voice-profile';

/**
 * The voice profile is DECORATION around a deterministic answer. These tests pin
 * the one property that keeps the "structurally cannot misquote" guarantee true
 * once voice-match ships: no voice fragment may ever carry a fact or a contact
 * route.
 */

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

// ── the safety invariant: fragments carry no facts ──────────────────────────

const FORBIDDEN_FRAGMENTS = [
  'Hi, we start at 48000',          // a price
  'Book by 12/25',                  // a date
  'Call 09171234567',               // a phone number
  'Email me at hi@studio.ph',       // an off-platform route
  'See https://studio.ph',          // a link
  'Visit www.studio.ph',            // a bare-domain link
  '₱ deals inside',                 // the peso sign
];

for (const bad of FORBIDDEN_FRAGMENTS) {
  test(`fragment rejected — carries a fact or contact route: ${bad}`, () => {
    const res = sanitizeVoiceFragment(bad, 'Greeting');
    assert.equal(res.ok, false);
  });
}

test('fragment rejected when longer than the cap', () => {
  const res = sanitizeVoiceFragment('a'.repeat(VOICE_FRAGMENT_MAX + 1), 'Greeting');
  assert.equal(res.ok, false);
});

test('fragment accepted at exactly the cap, whitespace normalized', () => {
  const res = sanitizeVoiceFragment('  Hi   po  ', 'Greeting');
  assert.deepEqual(res, { ok: true, value: 'Hi po' });
  assert.equal(sanitizeVoiceFragment('a'.repeat(VOICE_FRAGMENT_MAX), 'Greeting').ok, true);
});

test('empty / null fragment is VALID and means "no decoration"', () => {
  assert.deepEqual(sanitizeVoiceFragment('', 'Greeting'), { ok: true, value: '' });
  assert.deepEqual(sanitizeVoiceFragment(null, 'Greeting'), { ok: true, value: '' });
  assert.deepEqual(sanitizeVoiceFragment('   ', 'Greeting'), { ok: true, value: '' });
});

// ── coercion is total: every junk shape lands on the house voice ────────────

const JUNK: unknown[] = [null, undefined, 0, '', 'smart', [], [1, 2], true];

for (const raw of JUNK) {
  test(`coerceVoiceProfile(${JSON.stringify(raw) ?? 'undefined'}) → house voice`, () => {
    assert.deepEqual(coerceVoiceProfile(raw), HOUSE_VOICE);
  });
}

test('coercion drops a stored fragment that would carry a fact', () => {
  const p = coerceVoiceProfile({ greeting: 'Rates from 48000', signoff: 'Salamat po' });
  assert.equal(p.greeting, '');
  assert.equal(p.signoff, 'Salamat po');
});

test('coercion falls back per-field on unknown enum values', () => {
  const p = coerceVoiceProfile({
    language_mix: 'klingon',
    emoji_level: 'extreme',
    warmth: 'icy',
    honorifics: 'yes',
  });
  assert.equal(p.languageMix, HOUSE_VOICE.languageMix);
  assert.equal(p.emojiLevel, HOUSE_VOICE.emojiLevel);
  assert.equal(p.warmth, HOUSE_VOICE.warmth);
  assert.equal(p.honorifics, false); // only a real boolean true enables it
});

test('every valid enum value round-trips through json + coercion', () => {
  for (const languageMix of VOICE_LANGUAGE_MIXES) {
    for (const emojiLevel of VOICE_EMOJI_LEVELS) {
      for (const warmth of VOICE_WARMTHS) {
        for (const honorifics of [true, false]) {
          const p: VoiceProfile = {
            greeting: 'Hi po',
            signoff: 'Salamat po',
            languageMix,
            emojiLevel,
            warmth,
            honorifics,
          };
          assert.deepEqual(coerceVoiceProfile(toVoiceProfileJson(p)), p);
        }
      }
    }
  }
});

test('isHouseVoice is true only for the undecorated profile', () => {
  assert.equal(isHouseVoice(HOUSE_VOICE), true);
  assert.equal(isHouseVoice({ ...HOUSE_VOICE, greeting: 'Hi' }), false);
  assert.equal(isHouseVoice({ ...HOUSE_VOICE, signoff: 'Salamat' }), false);
  assert.equal(isHouseVoice({ ...HOUSE_VOICE, emojiLevel: 'light' }), false);
  assert.equal(isHouseVoice({ ...HOUSE_VOICE, warmth: 'friendly' }), false);
  assert.equal(isHouseVoice({ ...HOUSE_VOICE, honorifics: true }), false);
  // languageMix alone is not decoration — it never changes the envelope.
  assert.equal(isHouseVoice({ ...HOUSE_VOICE, languageMix: 'cebuano' }), true);
});

// ── form parsing: absent fields never reset an approved field ───────────────

test('absent fields fall back to the current profile', () => {
  const current: VoiceProfile = {
    greeting: 'Kumusta po',
    signoff: 'Salamat po',
    languageMix: 'taglish_heavy',
    honorifics: true,
    emojiLevel: 'light',
    warmth: 'friendly',
  };
  const res = parseVoiceProfileForm(form({}), current);
  assert.equal(res.ok, true);
  if (res.ok) assert.deepEqual(res.profile, current);
});

test('a fact-carrying greeting fails the whole parse', () => {
  const res = parseVoiceProfileForm(form({ greeting: 'From 48000' }));
  assert.equal(res.ok, false);
});

test('an unknown enum value fails the parse rather than silently defaulting', () => {
  assert.equal(parseVoiceProfileForm(form({ language_mix: 'klingon' })).ok, false);
  assert.equal(parseVoiceProfileForm(form({ emoji_level: 'extreme' })).ok, false);
  assert.equal(parseVoiceProfileForm(form({ warmth: 'icy' })).ok, false);
  assert.equal(parseVoiceProfileForm(form({ honorifics: 'maybe' })).ok, false);
});

test('a full valid form parses to the exact profile', () => {
  const res = parseVoiceProfileForm(
    form({
      greeting: 'Hello po',
      signoff: 'Maraming salamat po',
      language_mix: 'taglish_light',
      emoji_level: 'light',
      warmth: 'friendly',
      honorifics: 'true',
    }),
  );
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.deepEqual(res.profile, {
      greeting: 'Hello po',
      signoff: 'Maraming salamat po',
      languageMix: 'taglish_light',
      emojiLevel: 'light',
      warmth: 'friendly',
      honorifics: true,
    });
  }
});

test('clearing a fragment is allowed — back to the house voice', () => {
  const current: VoiceProfile = { ...HOUSE_VOICE, greeting: 'Hi po', signoff: 'Salamat' };
  const res = parseVoiceProfileForm(form({ greeting: '', signoff: '' }), current);
  assert.equal(res.ok, true);
  if (res.ok) assert.equal(isHouseVoice(res.profile), true);
});
