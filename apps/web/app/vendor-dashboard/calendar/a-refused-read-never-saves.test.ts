/**
 * a-refused-read-never-saves.test.ts — a Dates write that could not read must say so, never "saved".
 *
 * ── THE DEFECTS THIS PINS (supplier dashboard audit, 2026-11-17) ──────────────
 * 1. `ownedServiceIds` returned `[]` on a refused read. `editCalendar` diffs that against the schedule's
 *    current services, so ONE refused read unassigned every service and the supplier read "Schedule saved".
 * 2. `movePoolCategory` read a refused count as 0 and switched the old schedule off while it still held services.
 * 3. `notifyWaitlistSlot` threw away the count `notifyWaitlistForFreedDate` returns, so "Told them" showed when
 *    nobody was told (nobody waiting, the day closed again, or the call threw).
 *
 * A SOURCE SCAN, like `picking-someone-tells-them.test.ts` beside it: the module is `'use server'` with a
 * redirect that throws. Comments are stripped first so the docblocks naming the defect cannot satisfy it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const SRC = stripComments(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'actions.ts'), 'utf8'));

function body(name: string): string {
  const at = SRC.indexOf(`function ${name}(`);
  assert.ok(at >= 0, `${name} is still in calendar/actions.ts`);
  const next = SRC.indexOf('\nexport async function ', at + 10);
  const nextPlain = SRC.indexOf('\nasync function ', at + 10);
  const ends = [next, nextPlain].filter((n) => n > 0);
  return SRC.slice(at, ends.length ? Math.min(...ends) : undefined);
}

test('ownedServiceIds tells a refused read from "none of these are yours"', () => {
  const b = body('ownedServiceIds');
  assert.match(b, /Promise<string\[\] \| null>/, 'it can answer null');
  assert.match(b, /if \(error\)[\s\S]*?return null/, 'a refused read returns null');
});

test('every caller of ownedServiceIds answers save_failed on null', () => {
  for (const fn of ['createCalendar', 'editCalendar']) {
    assert.match(body(fn), /=== null\) backToCalendar\(formData, 'save_failed'\)/, `${fn} stops on an unread service list`);
  }
});

test('editCalendar checks the delete it makes', () => {
  assert.match(body('editCalendar'), /error: removeErr[\s\S]*?if \(removeErr\) backToCalendar/);
});

test('a refused count never switches a schedule off', () => {
  assert.doesNotMatch(SRC, /\(count \?\? 0\) === 0\) \{\s*await supabase\s*\.from\('vendor_schedule_pools'\)/);
});

test('"Told them" only when somebody was told', () => {
  const b = body('notifyWaitlistSlot');
  assert.match(b, /const told = await notifyWaitlistForFreedDate/);
  assert.match(b, /told === 0 \? 'waitlist_none' : 'waitlist_notified'/);
});
