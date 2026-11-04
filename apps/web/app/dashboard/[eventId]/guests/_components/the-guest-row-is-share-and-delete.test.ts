/**
 * the-guest-row-is-share-and-delete.test.ts — 🗂 A GUEST ROW CARRIES SHARE AND DELETE, AND NOTHING ELSE
 * (owner 2026-10-27, DECISION_LOG "GUEST ROW = SHARE + DELETE; THE PENCIL GOES (tapping the row opens the card)":
 * *"we can now have edit, share and delete? will this fit on screens?"* → *"okay that makes more sense. share and
 * delete only"*) — and since 2026-11-03 ("SWIPE LEFT TO DELETE ON EVERY LIST ROW — NO VISIBLE ✕ ON ROWS") Delete is
 * BEHIND the row: its swipe on a phone, its hover Delete on a computer (`SwipeToDelete`), the same `onRemove`.
 *
 * The PROPERTIES, measured on what renders and on what the press reaches — not on a phrasing:
 *   1. EXECUTED — `rowVerbsFor` gives a guest with their own link exactly Share · Delete; without one, Delete alone;
 *      the couple nothing; a +1 with no name only Release seat (they ride on their guest's invitation — never Share).
 *   2. RENDERED — the REAL screen over real rows: a guest's row shows EXACTLY one button, "Share <name>’s
 *      invitation"; "Delete <name>" is the row's swipe (and hover) Delete; no Edit, no Message; the row still opens
 *      the card (its name is a button).
 *   3. ONE SENDER — the row's Share is the shipped `GuestInviteCell` (the card's Invite) drawn as one icon: its press
 *      reaches `shareInvite` (the one share) and, where there is no share sheet, the cell's own sheet — never a new
 *      `navigator.share` call of its own.
 *   4. THE PAGE — hands Share only for guests the send run would hold (`mayBeInvited`) and never to a look-only viewer.
 *
 * SABOTAGE (seen RED, then restored, 2026-10-28; 2026-11-03): the pencil put back in the row (`label="Edit"`) → tests 2 + 3 red ·
 * the visible Delete put back in the buttons span → tests 2 + 3 red ·
 * `rowVerbsFor` giving a seat Share → test 1 red · the page dropping `mayBeInvited` from the tokens → test 4 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { rowVerbsFor } from '@/lib/guest-roster-view';
import { guestRow, renderGuestsScreen } from './render-guests-screen';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCREEN = stripComments(readFileSync(join(HERE, 'guests-screen.tsx'), 'utf8'));
const CELL = stripComments(readFileSync(join(HERE, 'guest-invite-cell.tsx'), 'utf8'));
const PAGE = stripComments(readFileSync(join(HERE, '..', 'page.tsx'), 'utf8'));

test('1 · EXECUTED: Share · Delete for a guest with a link; Delete alone without; nothing for the couple; a seat only Release', () => {
  assert.deepEqual(rowVerbsFor({ role: 'guest' }, { shareable: true }), ['share', 'remove']);
  assert.deepEqual(rowVerbsFor({ role: 'guest' }, { shareable: false }), ['remove']);
  assert.deepEqual(rowVerbsFor({ role: 'bride' }, { shareable: false }), []);
  assert.deepEqual(rowVerbsFor({ role: 'groom' }, { shareable: false }), []);
  const seat = { role: 'guest' as const, guest_id: 'h-1', first_name: 'TBA', last_name: '+1', plus_one_of_guest_id: 'h', plus_one_name_confirmed_at: null };
  assert.deepEqual(rowVerbsFor(seat as never, { shareable: true }), ['release'], 'a +1 with no name is offered Share — they ride on their guest');
});

/** Every `<button …>` / `<a …>` inside the row's buttons span, by its aria-label. */
function rowButtons(html: string, guestId: string): string[] {
  const at = html.indexOf(`data-guest-id="${guestId}"`);
  assert.ok(at > 0, `row ${guestId} not drawn`);
  const acts = html.indexOf('data-row-acts=""', at);
  const next = html.indexOf('data-guest-row=""', at + 1);
  assert.ok(acts > 0 && (next < 0 || acts < next), `row ${guestId} draws no buttons span`);
  // The row ends at the next row, or — for a section's last row — where its section closes.
  const sectionEnd = html.indexOf('</section>', acts);
  // …or where its swipe's own Delete begins (the row's hover Delete, or the next row's swipe).
  const swipeEnd = [html.indexOf('data-swipe-hover-delete', acts), html.indexOf('data-swipe-row', acts)]
    .filter((i) => i > 0)
    .map((i) => html.lastIndexOf('<', i)); // from the start of that tag
  const end = Math.min(next < 0 ? html.length : next, sectionEnd < 0 ? html.length : sectionEnd, ...swipeEnd);
  const chunk = html.slice(acts, end);
  return [...chunk.matchAll(/<(?:button|a)\b[^>]*aria-label="([^"]+)"/g)].map((m) => m[1]!);
}

