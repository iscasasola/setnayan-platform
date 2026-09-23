/**
 * the-mark-travels-or-sits-still.test.ts — MAGIC MOVE CANNOT STRAND THE MARK.
 *
 * This is the first thing on the guest page that MOVES an element across the
 * viewport, and the failure it must not have is the mark ending up somewhere
 * the layout never put it — mid-flight, off-screen, or on top of the words —
 * because a script stopped halfway.
 *
 * The protection is structural, not careful coding: the script writes THREE
 * CUSTOM PROPERTIES and nothing else, and one CSS rule turns them into
 * movement. That rule is gated on `.pahina-js`, which three independent paths
 * already remove. No flag → no rule → the mark is where CSS put it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  MAGIC_BERTH_ATTR,
  MAGIC_DEFAULT,
  MAGIC_TRAVELLERS,
  MAGIC_TRAVELLER_ATTR,
  sanitizeMagicTraveller,
} from './magic-move';

const SCRIPT = readFileSync(
  join(__dirname, '..', 'app', '[slug]', '_components', 'magic-move.tsx'),
  'utf8',
);
const CSS = stripComments(readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8'));

test('⛔ OFF by default — every page today renders byte-identically', () => {
  assert.equal(MAGIC_DEFAULT, null, 'nothing travels until a couple says so');
  for (const junk of [null, undefined, '', 'Mark', 'monogram', 7, {}, []]) {
    assert.equal(sanitizeMagicTraveller(junk), null, `${JSON.stringify(junk)} must not start a journey`);
  }
  assert.equal(sanitizeMagicTraveller('mark'), 'mark', 'and a real one is accepted');
  assert.equal(MAGIC_TRAVELLERS.length, 1, 'one traveller: a list, not a switch on any element');
});

test('🔒 the script writes custom properties and NOTHING else', () => {
  const body = stripComments(SCRIPT);
  // Every style write must be a custom property. A direct transform would
  // survive the flag being removed and strand the mark.
  const writes = [...body.matchAll(/\.style\.setProperty\('([^']+)'/g)].map((m) => m[1] as string);
  assert.ok(writes.length >= 3, `precondition: it writes properties (${writes.length})`);
  for (const w of writes) {
    assert.match(w, /^--magic-/, `${w} is not a --magic-* property`);
  }
  assert.doesNotMatch(body, /\.style\.transform\s*=/, 'never a transform directly');
  assert.doesNotMatch(body, /classList\.(add|toggle)/, 'never a class on the traveller');
  assert.doesNotMatch(body, /innerHTML|appendChild|insertBefore/, 'it measures; it does not build');
});

test('🔒 nothing moves without the flag, at either end', () => {
  assert.match(SCRIPT, /if\(!r\.classList\.contains\('pahina-js'\)\)return;/, 'the script stands down without it');
  assert.match(
    CSS,
    /\.pahina-js \[data-magic-traveller\] \{[^}]*transform:\s*translate3d\(var\(--magic-dx/,
    'and the only rule that moves it is gated on it too',
  );
  /*
    🪤 EVERY RULE IS PARSED, NOT SNIFFED FOR ONE CHARACTER. The first version
    forbade `[data-magic-traveller] {` preceded by a non-word character — and
    the SPACE in `.pahina-js [data-magic-traveller]` is a non-word character, so
    it flagged the correctly-gated rule as ungated. A negative assertion that
    cannot tell the safe shape from the dangerous one is worse than none: it
    teaches the next session to delete it.
  */
  const moving = [...CSS.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter(([, sel, body]) => (sel ?? '').includes('[data-magic-traveller]') && /transform:/.test(body ?? ''))
    .map(([, sel]) => (sel ?? '').trim());
  assert.ok(moving.length > 0, 'precondition: something does move the traveller');
  for (const sel of moving) {
    assert.ok(
      sel.includes('.pahina-js'),
      `"${sel}" moves the mark without the flag — nothing could then stop it`,
    );
  }
});

test('🔑 the defaults are the identity — a flag with no measurement changes nothing', () => {
  const rule = /\.pahina-js \[data-magic-traveller\] \{([^}]*)\}/.exec(CSS)?.[1] ?? '';
  assert.match(rule, /var\(--magic-dx,\s*0px\)/, 'no horizontal travel until measured');
  assert.match(rule, /var\(--magic-dy,\s*0px\)/, 'no vertical travel until measured');
  assert.match(rule, /var\(--magic-k,\s*1\)/, 'and no scaling');
  assert.match(rule, /will-change/, 'the layer hint is declared in CSS, not set by the script');
  assert.doesNotMatch(SCRIPT, /will-change/, 'a hint the script set would outlive the flag');
});

test('⛔ reduced motion stops it even if the flag is somehow set', () => {
  const at = CSS.indexOf('prefers-reduced-motion: reduce');
  const blocks = [...CSS.matchAll(/prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/g)].map((m) => m[1] ?? '');
  assert.ok(at > 0 && blocks.length > 0, 'precondition: reduced-motion blocks exist');
  assert.ok(
    blocks.some((b) => /\[data-magic-traveller\][^}]*transform:\s*none/.test(b)),
    'the traveller is explicitly stilled for a guest who asked for less motion',
  );
});

test('🪤 it does not conclude "nothing to move" while the page is still streaming', () => {
  // The seven-week bug next door: a safety net that gave up during streaming,
  // when finding nothing was a lie rather than a fact, and suppressed the
  // feature on every public invitation with nothing written anywhere.
  assert.match(SCRIPT, /document\.readyState==='loading'/, 'it knows the page may still be parsing');
  assert.match(SCRIPT, /DOMContentLoaded/, 'and retries when it is not');
  assert.match(SCRIPT, /setTimeout\(retry,\s*\d+\)/, 'with a timer as the second route');
  assert.match(SCRIPT, /console\.warn\('\[magic\]/, 'and it SAYS SO if it really is empty');
});

test('🪤 the resting rect is measured with the transform zeroed', () => {
  // `getBoundingClientRect` returns the TRANSFORMED box. Reading the traveller
  // mid-flight feeds its own output back in and the value runs away.
  const measure = SCRIPT.slice(SCRIPT.indexOf('var measure='), SCRIPT.indexOf('var frame='));
  assert.match(measure, /--magic-dx','0px'/, 'zeroed before reading');
  assert.match(measure, /--magic-k','1'/);
  assert.ok(
    measure.indexOf("--magic-k','1'") < measure.indexOf('getBoundingClientRect'),
    'and zeroed BEFORE, not after',
  );
});

test('⭐ both ends are named by the contract, not by a string in the script', () => {
  assert.equal(MAGIC_TRAVELLER_ATTR, 'data-magic-traveller');
  assert.equal(MAGIC_BERTH_ATTR, 'data-magic-berth');
  assert.match(SCRIPT, /\[data-magic-traveller\]/);
  assert.match(SCRIPT, /\[data-magic-berth\]/);
  assert.match(CSS, /\[data-magic-berth\] \{[^}]*visibility:\s*hidden/, 'the berth holds space and draws nothing');
});
