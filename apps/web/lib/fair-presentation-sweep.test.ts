/**
 * 🚫 THE ONE SWEEP (owner 2026-11-08): live names that need an edit are listed with the ruled sentence and a door;
 * drafts are not swept; nothing is ever taken down (the sweep is a read — it has no write to make).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { fairSweepItems } from './fair-presentation-sweep';

const WORDS = [{ phrase: 'best', why: 'w' }];

test('the reported live card "Best mobile bar" gets its "Edit your name" row, with the ruled sentence and its door', () => {
  const items = fairSweepItems(
    { shopName: 'Rondo Musical', tagline: null, cards: [{ id: 'c1', title: 'Best mobile bar', live: true }], packages: [] },
    WORDS,
  );
  assert.equal(items.length, 1);
  assert.equal(items[0]!.href, '/vendor-dashboard/services/c1');
  assert.equal(
    items[0]!.line,
    'One of your cards needs a quick edit to meet our fair-presentation standard: reword “best”. It stays visible while you fix it.',
  );
});

test('shop name, tagline, cards and bundles are each swept; drafts and fine names are not', () => {
  const items = fairSweepItems(
    {
      shopName: 'Best Lights 🔥',
      tagline: 'Only 2 slots left!!',
      cards: [
        { id: 'c1', title: 'Classic Booth', live: true },
        { id: 'c2', title: 'Best draft', live: false },
        { id: 'c3', title: 'Classic booth', live: true },
      ],
      packages: [
        { id: 'p1', name: 'No. 1 Package', live: true },
        { id: 'p2', name: 'Best draft bundle', live: false },
      ],
    },
    WORDS,
  );
  assert.deepEqual(
    items.map((i) => `${i.kind}:${i.id ?? ''}`),
    ['shop_name:', 'tagline:', 'card:c1', 'card:c3', 'package:p1'],
  );
  assert.match(items[0]!.line, /^Your shop name needs a quick edit/);
  assert.match(items[0]!.what, /reword “best” and remove the emoji/);
});

test('nothing to fix → nothing drawn', () => {
  assert.deepEqual(fairSweepItems({ shopName: 'Rondo Musical', tagline: 'Live strings for weddings', cards: [], packages: [] }, WORDS), []);
});

test('the sweep never writes, never notifies, never emails, never takes a card down', () => {
  const WEB = join(__dirname, '..');
  for (const f of ['lib/fair-presentation-sweep.ts', 'app/vendor-dashboard/shop/_components/fair-sweep-notice.tsx']) {
    const src = readFileSync(join(WEB, f), 'utf8');
    const code = stripComments(src);
    assert.doesNotMatch(code, /\.(insert|update|upsert|delete)\(|\.rpc\(/, `${f} writes`);
    assert.doesNotMatch(code, /emitNotification|sendEmail|resend|push-send/i, `${f} notifies`);
    assert.doesNotMatch(code, /is_active\s*:\s*false|hidden_at|unpublish/i, `${f} takes something down`);
  }
});
