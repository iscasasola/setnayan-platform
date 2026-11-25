/**
 * the-plan-pages-say-when-a-read-failed.test.ts — final check, area 2, fix batch 1 (25 Nov 2026).
 *
 * The staging walk found the couple's planning pages turning a REFUSED read into a confident absence:
 * "No contracts yet", "No disputes on record", "0 of 16 slots filled", "Start your checklist", "No documents yet",
 * "Nothing has happened yet", "0 / 0 attending", "0 suppliers", "Set your dates first", "not shared with you".
 * Each one is a claim the couple acts on. CLAUDE.md §5 rule 4: a failed read never renders as zero, empty or
 * success, and the measurement must reach the RENDER.
 *
 * This file holds each fix two ways:
 *   1. behaviour — the new honest readers return `null` / `refused` on an error, and `[]` only on an answer;
 *   2. source — each page branches on that measurement and draws `ReadRefusedNotice` before its empty state.
 * Source checks run on comment-stripped text, so a comment that names the fix cannot satisfy them.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readEventContracts } from '@/lib/contracts';
import { readEventPaperwork } from '@/lib/paperwork';
import { fetchEventActivityMeasured } from '@/lib/activity';
import { stripComments } from '@/lib/strip-comments';

const here = dirname(fileURLToPath(import.meta.url));
const page = (rel: string): string => stripComments(readFileSync(join(here, rel), 'utf8'));

/** A thenable query builder: every chained call returns itself; awaiting it yields `result`. */
function stubClient(result: { data: unknown; error: unknown }): SupabaseClient {
  const builder: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'eq', 'neq', 'is', 'in', 'order', 'limit', 'maybeSingle']) {
    builder[m] = () => builder;
  }
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder as unknown as SupabaseClient;
}
const REFUSED = { data: null, error: { code: '42501', message: 'permission denied' } };
const ANSWERED_EMPTY = { data: [], error: null };

// ── 1 · behaviour ─────────────────────────────────────────────────────────────────────────────────────────────

test('A2-G14: readEventContracts says null when refused and [] only when the read answered', async () => {
  const orig = console.error;
  console.error = () => {};
  try {
    assert.equal(await readEventContracts(stubClient(REFUSED), 'e1'), null);
  } finally {
    console.error = orig;
  }
  assert.deepEqual(await readEventContracts(stubClient(ANSWERED_EMPTY), 'e1'), []);
});

test('A2-I8 / A2-I5: readEventPaperwork says null when refused and [] only when the read answered', async () => {
  const orig = console.error;
  console.error = () => {};
  try {
    assert.equal(await readEventPaperwork(stubClient(REFUSED), 'e1'), null);
  } finally {
    console.error = orig;
  }
  assert.deepEqual(await readEventPaperwork(stubClient(ANSWERED_EMPTY), 'e1'), []);
});

test('A2-B9: the activity feed names every refused source, and none when all four answered', async () => {
  const refused = await fetchEventActivityMeasured(stubClient(REFUSED), 'e1', 50);
  assert.deepEqual(refused.items, []);
  assert.deepEqual(refused.refused, ['guests', 'suppliers', 'orders', 'schedule']);
  const empty = await fetchEventActivityMeasured(stubClient(ANSWERED_EMPTY), 'e1', 50);
  assert.deepEqual(empty, { items: [], refused: [] });
});

// ── 2 · each page draws the refusal before (or instead of) its empty state ───────────────────────────────────

/** `needle` must appear in `src` before `emptyWords`, and `ReadRefusedNotice` must be drawn. */
function refusalComesFirst(src: string, guard: string, emptyWords: string, label: string): void {
  assert.ok(src.includes('<ReadRefusedNotice'), `${label}: draws ReadRefusedNotice`);
  const g = src.indexOf(guard);
  const e = src.indexOf(emptyWords);
  assert.ok(g >= 0, `${label}: branches on the measurement (${guard})`);
  assert.ok(e >= 0, `${label}: still has its empty state (${emptyWords})`);
  assert.ok(g < e, `${label}: the refusal is decided before the empty state`);
}

test('A2-E7: Access requests says "Nothing waiting" only when BOTH lists were read', () => {
  const src = page('access-requests/page.tsx');
  assert.match(src, /pending\.length === 0 && claimsRead\.measured && claimsRead\.asks\.length === 0 \?/);
  assert.doesNotMatch(src, /!\(claimsRead\.measured && claimsRead\.asks\.length > 0\)/);
});

