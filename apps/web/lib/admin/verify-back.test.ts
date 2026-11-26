/** A8·E-9: a verify press lands back on the surface, tab and shop it came from. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '../strip-comments';
import { verifyBackHref } from './verify-back';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('keeps surface, status and shop; drops the old flash; adds the new one', () => {
  assert.equal(
    verifyBackHref('https://setnayan.com/admin/verify?surface=visibility&approved=1', { approved: '1' }),
    '/admin/verify?surface=visibility&approved=1',
  );
  assert.equal(
    verifyBackHref('https://setnayan.com/admin/verify?status=in_review&shop=abc-123&deep_search=1', { deep_search: '1' }),
    '/admin/verify?status=in_review&shop=abc-123&deep_search=1',
  );
  assert.equal(
    verifyBackHref('https://setnayan.com/admin/verify?status=in_review&archived=1', { reread: '1' }),
    '/admin/verify?status=in_review&reread=1',
  );
});

test('only a /admin/verify address is followed', () => {
  assert.equal(verifyBackHref('https://evil.example/admin/verify?surface=x', { approved: '1' }), '/admin/verify?surface=x&approved=1');
  assert.equal(verifyBackHref('https://setnayan.com/admin/work?surface=x', { approved: '1' }), '/admin/verify?approved=1');
  assert.equal(verifyBackHref(null, { approved: '1' }), '/admin/verify?approved=1');
  assert.equal(verifyBackHref('not a url ::', {}), '/admin/verify');
  assert.equal(verifyBackHref('https://setnayan.com/admin/verify?shop=%3Cscript%3E', { approved: '1' }), '/admin/verify?approved=1');
});

test('the verify actions land through verifyBackHref, never a bare flash address', () => {
  const src = stripComments(readFileSync(join(WEB, 'app/admin/verify/actions.ts'), 'utf8'));
  for (const flag of ['approved=1', 'archived=1', 'deep_search=1', 'reread=1', 'exp_verified=1']) {
    assert.doesNotMatch(src, new RegExp(`redirect\\('/admin/verify\\?${flag}'\\)`), `${flag} still lands on the bare page`);
  }
  assert.match(src, /verifyBack\(\{ saved: '1', msg: /, 'experience verified is said (FlashBanner never read exp_verified)');
});
