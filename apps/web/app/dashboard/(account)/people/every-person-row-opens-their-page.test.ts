/**
 * every-person-row-opens-their-page.test.ts — every People row that is an ACCOUNT opens that account's
 * page; a row with no account stays plain text (owner 2026-10-25: "so why don't i see their user account
 * page?" · "i cannot click their names" · "i want to see the 3").
 *
 * Source-read, for the reason `people-redesign-holds.test.ts` gives (the views import `server-only` code).
 * Each anchor is per COMPONENT, so a door removed from one row cannot hide behind another row's door.
 *
 * ⚠ RUN IT BY GLOB — the path holds `(account)`: `tsx --test "app/**\/people/*.test.ts"`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const FOLLOW_VIEW = code('app/dashboard/(account)/people/_components/follow-list-view.tsx');
const ROSTER_VIEW = code('app/dashboard/(account)/people/_components/people-roster-view.tsx');
const FOLLOW_LIB = code('lib/people-follows.ts');
const ROSTER_LIB = code('lib/people-roster.ts');
const PROFILE_LIB = code('lib/public-profile.ts');
const U_PAGE = code('app/u/[userSlug]/page.tsx');

/** The body of one top-level `function Name(` in a file, up to the next top-level `function`. */
function component(src: string, name: string): string {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is gone — re-anchor this guard`);
  const next = src.indexOf('\nfunction ', start + 10);
  return src.slice(start, next < 0 ? undefined : next);
}

/** The row computes its door from `personPageHref`, and draws a <Link href={href}> when it has one. */
function opensTheirPage(body: string, where: string) {
  assert.match(body, /const href = (?:selectMode \? null : )?personPageHref\(/, `${where}: the row no longer asks personPageHref for the door`);
  assert.match(body, /<Link\s[^>]*href=\{href\}/, `${where}: no <Link href={href}> — the name is not a door`);
  // And the no-account branch exists: `href ?` choosing between the door and the plain row.
  assert.match(body, /\{href \?/, `${where}: no plain-text branch for a row with no account`);
}

test('Following / Followers: face · name · line is one door to their page', () => {
  opensTheirPage(component(FOLLOW_VIEW, 'FollowRowItem'), 'FollowRowItem');
});

test('the roster rows — labelled, no label yet, waiting for them — open their page', () => {
  const row = component(ROSTER_VIEW, 'PersonRow');
  opensTheirPage(row, 'PersonRow');
  // ONE row component draws all three states, and the door is not gated on the state.
  assert.doesNotMatch(row, /p\.state === '[a-z_]+'[^;\n]*personPageHref/, 'PersonRow gates the page link on a state');
  // ✎ Edit still opens the card.
  assert.match(row, /label="Edit"[^>]*onClick=\{onOpen\}/, 'PersonRow: Edit no longer opens the card');
});

test('Requests: the face and the sentence open their page', () => {
  const body = component(ROSTER_VIEW, 'RequestRow');
  assert.match(body, /const href = personPageHref\(p\)/, 'RequestRow no longer asks personPageHref');
  assert.match(body, /<Link\s[^>]*href=\{href\}/, 'RequestRow: the face is not a door');
  assert.ok((body.match(/<PersonNameLink href=\{href\}/g) ?? []).length >= 2, 'RequestRow: a request sentence is not a door');
});

test('the person card says "See … page" near the top', () => {
  const body = component(ROSTER_VIEW, 'PersonCard');
  assert.match(body, /const href = personPageHref\(p\)/);
  assert.match(body, /data-card-page-link/);
  assert.match(body, /See \{first\}’s page/);
  assert.ok(body.indexOf('data-card-page-link') < body.indexOf('What {first} is to you'), 'the page link sank below the label rows');
});

test('the rows carry the slug, from the same reads', () => {
  assert.match(FOLLOW_LIB, /slug: slugs\.get\(e\.other\)/);
  assert.match(ROSTER_LIB, /account:users!claimed_by_user_id\(public_id, slug\)/);
  assert.match(ROSTER_LIB, /slug: slugByPerson\.get\(otherId\)/);
});

test('/u resolves an account’s public handle, and a stranger still meets the gate', () => {
  assert.match(PROFILE_LIB, /\.eq\('public_id', /, 'the /u resolver no longer finds a slug-less account');
  assert.match(U_PAGE, /if \(!enabled && !isOwnerPreview && !isConnectionView\) notFound\(\)/, 'the dormant gate changed shape');
  assert.match(U_PAGE, /isConnectionView = !enabled && viewerKnowsThem\(viewer\)/);
  // The single-event jump is for strangers only.
  assert.match(U_PAGE, /if \(!viewerKnowsThem\(viewer\)\) redirect\(/);
});
