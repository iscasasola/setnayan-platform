/**
 * person-page-facts.test.ts — the walk's people findings on a person's page (13 Nov 2026):
 *   F-W3-04/10/29 · the page said "Someone on Setnayan" and printed `setnayan.com/u/S89U-…` as the address;
 *   F-W3-06       · a pending person's page had no Accept / Decline;
 *   F-W3-27       · "They confirmed your connection" carried no name.
 * The pure rules run here; the wiring is read from SOURCE (comment-stripped — a comment is not the wiring).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { confirmedByName, profileShownName, waitingOnMe } from './person-page-facts';
import { stripComments } from './strip-comments';

const WEB = join(import.meta.dirname, '..');
const src = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

test('F-W3-04 · the shown name: display name, else first + last, never a stand-in', () => {
  assert.equal(profileShownName({ display_name: 'Ice Casasola', first_name: 'X', last_name: 'Y' }), 'Ice Casasola');
  assert.equal(profileShownName({ display_name: null, first_name: 'Ana', last_name: 'Reyes' }), 'Ana Reyes');
  assert.equal(profileShownName({ display_name: '  ', first_name: 'Ana', last_name: '—' }), 'Ana');
  assert.equal(profileShownName({ display_name: '—', first_name: null, last_name: null }), null);
  assert.equal(profileShownName({ display_name: null, first_name: null, last_name: null }), null);
});

test('F-W3-06 · only a request FROM them TO you waits on your answer', () => {
  const mine = ['me1'];
  const theirs = ['them1'];
  const conns = [
    { connection_id: 'c-out', status: 'pending', from_person_id: 'me1', to_person_id: 'them1' },
    { connection_id: 'c-in', status: 'pending', from_person_id: 'them1', to_person_id: 'me1' },
  ];
  assert.equal(waitingOnMe(conns, mine, theirs), 'c-in');
  assert.equal(waitingOnMe([conns[0]!], mine, theirs), null, 'a request I sent is not mine to answer');
  assert.equal(waitingOnMe([{ ...conns[1]!, status: 'confirmed' }], mine, theirs), null);
});

test('F-W3-27 · the confirmation notice names the person who confirmed', () => {
  assert.equal(confirmedByName(null, { display_name: null, first_name: 'Ana', last_name: 'Reyes' }), 'Ana');
  assert.equal(confirmedByName('Miguel Santos', null), 'Miguel');
  assert.equal(confirmedByName('', null), 'They');
  const actions = src('app/dashboard/(account)/people/actions.ts');
  const confirm = actions.slice(actions.indexOf('export async function confirmConnection('), actions.indexOf('export async function declineConnection('));
  assert.match(confirm, /confirmedByName\(/, 'confirmConnection words its notice without the account name fallback');
  assert.match(confirm, /from\('users'\)\s*\.select\('display_name, first_name, last_name'\)/);
});

test('F-W3-04/06 · the person page: the shown name, no raw handle as the address, Accept · Decline wired', () => {
  const page = src('app/u/[userSlug]/page.tsx');
  assert.match(page, /profileShownName\(user\)/, 'the page names the person from display_name alone again');
  assert.doesNotMatch(page, /handle=\{`\$\{host\}\/u\/\$\{canonicalSlug\}`\}/, 'the address line prints /u/<handle> even with no slug (the S89U id)');
  assert.match(page, /handle=\{user\.slug \?/);
  assert.match(page, /viewer\?\.answerConnectionId \? <ConnectionAnswer/, 'no Accept / Decline on the page of somebody who asked you');
  const island = src('app/u/_components/connection-answer.tsx');
  assert.match(island, /confirmConnection\(connectionId/);
  assert.match(island, /declineConnection\(connectionId/);
  assert.match(src('lib/profile-viewer.ts'), /answerConnectionId = connected \? null : waitingOnMe\(/);
});
