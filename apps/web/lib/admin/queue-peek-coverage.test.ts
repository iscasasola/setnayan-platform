import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The work list may only offer an EXPAND control on a queue that can actually
 * expand — and this checks that against the CODE, not against a twin list.
 *
 * 🪤 THE BUG THIS EXISTS FOR. Every row was handed an `?open=` link, but only
 * some queues have a peek. Five rows became DEAD TAPS: the URL changed, no
 * drawer rendered, the page redrew identically, and on a phone it jumped back
 * to the top. Those rows used to open their queue page, so the work made them
 * worse. Nothing errored and CI was green.
 *
 * 🔑 WHY IT READS SOURCE INSTEAD OF COMPARING TWO ARRAYS. `EXPANDABLE_QUEUES`
 * is a hand-maintained list sitting next to a hand-written if/else chain — the
 * textbook shape of "two hand-typed things that drift together while CI stays
 * green". So the guard parses the branch conditions out of the real file. Add a
 * `key === 'x'` branch without listing it and this fails; list one with no
 * branch and this fails. The list can only be right by matching the code.
 */

const SRC = readFileSync(join(process.cwd(), 'lib/admin/queue-peek.ts'), 'utf8');

/** Every queue the peek function actually branches on. */
function branchedKeys(): Set<string> {
  const out = new Set<string>();
  for (const m of SRC.matchAll(/key === '([a-z0-9-]+)'/g)) {
    if (m[1]) out.add(m[1]);
  }
  return out;
}

/** The keys the declared list claims are expandable. */
function declaredPeekKeys(): Set<string> {
  const m = SRC.match(/const PEEK_QUEUES = \[([^\]]+)\]/);
  assert.ok(m && m[1], 'PEEK_QUEUES declaration not found — did it get renamed?');
  return new Set(
    m[1]
      .split(',')
      .map((s) => s.trim().replace(/^'|'$/g, ''))
      .filter(Boolean),
  );
}

function judgementKeys(): Set<string> {
  const m = SRC.match(/JUDGEMENT_QUEUES: Record<string, string> = \{([\s\S]*?)\n\};/);
  assert.ok(m && m[1], 'JUDGEMENT_QUEUES declaration not found — did it get renamed?');
  const out = new Set<string>();
  for (const line of m[1].matchAll(/^\s*'?([a-z0-9-]+)'?:/gm)) {
    if (line[1]) out.add(line[1]);
  }
  return out;
}

test('every queue the peek branches on is declared expandable', () => {
  const branched = branchedKeys();
  const declared = declaredPeekKeys();
  const missing = [...branched].filter((k) => !declared.has(k));
  assert.deepEqual(
    missing,
    [],
    `peekQueue() branches on ${missing.join(', ')} but PEEK_QUEUES does not list ${missing.length === 1 ? 'it' : 'them'}. ` +
      'The row would never offer to expand, so that peek code is unreachable.',
  );
});

test('every declared expandable queue really has a branch', () => {
  const branched = branchedKeys();
  const declared = declaredPeekKeys();
  const phantom = [...declared].filter((k) => !branched.has(k));
  assert.deepEqual(
    phantom,
    [],
    `PEEK_QUEUES lists ${phantom.join(', ')} but peekQueue() has no branch for ${phantom.length === 1 ? 'it' : 'them'}. ` +
      'That row would offer an expand control that renders nothing — a dead tap.',
  );
});

test('a judgement queue is expandable too — its sentence is the content', () => {
  // A judgement queue has no branch of its own; it is served by the shared
  // `note` path. It must still be expandable, or the admin never sees the
  // sentence explaining why there is no button.
  const judgement = judgementKeys();
  assert.ok(judgement.size > 0, 'no judgement queues parsed — the regex is stale');
  assert.match(
    SRC,
    /EXPANDABLE_QUEUES[\s\S]{0,200}Object\.keys\(JUDGEMENT_QUEUES\)/,
    'EXPANDABLE_QUEUES must be built from JUDGEMENT_QUEUES, not re-listed by hand',
  );
});

test('no branch re-types a filter the queue definitions already own', () => {
  // 🔑 THE NUMBER AND THE LIST MUST COME FROM ONE PREDICATE. Payouts once
  // counted `paid_at IS NULL` on the badge and listed `released_at IS NULL` in
  // the drawer — both columns exist, so nothing errored and the two disagreed
  // silently, forever. Every branch now builds through open(), which reads the
  // filter from getQueueSource().
  // The shared helper legitimately calls .from(src.table) — a VARIABLE. A
  // branch going around it would name its table as a LITERAL, so that is the
  // discriminator, not the presence of .from() at all.
  const literalFrom = [...SRC.matchAll(/\.from\('([a-z_]+)'\)/g)].map((m) => m[1]);
  assert.deepEqual(
    literalFrom,
    [],
    `these peek branches name a table directly (${literalFrom.join(', ')}) instead of going ` +
      'through open(); that re-types a predicate getQueueSource() already owns, which is how ' +
      'the badge and the list came to disagree about payouts',
  );
});
