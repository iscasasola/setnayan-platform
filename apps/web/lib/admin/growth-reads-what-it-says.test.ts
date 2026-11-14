/**
 * growth-reads-what-it-says.test.ts — AW-8 (admin walk 14 Nov 2026), Insights › Sign-ups & growth.
 *
 *  1. Events by type are named by the admin-managed event-type list, never by a raw key ("simple_event", "debut",
 *     "date") out of a hand-kept five-entry map.
 *  2. Guest → account conversion divides like for like: the converted count is taken over the SAME non-removed guests
 *     the total counts (`entityBase('guests')` = `guests.deleted_at IS NULL`), and the figure names its unit.
 *
 * Reads source (comments stripped) — the reads need a database. Each assertion was broken on purpose and went red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const stats = code('lib/admin/growth-stats.ts');

test('events by type read the admin-managed names, not a hand-kept map', () => {
  assert.doesNotMatch(stats, /EVENT_TYPE_LABELS/, 'the hand-kept five-entry map is back');
  assert.match(stats, /eventsByType:\s*toRows\(byType,\s*await eventTypeNamer\(\)\)/);
  assert.match(stats, /import\('@\/lib\/admin\/event-type-names\.server'\)/);
});

test('conversion counts only the guests the total counts', () => {
  const body = stats.slice(stats.indexOf('function conversionBase'), stats.indexOf('async function conversionCountBefore'));
  assert.ok(body.length > 0, 'conversionBase is gone');
  assert.match(body, /guests!inner\(deleted_at\)/, 'the converted count is no longer joined to its guest row');
  assert.match(body, /\.is\('guests\.deleted_at',\s*null\)/, 'removed guests count as converted again');
  assert.match(stats, /case 'guests':\s*return admin\.from\('guests'\)\.select\('\*', HEAD\)\.is\('deleted_at', null\)/,
    'the denominator changed — re-check that both sides still count the same guests');
});

test('the converted figure names its unit', () => {
  const surface = code('app/admin/app-performance/_surfaces/growth-surface.tsx');
  assert.match(surface, /of \{nf\.format\(c\.totalGuests\)\} guests/);
  assert.doesNotMatch(surface, /\/ \{nf\.format\(c\.totalGuests\)\}/, 'a bare "/ N" is back');
});
