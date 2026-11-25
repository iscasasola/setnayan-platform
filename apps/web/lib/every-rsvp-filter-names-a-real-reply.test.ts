/**
 * every-rsvp-filter-names-a-real-reply.test.ts — a guest read never filters on a reply that does not exist.
 *
 * ── The defect (final check B-01, 25 Nov 2026) ─────────────────────────────
 * Story Assignments read its guests with `.eq('rsvp_status', 'confirmed')`. The reply enum is
 * `pending · attending · declined · maybe` (migration 20260513010000_iteration_0001_guests.sql), so Postgres
 * refused the read, the page logged it as graceful_degrade, and every moment said "No guests to assign" for every
 * event. Nothing could ever be assigned.
 *
 * 🔒 The claim held here: every `.eq('rsvp_status', …)` / `.neq(…)` / `.in('rsvp_status', […])` in app and lib names
 * only values of `RsvpStatus` (lib/guests.ts), and the assignments page counts guests through `countsTowardEvent`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPLIES = new Set(['pending', 'attending', 'declined', 'maybe']);

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* sources(p);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) yield p;
  }
}

test('the reply enum in lib/guests.ts is the one this test checks against', () => {
  const src = readFileSync(join(WEB, 'lib/guests.ts'), 'utf8');
  const m = /export type RsvpStatus = ([^;]+);/.exec(src);
  assert.ok(m, 'RsvpStatus type not found in lib/guests.ts');
  const values = new Set([...(m[1] ?? '').matchAll(/'([a-z_]+)'/g)].map((x) => x[1]));
  assert.deepEqual([...values].sort(), [...REPLIES].sort());
});

test('every rsvp_status filter in app/ and lib/ names a real reply', () => {
  const bad: string[] = [];
  let seen = 0;
  for (const dir of ['app', 'lib']) {
    for (const file of sources(join(WEB, dir))) {
      const src = stripComments(readFileSync(file, 'utf8'));
      for (const m of src.matchAll(/\.(?:eq|neq)\(\s*'rsvp_status'\s*,\s*'([^']+)'/g)) {
        seen++;
        const v = m[1] ?? '';
        if (!REPLIES.has(v)) bad.push(`${relative(WEB, file)}: '${v}'`);
      }
      for (const m of src.matchAll(/\.in\(\s*'rsvp_status'\s*,\s*\[([^\]]*)\]/g)) {
        for (const v of (m[1] ?? '').matchAll(/'([^']+)'/g)) {
          seen++;
          const reply = v[1] ?? '';
          if (!REPLIES.has(reply)) bad.push(`${relative(WEB, file)}: '${reply}'`);
        }
      }
    }
  }
  assert.ok(seen > 5, `expected to find rsvp_status filters, found ${seen}`);
  assert.deepEqual(bad, [], 'rsvp_status filters on a reply that does not exist');
});

test('Story Assignments lists attending guests through the one headcount reader, and says when it could not read', () => {
  const src = stripComments(
    readFileSync(join(WEB, 'app/dashboard/[eventId]/alaala/assignments/page.tsx'), 'utf8'),
  );
  assert.match(src, /\.eq\('rsvp_status', 'attending'\)/);
  assert.match(src, /\.filter\(countsTowardEvent\)/);
  assert.match(src, /readFailed \?/);
  assert.match(src, /Couldn't read your story assignments/);
});
