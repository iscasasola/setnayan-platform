/**
 * the-front-door-says-something.test.ts — `/` must open with a sentence, not a
 * filter bar.
 *
 * 🔴 WHAT THIS IS FOR. The front door's `<h1>` was `.fd-sr-only` — present for
 * screen readers and for search, invisible to a person — so the page opened on
 * the chip bar and the card grid. Owner: *"doesn't it feel like just a youtube
 * rip off?"* A feed with nothing above it IS a feed.
 *
 * It is also why an app-verification review failed: the page did not obviously
 * say what the product is, or that it is called Setnayan.
 *
 * WHAT IS PINNED, and each line is a mistake somebody will make later:
 *   · exactly ONE <h1> — the opening REPLACES the sr-only fallback, never joins
 *     it. Two would break the "exactly one <h1> each" rule closed 2026-08-13.
 *   · the fallback SURVIVES for any front-door surface with no real heading.
 *   · the create link points at `/onboarding/wedding`. Bare `/onboarding` is a
 *     404 — verified live — and a link that goes nowhere is the one thing this
 *     page forbids.
 *   · the brand name sits in the opening prose, for the reviewer.
 *   · the body copy uses `--fd-m1` (5.38:1 on white). `--fd-m2` is 3.67:1 and
 *     FAILS as body text — it is metadata grey, and the difference is invisible
 *     until somebody measures it.
 *   · no fear framing. The argument is recognition — a group chat that went
 *     quiet — never "don't you want to remember your wedding?". These are
 *     people spending the most money they ever will; pressure would be both
 *     wrong and obvious.
 *
 * ⚠ SOURCE-LEVEL. It proves the page HAS an opening and what colour that
 * opening speaks in. It cannot prove the page reads well — the owner looking at
 * it is the only test for that.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => readFileSync(join(HERE, f), 'utf8');
/** comments quote the very strings under test — strip them or the guard reads
 *  its own prose as evidence, which is how a check ends up defending nothing */
const strip = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const OPENING = strip(read('front-door-opening.tsx'));
const SHELL = strip(read('front-door-shell.tsx'));
const DOOR = strip(read('front-door.tsx'));
const CSS = read('front-door.css').replace(/\/\*[\s\S]*?\*\//g, '');

test('the front door opens with a real, visible heading', () => {
  assert.equal(
    (OPENING.match(/<h1[\s>]/g) ?? []).length,
    1,
    'the opening must declare exactly one <h1>',
  );
  assert.ok(
    /heading=\{<FrontDoorOpening \/>\}/.test(DOOR),
    'the front door must hand that opening to the shell as its heading',
  );
});

test('it REPLACES the screen-reader-only heading and never joins it', () => {
  assert.ok(
    /heading \?\? \(/.test(SHELL),
    'the shell must render the supplied heading OR the fallback — `??`, not both. ' +
      'Two <h1>s is the defect the doorway work closed on 2026-08-13.',
  );
  assert.ok(
    /fd-sr-only/.test(SHELL),
    'the fallback must survive for any front-door surface that has no real heading',
  );
});

test('every link in the opening points at a page that exists', () => {
  assert.ok(
    /href="\/onboarding\/wedding\?from=home"/.test(OPENING),
    'the create link must use /onboarding/wedding — the path every other create ' +
      'door in the app uses',
  );
  assert.ok(
    !/href="\/onboarding"/.test(OPENING),
    'bare /onboarding is a 404 — there is no page.tsx at that path, only ' +
      '[type], simple and wedding beneath it. A fake door is the one thing this ' +
      'page forbids.',
  );
});

test('the opening speaks in colours that pass, and names the brand', () => {
  assert.ok(
    /\.fd-opening-lede\s*\{[^}]*--fd-m1/.test(CSS),
    'body copy must use --fd-m1 (5.38:1 on white)',
  );
  assert.ok(
    !/\.fd-opening-lede\s*\{[^}]*--fd-m2/.test(CSS),
    '--fd-m2 is 3.67:1 — metadata grey. As body copy it fails AA, and the ' +
      'difference is invisible until somebody measures it.',
  );
  assert.ok(
    /\.fd-opening-alt\s*\{[^}]*--fd-link/.test(CSS),
    'the secondary action must use the link slate (8.50:1), never the ' +
      'decorative gold (3.48:1, fails as text)',
  );
  assert.ok(
    /<b>Setnayan<\/b>/.test(OPENING),
    'the brand name must appear in the opening prose — an app-verification ' +
      'review already failed once on exactly this',
  );
});

test('the argument is recognition, not fear', () => {
  assert.ok(
    !/(don’t you|don't you|before it’s too late|before it's too late|you’ll regret|you'll regret|last chance|hurry)/i.test(
      OPENING,
    ),
    'no pressure framing. The claim is verified from the reader’s own memory — ' +
      'a group chat that went quiet — never from what they stand to lose.',
  );
});
