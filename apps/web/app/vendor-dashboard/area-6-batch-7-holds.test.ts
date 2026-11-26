/**
 * Final check 25 Nov, area 6, batch 7 — A6-48 (the Headcount card counts on the hosts' basis; the SQL half is
 * tests/db/the-brief-says-how-the-hosts-count) and A6-B21 (the Recaps forward lands on #share).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { briefHeadcount, headcountBasisWords } from '@/lib/brief-headcount';

const read = (rel: string) => stripComments(readFileSync(join(__dirname, '../..', rel), 'utf8'));
const PAX = { invited: 10, attending: 4, maybe: 3, pending: 2, declined: 1 };

test('A6-48 · the count follows the hosts’ basis, through the one reader', () => {
  assert.equal(briefHeadcount({ ...PAX, headcount_basis: 'attending' }), 4);
  assert.equal(briefHeadcount({ ...PAX, headcount_basis: 'attending_plus_maybe' }), 7);
  assert.equal(briefHeadcount({ ...PAX, headcount_basis: 'invited' }), 9);
  assert.equal(briefHeadcount(PAX), 4, 'an older brief without the basis reads the owner-locked default');
  assert.equal(headcountBasisWords('attending_plus_maybe'), 'coming or maybe');
  assert.equal(headcountBasisWords('invited'), 'invited, not declined');
  assert.equal(headcountBasisWords(null), 'coming');
});

test('A6-48 · the client page’s Headcount card draws that count and its words, never a hand-picked "attending"', () => {
  const src = read('app/vendor-dashboard/clients/[eventId]/page.tsx');
  assert.match(src, /\{formatCount\(briefHeadcount\(brief\.pax\)\)\}/);
  assert.match(src, /\{headcountBasisWords\(brief\.pax\.headcount_basis\)\} of \{formatCount\(brief\.pax\.invited\)\} invited/);
  assert.doesNotMatch(src, /attending of \{brief\.pax\.invited\} invited/);
});

test('A6-B21 · the share section lands its own #share in view', () => {
  const share = read('app/vendor-dashboard/shop/promote/_components/share-your-work.tsx');
  assert.match(share, /<section id="share"[^>]*>[\s\S]{0,120}?<LandsAtHash id="share" \/>/);
  const lands = read('app/_components/lands-at-hash.tsx');
  assert.match(lands, /window\.location\.hash !== `#\$\{id\}`/);
  assert.match(lands, /document\.getElementById\(id\)\?\.scrollIntoView\(\{ block: 'start' \}\)/);
  assert.match(lands, /addEventListener\('hashchange', apply\)/);
  assert.match(read('app/vendor-dashboard/recaps/page.tsx'), /redirect\('\/vendor-dashboard\/shop\/promote#share'\)/);
});
