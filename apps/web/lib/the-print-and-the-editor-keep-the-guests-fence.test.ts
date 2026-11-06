/**
 * 🔒 THE PRINT AND THE EDITOR KEEP THE GUESTS' FENCE — DB, pages and prints say
 * one thing about which schedule moments guests are told about: public · for
 * Everyone · released (owner 2026-10-06 DECISION_LOG "STUDIO › SCHEDULE AND LOVE
 * STORY": a moment for a role is shown only to that role).
 *
 *   · the database's anonymous read — migration 20271267138064;
 *   · the printed Details card's programme (`printProgram`, lib/print-pieces.ts,
 *     fed by lib/print-set.server.ts) — guests are handed that card; before, it
 *     listed every `is_public` top-level moment whoever it was for;
 *   · the older website editor's schedule panel
 *     (app/dashboard/[eventId]/website/editor/page.tsx) — it says it shows "the
 *     same set guests see"; before, it asked `is_public` only, so a host saw their
 *     role-only moments listed as if guests saw them.
 *
 * Sabotage (each seen red, then restored): drop the audience condition from
 * `isOnTheGuestsSchedule`; put the old hand-typed `is_public` filter back in the
 * print; drop `audience` from the print's select; drop either new condition from
 * the editor read; drop `AND audience IS NULL` from the migration.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isOnTheGuestsSchedule } from './schedule-audience';
import { printProgram } from './print-pieces';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const REPO = join(WEB, '..', '..');
const code = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

/** One moment per way of being kept from the room, and one for everybody. */
const MOMENTS = [
  { label: 'Guests arrive', start_at: '2031-03-13T13:30:00+00:00', is_public: true, audience: null, visibility: 'couple_visible', parent_block_id: null },
  { label: 'Entourage photos', start_at: '2031-03-13T13:00:00+00:00', is_public: true, audience: 'entourage', visibility: 'couple_visible', parent_block_id: null },
  { label: 'Sponsors signing', start_at: '2031-03-13T13:10:00+00:00', is_public: true, audience: 'sponsors', visibility: 'couple_visible', parent_block_id: null },
  { label: 'Family portrait', start_at: '2031-03-13T13:20:00+00:00', is_public: true, audience: 'family', visibility: 'couple_visible', parent_block_id: null },
  { label: 'Suppliers call time', start_at: '2031-03-13T12:00:00+00:00', is_public: true, audience: 'suppliers', visibility: 'couple_visible', parent_block_id: null },
  { label: 'Coordinator prep', start_at: '2031-03-13T12:30:00+00:00', is_public: true, audience: null, visibility: 'coordinator_only', parent_block_id: null },
  { label: 'Hidden rehearsal', start_at: '2031-03-13T11:00:00+00:00', is_public: false, audience: null, visibility: 'couple_visible', parent_block_id: null },
  { label: 'Ceremony', start_at: '2031-03-13T14:00:00+00:00', is_public: true, audience: null, visibility: 'couple_visible', parent_block_id: null },
] as const;

const KEPT_FROM_THE_ROOM = ['Entourage photos', 'Sponsors signing', 'Family portrait', 'Suppliers call time', 'Coordinator prep', 'Hidden rehearsal'];

test('isOnTheGuestsSchedule: public, for Everyone, released — and nothing else', () => {
  const on = MOMENTS.filter(isOnTheGuestsSchedule).map((m) => m.label);
  assert.deepEqual(on, ['Guests arrive', 'Ceremony']);
  // Strict where the database is strict: only NULL is Everyone; an unknown word is never read as wider.
  assert.equal(isOnTheGuestsSchedule({ is_public: true, audience: 'everyone', visibility: 'couple_visible' }), false);
  assert.equal(isOnTheGuestsSchedule({ is_public: null, audience: null }), false, 'a moment not marked public is not on it');
  // A row read without the visibility column is not staged (the column defaults to couple_visible).
  assert.equal(isOnTheGuestsSchedule({ is_public: true, audience: null }), true);
});

