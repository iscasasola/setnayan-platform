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

/* ════════════════════════════════════════════════════════════════════════════
   AND IT HAS TO BE REACHABLE — the half that was missing for a whole day.

   🔴 EVERY TEST ABOVE PASSED WHILE NOBODY COULD EVER SEE THIS. The mechanism
   shipped on 2026-09-23 with no column, no mount, no control: three files that
   mentioned Magic Move, and two of them were the feature's own source and this
   test. `tests/db/ugat-both-ends.db.test.ts` is what caught it, and its wording
   is the rule —

       [other] component-no-mount  app/[slug]/_components/magic-move.tsx
           no runtime importer in any source file
       component-no-mount: mount it from a page, or delete it.

   — with the escape hatch closed in the same breath: "Do NOT add a line to
   tests/db/ugat-both-ends.baseline.txt; that file is the debt we inherited."

   🔑 A MECHANISM NOBODY MOUNTS IS INDISTINGUISHABLE FROM ONE NOBODY WROTE.
   The tests below assert the JOIN — the column, both ends of the flight, the
   script, and the switch a couple presses — because each half is silent about
   the other. A traveller with no berth gives up and writes a console line; a
   berth with no traveller is a gap in the header nobody can explain; a control
   with no column saves nothing and says "Saved".
   ════════════════════════════════════════════════════════════════════════════ */

const WEB = join(__dirname, '..');
const src = (...p: string[]) => stripComments(readFileSync(join(WEB, ...p), 'utf8'));

const SHELL = src('app', '[slug]', '_components', 'invitation-shell.tsx');
const BODY = src('app', '[slug]', '_components', 'site-body.tsx');
const HERO = src('app', '[slug]', '_components', 'editorial', 'editorial-content.tsx');
const PANEL = src('app', 'dashboard', '[eventId]', 'website', 'editor', '_components', 'pro-panels.tsx');
const SAVE = src('app', 'dashboard', '[eventId]', 'website', 'colors', 'actions.ts');

test('⛔ the script is MOUNTED — this is the test the guard asked for', () => {
  assert.match(SHELL, /import \{ MagicMove \} from '\.\/magic-move'/, 'the shell must import it');
  assert.match(
    SHELL,
    /magicTraveller \? <MagicMove \/> : null/,
    'and render it — only when a couple armed it, but really render it',
  );
});

