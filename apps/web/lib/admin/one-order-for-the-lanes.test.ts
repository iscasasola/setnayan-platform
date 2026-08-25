/**
 * Guard: the admin queues are ranked ONE way.
 *
 * WHAT WAS WRONG (cleanliness finding 5, measured on `origin/main` a8f8601).
 * Two `LANE_ORDER` constants existed, neither aware of the other, ranking the
 * same four lanes in OPPOSITE orders:
 *
 *   · `app/admin/queues/_components/queues-triage-feed.tsx` → money, trust, …
 *   · `lib/admin/digest-content.ts`                          → trust, money, …
 *
 * Same queues, same person, two answers to "what do I do first" — invisible
 * because each file was internally consistent. Both now read
 * `ADMIN_LANE_ORDER`, which lives beside the lane TYPE so a fifth lane cannot be
 * added without meeting the order it will be shown in.
 *
 * The CONSUMER list is derived: every file mentioning a lane order is found by
 * walking the tree, so a third copy fails here on the day it is written.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ADMIN_LANE_ORDER } from './queue-counts';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');

const strip = (src: string) =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');

function sources(): string[] {
  const out: string[] = [];
  for (const root of ['app', 'lib']) {
    (function walk(dir: string) {
      for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === '.next') continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if ((p.endsWith('.ts') || p.endsWith('.tsx')) && !p.includes('.test.')) out.push(p);
      }
    })(join(WEB, root));
  }
  return out;
}

test('trust leads, and it is a clock argument not a taste one', () => {
  assert.deepEqual(
    [...ADMIN_LANE_ORDER],
    ['trust', 'money', 'growth', 'support'],
    'trust is the only lane with a STATUTORY deadline (RA 10173 erasure, ' +
      'disputes). A compliance deadline missed is not recoverable; a payment ' +
      'confirmed an hour later is. Moving it is an owner call, not a tidy-up.',
  );
});

test('🔴 nobody keeps a private copy of the order', () => {
  const files = sources();
  assert.ok(files.length >= 500, `floor: source scan found only ${files.length} files`);

  /* Any array literal of the four lane names, anywhere but the one definition. */
  const laneArray = /\[\s*'(money|trust|growth|support)'\s*,\s*'(money|trust|growth|support)'\s*,/;
  const rogue = files.filter((f) => {
    if (f.endsWith('lib/admin/queue-counts.ts')) return false;
    return laneArray.test(strip(readFileSync(f, 'utf8')));
  });
  assert.deepEqual(
    rogue.map((f) => f.slice(WEB.length + 1)),
    [],
    'a file is ranking the admin lanes for itself again. Import ADMIN_LANE_ORDER ' +
      '— two copies of an order is how the triage feed and the digest ended up ' +
      'telling the same person opposite things.',
  );
});

test('both surfaces read the shared order', () => {
  for (const rel of [
    'app/admin/queues/_components/queues-triage-feed.tsx',
    'lib/admin/digest-content.ts',
  ]) {
    assert.match(
      strip(readFileSync(join(WEB, rel), 'utf8')),
      /ADMIN_LANE_ORDER/,
      `${rel} no longer reads the shared lane order`,
    );
  }
});

test('⚖ the two LANE LABELS differ on purpose — pinned so a third cannot appear', () => {
  /* A compact chip and a line of prose have different width budgets. That is a
     deliberate pair, not drift — but an UNPINNED deliberate pair is
     indistinguishable from drift the next time somebody reads it. */
  const feed = strip(
    readFileSync(join(WEB, 'app/admin/queues/_components/queues-triage-feed.tsx'), 'utf8'),
  );
  const digest = strip(readFileSync(join(WEB, 'lib/admin/digest-content.ts'), 'utf8'));
  assert.match(feed, /trust: 'Trust'/, 'the compact chip label changed');
  assert.match(digest, /trust: 'Trust & recourse'/, 'the digest prose label changed');
});
