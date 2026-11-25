/**
 * FINAL CHECK A1-081 · A1-082 (25 Nov 2026): a help link someone shares lands somewhere real.
 *
 * A1-082: an answer's topic breadcrumb (and its BreadcrumbList data) pointed at `/help#<topic>`, an anchor /help never
 * draws, so the tap landed at the top of /help. It opens the topic page now.
 * A1-081: a shared guide or topic link was a 404 for anyone signed out. It is a sign-in door that comes back.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { helpSignInDoor } from './help-place';
import { stripComments } from '../strip-comments';

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));

test('the sign-in door comes back to the same guide or topic', () => {
  assert.equal(helpSignInDoor('/help/guides/guests', {}), '/login?next=%2Fhelp%2Fguides%2Fguests');
  assert.equal(helpSignInDoor('/help/topics/shop', { for: 'shop' }), '/login?next=%2Fhelp%2Ftopics%2Fshop%3Ffor%3Dshop');
});

test('🔒 a signed-out reader of an account guide or topic is sent to sign in, not to a 404', () => {
  for (const rel of ['app/(shell)/(help-pages)/help/guides/[key]/page.tsx', 'app/(shell)/(help-pages)/help/topics/[key]/page.tsx']) {
    const src = read(rel);
    assert.match(src, /place\.coverage === 'public'[\s\S]{0,200}redirect\(helpSignInDoor\(/, `${rel} has no sign-in door`);
  }
});

test('🔒 the answer page never links to an anchor /help does not draw', () => {
  const src = read('app/help/[slug]/page.tsx');
  assert.doesNotMatch(src, /\/help#\$\{/, 'the breadcrumb still points at /help#<topic>');
  assert.match(src, /routes\.help\.topic\(topic\.key\)/);
});