test('⛔ both ends exist, and the page reads the column ONCE to set them', () => {
  // One read, two ends. Two reads is two chances for one end to be armed and
  // the other not, and neither failure is loud.
  const reads = [...BODY.matchAll(/sanitizeMagicTraveller\(/g)];
  assert.equal(reads.length, 1, `site-body must read the column exactly once, saw ${reads.length}`);
  assert.match(BODY, /magicTraveller=\{magicTraveller\}/, 'and hand the SAME value onward');
  assert.equal(
    [...BODY.matchAll(/magicTraveller=\{magicTraveller\}/g)].length,
    2,
    'to both ends — the shell (berth + script) and the editorial hero (traveller)',
  );

  // 🪤 `const` is not hoisted and the two call sites are ~1,500 lines apart, so
  // a declaration that merely LOOKS well-placed throws on every render.
  const declared = BODY.indexOf('const magicTraveller =');
  const firstUse = BODY.indexOf('magicTraveller={magicTraveller}');
  assert.ok(declared > 0 && firstUse > 0, 'precondition: both are present');
  assert.ok(
    declared < firstUse,
    'the declaration sits AFTER its first use — a ReferenceError on every guest page',
  );
});

test(`⛔ the berth is real, and it is the header's own monogram`, () => {
  assert.match(SHELL, new RegExp(MAGIC_BERTH_ATTR), 'the shell must stamp the berth attribute');
  assert.match(
    SHELL,
    /monogramText && magicTraveller === 'mark'/,
    'armed only when there is a mark to receive AND a couple asked for it',
  );
  // An unarmed page keeps the plain monogram branch it always had.
  assert.match(SHELL, /\) : monogramText \? \(/, 'the original branch must survive underneath');
});

test('⛔ the traveller is stamped at the SLOT, and has a box to transform', () => {
  assert.match(HERO, new RegExp(MAGIC_TRAVELLER_ATTR), 'the hero must stamp the traveller');
  // 🪤 `display: contents` generates NO BOX, so it takes no transform: the rule
  // would match, every property would be written, and the mark would sit
  // perfectly still with nothing reporting a fault.
  assert.doesNotMatch(
    HERO,
    new RegExp(`${MAGIC_TRAVELLER_ATTR}[^>]*className="contents"`),
    'a display:contents traveller cannot move, and fails silently',
  );
  assert.match(
    HERO,
    new RegExp(`${MAGIC_TRAVELLER_ATTR} className="block"`),
    'it needs a real box for the transform and for getBoundingClientRect',
  );
  // Both implementations of the slot must sit inside the one wrapper.
  const at = HERO.indexOf(MAGIC_TRAVELLER_ATTR);
  const wrapped = HERO.slice(at, at + 600);
  assert.match(wrapped, /HeroMonogram/, 'the designed mark travels');
  assert.match(wrapped, /<Monogram text=/, 'and so does the fallback circle');
});

test('⛔ a couple can turn it on, and can take it back', () => {
  assert.match(PANEL, /name="site_magic_traveller"/, 'the editor needs the control');
  const radios = [...PANEL.matchAll(/name="site_magic_traveller"/g)];
  assert.ok(radios.length >= 2, `an off option and at least one traveller, saw ${radios.length}`);
  assert.match(PANEL, /value=""\n\s*defaultChecked=\{!magicTraveller\}/, '"nothing travels" posts the clear');
  assert.match(PANEL, /MAGIC_TRAVELLERS\.map/, 'the options come from the contract, not a retyped list');
  assert.match(PANEL, /MAGIC_TRAVELLER_LABEL/, 'and so does their copy');
});

test('⛔ the save writes it, and an absent field leaves it alone', () => {
  assert.match(SAVE, /sanitizeMagicTraveller/, 'the action must sanitize, never repair');
  assert.match(
    SAVE,
    /magic !== undefined \? \{ site_magic_traveller: magic \} : \{\}/,
    'the tri-state: absent leaves the column untouched',
  );
  // The colours sub-page posts this same action without the control. Without
  // absent-means-unchanged, every colour save would switch a couple's motion off.
  assert.match(SAVE, /magicRaw === ''\n?\s*\? null/, "and `''` clears it back to nothing");
});

test('⛔ the column is in every SELECT that has to carry it', () => {
  const loaders = src('app', '[slug]', '_lib', 'loaders.ts');
  assert.match(loaders, /site_magic_traveller/, 'the guest page cannot honour what it never read');
  const editor = src('app', 'dashboard', '[eventId]', 'website', 'editor', 'page.tsx');
  assert.match(editor, /site_magic_traveller/, 'and the editor cannot show the saved state');
  assert.match(
    editor,
    /magicTraveller=\{/,
    'the editor must hand it to the panel, or the radio always reads "nothing travels"',
  );
});

test('⛔ and the BERTH stops hiding when the script does not run', () => {
  // 🔴 This rule was ungated. The berth is the header's own monogram, so hidden
  // unconditionally, every reduced-motion guest lost it from the header and
  // nothing said so — a fail-INVISIBLE at the quiet end of a fail-visible
  // feature.
  assert.match(
    CSS,
    new RegExp(`\\.pahina-js \\[${MAGIC_BERTH_ATTR}\\]`),
    'the hiding must be gated on the same flag as the movement',
  );
  assert.doesNotMatch(
    CSS,
    new RegExp(`(^|\\n)\\s*\\[${MAGIC_BERTH_ATTR}\\]\\s*\\{`),
    'an ungated berth rule deletes the monogram for anyone whose script never ran',
  );
});
