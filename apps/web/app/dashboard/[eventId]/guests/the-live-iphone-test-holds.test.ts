/**
 * GUARD — the five Guests-page faults the owner hit in his LIVE iPhone test on
 * prod 5666406 (2026-10-02). Each test holds a PROPERTY of the fix, so a reword
 * walks past nothing and a revert turns it red.
 *
 *   ① "Add a guest": tapping + did nothing; only Enter added.
 *   ② "Test Guest A" landed as First Test · Middle Guest · Last A, and the list
 *      read "Test A" — and the quick list split names its own way.
 *   ③ The guest card took ~7–8 s to open and its right side was clipped at 390.
 *   ④ No way to copy a guest's personal invitation link.
 *   ⑤ The list got STUCK in select mode: no Done after unticking, the boxes
 *      stayed, a tap only ticked, and a reload redrew it.
 *
 * 🛡 Sabotaged once (see the PR): restoring `selectedIds.length > 0 ? (` as the
 * bulk bar's only condition turns ⑤ red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { parsePersonName } from '@/lib/person-name-parse';
import { parseGuestInput } from '@/lib/guest-parse';
import { buildInvitationUrl } from '@/lib/qr';
import { invitationLinkOn } from '@/lib/invitation-link';
import { guestSelection, readGuestSelection } from './_components/guest-selection-store';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..');
const read = (...p: string[]) => stripComments(readFileSync(join(HERE, ...p), 'utf8'));
const readWeb = (...p: string[]) => stripComments(readFileSync(join(WEB, ...p), 'utf8'));

/** The body of a named function (walks past its parameters first). */
function bodyOf(src: string, name: string): string {
  const at = src.search(new RegExp(`(?:function|const) ${name}\\b`));
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

// ── ① the + adds ────────────────────────────────────────────────────────────
test('① the + inside the add box is a button that runs the SAME submit as Enter', () => {
  const bar = read('_components', 'capture-bar.tsx');
  const plus = bar.match(/<button\b[\s\S]*?data-capture-add=""[\s\S]*?<\/button>/);
  assert.ok(plus, 'the + inside the add box is not a button');
  assert.match(plus[0], /onClick=\{submitAdd\}/, 'the + does not run the add');
  assert.match(plus[0], /<Plus\b/, 'the + button lost its + mark');
  assert.match(bodyOf(bar, 'CaptureBar'), /e\.key === 'Enter'[\s\S]{0,80}submitAdd\(\)/, 'Enter no longer runs the same add');
  assert.doesNotMatch(bar, /<Plus\b[^>]*pointer-events-none/, 'a + that taps through to nothing is back');
});

// ── ② one sensible split, in one place ──────────────────────────────────────
test('② the live-test line: last word is the last name, the rest is the first, no guessed middle', () => {
  const p = parsePersonName('Test Guest A');
  assert.deepEqual([p.firstName, p.middleName, p.lastName], ['Test Guest', '', 'A']);
  const d = parseGuestInput('Test Guest A');
  assert.deepEqual([d.firstName, d.middleName, d.lastName], ['Test Guest', '', 'A'], 'quick add splits differently from the shared parser');
  // A typed initial is the host marking a middle name themselves — kept.
  assert.equal(parsePersonName('Arnaldo M. Espinas').middleName, 'M.');
});

test('② every add path splits a typed name with the ONE shared parser', () => {
  // Quick add (the capture bar), the import, the quick list's edit AND its
  // server action — no "first word + the rest" left anywhere on these paths.
  assert.match(readWeb('lib', 'guest-parse.ts'), /parsePersonName\(/);
  assert.match(readWeb('lib', 'guest-import-file.ts'), /parsePersonName\(/);
  const list = read('quick', '_components', 'quick-add-list.tsx');
  assert.match(bodyOf(list, 'commitEdit'), /parsePersonName\(/, 'the quick list edits a name with its own split');
  assert.doesNotMatch(list, /slice\(1\)\.join\(' '\)/, 'the quick list still splits "first word + the rest"');
  assert.match(bodyOf(read('quick', 'actions.ts'), 'bulkAddGuests'), /parsePersonName\(/, 'the quick list saves names unsplit');
});

// ── ③ the card opens fast and fits 390 ──────────────────────────────────────
test('③ a row on a sheet surface never prefetches the standalone guest page', () => {
  const inspector = readWeb('app', '_components', 'inspector', 'inspector-column.tsx');
  const trigger = bodyOf(inspector, 'InspectorTrigger');
  assert.match(trigger, /prefetch=\{ctx\?\.sheet \? false : undefined\}/,
    'every guest row on screen prefetches /guests/<id> again — ~40 server renders per list open');
  // …and the sheet says it is opening instead of sitting blank.
  assert.match(bodyOf(inspector, 'InspectorSheet'), /children \?\?/, 'the sheet is blank until the card arrives');
});

test('③ the card’s reads leave together, and start beside the roster’s', () => {
  const data = read('_components', 'guest-card-data.ts');
  const loader = bodyOf(data, 'loadGuestCard');
  // 15 waits on 2026-10-02 (each read behind the last); now three steps — the
  // batch, the access pair, the linked account — plus the two awaits INSIDE the
  // access pair's own lambdas, which run side by side.
  const awaits = (loader.match(/\bawait\b/g) ?? []).length;
  assert.ok(awaits <= 5, `loadGuestCard waits ${awaits} times — its independent reads are queued again`);
  assert.match(loader, /\] = await Promise\.all\(\[\s*fetchGuestById\(/, 'the guest row is read on its own before the rest again');
  const page = read('page.tsx');
  const cardAt = page.indexOf('loadGuestCard(');
  const rosterAt = page.indexOf('fetchGuestsByEventMeasured(');
  assert.ok(cardAt > 0 && rosterAt > 0 && cardAt < rosterAt, 'the open card waits for the whole roster before it starts');
});

test('③ inside the phone sheet the card is the sheet’s width, not the desktop rail’s', () => {
  const css = readFileSync(join(WEB, 'app', 'globals.css'), 'utf8');
  const rule = css.match(/\.sn-inspector-sheet \.sn-inspector-panel \{([^}]*)\}/);
  assert.ok(rule, 'the panel inside the sheet keeps the rail’s clamp(340px…) width — it overflows a 390 phone');
  assert.match(rule[1] ?? "", /width:\s*auto/);
  assert.match(rule[1] ?? "", /max-width:\s*100%/);
  assert.match(rule[1] ?? "", /position:\s*static/);
  // The card's Invite keeps its wide floor only where there is room for it.
  const cell = read('_components', 'guest-invite-cell.tsx');
  assert.doesNotMatch(cell, /(?<!sm:)min-w-\[132px\]/, 'the card’s Invite forces 132 px on a phone');
});

// ── ④ Copy invitation link ──────────────────────────────────────────────────
test('④ the Invite sheet offers Copy invitation link beside the share, on a phone AND a computer', () => {
  const cell = read('_components', 'guest-invite-cell.tsx');
  const body = bodyOf(cell, 'GuestInviteCell');
  assert.match(body, /data-guest-invite-copy-link=""/, 'no Copy invitation link in the Invite sheet');
  assert.match(body, /Copy invitation link/);
  // Drawn in BOTH shapes of the sheet: right after the phone's share, and with the computer's steps.
  const uses = (body.match(/\{copyLinkRow\}/g) ?? []).length;
  assert.equal(uses, 2, `Copy invitation link is drawn in ${uses} of the sheet's two shapes`);
  assert.match(body, /data-guest-invite-share=""[\s\S]{0,400}\{copyLinkRow\}/, 'the phone’s copy-link is not beside its share');
  // On a phone Invite OPENS the sheet; the share is a row inside it.
  assert.doesNotMatch(bodyOf(cell, 'invite'), /shareInvite\(/, 'a phone’s Invite jumps past the sheet again — no room for Copy link');
  // ONE action: it copies the link the row/card was handed, and a copy is not a send.
  const copy = bodyOf(cell, 'copyLink');
  assert.match(copy, /clipboard\.writeText\(link\)/);
  assert.match(copy, /guest\.inviteUrl/);
  assert.doesNotMatch(copy, /\bmark\(/, 'copying the link stamps Sent — a copy is not a send');
});

test('④ the copied link is spelled by the one speller buildInvitationUrl ends in', () => {
  // Behaviour: the base + token gives exactly what buildInvitationUrl gives.
  const appUrl = 'https://www.setnayan.com';
  const base = buildInvitationUrl({ appUrl, slug: 'ana-and-ben', qrToken: 'TOKEN' }).replace(/\?invite=TOKEN$/, '');
  assert.equal(invitationLinkOn(base, 'TOKEN'), buildInvitationUrl({ appUrl, slug: 'ana-and-ben', qrToken: 'TOKEN' }));
  assert.match(bodyOf(readWeb('lib', 'qr.ts'), 'buildInvitationUrl'), /invitationLinkOn\(/, 'buildInvitationUrl spells the link itself again');
  // Property: nothing on the Guests pages hand-spells `?invite=<token>`.
  for (const f of [
    ['_components', 'guest-card-body.tsx'],
    ['send', 'page.tsx'],
    ['claims', 'page.tsx'],
  ]) {
    const src = read(...f);
    assert.doesNotMatch(src, /\?invite=\$\{[^}]*token/, `${f.join('/')} hand-spells a guest's invitation link`);
    assert.match(src, /invitationLinkOn\(/, `${f.join('/')} no longer builds the link with invitationLinkOn`);
  }
});

// ── ⑤ select mode always has a way out ──────────────────────────────────────
test('⑤ unticking the last guest leaves select mode; entering on purpose does not', () => {
  const s = readGuestSelection;
  guestSelection.exit();
  guestSelection.enter();
  assert.equal(s().selectMode, true, 'a long press no longer enters select mode');
  guestSelection.toggle('a');
  guestSelection.toggle('b');
  guestSelection.toggle('a');
  assert.equal(s().selectMode, true, 'unticking one of two left select mode');
  guestSelection.toggle('b');
  assert.equal(s().selectMode, false, 'unticking the last guest leaves the list stuck in select mode');
  guestSelection.enter();
  guestSelection.toggle('a');
  guestSelection.clear();
  assert.equal(s().selectMode, false, 'Clear leaves the list in select mode with no bar');
  guestSelection.enter();
  guestSelection.toggle('a');
  guestSelection.setAll([]);
  assert.equal(s().selectMode, false, 'a finished bulk action leaves the list in select mode');
  guestSelection.exit();
});

test('⑤ a page mid-selection is never kept as last-seen, and a reload never redraws select mode', () => {
  const list = read('_components', 'guests-screen.tsx');
  // The last-seen copy is never taken mid-selection.
  assert.match(list, /data-last-seen-hold=\{selectMode \? '' : undefined\}/, 'the screen no longer holds the last-seen capture while selecting');
  const snap = bodyOf(readWeb('lib', 'last-seen', 'snapshot-dom.ts'), 'snapshotFromRoot');
  const holdAt = snap.search(/querySelector\('\[data-last-seen-hold\]'\)\)\s*return null/);
  assert.ok(holdAt > 0 && holdAt < snap.indexOf('cloneNode('), 'a page mid-selection is still kept as last-seen');
});
