import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

/**
 * The property: the conversation keeps a usable height, and the live quote is
 * reachable from inside it.
 *
 * ─── MEASURED ON PRODUCTION 2026-09-18 ───────────────────────────────────
 * The first quote ever sent on this platform was accepted at 06:46. Between
 * those two moments the couple's thread rendered:
 *
 *     <ol class="flex-1 … overflow-y-auto">   clientHeight 32px
 *                                             scrollHeight 498px
 *
 * The column is a fixed height and the pinned CURRENT QUOTE card sat above the
 * list, so the card's height came straight out of the conversation. On a phone
 * it left 32px; on desktop it clipped a card mid-sentence.
 *
 * 🔑 UNREACHABLE UNTIL A QUOTE EXISTED. The card only renders when there is a
 * proposal, and none had ever been sent — so the layout was correct for every
 * state anybody had been able to reach.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const STREAM = 'app/_components/chat-message-stream.tsx';
const COUPLE = 'app/dashboard/[eventId]/messages/[threadId]/page.tsx';
const VENDOR = 'app/vendor-dashboard/messages/[threadId]/page.tsx';

test('the conversation has a floor it cannot be squeezed below', () => {
  const s = read(STREAM);
  // ⚠ COUNT, DO NOT JUST MATCH. My first version asserted that SOMETHING in
  // this file had `min-h-…flex-1…overflow-y-auto`, and removing the floor from
  // the conversation left it green — because the Files panel beside it has the
  // same shape and satisfied the pattern. A guard that finds *a* match instead
  // of *the* match is the oldest bug in this repo's toolkit.
  const floored = s.match(/min-h-\[\d+rem\][^"]*flex-1[^"]*overflow-y-auto/g) ?? [];
  assert.equal(
    floored.length,
    2,
    `expected BOTH scrollers to keep a floor (the conversation and the Files ` +
      `panel); found ${floored.length}. The message list is the only flex-1 ` +
      'child of a fixed-height column, so any sibling that grows takes the ' +
      'conversation with it — measured at 32px against 498px of content.',
  );
  // And name the conversation specifically, so the two can never be confused.
  const ol = s.slice(s.indexOf('<ol'), s.indexOf('</ol>'));
  assert.match(ol, /min-h-\[\d+rem\]/, 'the CONVERSATION list lost its floor');
});

test('the column cannot clip its own composer', () => {
  /*
    ── EVOLVED 2026-09-18 (One Chat Box) ─────────────────────────────────────
    The first version of this test demanded `min-h-[calc(100dvh-12rem)]` on the
    couple's column: growing was the only way to guarantee nothing got crushed
    while six siblings shared the height. A page-scrolling column has a cost
    the same day showed: the list is never height-bounded, so its own
    scroll-to-bottom scrolls nothing and a long thread opens at the TOP.

    Both pages now bound the row again — that is what pins the composer and
    lets the conversation scroll inside the frame — and the property moves to
    where it is actually enforced: the row carries a `min-h-[Nrem]` FLOOR on
    the same className as its height, so on a phone shorter than the floor the
    row outgrows the viewport and the page scrolls, rather than the frame
    clipping. The list's own `min-h-[14rem]` (tested above) is the second
    floor. The bare fixed shape — a height with no floor — stays forbidden.
  */
  for (const [rel, name] of [[COUPLE, 'couple'], [VENDOR, 'supplier']] as const) {
    const s = read(rel);
    // COUNT the row: exactly one className carries the height AND a rem floor.
    const bounded = s.match(/className="[^"]*\bh-\[calc\(100dvh-12rem\)\][^"]*\bmin-h-\[\d+rem\][^"]*"/g) ?? [];
    assert.equal(
      bounded.length,
      1,
      `${name}: expected exactly one row bounded to the viewport WITH a rem floor; found ${bounded.length}`,
    );
    const floorRem = Number(/\bmin-h-\[(\d+)rem\]/.exec(bounded[0]!)![1]);
    assert.ok(
      floorRem >= 26,
      `${name}: the floor is ${floorRem}rem — below header + note + switch + composer + the list's 14rem`,
    );
    assert.doesNotMatch(
      s,
      /className="[^"]*\bh-\[calc\(100dvh-12rem\)\](?![^"]*min-h-\[)[^"]*"/,
      `${name}: a fixed-height row with no floor — the exact shape that crushed the list`,
    );
  }
});

test('the quote is NOT duplicated above the conversation', () => {
  const s = read(COUPLE);
  assert.doesNotMatch(
    s,
    /<ThreadQuotationsCard/,
    'the pinned quote card is mounted again. It renders the same proposal the ' +
      'stream already shows, and its height comes out of the conversation.',
  );
});

test('the in-stream quote card carries the inclusions and a way to counter', () => {
  const s = read(STREAM);
  // ⚠ `card?.lineItems` — optional chaining. My first spelling was
  // `/card\.lineItems/` and it failed against correct code, which is the same
  // mistake as a window that ends at the wrong boundary: the assertion has to
  // match what the source ACTUALLY says, not the shape I had in mind.
  assert.match(s, /card\?\.lineItems/, 'the stream card lost the line items');
  assert.match(s, /Counter-offer/, 'a quote is take-it-or-leave-it again');
  assert.match(
    s,
    /counterHref \? \(/,
    'the counter action is not conditional on a destination being supplied',
  );
  // It must be a Link, not an onClick — a server component cannot pass a
  // function across the boundary, and that mistake compiles until it runs.
  assert.doesNotMatch(s, /onClick=\{onCounterOffer\}/);
});

test('both thread pages supply the counter destination and honour it', () => {
  for (const [rel, name] of [[COUPLE, 'couple'], [VENDOR, 'supplier']] as const) {
    const s = read(rel);
    assert.match(s, /counterHref=\{`\?compose=deal`\}/, `${name} page sends no counterHref`);
    assert.match(
      s,
      /initialMode=\{/,
      `${name} page does not open the composer on ?compose=deal, so the ` +
        'Counter-offer button lands on a page that looks unchanged',
    );
  }
});

test('the jump pills exist and cost no layout height', () => {
  const s = read(STREAM);
  assert.match(s, /Jump to the quote/, 'no way back to the quote from the conversation');
  assert.match(s, /Latest messages/, 'no way back to the newest message');
  // Absolute, or they take the very space this change exists to give back.
  // Both pills, counted — removing `absolute` from one left the other's match
  // satisfying a bare /absolute/ over the window.
  const pills = s.slice(s.indexOf('Jump to the quote') - 700, s.indexOf('Latest messages') + 300);
  const absolutes = pills.match(/className="absolute/g) ?? [];
  assert.equal(
    absolutes.length,
    2,
    `${absolutes.length} of 2 pills are absolutely positioned. One in flow costs ` +
      'back the very height this change exists to return to the conversation.',
  );
  // And they must be conditional: a pill that is always there is a pinned bar.
  assert.match(s, /quoteOffScreen && latestProposalId \?/);
  assert.match(s, /awayFromBottom \?/);
});