test('the printed programme names only the Everyone moments', () => {
  const lines = printProgram(MOMENTS);
  assert.equal(lines.length, 2, `the programme printed ${JSON.stringify(lines)}`);
  assert.match(lines[0]!, /· Guests arrive$/);
  assert.match(lines[1]!, /· Ceremony$/);
  const all = lines.join('\n');
  for (const label of KEPT_FROM_THE_ROOM) assert.ok(!all.includes(label), `the guests' card prints "${label}"`);
});

test('the printed programme keeps its own shape — top level, timed, named, at most eight', () => {
  const base = { is_public: true, audience: null, visibility: 'couple_visible' } as const;
  const lines = printProgram([
    { ...base, label: 'Procession', start_at: '2031-03-13T14:05:00+00:00', parent_block_id: 'p1' },
    { ...base, label: 'Untimed', start_at: null, parent_block_id: null },
    { ...base, label: null, start_at: '2031-03-13T15:00:00+00:00', parent_block_id: null },
    ...Array.from({ length: 10 }, (_, i) => ({ ...base, label: `Moment ${i + 1}`, start_at: `2031-03-13T1${i}:00:00+00:00`, parent_block_id: null })),
  ]);
  assert.equal(lines.length, 8);
  assert.ok(lines.every((l) => /^\S.* · Moment \d+$/.test(l)), JSON.stringify(lines));
});

test('the print reads the two columns the fence needs, and hands the programme to printProgram', () => {
  const src = code('lib/print-set.server.ts');
  const select = src.match(/from\('event_schedule_blocks'\)\s*\.select\('([^']+)'\)/);
  assert.ok(select, 'the print no longer reads the schedule the way this guard expects');
  const cols = select![1]!.split(',').map((c) => c.trim());
  for (const c of ['is_public', 'audience', 'visibility']) assert.ok(cols.includes(c), `the print's schedule read lost ${c} — the fence would be blind`);
  assert.match(src, /program:\s*inc\.schedule\s*\?\s*printProgram\(blocks\)\s*:\s*\[\]/, 'the Details programme is not printProgram');
  assert.doesNotMatch(src, /\.filter\(\(b\)\s*=>\s*b\.is_public/, 'a hand-typed is_public filter is back in the print');
});

test('the website editor\'s "same set guests see" asks the same three conditions', () => {
  const src = code('app/dashboard/[eventId]/website/editor/page.tsx');
  const reads = src.split(".from('event_schedule_blocks')").slice(1);
  assert.equal(reads.length, 1, 'the editor reads the schedule more (or fewer) times than this guard knows');
  const chain = reads[0]!.slice(0, reads[0]!.indexOf(';'));
  assert.match(chain, /\.eq\('is_public', true\)/, 'the editor panel lost "public"');
  assert.match(chain, /\.is\('audience', null\)/, 'the editor panel lists role-only moments as guests\' schedule');
  assert.match(chain, /\.neq\('visibility', 'coordinator_only'\)/, 'the editor panel lists unreleased prep as guests\' schedule');
});

test('the database says the same thing — its anonymous read asks the same three conditions', () => {
  // Raw SQL: its header never says CREATE POLICY, so the match lands on the statement.
  const sql = readFileSync(join(REPO, 'supabase/migrations/20271267138064_guests_schedule_read_is_for_everyone.sql'), 'utf8');
  const policy = sql.match(/CREATE POLICY event_schedule_blocks_public_read[\s\S]*?USING \(([\s\S]*?)\);/);
  assert.ok(policy, 'the anonymous policy is not in the migration');
  const using = policy![1]!.replace(/\s+/g, ' ');
  assert.match(using, /is_public = TRUE/);
  assert.match(using, /visibility <> 'coordinator_only'/);
  assert.match(using, /audience IS NULL/);
});
