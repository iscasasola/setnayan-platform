/**
 * FINAL CHECK · area 1 · sign-up, the You card, public profiles (batch a1-a4-account, 25 Nov 2026).
 * Each test names the finding it holds.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { PASSWORD_RESET_WINDOW_MS, passwordResetWaitMessage } from './password-reset-limit';

const src = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));

test('A1-061 · /signup makes no promise that guest photos move to the new account', () => {
  assert.doesNotMatch(src('app/signup/page.tsx'), /Your event photos will be saved to your new account/);
});

test('A1-064 · the /signup description makes no speed claim', () => {
  assert.doesNotMatch(src('app/signup/page.tsx'), /in seconds/i);
});

test('A1-065 · the reset refusal names the limiter’s real wait', () => {
  assert.match(passwordResetWaitMessage(), /wait 15 minutes/);
  assert.equal(PASSWORD_RESET_WINDOW_MS, 15 * 60_000);
  assert.match(src('app/forgot-password/page.tsx'), /rate_limited: passwordResetWaitMessage\(\)/);
  assert.match(src('app/forgot-password/actions.ts'), /PER_EMAIL_WINDOW_MS = PASSWORD_RESET_WINDOW_MS/);
});

test('A1-062 · a refused You-card read is said, and a save without the saved row is refused', () => {
  const page = src('app/signup/you/page.tsx');
  assert.match(page, /if \(profileError\) \{[\s\S]{0,400}Couldn’t read your details/);
  assert.match(src('app/signup/you/actions.ts'), /if \(mineError\) backWithError\(/);
});

test('A1-063 · the consent box names no retired feature', () => {
  const card = src('app/signup/you/_components/you-card.tsx');
  assert.doesNotMatch(card, /realstories|Stories showcase/i);
});

test('A1-070 · every public-profile read throws when refused, never folds into "no profile" / "nothing public"', () => {
  const lib = src('lib/public-profile.ts');
  for (const what of ['users by slug', 'users by public id', 'event_members', 'events']) {
    assert.match(lib, new RegExp(`throw new PublicProfileReadError\\('${what}'`), `${what}: a refused read is folded again`);
  }
  assert.match(src('app/dashboard/(account)/profile/page.tsx'), /resolvePublicProfile\(currentSlug\)\.catch\(\(\) => null\)/);
});

test('A1-071 · the hidden-profile banner names the real path and links to it', () => {
  const page = src('app/u/[userSlug]/page.tsx');
  assert.doesNotMatch(page, /URL &amp; handle/);
  assert.match(page, /routes\.dashboard\.profile\.index\(\)\}#privacy/);
});

test('A1-072 · a refused follow is said and the button goes back to the truth', () => {
  const btn = src('app/u/_components/follow-button.tsx');
  assert.match(btn, /if \(!res\.ok\) \{[\s\S]{0,200}toast\.error\(/);
});

test('A1-073 · the chapter page names the person as /u does and claims no unmeasured Papic Memories', () => {
  const ch = src('app/u/[userSlug]/c/[chapterId]/page.tsx');
  assert.match(ch, /profileShownName\(user\) \?\? 'A Setnayan creator'/);
  assert.doesNotMatch(ch, /Papic Memories of candid photos/);
});

test('A1-005 · group chat refusals are loud and said', () => {
  const act = src('app/samahan/chat/actions.ts');
  assert.match(act, /throw new Error\('add refused'\)/);
  assert.match(act, /throw new Error\('leave refused'\)/);
  assert.match(act, /\?error=rejoin/);
  assert.match(act, /error=\$\{name\.trim\(\) \? 'refused' : 'name'\}/);
  const strip = src('app/_components/chat/chat-host-strip.tsx');
  assert.match(strip, /catch \{[\s\S]{0,160}setRefused\(true\);/);
  assert.match(strip, /They were not added just now\. Press Add to try again\./);
  assert.match(strip, /catch \{[\s\S]{0,160}setLeaveRefused\(true\);/);
  assert.match(strip, /You did not leave the chat just now\. Try again\./);
  assert.match(src('app/samahan/chat/[threadId]/page.tsx'), /rejoinFailed \? \(/);
});

test('A1-008 · group chat failed reads are not empty lists', () => {
  assert.match(src('app/samahan/chat/[threadId]/page.tsx'), /switcher=\{groups === null \? null : groups\.map/);
  const nw = src('app/samahan/chat/new/page.tsx');
  assert.match(nw, /if \(meError \|\| peopleRead === null\) \{/);
  assert.doesNotMatch(nw, /readGroupPeople\(supabase, eventId\)\) \?\? \[\]/);
  assert.doesNotMatch(src('app/_components/chat/chat-host-strip.tsx'), /Every host of this event is already in this chat/);
});

test('controller follow-ups on #8340 · the rejecting cases are said too', () => {
  const read = (rel: string) => stripComments(readFileSync(join(import.meta.dirname, '..', rel), 'utf8'));
  // A1-070: a refused profile read lands on the page's own boundary, with Try again.
  const boundary = read('app/u/error.tsx');
  assert.match(boundary, /Couldn’t read this profile/);
  assert.match(boundary, /router\.refresh\(\);\s*reset\(\);/);
  // A1-072: a thrown follow action (a dropped connection) is a refusal.
  assert.match(read('app/u/_components/follow-button.tsx'), /\.catch\(\s*\(\) => \(\{ ok: false, following: wasFollowing \}\)/);
  // A1-005: a rejoin refused as data is a refusal.
  assert.match(read('app/samahan/chat/actions.ts'), /if \(error \|\| \(data !== 'added' && data !== 'already'\)\) \{\s*logQueryError\('rejoinGroup/);
  // A1-008: the host check comes before the people read.
  const page = read('app/samahan/chat/new/page.tsx');
  assert.ok(page.indexOf("if (!meError && me !== 'host') notFound();") < page.indexOf('await readGroupPeople('), 'host check first');
});
