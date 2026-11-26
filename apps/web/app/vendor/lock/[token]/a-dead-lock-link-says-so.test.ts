/**
 * A6-26 · A6-B23 (final check 25 Nov) — a lock link the page cannot show says so in its own words: an unknown code is
 * "This Locked QR link is not valid." with what to do, a read that did not answer is "Couldn't read" with Try again.
 * Never the site-wide 404 (which made a real QR look fake).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const src = stripComments(readFileSync(join(__dirname, 'page.tsx'), 'utf8'));
const body = src.slice(src.indexOf('export default async function VendorLockPage'));

test('the lock page never answers with notFound()', () => {
  assert.doesNotMatch(body, /notFound\(\)/);
});

test('both reads bind their error and say an unread link, apart from an unknown one', () => {
  assert.match(body, /data: tok, error: tokError/);
  assert.match(body, /if \(tokError\) \{\s*logQueryError\([^)]*\);\s*return <LockLinkMessage kind="unread"/);
  assert.match(body, /if \(!tok\) return <LockLinkMessage kind="invalid"/);
  assert.match(body, /if \(vendorError\) \{\s*logQueryError\([^)]*\);\s*return <LockLinkMessage kind="unread"/);
  assert.match(body, /if \(!vendor\) return <LockLinkMessage kind="invalid"/);
});

test('the unknown-code words are the page’s own Locked QR words', () => {
  assert.match(body, /STATUS_COPY\.invalid/);
  assert.match(src, /invalid: 'This Locked QR link is not valid\.'/);
});
