/**
 * 👥 A SCHEDULE MOMENT IS FOR SOMEONE (owner 2026-10-06 DECISION_LOG "STUDIO ›
 * SCHEDULE AND LOVE STORY": For ▾ Everyone · Entourage · Sponsors · Family ·
 * Suppliers; stored 2026-10-07 "THE MISSING FIELDS ARE APPROVED").
 *
 * Holds: the vocabulary and its stored form (Everyone = NULL, never a word); the
 * guests' schedule is the Everyone moments only — on BOTH guest readers (the
 * public fetch and the couple's guest preview filter); the one writer accepts
 * the field and refuses an unknown word; the column's CHECK names exactly the
 * stored four; and For ▾ is one PickMenu, drawn only in the new Maker's Studio.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  SCHEDULE_AUDIENCES,
  STORED_SCHEDULE_AUDIENCES,
  momentsForAudience,
  momentsForEveryone,
  readScheduleAudience,
  scheduleAudienceForWrite,
} from './schedule-audience';
import { filterBlocksForAudience } from './schedule-ros';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('the five, in the owner order — Everyone is the absence', () => {
  assert.deepEqual([...SCHEDULE_AUDIENCES], ['everyone', 'entourage', 'sponsors', 'family', 'suppliers']);
  assert.equal(scheduleAudienceForWrite('everyone'), null, 'Everyone is stored as NULL');
  assert.equal(scheduleAudienceForWrite('entourage'), 'entourage');
  assert.equal(scheduleAudienceForWrite('ninang'), undefined, 'an unknown word is refused');
  assert.equal(readScheduleAudience(null), 'everyone', 'every moment made before this reads as Everyone');
  assert.equal(readScheduleAudience('everyone'), 'everyone');
  assert.equal(readScheduleAudience('garbage'), 'everyone', 'unknown never narrows a moment');
});

const blocks = [
  { block_id: 'a', parent_block_id: null, is_public: true, audience: null },
  { block_id: 'b', parent_block_id: null, is_public: true, audience: 'entourage' },
  { block_id: 'c', parent_block_id: null, is_public: false, audience: null },
  { block_id: 'd', parent_block_id: null, is_public: true, audience: 'family' },
];

test('the guests’ schedule is the Everyone moments only; a role reads its own (Arrive by)', () => {
  assert.deepEqual(momentsForEveryone(blocks).map((b) => b.block_id), ['a', 'c']);
  assert.deepEqual(filterBlocksForAudience(blocks, { kind: 'guest' }).map((b) => b.block_id), ['a']);
  assert.deepEqual(filterBlocksForAudience(blocks, { kind: 'couple' }).map((b) => b.block_id), ['a', 'b', 'c', 'd'], 'the couple sees all');
  assert.deepEqual(momentsForAudience(blocks, 'entourage').map((b) => b.block_id), ['b']);
});

test('the public fetch leaves role moments out, by the stored NULL', () => {
  const src = read('lib/schedule.ts');
  const fn = src.slice(src.indexOf('export async function fetchPublicScheduleBlocks'));
  assert.match(fn.slice(0, fn.indexOf('\n}\n')), /\.is\('audience', null\)/, 'fetchPublicScheduleBlocks no longer filters to Everyone');
  assert.match(src, /const SELECT =\s*\n\s*'[^']*\baudience'/, 'the canonical schedule SELECT does not read audience');
});

test('the one writer takes For ▾ and refuses an unknown word', () => {
  const src = read('app/dashboard/[eventId]/schedule/actions.ts');
  const fn = src.slice(src.indexOf('export async function updateScheduleBlock'));
  const body = fn.slice(0, fn.indexOf('\nexport async function'));
  assert.match(body, /formData\.get\('audience'\)/);
  assert.match(body, /scheduleAudienceForWrite\(audienceRaw\)/);
  assert.match(body, /throw new Error\('Invalid audience'\)/);
});

test('the column CHECK holds exactly the stored four', () => {
  const dir = join(ROOT, '..', '..', 'supabase', 'migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_studio_missing_fields.sql'));
  assert.ok(file, 'the missing-fields migration is gone');
  const sql = readFileSync(join(dir, file!), 'utf8');
  const m = sql.match(/audience IN \(([^)]*)\)/);
  assert.ok(m, 'no audience CHECK');
  assert.deepEqual(m![1]!.split(',').map((v) => v.trim().replace(/'/g, '')), [...STORED_SCHEDULE_AUDIENCES]);
});

test('For ▾ is ONE PickMenu over the five, drawn only in the Studio', () => {
  const src = read('app/dashboard/[eventId]/schedule/_components/moment-inspector.tsx');
  assert.match(src, /const studio = useMaker\(\)\?\.stagesStudio === true;/);
  const at = src.indexOf('data-moment-for=""');
  assert.ok(at > 0, 'For ▾ is gone');
  const block = src.slice(src.lastIndexOf('{studio ? (', at), at + 1400);
  assert.match(block, /<PickMenu[\s\S]*options=\{SCHEDULE_AUDIENCE_OPTIONS\}/);
  assert.match(block, /updateScheduleBlock\(toFormData\(\{ event_id: eventId, block_id: m\.block_id, audience: key \}\)\)/);
});
