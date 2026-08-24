/**
 * the-veil-asks-like-an-invitation.test.ts — H-1.
 *
 * WHAT WAS WRONG, MEASURED IN A REAL SIGNED-OUT BROWSER (375×812, live site,
 * 2026-08-24). The first thing a guest ever sees of somebody's wedding is the
 * veil, and the instruction under it was set in DM Mono, UPPERCASE, at 3.52px
 * and 2.24px of letter-spacing. A monospaced DATA face, set as a system
 * message, on an invitation.
 *
 * 🛑 AND IT HAD TO BE A BROWSER. This overlay is CLIENT-rendered: both strings
 * are ZERO occurrences in the server HTML, and that is not evidence they are
 * absent — it is evidence a fetch cannot see them. The computed styles above
 * were read off the live DOM.
 *
 * 📏 "you" WAS STRANDED ALONE ON A LINE. Measured by walking the text node and
 * taking each word's client rect: at 375px the second line rendered as
 * "or double-tap to lift it for" / "you".
 *
 * 🔒 THE OWNER'S LOCK HERE IS LEGIBILITY, NOT TYPOGRAPHY (2026-06-20: "the text
 * at the bottom should be visible so old people can understand the app"). So
 * legibility had to go UP, and the words — his — are untouched. Only the voice
 * setting them changed.
 *
 * ⛔ THIS IS NOT H-2. H-2 is the FILM's label face in `lib/std-themes.ts`, it is
 * owner-gated, and the last test in this file proves it was left alone.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');
const OVERLAY = join(HERE, 'reveal-overlay.tsx');

/** The comment above the pill quotes the old class string verbatim to explain
 *  the defect. A raw grep would match the explanation and report the bug it
 *  just fixed — this repo has shipped that mistake before. */
function pillMarkup(): string {
  const src = readFileSync(OVERLAY, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  // Only the scrim pill itself — the rest of the file legitimately uses mono.
  const m = /<div className="rounded-full bg-black\/35[\s\S]*?<\/div>/.exec(src);
  assert.notEqual(m, null, 'the veil instruction pill is gone from reveal-overlay.tsx');
  return m![0];
}

test('🔴 the veil instruction is not set in the data face', () => {
  assert.equal(
    /font-mono/.test(pillMarkup()),
    false,
    'the veil instruction is back in DM Mono — a monospaced data face on the ' +
      'first thing a guest sees of somebody’s wedding',
  );
});

test('🔴 it is not shouted in tracked-out capitals', () => {
  const pill = pillMarkup();
  assert.equal(
    /uppercase/.test(pill),
    false,
    'the veil instruction is being shouted in ALL CAPS again — that plus wide ' +
      'tracking is what made it read as a system message, and it is measurably ' +
      'slower to read than sentence case',
  );
  assert.equal(
    /tracking-\[/.test(pill),
    false,
    'wide letter-spacing is back on the veil instruction',
  );
});

test('🔒 legibility went UP, not down — the owner’s lock on this pill', () => {
  const pill = pillMarkup();
  // Was text-base (16px). Anything smaller than text-2xl on the headline is a
  // regression against 2026-06-20, which is the one thing this item may not
  // trade away for a prettier face.
  assert.match(
    pill,
    /text-2xl/,
    'the headline shrank below 24px — it was 16px in the mono setting and the ' +
      'owner’s requirement is that older guests can read it',
  );
  // The scrim and shadow are what keep cream text off a light ivory veil.
  assert.match(pill, /bg-black\/35/, 'the dark scrim behind the instruction is gone');
  assert.match(
    pill,
    /text-shadow:0_1px_8px_rgba\(0,0,0,0\.7\)/,
    'the text-shadow that stops cream washing out on a pale veil is gone',
  );
  assert.match(pill, /backdrop-blur-\[2px\]/, 'the backdrop blur behind the instruction is gone');
});

test('📏 the orphan cannot come back — "you" alone on a line', () => {
  assert.match(
    pillMarkup(),
    /text-balance/,
    'the second line lost its balanced wrapping, so "you" can be stranded on a ' +
      'line of its own again — measured at 375px on the live site',
  );
});

test('the owner’s words are untouched', () => {
  const pill = pillMarkup();
  assert.match(pill, /Lift the veil ↑/, 'the headline wording changed');
  assert.match(pill, /or double-tap to lift it for you/, 'the second line wording changed');
});

test('it uses the guest editorial stack, not a third register', () => {
  const pill = pillMarkup();
  // Inside .sn-editorial, font-display resolves to Cormorant and font-sans to
  // Manrope — verified in the live DOM. Anything else here would be a new
  // typeface introduced on the most-seen screen in the product.
  assert.match(pill, /font-display/, 'the headline left the editorial display face');
  assert.match(pill, /font-sans/, 'the second line left the editorial sans');
});

test('⛔ the OWNER-GATED film label face is untouched', () => {
  // H-2 is scoped, decided-under-delegation, and explicitly NOT this session's
  // to build. If this ever fails, somebody has quietly shipped it alongside H-1
  // and the owner never saw it.
  const themes = readFileSync(join(WEB, 'lib', 'std-themes.ts'), 'utf8');
  assert.match(
    /labelCls: '([^']*)'/.exec(themes)?.[1] ?? '',
    /^font-mono /,
    'lib/std-themes.ts labelCls is no longer DM Mono — that is H-2, it is ' +
      'OWNER-GATED, and it must not ride along with H-1',
  );
});
