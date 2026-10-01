/**
 * ONE QR ON THE INVITATION (owner, 2026-09-21: "they serve the same purpose").
 *
 * The pass card on the page and the Me section's "My QR" pop-up showed the
 * SAME code. The card is the one (since 2026-09-30: the Digital ticket, on Me
 * — `guest-ticket.tsx`); the button now appears only when the card
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
  // 📱 The section is its own component now (`GuestMeSection`, owner
  // 2026-09-30: on a tabbed page it is the Me TAB, drawn by the page body), so
  // its one opener is the `onOpenQr` it is handed — GuestHubBar's own sheet,
  // directly or, from the page body, by event.
  const opens = me.split('onClick={onOpenQr}').length - 1;
  assert.equal(opens, 1, `exactly one My QR opener in the Me section (found ${opens})`);
  assert.match(hub, /onOpenQr=\{\(\) => setQrOpen\(true\)\}/, 'GuestHubBar hands the section its own sheet');
  assert.match(hub, /window\.addEventListener\(OPEN_MY_QR_EVENT, open\)/, 'the page-drawn section can still open the sheet');
  const before = me.slice(0, me.indexOf('onClick={onOpenQr}'));
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

test('the ticket carries the anchor the check looks for — and Home carries none', () => {
  // 2026-09-30: the pass left Home; the Digital ticket on Me (`GuestTicket`)
  // is the one QR a guest shows, so IT carries `#site-pass`. Every section it
  // can render carries the id — a state without it would make the check above
  // see "no ticket" and offer the duplicate My QR beside a ticket.
  const ticket = stripComments(readFileSync(join(HERE, 'guest-ticket.tsx'), 'utf8'));
  const sections = ticket.split('<section').length - 1;
  assert.ok(sections >= 2, 'precondition: the ticket and the declined line both render a section');
  assert.equal(ticket.split('id={PASS_ANCHOR}').length - 1, sections, 'a ticket state renders without #site-pass');
  assert.doesNotMatch(body, /PASS_ANCHOR/, 'Home carries a pass anchor again — two elements with one id');
});
