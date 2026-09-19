/**
 * SUP-106 · THE DELETE DIALOG'S SENTENCE ABOUT SUPPLIERS IS READ OUT OF THE SCHEMA.
 *
 * `SupplierRecordsNote` in `app/dashboard/(launcher)/_components/event-card-menu.tsx`
 * tells a couple, immediately before an irreversible press, what their
 * suppliers keep and what they lose. It DESCRIBES today's behaviour (DATA-01 is
 * an open owner question), so the only way it goes wrong is the behaviour
 * changing underneath it. This pins each clause to the rule that makes it true:
 * change an FK and this goes red, pointing at the sentence to rewrite.
 *
 * The "confirmed payment receipts are kept, scrubbed" clause is proved by
 * `the-money-outlives-the-event.db.test.ts` (real INSERT → DELETE → assert),
 * which this file checks still exists rather than duplicating.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

/** ON DELETE rule of every FK from `table` to public.events ('c' cascade, 'n' set null …). */
async function onDelete(table: string): Promise<string[]> {
  const r = await db.query<{ rule: string }>(
    `SELECT c.confdeltype::text AS rule
       FROM pg_constraint c
      WHERE c.contype = 'f'
        AND c.confrelid = 'public.events'::regclass
        AND c.conrelid = $1::regclass`,
    [`public.${table}`],
  );
  return r.rows.map((x) => x.rule);
}

const KEPT = ['vendor_proposals', 'vendor_contracts', 'vendor_reviews'] as const;
const REMOVED = ['chat_threads', 'chat_messages', 'event_vendor_payment_plan', 'vendor_guest_deliveries'] as const;

for (const table of KEPT) {
  test(`"…plus the proposals and contracts they sent you" — ${table} survives the event`, async () => {
    const rules = await onDelete(table);
    assert.ok(rules.length > 0, `${table} no longer references events — the sentence needs re-measuring`);
    assert.ok(
      rules.every((r) => r === 'n'),
      `${table} → events is now ${rules.join(',')}, not SET NULL. The delete dialog tells couples ` +
        `suppliers KEEP this; rewrite SupplierRecordsNote in event-card-menu.tsx.`,
    );
  });
}

for (const table of REMOVED) {
  test(`"…are removed with it" — ${table} cascades with the event`, async () => {
    const rules = await onDelete(table);
    assert.ok(rules.length > 0, `${table} no longer references events — the sentence needs re-measuring`);
    assert.ok(
      rules.includes('c'),
      `${table} → events no longer cascades (${rules.join(',')}). The delete dialog tells couples ` +
        `this is REMOVED; if suppliers now keep it, rewrite SupplierRecordsNote and say so.`,
    );
  });
}

test('the receipts clause is still proved by a real delete, and the dialog still says it', () => {
  assert.ok(
    existsSync(join(__dirname, 'the-money-outlives-the-event.db.test.ts')),
    'the test proving confirmed receipts survive is gone — the dialog’s receipts clause is unproved',
  );
  const menu = readFileSync(
    join(__dirname, '../../app/dashboard/(launcher)/_components/event-card-menu.tsx'),
    'utf8',
  );
  assert.equal((menu.match(/<SupplierRecordsNote \/>/g) ?? []).length, 1, 'the note is not mounted exactly once');
  assert.match(menu, /<PermanenceWarning \/>\s*<SupplierRecordsNote \/>/, 'the note must sit beside the button, with the permanence warning');
});
