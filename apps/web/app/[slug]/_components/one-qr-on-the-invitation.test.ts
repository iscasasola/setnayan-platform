/**
 * ONE QR ON THE INVITATION (owner, 2026-09-21: "they serve the same purpose").
 *
 * The pass card on the page and the Me section's "My QR" pop-up showed the
 * SAME code. The card is the one; the button now appears only when the card
 * is not on the page — because the couple can hide the card, and then the
 * button is the guest's only QR. Both halves are pinned: the duplicate must
 * not return, and the fallback must not disappear.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const HERE = __dirname;
const hub = stripComments(readFileSync(join(HERE, 'guest-hub-bar.tsx'), 'utf8'));
const body = stripComments(readFileSync(join(HERE, 'site-body.tsx'), 'utf8'));

function meSection(): string {
  const start = hub.indexOf('id="site-me"');
  assert.ok(start > 0, 'precondition: the Me section exists');
  const end = hub.indexOf('</section>', start);
  assert.ok(end > start, 'precondition: the Me section closes');
  return hub.slice(start, end);
}

test('the Me section offers My QR only when the pass card is missing', () => {
  const me = meSection();
  const opens = me.split('setQrOpen(true)').length - 1;
  assert.equal(opens, 1, `exactly one My QR opener in the Me section (found ${opens})`);
  const before = me.slice(0, me.indexOf('setQrOpen(true)'));
  assert.match(
    before,
    /\{passOnPage \? null : \(\s*<button/,
    'the My QR button must sit behind `passOnPage ? null`, or it duplicates the pass card',
  );
});

test('"is the card on the page" is asked of the page, by the pass anchor', () => {
  assert.match(hub, /document\.getElementById\(PASS_ANCHOR\) !== null/);
  assert.match(hub, /import \{ PASS_ANCHOR \} from '@\/lib\/arrival-action'/);
  // Starts hidden, so the duplicate never flashes before the check runs.
  assert.match(hub, /useState\(true\)/);
});

test('the pass card carries the anchor the check looks for', () => {
  const card = body.slice(body.indexOf('const passCard'));
  assert.ok(card.length > 0, 'precondition: the pass card exists');
  assert.match(card.slice(0, 400), /id=\{PASS_ANCHOR\}/, 'the card must carry #site-pass');
});
