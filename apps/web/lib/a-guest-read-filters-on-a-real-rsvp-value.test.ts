/**
 * GUARD: a guest read filters on an RSVP value that exists (final check B-01, A1-056, 25 Nov 2026).
 *
 * Story Assignments (`app/dashboard/[eventId]/alaala/assignments/page.tsx`) read its picker with
 * `.eq('rsvp_status', 'confirmed')`. `public.rsvp_status` has no 'confirmed', so Postgres rejected the read,
 * the page degraded to an empty picker and no guest could ever be assigned a story.
 *
 * This test reads the enum from the migration that creates it, checks that `RsvpStatus` (`lib/guests.ts`) carries
 * the same values, then walks every source file in app/, lib/ and components/. Every literal RSVP value in an
 * `.eq` / `.neq` / `.in` filter on `rsvp_status` must be one of them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(WEB, '..', '..');

function enumValues(): string[] {
  const sql = readFileSync(
    join(REPO, 'supabase', 'migrations', '20260513010000_iteration_0001_guests.sql'),
    'utf8',
  );
  const m = sql.match(/CREATE TYPE public\.rsvp_status AS ENUM \(([^)]*)\)/);
  assert.ok(m, 'the rsvp_status enum is created in the guests migration');
  const base = [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
  // Any later ALTER TYPE … ADD VALUE also counts.
  const added: string[] = [];
  for (const f of readdirSync(join(REPO, 'supabase', 'migrations'))) {
    if (!f.endsWith('.sql')) continue;
    const s = readFileSync(join(REPO, 'supabase', 'migrations', f), 'utf8');
    for (const a of s.matchAll(/ALTER TYPE public\.rsvp_status ADD VALUE(?: IF NOT EXISTS)? '([a-z_]+)'/gi)) {
      added.push(a[1]);
    }
  }
  return [...base, ...added];
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) sourceFiles(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

test('RsvpStatus carries exactly the values of the rsvp_status enum', () => {
  const src = readFileSync(join(WEB, 'lib', 'guests.ts'), 'utf8');
  const m = src.match(/export type RsvpStatus = ([^;]+);/);
  assert.ok(m, 'lib/guests.ts exports RsvpStatus');
  const typed = [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
  assert.deepEqual(typed, [...enumValues()].sort());
});

test('every rsvp_status filter in app/, lib/ and components/ names a real value', () => {
  const real = new Set(enumValues());
  const bad: string[] = [];
  for (const root of ['app', 'lib', 'components']) {
    for (const file of sourceFiles(join(WEB, root))) {
      const src = readFileSync(file, 'utf8');
      const rel = relative(WEB, file);
      for (const m of src.matchAll(/\.(?:eq|neq)\(\s*'rsvp_status',\s*'([a-z_]+)'/g)) {
        if (!real.has(m[1])) bad.push(`${rel}: '${m[1]}'`);
      }
      for (const m of src.matchAll(/\.in\(\s*'rsvp_status',\s*\[([^\]]*)\]/g)) {
        for (const v of m[1].matchAll(/'([a-z_]+)'/g)) {
          if (!real.has(v[1])) bad.push(`${rel}: '${v[1]}'`);
        }
      }
    }
  }
  assert.deepEqual(bad, [], `filters on an RSVP value that does not exist:\n${bad.join('\n')}`);
});

test('Story Assignments picks from the guests who said yes', () => {
  const page = readFileSync(join(WEB, 'app', 'dashboard', '[eventId]', 'alaala', 'assignments', 'page.tsx'), 'utf8');
  assert.match(page, /\.eq\('rsvp_status', 'attending'/);
});