test('A2-G15: Disputes never says "No disputes on record" for a refused read', () => {
  const src = page('disputes/page.tsx');
  refusalComesFirst(src, 'flagsRefused ? (', 'No disputes on record', 'disputes');
  assert.match(src, /const flagsRefused = Boolean\(flagsRes\.error\)/);
  assert.match(src, /vendorsRefused \? <ReadRefusedNotice/);
});

test('A2-H5: Manpower says once that the gigs could not load, never three empty groups', () => {
  refusalComesFirst(page('manpower/page.tsx'), 'gigsError ? (', 'No open gigs', 'manpower');
});

test('A2-I13: Sponsors stops at the refusal (no "0 of N slots", no Add buttons over sponsors already there)', () => {
  const src = page('sponsors/page.tsx');
  refusalComesFirst(src, 'if (sponsorRowsError) {', 'slots filled', 'sponsors');
});

test('A2-H15: Find your date never tells a couple with a date to set one when the date read failed', () => {
  const src = page('find-date/page.tsx');
  const g = src.indexOf('if (eventRes.error) {');
  const r = src.indexOf('<ReadRefusedNotice', g);
  const m = src.indexOf('buildScheduleMatrix(');
  assert.ok(g >= 0 && r > g && r < m, 'the refusal returns before the matrix is built from a null date');
});

test('A2-E8: Who is here never says "not shared with you" when who you are could not be read', () => {
  refusalComesFirst(page('people/page.tsx'), 'groups.length === 0 && whoRefused ? (', 'lists are shared with you', 'people');
});

test('A2-B9: Activity reads the measured feed and never says "Nothing has happened yet" over a refusal', () => {
  const src = page('activity/page.tsx');
  assert.match(src, /fetchEventActivityMeasured\(/);
  refusalComesFirst(src, 'refused.length > 0 ? (', 'Nothing has happened yet', 'activity');
  assert.match(src, /activity\.length === 0 && refused\.length > 0 \? null/);
});

test('A2-D13: the check-in desk is not drawn from a refused guest read', () => {
  const src = page('guests/checkin/page.tsx');
  const g = src.indexOf('guestsRawError ? (');
  const d = src.indexOf('<CheckinDesk');
  assert.ok(g >= 0 && d > g, 'the guests part branches on the refusal before drawing the desk');
});

test('A2-E2: the souvenir desk is not drawn from a refused guest read', () => {
  const src = page('guests/souvenirs/page.tsx');
  const g = src.indexOf('guestsRawError ? (');
  const d = src.indexOf('<SouvenirDesk');
  assert.ok(g >= 0 && d > g, 'the desk branches on the refusal before drawing');
});

test('A2-G14: Contracts list and detail say "could not load", and the detail 404s only on an answered miss', () => {
  refusalComesFirst(page('contracts/page.tsx'), 'contractsRead === null ? (', 'No contracts yet', 'contracts');
  const detail = page('contracts/[contractId]/page.tsx');
  assert.match(detail, /readContract\(supabase, contractId\)/);
  assert.doesNotMatch(detail, /fetchContract\(/);
  assert.ok(detail.indexOf('if (read.failed)') < detail.indexOf('notFound()'));
});

test('A2-I8: Paperwork never offers "Start your checklist" over a refused read', () => {
  const src = page('paperwork/page.tsx');
  assert.match(src, /readEventPaperwork\(supabase, eventId\)/);
  const g = src.indexOf('if (rowsRead === null) {');
  const seed = src.indexOf('const needsSeed');
  assert.ok(g >= 0 && seed > g, 'the refusal returns before needsSeed is worked out');
});

test('A2-I9: Paperwork for a non-wedding event says what it is, never a blank page', () => {
  assert.match(page('paperwork/page.tsx'), /This event has no government paperwork to track/);
});

test('A2-I5: Documents keeps every failure and never draws "No documents yet" over one', () => {
  const src = page('documents/page.tsx');
  assert.doesNotMatch(src, /\.catch\(\(\) => \[\]\)/, 'no failure is folded into an empty list');
  assert.match(src, /receiptsRefused/);
  assert.match(src, /totalDocs === 0 && refusedParts\.length > 0 \? null/);
});

test('A2-G10: Find never prints "0 suppliers" for a refused category search', () => {
  const src = page('vendors/categories/page.tsx');
  const g = src.indexOf('res.unreadable ? (');
  const count = src.indexOf('suppliers`');
  assert.ok(g >= 0 && count > g, 'the refusal is drawn before the count');
  assert.match(src, /res\.unreadable \|\| empty === 'nobody_free' \? null/);
  assert.match(src, /res\.unreadable \? null : empty \?/);
});
