/**
 * the-lab-never-ships.test.ts — /dev/clients-lab 404s in production: the production check is the FIRST thing the page
 * does, before it reads a single search param or renders a fixture; and the lab mounts the Schedule month with lab
 * inputs, so it never calls the server action (no request, no database).
 *
 * Sabotage log (2026-11-08, reverted): the production line moved below `await searchParams` → 1 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAB = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

test('the clients lab calls notFound() in production, before anything else', () => {
  assert.match(LAB, /import \{ notFound \} from 'next\/navigation';/, 'notFound is not imported');
  const page = LAB.slice(LAB.indexOf('export default async function ClientsLabPage('));
  const body = page.slice(page.indexOf('{', page.indexOf(')')) + 1).trimStart();
  assert.ok(page.length > 0, 'the lab page function is gone');
  assert.match(body, /^if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/, 'the production 404 is not the first statement');
});

test('the lab’s Schedule month is handed its inputs — it never asks the server', () => {
  assert.match(LAB, /<ScheduleCalendar eventDate="2026-11-08" todayIso=\{LAB_TODAY\} lab=\{cal === 'fail' \? null : cal === 'two' \? LAB_CALENDAR_TWO : LAB_CALENDAR\} \/>/);
  assert.doesNotMatch(LAB, /fetchCustomerCalendarMonth|createClient|supabase/, 'the lab reaches for the database');
});
