import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANSWER_SLOT,
  MAX_PHRASINGS_PER_INTENT,
  VOICED_INTENTS,
  assertFactFree,
  buildPhrasingLibrary,
  buildPhrasingsForIntent,
  coercePhrasings,
  pickPhrasingIndex,
  renderPhrasing,
} from './phrasings';
import {
  HOUSE_VOICE,
  VOICE_EMOJI_LEVELS,
  VOICE_LANGUAGE_MIXES,
  VOICE_WARMTHS,
  type VoiceProfile,
} from '../vendor-voice-profile';

/**
 * The precompute library. The headline invariant — pinned across EVERY profile
 * combination below — is that a phrasing is an ENVELOPE and never a fact: no
 * digit, no ₱, no '@', no URL, exactly one {{answer}} slot. That is what keeps
 * "the bot structurally cannot misquote" true after voice-match ships.
 */

const ANSWER = 'Our Full-Day Coverage starts at ₱48,000 (covers 8 hrs).';

function profile(p: Partial<VoiceProfile> = {}): VoiceProfile {
  return { ...HOUSE_VOICE, greeting: 'Hi po', signoff: 'Salamat po', ...p };
}

/** Every profile shape the schema allows. */
function allProfiles(): VoiceProfile[] {
  const out: VoiceProfile[] = [];
  for (const languageMix of VOICE_LANGUAGE_MIXES) {
    for (const emojiLevel of VOICE_EMOJI_LEVELS) {
      for (const warmth of VOICE_WARMTHS) {
        for (const honorifics of [true, false]) {
          for (const greeting of ['', 'Hi', 'Kumusta po']) {
            for (const signoff of ['', 'Salamat', 'Maraming salamat po']) {
              out.push({ greeting, signoff, languageMix, emojiLevel, warmth, honorifics });
            }
          }
        }
      }
    }
  }
  return out;
}

// ── THE NO-FACTS INVARIANT, over every profile × every voiced intent ────────

test('NO PHRASING EVER CARRIES A FACT — every profile × every intent', () => {
  for (const p of allProfiles()) {
    for (const intent of VOICED_INTENTS) {
      for (const envelope of buildPhrasingsForIntent(p, intent)) {
        assert.equal(
          envelope.split(ANSWER_SLOT).length,
          2,
          `exactly one slot required: ${envelope}`,
        );
        const decoration = envelope.split(ANSWER_SLOT).join(' ');
        assert.equal(/[0-9₱@]/.test(decoration), false, `fact in envelope: ${envelope}`);
        assert.equal(
          /https?:\/\/|www\./i.test(decoration),
          false,
          `link in envelope: ${envelope}`,
        );
        assert.equal(assertFactFree(envelope), true, envelope);
      }
    }
  }
});

test('library is capped and never empty', () => {
  for (const p of allProfiles()) {
    for (const intent of VOICED_INTENTS) {
      const list = buildPhrasingsForIntent(p, intent);
      assert.ok(list.length >= 1, 'at least the bare answer');
      assert.ok(list.length <= MAX_PHRASINGS_PER_INTENT, `capped: got ${list.length}`);
      assert.equal(new Set(list).size, list.length, 'no duplicates');
    }
  }
});

test('the bare {{answer}} envelope is always FIRST — the house voice is always reachable', () => {
  for (const p of allProfiles()) {
    assert.equal(buildPhrasingsForIntent(p, 'price')[0], ANSWER_SLOT);
  }
});

test('the HOUSE voice produces exactly one envelope, rendering byte-identically to today', () => {
  const list = buildPhrasingsForIntent(HOUSE_VOICE, 'price');
  assert.deepEqual(list, [ANSWER_SLOT]);
  assert.equal(renderPhrasing(list[0] ?? '', ANSWER), ANSWER);
});

test('DETERMINISTIC — same profile, same library, same order', () => {
  const p = profile({ warmth: 'friendly', emojiLevel: 'light' });
  assert.deepEqual(
    buildPhrasingsForIntent(p, 'price'),
    buildPhrasingsForIntent({ ...p }, 'price'),
  );
});

test('the library covers exactly the ANSWERABLE intents — never the handoff ones', () => {
  const rows = buildPhrasingLibrary(profile());
  assert.deepEqual(
    rows.map((r) => r.intent),
    [...VOICED_INTENTS],
  );
  for (const handoff of ['customization', 'booking', 'unknown']) {
    assert.equal(rows.some((r) => r.intent === handoff), false, handoff);
  }
});

test('honorifics add "po" once, never twice', () => {
  const list = buildPhrasingsForIntent(
    profile({ greeting: 'Hello', signoff: 'Salamat po', honorifics: true, warmth: 'friendly' }),
    'price',
  );
  const voiced = list.find((e) => e !== ANSWER_SLOT);
  assert.ok(voiced);
  assert.match(voiced!, /Hello po/);
  assert.equal(/Salamat po po/.test(voiced!), false);
});

// ── rendering ───────────────────────────────────────────────────────────────

test('renderPhrasing keeps the answer VERBATIM', () => {
  const out = renderPhrasing('Hi po! {{answer}} Salamat po.', ANSWER);
  assert.ok(out);
  assert.ok(out!.includes(ANSWER), 'the deterministic answer is untouched');
  assert.equal(out, `Hi po! ${ANSWER} Salamat po.`);
});

