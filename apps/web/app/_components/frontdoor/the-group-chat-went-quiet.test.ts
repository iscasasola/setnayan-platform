/**
 * the-group-chat-went-quiet.test.ts — the two blocks that make the front door's
 * headline an argument rather than an assertion.
 *
 * The opening claims *"the best photo of the night is on somebody else's
 * phone."* These make the reader verify it from their own memory — the only
 * proof a company with almost no customers can honestly offer.
 *
 * 🔑 THE ONE THAT MATTERS MOST: **IT MUST NEVER LOOK LIKE A REAL SCREENSHOT.**
 * No avatars, no sender names, no app chrome. We have near-zero customers, so a
 * vignette mistakable for a real person's messages is a fabricated testimonial
 * — the single thing the whole front-door brief forbids. A later pass that
 * "improves" this with profile pictures or a phone frame crosses that line, and
 * this test is what stops it.
 *
 * 🔑 AND NO GUILT. The family-abroad block is framed as something you can SEND,
 * never as something you would be guilty of missing. *"Don't let lola miss it"*
 * is banned from this page and everything descended from it. Asserted on the
 * vocabulary, because tone is exactly what erodes one edit at a time.
 *
 * 🪤 THE BRANCH CHECK IS STRUCTURAL, NOT PROXIMITY-BASED, and my first cut was
 * not: the two halves of the ternary sit within a couple of hundred characters
 * of each other, so a windowed regex matched ACROSS the boundary and reported a
 * defect that did not exist. It splits on the ternary's own `) : (` instead.
 *
 * ⚠ SOURCE-LEVEL. It proves the blocks exist, where they render, and what
 * colours they speak in. Whether they LAND is the owner's call.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => readFileSync(join(HERE, f), 'utf8');
const strip = (s: string) =>
  s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const STORY = strip(read('front-door-story.tsx'));
const DOOR = strip(read('front-door.tsx'));
const CSS = read('front-door.css').replace(/\/\*[\s\S]*?\*\//g, '');

test('the group chat has its four beats and ends in silence', () => {
  assert.equal(
    (STORY.match(/fd-chat-beat/g) ?? []).length,
    4,
    'four beats with widening gaps — the silence is the argument',
  );
  assert.ok(/Tita left the group\./.test(STORY), 'the last beat is the one that lands');
  assert.ok(/gathering problem/.test(STORY), 'the turn from the wound to the product');
});

test('it is a drawn illustration, never a screenshot of a real person', () => {
  assert.ok(
    !/avatar|profile|sender/i.test(STORY),
    'no avatars, no sender names. With near-zero customers a realistic vignette ' +
      'is a fabricated testimonial — the one thing this page forbids.',
  );
  assert.ok(
    /<figure/.test(STORY) && /<figcaption/.test(STORY),
    'a <figure> with a real caption, so it is announced as an illustration',
  );
  assert.equal(
    (STORY.match(/<li /g) ?? []).length,
    4,
    'the beats are a list — a screen reader gets the same four, in order',
  );
});

test('the family who could not fly home are offered something, never blamed', () => {
  assert.ok(/couldn’t fly home/.test(STORY), 'the block is present');
  assert.ok(
    !/(don’t let|don't let|missed out|you’ll regret|you'll regret|before it’s too late)/i.test(STORY),
    'framed as something you can SEND. Guilt is banned from this page.',
  );
});

test('it sits above the feed, and never over search results', () => {
  assert.ok(
    DOOR.indexOf('<FrontDoorStory />') < DOOR.indexOf('<FrontDoorFeed'),
    'the story comes before the feed',
  );
  // structural, not proximity — see the trap note in the docblock
  const t = DOOR.indexOf('{searchQuery ? (');
  const seg = DOOR.slice(t);
  const elseAt = seg.indexOf(') : (');
  assert.ok(t >= 0 && elseAt >= 0, 'the search/feed ternary should still be here');
  assert.ok(
    !seg.slice(0, elseAt).includes('<FrontDoorStory'),
    'somebody who typed a query wants their answer, not the marketing argument ' +
      'pushed above it',
  );
  assert.ok(seg.slice(elseAt).includes('<FrontDoorStory'), 'and it must render on the feed branch');
});

test('the panel is neutral grey, not the beige the owner asked us to drop', () => {
  assert.ok(
    /--fd-panel:\s*#f4f4f5/.test(CSS),
    'the vignette gets its own neutral surface. `--fd-wash` is #f3ecdf — beige — ' +
      'and the owner asked for the page to stop being beige.',
  );
  assert.ok(
    /\.fd-chat-when\s*\{[^}]*--fd-m1/.test(CSS),
    'timestamps use --fd-m1 (4.90:1 on the panel). --fd-m2 is 3.34:1 and fails.',
  );
});
