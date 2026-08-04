import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VOICE_MIN_SAMPLE,
  VOICE_SAMPLE_LIMIT,
  deriveVoiceProfile,
} from './vendor-voice-derive';
import { HOUSE_VOICE } from './vendor-voice-profile';

/**
 * Derivation reads the vendor's OWN replies and COUNTS. These tests pin the two
 * things that matter beyond "does it classify tone":
 *   • the closed-vocabulary rule — nothing free-form from a past message can
 *     ever end up in the profile (§ 2A: a customer's name/number must not be
 *     quoted back to a different couple);
 *   • determinism — same corpus, same profile, every time.
 */

const TAGLISH = [
  'Hi po! Salamat sa message ninyo. Available po kami sa date na yan. Salamat po!',
  'Hi po! Pwede po natin pag-usapan ang package. Salamat po!',
  'Hi po! Yung coverage po namin ay buong araw. Salamat po!',
  'Hi po! Sige po, ready na kami. Salamat po!',
  'Hi po! Meron po kaming promo ngayon. Salamat po!',
];

const ENGLISH_TERSE = [
  'Yes, we are available.',
  'Sure, sending details.',
  'Confirmed.',
  'We can do that.',
  'Noted.',
];

test('empty corpus → house voice, not confident', () => {
  const d = deriveVoiceProfile([]);
  assert.deepEqual(d.profile, HOUSE_VOICE);
  assert.equal(d.sampleCount, 0);
  assert.equal(d.confident, false);
});

test('blank/whitespace-only bodies are ignored entirely', () => {
  const d = deriveVoiceProfile(['', '   ', '\n\t']);
  assert.deepEqual(d.profile, HOUSE_VOICE);
  assert.equal(d.sampleCount, 0);
});

test('a Taglish, honorific vendor is detected as such', () => {
  const d = deriveVoiceProfile(TAGLISH);
  assert.equal(d.profile.greeting, 'Hi po');
  assert.equal(d.profile.signoff, 'Salamat po');
  assert.equal(d.profile.honorifics, true);
  assert.ok(d.profile.languageMix === 'taglish_light' || d.profile.languageMix === 'taglish_heavy');
  assert.equal(d.confident, true);
});

test('a terse English vendor gets no decoration and a concise tone', () => {
  const d = deriveVoiceProfile(ENGLISH_TERSE);
  assert.equal(d.profile.greeting, '');
  assert.equal(d.profile.signoff, '');
  assert.equal(d.profile.honorifics, false);
  assert.equal(d.profile.languageMix, 'english');
  assert.equal(d.profile.emojiLevel, 'none');
  assert.equal(d.profile.warmth, 'concise');
});

test('a Cebuano vendor is not mislabelled as Tagalog', () => {
  const d = deriveVoiceProfile([
    'Maayong adlaw! Naa mi available ana nga petsa. Daghang salamat!',
    'Maayong adlaw! Palihug lang og confirm. Daghang salamat!',
    'Maayong adlaw! Maayo kaayo ang package namo. Daghang salamat!',
    'Maayong adlaw! Buhaton namo kini. Daghang salamat!',
    'Maayong adlaw! Naa mi promo karon. Daghang salamat!',
  ]);
  assert.equal(d.profile.languageMix, 'cebuano');
  assert.equal(d.profile.greeting, 'Maayong adlaw');
  assert.equal(d.profile.signoff, 'Daghang salamat');
});

test('CLOSED VOCABULARY — a customer name / number in a past reply never enters the profile', () => {
  const leaky = [
    'Hi Maria Santos! Your total is 48000, call me at 09171234567. Salamat po!',
    'Hi Maria Santos! Deposit 15000 to BDO 1234567890. Salamat po!',
    'Hi Maria Santos! Meet at 123 Rizal Ave. Salamat po!',
    'Hi Maria Santos! Balance due 33000. Salamat po!',
    'Hi Maria Santos! See you on 06/14. Salamat po!',
  ];
  const d = deriveVoiceProfile(leaky);
  const decoration = `${d.profile.greeting} ${d.profile.signoff}`;
  assert.equal(/[0-9₱@]/.test(decoration), false, 'no digits, peso sign or @ may survive');
  assert.equal(/maria|santos|rizal|bdo/i.test(decoration), false, 'no copied name/address');
  // Only the KNOWN opener/closer are adopted.
  assert.equal(d.profile.greeting, 'Hi');
  assert.equal(d.profile.signoff, 'Salamat po');
});

test('a one-off greeting is NOT adopted as the vendor’s habit', () => {
  const mostlyBare = [
    'Hey there, sending the details now.',
    'Sending the details now.',
    'Sending the details now.',
    'Sending the details now.',
    'Sending the details now.',
    'Sending the details now.',
  ];
  assert.equal(deriveVoiceProfile(mostlyBare).profile.greeting, '');
});

test('longest matching phrase wins — "Maraming salamat po" is not counted as "Salamat"', () => {
  const bodies = Array.from({ length: 6 }, () => 'Sige po. Maraming salamat po!');
  assert.equal(deriveVoiceProfile(bodies).profile.signoff, 'Maraming salamat po');
});

test('a greeting must be a whole word — "History" is not "Hi"', () => {
  const bodies = Array.from({ length: 6 }, () => 'History of our studio is on the profile.');
  assert.equal(deriveVoiceProfile(bodies).profile.greeting, '');
});

test('emoji level tracks emoji density', () => {
  const none = Array.from({ length: 5 }, () => 'Yes we are available.');
  const light = ['Yes 💛', 'Yes', 'Yes', 'Yes', 'Yes'];
  const rich = Array.from({ length: 5 }, () => 'Yes 💛✨🙌');
  assert.equal(deriveVoiceProfile(none).profile.emojiLevel, 'none');
  assert.equal(deriveVoiceProfile(light).profile.emojiLevel, 'light');
  assert.equal(deriveVoiceProfile(rich).profile.emojiLevel, 'rich');
});

test('long, exclamatory replies read as a warmer tone', () => {
  const long = Array.from(
    { length: 5 },
    () =>
      'Thank you so much for reaching out to us! We would absolutely love to be part of your celebration and we always make sure every couple feels completely taken care of from the first meeting all the way through to the very last dance of the night, with a team that stays until the final guest goes home!',
  );
  assert.equal(deriveVoiceProfile(long).profile.warmth, 'effusive');
});

test('confidence flips exactly at VOICE_MIN_SAMPLE', () => {
  const body = 'Yes we are available.';
  const under = deriveVoiceProfile(Array.from({ length: VOICE_MIN_SAMPLE - 1 }, () => body));
  const at = deriveVoiceProfile(Array.from({ length: VOICE_MIN_SAMPLE }, () => body));
  assert.equal(under.confident, false);
  assert.equal(at.confident, true);
});

test('the corpus is capped — bounded work and bounded exposure', () => {
  const d = deriveVoiceProfile(Array.from({ length: VOICE_SAMPLE_LIMIT + 50 }, () => 'Yes.'));
  assert.equal(d.sampleCount, VOICE_SAMPLE_LIMIT);
});

test('DETERMINISTIC — the same corpus always derives the same profile', () => {
  const a = deriveVoiceProfile(TAGLISH);
  const b = deriveVoiceProfile([...TAGLISH]);
  assert.deepEqual(a, b);
});
