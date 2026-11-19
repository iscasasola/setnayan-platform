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
  // Bounded by the class string (no `"` and no backtick): unbounded, one match
  // ran from the Decisions floor across to the Files scroller and counted two as one.
  const floored = s.match(/min-h-\[\d+rem\][^"`]*flex-1[^"`]*overflow-y-auto/g) ?? [];
  assert.equal(
    floored.length,
    2,
    // Build 3 · lane B retired the Decisions view (open ones are the pins, closed ones Details › Decisions).
    `expected BOTH view scrollers to keep a floor (the conversation, ` +
      `and Files — 2026-09-19 gave Files one too); found ${floored.length}. The message list is the only flex-1 ` +
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
    // Since 2026-10-29 the row is the ONE thread frame both pages return (`ChatThreadFrame`): the page must return it,
    // and the row is read there (page + frame, so a page that bounds a second row of its own is still counted).
    assert.match(read(rel), /<ChatThreadFrame\b/, `${name}: the page does not return the one thread frame`);
    const s = read(rel) + read('app/_components/chat/chat-thread-frame.tsx');
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
    if (name === 'supplier') {
      // Named once as `composeDealHref`: relative on full screen, absolute inside the picked client, where a relative
      // `?compose=` lost `tab=chat` and landed on Details (supplier dashboard audit, 2026-11-17).
      assert.match(s, /counterHref=\{composeDealHref\}/, 'supplier page sends no counterHref');
      assert.match(s, /composeDealHref = embedded \? `\$\{supplierThreadPageHref\(threadId\)\}\?compose=deal` : `\?compose=deal`/);
    } else {
      assert.match(s, /counterHref=\{`\?compose=deal`\}/, `${name} page sends no counterHref`);
    }
    assert.match(
      s,
      /initialMode=\{/,
      `${name} page does not open the composer on ?compose=deal, so the ` +
        'Counter-offer button lands on a page that looks unchanged',
    );
  }
});

test('the jumps have their own row above the message box — and cost nothing when there is nowhere to jump', () => {
  /*
    ── EVOLVED 2026-11-16 (DECISION_LOG 2026-11-16 CHAT-09, owner "Yes, build it") ─────────────────────────────
    This test used to demand both pills be `absolute` over the scroller, so they cost no layout height. The ruling
    moves them OUT of the overlay: a pill floating over the first message covered words and pressed at ~26 px. They
    now share ONE 44 px row directly above the message box, in the thumb zone. The property this test exists for —
    the jumps never take height from the conversation for nothing — survives as: the row is drawn ONLY while a target
    is off screen (0 px at rest), and never while a poll or decision form is up.
    Sabotage (16 Nov): the `return null` guard dropped (the row always drawn) → RED; the pills put back `absolute`
    over the scroller → RED.
  */
  const s = read(STREAM);
  assert.match(s, /aria-label="Jump to the quote"/, 'no way back to the quote from the conversation');
  assert.match(s, /aria-label="Latest messages"/, 'no way back to the newest message');
  const at = s.indexOf('data-chat-jump-row=""');
  assert.ok(at > 0, 'the jumps have no row of their own');
  // The row comes after the conversation list closes — below the messages, the last thing above the message box.
  assert.ok(at > s.indexOf('</ol>'), 'the jump row is not below the messages');
  // ONE row holds both, and neither floats over the words any more.
  const block = s.slice(s.lastIndexOf('{(() => {', at), s.indexOf('})()}', at));
  assert.match(block, /aria-label="Jump to the quote"/, 'the quote jump left the row');
  assert.match(block, /aria-label="Latest messages"/, 'the latest jump left the row');
  assert.doesNotMatch(s, /className="absolute[^"]*"[^>]*>\s*📄 Jump to the quote|className="absolute[^"]*"[^>]*>\s*↓ Latest messages/, 'a pill floats over the messages again');
  // Any bare `absolute` in the row (its press halo is `after:absolute`, which floats nothing) puts a jump back over the words.
  assert.doesNotMatch(block, /(?<![\w:-])absolute\b/, 'a jump floats over the messages again');
  // 0 px at rest: the row is not drawn unless a target is off screen, and never under a rising form.
  assert.match(block, /const quoteJump = quoteOffScreen && latestProposalId !== null;/);
  assert.match(block, /const formUp = plusState\.draft != null && RISING_DRAFTS\.has\(plusState\.draft\.kind\);/);
  assert.match(block, /if \(formUp \|\| !\(quoteJump \|\| awayFromBottom\)\) return null;/, 'the row is drawn with nothing to jump to');
  assert.match(block, /\{quoteJump \? \(/);
  assert.match(block, /\{awayFromBottom \? \(/);
  // A 44 px row — the drawn height (`h-11`), never taller.
  assert.match(block, /className="flex h-11 shrink-0 [^"]*" data-chat-jump-row=""/);
});
