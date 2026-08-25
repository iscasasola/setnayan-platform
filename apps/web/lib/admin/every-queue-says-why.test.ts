/**
 * Every act-now queue either lets you settle it, or SAYS WHY IT CANNOT.
 *
 * 🔑 THE GAP THIS CLOSES. Three queues — booking fees, completions and
 * partnerships — had neither a control nor a sentence. Expanding one showed
 * nothing at all, so a reader learned nothing and could only conclude the
 * feature was unfinished. `JUDGEMENT_QUEUES` already carried the house rule in
 * its own docblock — *"being explicit beats being silent"* — but judgement was
 * treated as the ONLY honest reason to withhold a button. It is not: a fee is
 * confirmed on Payments where the receipt is, and a partnership waits on the
 * other supplier.
 *
 * ⚖ THIS IS DERIVED, NOT A HAND-LIST. It walks the real QUEUE_DEFS and demands
 * every key be accounted for by one of the three maps — so the NEXT queue
 * somebody adds fails here until it is given a panel or a reason, instead of
 * shipping silent. A hand-enumerated list is a list of the queues somebody
 * thought of.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'lib/admin');
const counts = readFileSync(join(SRC, 'queue-counts.ts'), 'utf8');
const peekSrc = readFileSync(join(SRC, 'queue-peek.ts'), 'utf8');

/** The real act-now queues, read out of QUEUE_DEFS itself. */
function queueKeys(): string[] {
  const m = /QUEUE_DEFS[^=]*=\s*\[([\s\S]*?)\n\];/.exec(counts);
  assert.ok(m, 'QUEUE_DEFS is gone or reshaped — this guard is blind without it');
  return [...m[1]!.matchAll(/key:\s*'([a-z-]+)'/g)].map((x) => x[1]!);
}

/** Keys inside a named object/array literal in queue-peek.ts. */
function keysOf(name: string, open: string, close: string): string[] {
  const i = peekSrc.indexOf(name);
  assert.notEqual(i, -1, `${name} is gone from queue-peek.ts`);
  const a = peekSrc.indexOf(open, i);
  const b = peekSrc.indexOf(close, a);
  assert.ok(b > a, `could not read ${name}`);
  const blk = peekSrc.slice(a, b);
  /* ⚠ BOTH KEY FORMS. A JS object literal writes `disputes:` unquoted and
     `'user-reports':` quoted (the hyphen forces quotes). The first version of
     this parser matched only the quoted form and reported two properly-covered
     queues as silent — a false positive in the guard itself, from matching one
     SPELLING of a key rather than the key. */
  return [
    ...[...blk.matchAll(/'([a-z-]+)'\s*:/g)].map((x) => x[1]!),      // 'user-reports':
    ...[...blk.matchAll(/^\s+([a-z-]+):/gm)].map((x) => x[1]!),      // disputes:
    ...[...blk.matchAll(/^\s*'([a-z-]+)',$/gm)].map((x) => x[1]!),   // 'payments',
  ];
}

test('the guard can actually fire — it reads real sources', () => {
  // Floors far below the real values (19 queues), catching a broken parse.
  assert.ok(queueKeys().length >= 10, `parsed only ${queueKeys().length} queues`);
  assert.ok(peekSrc.length > 2000, 'queue-peek.ts read as near-empty');
});

test('no act-now queue is silent — it settles, or it says why', () => {
  const settle = keysOf('const PEEK_QUEUES', '[', '] as const;');
  const judgement = keysOf('JUDGEMENT_QUEUES', '{', '\n};');
  const elsewhere = keysOf('SETTLED_ELSEWHERE', '{', '\n};');
  const accounted = new Set([...settle, ...judgement, ...elsewhere]);

  const silent = queueKeys().filter((k) => !accounted.has(k));
  assert.deepEqual(
    silent,
    [],
    'These queues offer neither a control nor a sentence, so an expanded row shows ' +
      `nothing and reads as unfinished: ${silent.join(', ')}. Give each a panel, or a ` +
      'line in JUDGEMENT_QUEUES (it is a ruling) or SETTLED_ELSEWHERE (the work happens ' +
      'somewhere else).',
  );
});

test('a sentence that cannot be shown is not a sentence', () => {
  /* 🪤 THIS ASSERTION EXISTS BECAUSE A SABOTAGE PROVED THE GUARD INCOMPLETE.
     Deleting `...Object.keys(SETTLED_ELSEWHERE)` from EXPANDABLE_QUEUES left
     the sentences defined and UNREACHABLE — the row stops offering expansion,
     so the explanation can never render — and the check above stayed GREEN,
     because it only ever asked whether a map held the key.
     🔑 Same family as a granted RPC with no callers: the thing exists, and
     nothing can reach it. */
  const expandable = peekSrc.slice(
    peekSrc.indexOf('EXPANDABLE_QUEUES'),
    peekSrc.indexOf(']);', peekSrc.indexOf('EXPANDABLE_QUEUES')),
  );
  for (const map of ['JUDGEMENT_QUEUES', 'SETTLED_ELSEWHERE']) {
    assert.ok(
      expandable.includes(`...Object.keys(${map})`),
      `${map} is not folded into EXPANDABLE_QUEUES — its sentences are defined but ` +
        'the rows never offer expansion, so nobody can ever read them.',
    );
  }
});

test('a queue never both settles in place AND claims it cannot', () => {
  const settle = new Set(keysOf('const PEEK_QUEUES', '[', '] as const;'));
  const excused = [
    ...keysOf('JUDGEMENT_QUEUES', '{', '\n};'),
    ...keysOf('SETTLED_ELSEWHERE', '{', '\n};'),
  ];
  const both = excused.filter((k) => settle.has(k));
  assert.deepEqual(both, [], `contradictory: ${both.join(', ')} has a panel AND an excuse`);
});