test('2 · RENDERED: a guest row shows Share alone, Delete is its swipe — no Edit, no Message — and still opens the card', async () => {
  const ana = guestRow({ guest_id: 'ana', first_name: 'Ana', last_name: 'Cruz', invitation_sent_at: null });
  const ben = guestRow({ guest_id: 'ben', first_name: 'Ben', last_name: 'Lim' });
  const html = await renderGuestsScreen({
    guests: [ana, ben],
    initialQuery: '',
    invite: { base: 'https://setnayan.com/x', tokens: { ana: 'tok-a' }, facts: {}, template: null },
  });
  assert.deepEqual(rowButtons(html, 'ana'), ['Share Ana Cruz’s invitation'], 'Ana’s row is not exactly Share');
  // No token handed in for Ben → no Share at all.
  assert.deepEqual(rowButtons(html, 'ben'), [], 'Ben’s row draws Share with no link of his own');
  // 👈 Delete is each row's swipe (and hover) Delete — named for its guest, never a visible button on the row.
  for (const who of ['Ana Cruz', 'Ben Lim']) {
    assert.match(html, new RegExp(`<button[^>]*aria-label="Delete ${who}"[^>]*data-swipe-delete=""`), `${who}’s row has no swipe Delete`);
    assert.match(html, new RegExp(`<button[^>]*aria-label="Delete ${who}"[^>]*data-swipe-hover-delete=""`), `${who}’s row has no hover Delete`);
  }
  assert.doesNotMatch(html, /aria-label="(Edit|Message) /, 'a row draws Edit or Message again');
  // The row itself is the way into the card.
  assert.match(html, /aria-label="Open Ana Cruz"/, 'the row no longer opens the card');
});

test('3 · ONE SENDER: Share is the shipped Invite cell as one icon; its press reaches the one share, never a new one', () => {
  const row = SCREEN.slice(SCREEN.indexOf('function GuestRowLine('));
  const acts = row.slice(row.indexOf('className={styles.acts}'));
  const body = acts.slice(0, acts.indexOf('</span>'));
  assert.doesNotMatch(body, /\bPencil\b|label="Edit"|MessageCircle|label="Message"/, 'the pencil or Message is back on the row');
  assert.match(body, /verbs\.includes\('share'\) && share \? \(\s*<GuestInviteCell\b[^>]*layout="icon"/, 'Share is not the shipped Invite cell');
  // Exactly one control on the row: the cell. Delete / Release seat are the row's swipe — the same handlers.
  assert.equal((body.match(/<GuestInviteCell\b/g) ?? []).length, 1);
  assert.equal((body.match(/<ActionButton\b/g) ?? []).length, 0, 'a visible Delete is back on the row (owner 2026-11-03: swipe)');
  const swipe = row.slice(row.indexOf('<SwipeToDelete'));
  assert.ok(swipe.length > 0 && row.indexOf('<SwipeToDelete') > 0, 'the row has no swipe');
  assert.match(swipe, /onDelete=\{del === 'remove' \? onRemove : onRelease\}/, 'the swipe is not the shipped remove / release');
  assert.match(swipe, /label=\{del === 'remove' \? `Delete \$\{name\}` : `Release seat \$\{name\}`\}/, 'the swipe is not named for its guest');

  const icon = CELL.slice(CELL.indexOf("if (layout === 'icon') {"));
  assert.ok(icon.length > 100, "the cell's icon layout is gone");
  assert.match(icon.slice(0, icon.indexOf('</ActionButton>') > 0 ? icon.indexOf('</ActionButton>') : 600), /onClick=\{\(\) => void rowShare\(\)\}/);
  const rowShare = CELL.slice(CELL.indexOf('async function rowShare('));
  const fn = rowShare.slice(0, rowShare.indexOf('\n  }\n'));
  assert.match(fn, /await shareInvite\(null, message\)/, 'the row does not share through the one shareInvite');
  // (`at` — the card's ticket-row Share may be pressed from its pinned copy in the panel's head; the row's is 'body'.)
  assert.match(fn, /invite\(at\)/, 'a computer gets no sheet');
  assert.match(CELL, /async function rowShare\(at: 'body' \| 'head' = 'body'\)/);
  // Nothing in the cell calls the share sheet itself — `shareInvite` (send-invite.tsx) is the one caller.
  assert.doesNotMatch(CELL, /\bnav(?:igator)?\.share\(/, 'the cell calls navigator.share itself — a second sender');
});

test('4 · THE PAGE: Share only for guests the run would hold, never for a look-only viewer', () => {
  const at = PAGE.indexOf('const rowInvite');
  assert.ok(at > 0, 'the page hands the rows no Share');
  const block = PAGE.slice(at, PAGE.indexOf('const guestsScreen', at));
  assert.match(block, /!guestsViewOnly && invitationBase/, 'a look-only viewer is handed Share');
  assert.match(block, /mayBeInvited\(g\)/, 'tokens are handed for guests the run would never hold');
  assert.match(PAGE, /invite=\{rowInvite\}/);
});
