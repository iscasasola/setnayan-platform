/**
 * GUARD — the Guest list's Invite column is the card's Send invite, on every
 * guest row, with instructions (owner 2026-09-30: *"the personal QR is found on
 * the guest list. and we would want the table to have that column to copy a
 * message with the link and the photo with it. and instructions on how to use
 * it"*).
 *
 * What it holds, each as a property of the source rather than a phrasing:
 *   (2026-10-09: the roster's table/phone rows and their Invite column went with
 *   the retired GuestListMultiselect, and the two tests that pinned them with
 *   it. The cell itself is still the card's Invite control, so the rest holds.)
 *   3. It is NOT a second sender. The cell (`guest-invite-cell.tsx`, its own
 *      file only to stay out of the Maker's first load) imports and goes
 *      through the SAME share (`shareInvite`), the same Digital ticket file (`useTicketFile`),
 *      the same message builder and the ONE Sent ✓ writer — and the card's
 *      `SendInviteActions` goes through that same `shareInvite`, so the two
 *      cannot drift into sending different things.
 *   4. The page reads the event's words once and hands them to the list, and
 *      mounts the first-visit tour through the shipped `MiniTour`.
 *   5. No "email" anywhere a couple reads it — Setnayan sends guests nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { TOURS, TOUR_KEYS } from '@/lib/tours';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));
const SEND = read('send-invite.tsx');
const CELL = read('guest-invite-cell.tsx');
const PAGE = read('..', 'page.tsx');

/** The BODY of a named function (walks past the destructured params first). */
function bodyOf(src: string, name: string): string {
  const at = src.indexOf(`function ${name}(`);
  assert.notEqual(at, -1, `${name} is gone — this guard is pinning a ghost`);
  let parens = 0;
  let afterParams = -1;
  for (let i = src.indexOf('(', at); i < src.length; i += 1) {
    if (src[i] === '(') parens += 1;
    else if (src[i] === ')' && --parens === 0) {
      afterParams = i;
      break;
    }
  }
  const open = src.indexOf('{', afterParams);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error(`unbalanced braces in ${name}`);
}

test('the cell is the card’s Send invite in a row’s width, not a second sender', () => {
  // Its deciding pieces come FROM send-invite.tsx — the column only draws.
  assert.match(CELL, /import \{[^}]*\bshareInvite\b[^}]*\buseTicketFile\b[^}]*\} from '\.\/send-invite';/);
  assert.doesNotMatch(CELL, /\bnav(igator)?\.share\(/, 'the column calls the share sheet itself instead of shareInvite');
  const cell = bodyOf(CELL, 'GuestInviteCell');
  for (const piece of ['shareInvite(', 'useTicketFile(', 'buildGuestInviteMessage(', 'setGuestInvitationSent(', 'copyTicketImage(']) {
    assert.ok(cell.includes(piece), `GuestInviteCell no longer calls ${piece} — it has grown its own path`);
  }
  // …and the card goes through the SAME share, so the two cannot send different things.
  assert.ok(bodyOf(SEND, 'SendInviteActions').includes('shareInvite('), 'the card’s Send invite has its own share again');
  assert.equal((SEND.match(/\bnav\.share\(/g) ?? []).length, 1, 'more than one navigator.share call in send-invite.tsx');
});

test('the column stays OUT of send-invite.tsx, which the Maker loads first', () => {
  // launch/page.tsx → guests/claims/page.tsx → SendInviteActions puts
  // send-invite.tsx in the Maker's first load, under a measured JS ceiling.
  assert.doesNotMatch(SEND, /function GuestInviteCell\(|from '\.\/overlay-primitives'|from '\.\/guest-invite-cell'/,
    'the Guest list’s column moved back into send-invite.tsx — the Maker pays for it');
});

test('the page reads the words once, hands them to the card, and mounts the tour', () => {
  assert.equal((PAGE.match(/loadInviteSetup\(/g) ?? []).length, 1, 'the page reads the event’s words more than once');
  // ⤷ Maker PR 4f (G34, owner: *"so again. you still kept the invite here. how
  // do we invite?"*): the LIST has no per-row Invite any more — one way to
  // invite, the run. The open CARD is still handed the words for its Send.
  assert.doesNotMatch(PAGE, /<GuestsScreen[^>]*\binvite=\{/, 'the list is handed an Invite setup again — a per-row Invite is back');
  assert.match(PAGE, /inviteSetup=\{inspectedInviteSetup\}/, 'the card is not handed the Invite setup');
  assert.match(PAGE, /<MiniTour tourKey="customer_guest_invite_v1" \/>/, 'the Invite tour is not mounted on the Guest list');
  assert.ok(TOUR_KEYS.includes('customer_guest_invite_v1'), 'the tour key is not registered');
  const n = TOURS.customer_guest_invite_v1.slides.length;
  assert.ok(n >= 3 && n <= 4, `the Invite tour has ${n} slides — the brief is 3–4 short ones`);
});

test('the column hands over the Digital ticket, not the QR — and says so', () => {
  // Owner 2026-09-30: "we do not copy the QR Code, we copy the Digital Ticket".
  const cell = bodyOf(CELL, 'GuestInviteCell');
  assert.match(cell, /Copy ticket/);
  assert.match(cell, /Paste the message, then paste the ticket in the chat\./);
  assert.doesNotMatch(cell, /Copy QR|paste the QR/);
  const tour = TOURS.customer_guest_invite_v1.slides.map((s) => `${s.title} ${s.body}`).join(' ');
  assert.match(tour, /ticket/);
  assert.doesNotMatch(tour, /\bQR\b/);
});

test('nothing a couple reads says "email" — Setnayan sends guests nothing', () => {
  const tour = TOURS.customer_guest_invite_v1.slides.map((s) => `${s.title} ${s.body}`).join(' ');
  assert.doesNotMatch(tour, /e-?mail/i);
  const strings = [...bodyOf(CELL, 'GuestInviteCell').matchAll(/>([^<>{}]+)</g)].map((m) => m[1]).join(' ');
  assert.doesNotMatch(strings, /e-?mail/i);
});
