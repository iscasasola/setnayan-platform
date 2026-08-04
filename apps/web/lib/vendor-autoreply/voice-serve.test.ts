import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VOICED_BODY_MAX, serveVoicedReply, type VoiceServeInput } from './voice-serve';
import { VENDOR_AI_LEVELS, vendorAiAdvancedActive } from '../vendor-ai-level';

/**
 * THE serving gate. These tests exist to make three regressions impossible:
 *   1. flag-off changing a single byte of an existing reply;
 *   2. `vendor_bot_config.mode` (VENDOR-WRITABLE) being trusted as the
 *      entitlement — a vendor could then self-grant Advanced for free;
 *   3. a voiced reply being truncated (a cut mid-number turns a correct quote
 *      into a wrong one).
 */

const NEUTRAL = 'Our Full-Day Coverage starts at ₱48,000 (covers 8 hrs).';
const PHRASINGS = ['{{answer}}', 'Hi po! {{answer}} Salamat po.', 'Kumusta po! {{answer}}'];

function input(over: Partial<VoiceServeInput> = {}): VoiceServeInput {
  return {
    flagEnabled: true,
    advancedActive: true,
    mode: 'smart',
    neutralText: NEUTRAL,
    phrasings: PHRASINGS,
    rotationKey: 'thread-1:0',
    ...over,
  };
}

/** Every combination of the three non-flag gates. */
const STATES = (() => {
  const out: { advancedActive: boolean; mode: string | null | undefined; phrasings: string[] }[] = [];
  for (const advancedActive of [true, false]) {
    for (const mode of ['smart', 'free', null, undefined, 'SMART', '']) {
      for (const phrasings of [PHRASINGS, [], ['no slot']]) {
        out.push({ advancedActive, mode, phrasings: [...phrasings] });
      }
    }
  }
  return out;
})();

// ── 1. FLAG OFF = BYTE-IDENTICAL, in every state ────────────────────────────

test('FLAG OFF → the neutral text is returned untouched, in every state', () => {
  for (const s of STATES) {
    const res = serveVoicedReply(input({ flagEnabled: false, ...s }));
    assert.equal(res.text, NEUTRAL);
    assert.equal(res.voiced, false);
    assert.equal(res.reason, 'flag_off');
  }
});

// ── 2. the entitlement is the LEVEL, never the vendor-writable preference ───

test('mode="smart" WITHOUT the Advanced entitlement never voices a reply', () => {
  for (const mode of ['smart', 'SMART', 'free', null, undefined]) {
    const res = serveVoicedReply(input({ advancedActive: false, mode }));
    assert.equal(res.voiced, false);
    assert.equal(res.text, NEUTRAL);
    assert.equal(res.reason, 'not_advanced');
  }
});

test('the Advanced entitlement WITHOUT mode="smart" stays neutral (a vendor may decline)', () => {
  for (const mode of ['free', null, undefined, '', 'SMART', 'Smart']) {
    const res = serveVoicedReply(input({ mode }));
    assert.equal(res.voiced, false);
    assert.equal(res.reason, 'mode_not_smart');
    assert.equal(res.text, NEUTRAL);
  }
});

test('the level ladder feeds the gate correctly — only advanced + live window voices', () => {
  for (const level of [...VENDOR_AI_LEVELS, 'unknown', null, undefined]) {
    for (const windowActive of [true, false]) {
      const advancedActive = vendorAiAdvancedActive({ level, windowActive });
      const res = serveVoicedReply(input({ advancedActive }));
      const expected = level === 'advanced' && windowActive;
      assert.equal(advancedActive, expected, `${String(level)}/${windowActive}`);
      assert.equal(res.voiced, expected, `${String(level)}/${windowActive}`);
    }
  }
});

// ── 3. degrade paths always return the neutral answer, never silence ────────

test('no usable phrasings → neutral', () => {
  for (const phrasings of [[], ['', '  ']]) {
    const res = serveVoicedReply(input({ phrasings }));
    assert.equal(res.text, NEUTRAL);
    assert.equal(res.reason, 'no_phrasings');
  }
});

test('an unusable stored envelope → neutral, not a mangled reply', () => {
  const res = serveVoicedReply(input({ phrasings: ['no slot at all'] }));
  assert.equal(res.text, NEUTRAL);
  assert.equal(res.reason, 'render_failed');
});

test('a hand-edited envelope carrying a price is refused', () => {
  const res = serveVoicedReply(input({ phrasings: ['Only ₱999 today! {{answer}}'] }));
  assert.equal(res.text, NEUTRAL);
  assert.equal(res.reason, 'render_failed');
});

test('NEVER TRUNCATE — an over-long voiced reply falls back to the neutral answer', () => {
  const res = serveVoicedReply(
    input({ phrasings: [`${'x'.repeat(50)} {{answer}}`], maxLength: NEUTRAL.length + 10 }),
  );
  assert.equal(res.text, NEUTRAL);
  assert.equal(res.reason, 'too_long');
});

test('the default ceiling matches the chat_messages body CHECK', () => {
  assert.equal(VOICED_BODY_MAX, 4000);
});

// ── 4. the happy path ───────────────────────────────────────────────────────

test('all gates open → voiced, with the deterministic answer verbatim inside', () => {
  const res = serveVoicedReply(input());
  assert.equal(res.voiced, true);
  assert.equal(res.reason, 'voiced');
  assert.ok(res.text.includes(NEUTRAL), 'the live-row answer is never rewritten');
});

test('the same rotation key always yields the same text (a retry cannot reword)', () => {
  const a = serveVoicedReply(input({ rotationKey: 'thread-9:3' }));
  const b = serveVoicedReply(input({ rotationKey: 'thread-9:3' }));
  assert.equal(a.text, b.text);
});

test('every phrasing in a library renders with the answer intact', () => {
  for (let i = 0; i < 40; i += 1) {
    const res = serveVoicedReply(input({ rotationKey: `thread-1:${i}` }));
    assert.ok(res.text.includes(NEUTRAL), res.text);
  }
});
