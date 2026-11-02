/**
 * THE "HOSTS" COUNT ON /people COUNTS HOSTS (audit 2026-11-02 #21).
 *
 * `event_members` is the event's PEOPLE table, not a host table: a guest who claims their invite gets a row
 * (member_type 'guest'), and so does a supplier ('vendor'). The Hosts group counted every row, so it grew by each guest
 * who signed in. Hosts are `HOST_MEMBER_TYPES` (couple + coordinator — `app/[slug]/_lib/host-scope.ts`).
 *
 * THE PROPERTY: every `event_members` COUNT under the event dashboard constrains `member_type` (a count of "people on the
 * event, whatever they are" has no business on a host's page). Derived from the tree and floored, so it cannot go quiet.
 * `lib/host-means-host.test.ts` holds the sister rule for reads that SELECT member_type.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { HOST_MEMBER_TYPES } from '@/app/[slug]/_lib/host-scope';

const DASH = join(dirname(fileURLToPath(import.meta.url)), '..');
const WINDOW = 400;

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('every event_members COUNT on the event dashboard constrains member_type', () => {
  let counts = 0;
  const offenders: string[] = [];
  for (const file of files(DASH)) {
    const src = stripComments(readFileSync(file, 'utf8'));
    let i = 0;
    while ((i = src.indexOf(".from('event_members')", i)) !== -1) {
      const win = src.slice(i, i + WINDOW).split(/;|\.from\(/).slice(0, 2).join('');
      if (/count:\s*'exact'/.test(win)) {
        counts++;
        if (!/\.(in|eq|neq)\(\s*'member_type'/.test(win)) offenders.push(`${relative(DASH, file)}:${src.slice(0, i).split('\n').length}`);
      }
      i += 10;
    }
  }
  assert.ok(counts >= 1, 'no event_members count found under the event dashboard — the sweep has gone blind');
  assert.deepEqual(offenders, [], `these count every member — a claimed guest, a supplier — as a host:\n${offenders.join('\n')}`);
});

test("the Hosts count is couple + coordinator — the one shared definition, not a retyped list", () => {
  const src = stripComments(readFileSync(join(DASH, 'people', 'page.tsx'), 'utf8'));
  assert.match(src, /import\s*\{[^}]*HOST_MEMBER_TYPES[^}]*\}\s*from\s*'@\/app\/\[slug\]\/_lib\/host-scope'/);
  assert.match(src, /\.from\('event_members'\)[\s\S]{0,200}\.in\('member_type',\s*\[\.\.\.HOST_MEMBER_TYPES\]\)/);
  assert.deepEqual([...HOST_MEMBER_TYPES], ['couple', 'coordinator']);
});
