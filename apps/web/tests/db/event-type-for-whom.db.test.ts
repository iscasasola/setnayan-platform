/**
 * GUARD — the database half of "For ▾" (owner 2026-10-26).
 *
 * Owner, verbatim: "if i click for you, and it i don't have a debut, it should not show. same concept to the
 * christening, wake … If it is for a business, only business related events … For someone else, shows everything."
 * · "wake is if your declared passed away. so the event you can only make is anniversary or wake/funeral."
 *
 * Migration 20271292363990 adds `event_type_vocab.for_whom` — the ONE source the create grid reads
 * (lib/create-subjects.ts `forWhomHiddenTypes`) and Admin › Event types edits. Held here:
 *   1. the starting rule as seeded, for the types the owner named;
 *   2. only the four words may be stored;
 *   3. a type added later is shown to people, not to a business or a memorial.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});
after(async () => {
  await db?.close();
});

async function forWhom(key: string): Promise<string[] | null> {
  const r = await db.query<{ for_whom: string[] }>('SELECT for_whom FROM public.event_type_vocab WHERE event_type = $1', [key]);
  return r.rows[0]?.for_whom ?? null;
}

test('the seeded rule: no christening or wake for yourself; a wake only for someone who passed away', async () => {
  const rows = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM public.event_type_vocab');
  assert.ok((rows.rows[0]?.n ?? 0) > 0, 'the replay seeded no event types — this test would prove nothing');
  const christening = await forWhom('christening');
  if (christening) assert.deepEqual(christening, ['someone']);
  const wake = await forWhom('wake');
  if (wake) assert.deepEqual(wake, ['memorial']);
  const anniversary = await forWhom('anniversary');
  if (anniversary) assert.deepEqual(anniversary, ['self', 'someone', 'memorial', 'business']);
  assert.deepEqual(await forWhom('wedding'), ['self', 'someone'], 'a wedding is for people, never a business');
  const debut = await forWhom('debut');
  if (debut) assert.deepEqual(debut, ['self', 'someone'], 'the debut AGE band is code (life-event-gate), not a mode');
  const corporate = await forWhom('corporate');
  if (corporate) assert.ok(corporate.includes('business'));
});

test('only the four words may be stored', async () => {
  let msg = '';
  try {
    await db.query("UPDATE public.event_type_vocab SET for_whom = ARRAY['self','pets'] WHERE event_type = 'wedding'");
  } catch (e) {
    msg = (e as Error).message;
  }
  assert.match(msg, /event_type_vocab_for_whom_vocab/);
});

test('a type added later is shown to people — not to a business, not to a memorial', async () => {
  await db.query(
    "INSERT INTO public.event_type_vocab (event_type, label_en, sort_order, status) VALUES ('for_whom_probe', 'Probe', 999, 'active')",
  );
  assert.deepEqual(await forWhom('for_whom_probe'), ['self', 'someone']);
});
