/**
 * FACE TAGGING IS OFF BY DEFAULT — THE COUPLE OPTS IN.
 *
 * ⚖ DPO ruling 2026-10-23 (corpus DECISION_LOG, "OWNER ANSWERS ON THE BUILD
 * TRACKER"): *"face tagging OFF by default, opt-in"*, superseding the
 * 2026-10-01 "on by default, they can always turn it off" row. Until this
 * change `events.face_tagging_declined_by_couple` defaulted to FALSE, so every
 * event whose Papic was active ran face tagging unless the couple found the
 * switch, and the switch said "On automatically because your event has Papic".
 *
 * THE PROPERTY, in three places that must agree:
 *   1. THE DEFAULT — the last migration that sets the column's default sets
 *      TRUE (off), and the resolver turns a default event OFF even with Papic
 *      active, while a couple's opt-in (declined = false) still turns it on;
 *   2. THE COPY — no reader-visible string in app/ or lib/ says face tagging is
 *      on by default or on automatically;
 *   3. THE NOTICE — /privacy says it is off unless the hosts turn it on.
 *
 * SABOTAGE (run when written): set the new migration's DEFAULT back to false →
 * RED (1); put "On automatically because your event has Papic" back in
 * face-tagging-choice.tsx → RED (2); delete the /privacy sentence → RED (3).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveFaceMode } from './papic-face-mode';
import { copyStrings } from './public-copy-strings';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');

test('1 · the column defaults to OFF, and a default event stays off with Papic active', () => {
  const setters = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => ({ f, sql: stripComments(readFileSync(join(MIGRATIONS, f), 'utf8')).replace(/--.*$/gm, '') }))
    .flatMap(({ f, sql }) =>
      [...sql.matchAll(/face_tagging_declined_by_couple\s+(?:boolean\s+NOT\s+NULL\s+)?(?:SET\s+)?DEFAULT\s+(true|false)/gi)].map(
        (m) => ({ f, value: (m[1] ?? '').toLowerCase() }),
      ),
    );
  assert.ok(setters.length >= 2, `found ${setters.length} default setters — the reader is broken`);
  const last = setters[setters.length - 1]!;
  assert.equal(last.value, 'true', `${last.f} leaves face tagging ON by default — the DPO ruled it opt-in`);

  // `declined` at its default (true) + Papic active → OFF.
  assert.equal(resolveFaceMode(null, 'wedding', true, true), 'mode_b');
  // The couple's opt-in (declined = false) + Papic active → ON.
  assert.equal(resolveFaceMode(null, 'wedding', false, true), 'mode_a');
});

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const ON_BY_DEFAULT =
  /\b(?:face tagging|tagging)\b[^.]{0,40}\b(?:on by default|is on\b(?! for )|on automatically)|\bon automatically because your event has Papic/i;

test('2 · no reader-visible copy says face tagging is on by default', () => {
  assert.ok(ON_BY_DEFAULT.test('Face tagging is on — turn it off for a child’s party'));
  assert.ok(ON_BY_DEFAULT.test('On automatically because your event has Papic.'));
  assert.ok(!ON_BY_DEFAULT.test('Face tagging is off unless you turn it on.'));
  const hits: string[] = [];
  let read = 0;
  for (const file of [...sources(join(WEB, 'app')), ...sources(join(WEB, 'lib'))]) {
    read++;
    for (const s of copyStrings(readFileSync(file, 'utf8'), file)) {
      const t = s.text.replace(/\s+/g, ' ');
      if (ON_BY_DEFAULT.test(t)) hits.push(`${file.slice(WEB.length + 1)}:${s.line} "${t.trim()}"`);
    }
  }
  assert.ok(read > 500, `only ${read} files read`);
  assert.deepEqual(hits, [], hits.join('\n'));
});

test('3 · /privacy says face tagging is off unless the hosts turn it on', () => {
  const page = readFileSync(join(WEB, 'app/(shell)/privacy/page.tsx'), 'utf8');
  assert.match(page.replace(/\s+/g, ' '), /Face tagging is off unless the hosts turn it on\./);
});
