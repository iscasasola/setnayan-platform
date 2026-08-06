/**
 * face-choice-readable.test.ts — a card that hides itself when it fails.
 *
 * The couple's face-tagging opt-out card reads three columns from `events` with
 * the SIGNED-IN client. Two were readable; `face_tagging_declined_by_couple` was
 * not, so PostgREST refused the whole query and `if (error || !data) return null`
 * hid the card — on all five production events, every one of which is in the
 * mode where it is supposed to appear.
 *
 * 🪤 The self-hiding is DELIBERATE and good: a control that cannot enable
 * anything should not be offered. It is also exactly what made this invisible —
 * a missing card reads as "not applicable", never as "the query failed".
 *
 * 🚨 The live error's own hint says to `GRANT SELECT ON public.events TO
 * authenticated`. Following it would expose the encrypted photo-delivery OAuth
 * token, the master QR token, both partners' birth dates and the budget. This
 * file pins the narrow fix so a future reader cannot "simplify" it into the wide
 * one.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');
const sql = () =>
  readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
    .join('\n')
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');

test('every column the card selects is granted to the signed-in role', () => {
  const src = readFileSync(
    join(WEB, 'app/dashboard/[eventId]/studio/papic/_components/face-tagging-choice.tsx'),
    'utf8',
  );
  const select = src.match(/\.select\(\s*'([^']+)'/);
  // CI's typechecker runs with `noUncheckedIndexedAccess`, so `select[1]` is
  // `string | undefined` even after asserting the match is truthy — a capture
  // group can legitimately be absent. Narrow the group itself.
  const captured = select?.[1];
  assert.ok(captured, 'the card no longer selects anything');
  const cols = captured.split(',').map((c) => c.trim());
  assert.ok(cols.includes('face_tagging_declined_by_couple'), 'the opt-out column left the query');

  const s = sql();
  for (const c of cols) {
    const granted =
      new RegExp(`GRANT SELECT \\(([^)]*\\b${c}\\b[^)]*)\\) ON public\\.events`).test(s) ||
      // 176 of 199 columns were granted in bulk by earlier hardening migrations.
      new RegExp(`\\b${c}\\b`).test(s);
    assert.ok(
      granted,
      `The card selects \`${c}\` with the signed-in client, but no migration ` +
        `grants it. PostgREST refuses the WHOLE query, and the card hides itself ` +
        `— which looks exactly like "not applicable here".`,
    );
  }
});

test('the fix stays a COLUMN grant, never a table grant', () => {
  const s = sql();
  assert.ok(
    /GRANT SELECT \(face_tagging_declined_by_couple\) ON public\.events/.test(s),
    'The narrow column grant is gone.',
  );
  assert.ok(
    !/GRANT SELECT ON public\.events TO (anon|authenticated)/.test(s),
    'A TABLE-wide SELECT on events reached anon or authenticated. That is what ' +
      "Postgres's own error hint tells you to do, and it would expose the " +
      'encrypted photo-delivery OAuth token, the master QR token, both partners’ ' +
      'birth dates and the budget. 23 columns are withheld on purpose.',
  );
});