test('renderPhrasing preserves the answer’s own internal spacing', () => {
  const answer = 'Line one.  Line two.';
  assert.equal(renderPhrasing('Hi! {{answer}}', answer), `Hi! ${answer}`);
});

test('renderPhrasing refuses a broken or fact-carrying envelope', () => {
  assert.equal(renderPhrasing('no slot here', ANSWER), null);
  assert.equal(renderPhrasing('{{answer}} and {{answer}}', ANSWER), null);
  assert.equal(renderPhrasing('Only ₱999 today! {{answer}}', ANSWER), null);
  assert.equal(renderPhrasing('Email hi@x.ph {{answer}}', ANSWER), null);
  assert.equal(renderPhrasing('{{answer}}', '   '), null);
});

// ── rotation ────────────────────────────────────────────────────────────────

test('pickPhrasingIndex is in range, stable, and empty-safe', () => {
  assert.equal(pickPhrasingIndex(0, 'k'), -1);
  for (const count of [1, 2, 5, 20]) {
    for (const key of ['t1:0', 't1:1', 't2:0', '', 'a'.repeat(64)]) {
      const i = pickPhrasingIndex(count, key);
      assert.ok(i >= 0 && i < count, `${count}/${key} → ${i}`);
      assert.equal(i, pickPhrasingIndex(count, key), 'stable for the same key');
    }
  }
});

test('rotation actually rotates across reply counts', () => {
  const keys = Array.from({ length: 24 }, (_, i) => `thread-abc:${i}`);
  const picks = new Set(keys.map((k) => pickPhrasingIndex(6, k)));
  assert.ok(picks.size > 1, 'consecutive replies must not always pick the same phrasing');
});

// ── coercion of stored jsonb ────────────────────────────────────────────────

test('coercePhrasings is total and drops anything unusable', () => {
  assert.deepEqual(coercePhrasings(null), []);
  assert.deepEqual(coercePhrasings('{{answer}}'), []);
  assert.deepEqual(coercePhrasings({}), []);
  assert.deepEqual(
    coercePhrasings([
      '  Hi po! {{answer}}  ',
      'no slot',
      'Only ₱999 {{answer}}',            // hand-edited fact — dropped
      'Reach me at hi@x.ph {{answer}}',  // off-platform route — dropped
      42,
      '',
    ]),
    ['Hi po! {{answer}}'],
  );
});

// ── language_mix must be LOAD-BEARING, not decorative ───────────────────────
//
// The § 6 profile carries `language_mix`, the derivation infers it, and My Shop
// offers it as a selector. If it stopped changing the rendered output, a vendor
// could pick "Cebuano", watch the preview not move, and reasonably conclude the
// whole voice panel is theatre. These tests fail if it ever goes inert again.

test('every language mix produces DIFFERENT lead-ins for the same profile', () => {
  const seen = new Map<string, string>();
  for (const languageMix of VOICE_LANGUAGE_MIXES) {
    const built = buildPhrasingsForIntent(
      profile({ languageMix, warmth: 'friendly' }),
      'price',
    ).join('\n');
    for (const [otherLang, otherBuilt] of seen) {
      assert.notEqual(
        built,
        otherBuilt,
        `${languageMix} renders identically to ${otherLang} — the selector is inert`,
      );
    }
    seen.set(languageMix, built);
  }
});

test('the effusive closers are language-specific too', () => {
  const en = buildPhrasingsForIntent(
    profile({ languageMix: 'english', warmth: 'effusive' }),
    'price',
  ).join('\n');
  const ceb = buildPhrasingsForIntent(
    profile({ languageMix: 'cebuano', warmth: 'effusive' }),
    'price',
  ).join('\n');
  assert.notEqual(en, ceb);
  assert.ok(ceb.includes('kaayo'), 'the Cebuano closer should actually be Cebuano');
});

test('an unknown language mix falls back to English rather than losing its voice', () => {
  const bogus = buildPhrasingsForIntent(
    { ...profile({ warmth: 'friendly' }), languageMix: 'klingon' as never },
    'price',
  );
  const english = buildPhrasingsForIntent(
    profile({ languageMix: 'english', warmth: 'friendly' }),
    'price',
  );
  assert.deepEqual(bogus, english);
  assert.ok(bogus.length > 1, 'fallback must still carry lead-ins');
});

test('no lead-in or closer smuggles “po” — honorifics are the greeting/sign-off’s job', () => {
  for (const languageMix of VOICE_LANGUAGE_MIXES) {
    for (const warmth of ['friendly', 'effusive'] as const) {
      for (const intent of VOICED_INTENTS) {
        const built = buildPhrasingsForIntent(
          { greeting: '', signoff: '', languageMix, emojiLevel: 'none', warmth, honorifics: false },
          intent,
        );
        for (const envelope of built) {
          assert.equal(
            /(^|[^a-zñ])po([^a-zñ]|$)/i.test(envelope.split(ANSWER_SLOT).join(' ')),
            false,
            `"po" leaked into a lead-in/closer with honorifics off: ${envelope}`,
          );
        }
      }
    }
  }
});
