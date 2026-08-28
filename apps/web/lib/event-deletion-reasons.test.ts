/**
 * event-deletion-reasons.test.ts — the refusal says WHICH money, the door is
 * offered for exactly the two blocks that have one, and the reason survives the
 * celebration it is about.
 *
 * ─── WHAT THIS EXISTS TO CATCH ─────────────────────────────────────────────
 * Owner 2026-08-28, looking at the shipped panel: ***"still failed to
 * identify"***. Four different situations wore one sentence, and on the only
 * celebration in production it has ever been shown for that sentence was not
 * even true — the bill was still `submitted` and the payment still `pending`.
 * Nothing had been confirmed.
 *
 * Every source assertion runs over `stripComments` output and is anchored to an
 * ACT — a rendered element, a called helper, a written column — never to a bare
 * identifier: this feature is NAMED in a dozen comments across the files it
 * touches, so an unstripped match would pass with the code deleted. Each was
 * mutation-checked with the occurrence count printed before → after:
 *
 *   blockKind( in delete-actions.ts                    1 → 0   RED
 *   the awaiting_check sentence                        1 → 0   RED
 *   pendingPayments read                               1 → 0   RED
 *   status: 'self_removed' insert                      1 → 0   RED
 *   NO foreign key on event_id in the migration        0 → 1   RED
 *   REVOKE ... FROM authenticated in the migration     1 → 0   RED
 *   ReasonPicker mounted on the ordinary removal       2 → 1   RED
 *   event_deletion_answered in the enum migration      1 → 0   RED
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import {
  DELETION_REASONS,
  blockCanBeAsked,
  blockKind,
  deletionReasonLabel,
  isDeletionReasonCode,
  reasonIsComplete,
} from '@/lib/event-deletion-reasons';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..', 'app');
const MIGRATIONS = resolve(HERE, '..', '..', '..', 'supabase', 'migrations');

const read = (p: string) => stripComments(readFileSync(p, 'utf8'));
const count = (h: string, n: string) => h.split(n).length - 1;

/** The migration by content, not by a remembered filename. */
function migrationNaming(marker: string): string {
  const hit = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => join(MIGRATIONS, f))
    .find((f) => readFileSync(f, 'utf8').includes(marker));
  assert.ok(hit, `No migration mentions ${marker}.`);
  return readFileSync(hit as string, 'utf8');
}

// ── the vocabulary ──────────────────────────────────────────────────────────

test('six reasons, and the codes are what the database will accept', () => {
  assert.equal(DELETION_REASONS.length, 6);
  const sql = migrationNaming('event_deletion_requests');
  for (const r of DELETION_REASONS) {
    assert.ok(
      sql.includes(`'${r.code}'`),
      `The reason code ${r.code} is not in the table's CHECK constraint. A code ` +
        `the database refuses is refused, not thrown — the row simply never ` +
        `lands and nobody is told.`,
    );
    /*
      🪤 CAST TO `string` BOTH SIDES. `DELETION_REASONS` is `as const`, so the
      labels and the codes are two literal unions with no member in common —
      TypeScript reads the comparison as always-true and refuses to compile it.
      The check is still worth making at runtime: a label left equal to its code
      is somebody's placeholder shown to a person.
    */
    assert.ok(
      r.label.length > 0 && (r.label as string) !== (r.code as string),
      `The reason ${r.code} has no words of its own.`,
    );
  }
  assert.ok(!isDeletionReasonCode('anything_else'));
  assert.equal(deletionReasonLabel('made_by_mistake'), 'Made it by mistake');
});

test('"something else" is the only answer that needs words', () => {
  assert.ok(reasonIsComplete('not_happening', ''));
  assert.ok(reasonIsComplete('not_happening', null));
  assert.ok(!reasonIsComplete('other', ''));
  assert.ok(!reasonIsComplete('other', '   '));
  assert.ok(reasonIsComplete('other', 'the venue burned down'));
  assert.ok(!reasonIsComplete('', 'words with no answer'));
});

// ── which money is in the way ───────────────────────────────────────────────

const NOTHING = {
  unreadable: false,
  unsettledPaidSuppliers: 0,
  settledOrders: 0,
  receiptRows: 0,
  matchedPayments: 0,
  pendingPayments: 0,
};

test('a payment nobody has checked is NOT "already paid for"', () => {
  /*
    This is the celebration in the owner's screenshot, read out of production:
    one bill, `submitted`; one GCash payment, `pending`; no receipt. The old
    panel called that "already been paid for".
  */
  assert.equal(blockKind({ ...NOTHING, pendingPayments: 1 }), 'awaiting_check');
  assert.equal(blockKind({ ...NOTHING, settledOrders: 1 }), 'settled');
  assert.equal(blockKind({ ...NOTHING, receiptRows: 1 }), 'settled');
  assert.equal(blockKind({ ...NOTHING, matchedPayments: 1 }), 'settled');
});

test('confirmed money outranks an unchecked payment', () => {
  // A celebration can have both. Saying "we are still checking" to somebody
  // whose receipt we have already issued is the wrong half of the truth.
  assert.equal(
    blockKind({ ...NOTHING, matchedPayments: 1, pendingPayments: 3 }),
    'settled',
  );
});

test('the old order survives: unreadable first, then suppliers', () => {
  assert.equal(
    blockKind({ ...NOTHING, unreadable: true, settledOrders: 9 }),
    'unreadable',
  );
  assert.equal(
    blockKind({ ...NOTHING, unsettledPaidSuppliers: 2, settledOrders: 9 }),
    'suppliers',
  );
});

test('nothing in the way is not a block', () => {
  assert.equal(blockKind(NOTHING), null);
  assert.equal(blockCanBeAsked(null), false);
});

test('only our own money gets the "ask us" door', () => {
  assert.ok(blockCanBeAsked('settled'));
  assert.ok(blockCanBeAsked('awaiting_check'));
  // A supplier block has its own, better door — it asks the suppliers.
  assert.ok(!blockCanBeAsked('suppliers'));
  // ⛔ And an unreadable one keeps its dead end: there is nothing to request
  // about, because we do not yet know whether there is anything to request
  // about. A button there is a door to a room we cannot describe.
  assert.ok(!blockCanBeAsked('unreadable'));
});

// ── the callers ─────────────────────────────────────────────────────────────

test('the impact read names the block and counts pending payments apart', () => {
  const src = read(resolve(APP, 'dashboard', '[eventId]', 'delete-actions.ts'));
  assert.equal(
    count(src, 'blockKind({'),
    1,
    'The impact read must resolve WHICH block it is. Without it every refusal ' +
      'wears one sentence again — the defect the owner named.',
  );
  /*
    🪤 THIS ASSERTION WAS DECORATION ON ITS FIRST RUN AND THE MUTATION CAUGHT
    IT. It matched a bare `.eq('status', 'pending')` — which the read of the
    couple's own OPEN REQUEST also satisfies, three functions away. Flipping the
    payments query to 'matched' left it green while the whole
    pending-vs-matched distinction was gone. Anchored to the payments query
    itself now: every `.from('payments')` is taken with the code that follows
    it, and BOTH statuses have to appear among them.
  */
  const payStatuses = new Set<string>();
  let at = src.indexOf("from('payments')");
  while (at >= 0) {
    const window = src.slice(at, at + 220);
    for (const m of window.matchAll(/\.eq\('status', '([a-z_]+)'\)/g)) {
      // `noUncheckedIndexedAccess` — a capture group is `string | undefined`
      // even when the pattern guarantees it. Skip rather than store `undefined`.
      if (m[1]) payStatuses.add(m[1]);
    }
    at = src.indexOf("from('payments')", at + 1);
  }
  assert.ok(
    payStatuses.has('matched') && payStatuses.has('pending'),
    'Pending payments must be counted apart from matched ones. They are ' +
      'different facts and only one of them means we have the money. Found: ' +
      JSON.stringify([...payStatuses]),
  );
  assert.match(
    src,
    /still checking a payment/,
    'The awaiting-check sentence must exist and must not claim the money arrived.',
  );
});

test('the reason is written BEFORE the celebration is deleted', () => {
  const src = read(resolve(APP, 'dashboard', '[eventId]', 'delete-actions.ts'));
  const insertAt = src.indexOf("status: 'self_removed'");
  const deleteAt = src.indexOf(".from('events')\n    .delete()");
  assert.ok(insertAt > 0, 'Nothing records why an ordinary removal happened.');
  assert.ok(
    deleteAt > 0 && insertAt < deleteAt,
    'The reason must be written before the DELETE. Afterwards the celebration ' +
      'is gone and so is the name we snapshot from it.',
  );
});

test('the reason row outlives the celebration it is about', () => {
  const sql = migrationNaming('event_deletion_requests');
  const table = sql.slice(
    sql.indexOf('CREATE TABLE IF NOT EXISTS public.event_deletion_requests'),
    sql.indexOf('CREATE INDEX'),
  );
  const eventIdLine = table
    .split('\n')
    .find((l) => l.trim().startsWith('event_id'));
  assert.ok(eventIdLine, 'event_id must exist on the table.');
  assert.ok(
    !/REFERENCES/i.test(eventIdLine as string),
    'event_id must carry NO foreign key. A self_removed row is written moments ' +
      'before the celebration is deleted — a cascade would take the answer ' +
      'with it, and SET NULL would leave a reason attached to nothing.',
  );
  assert.match(
    table,
    /event_name\s+TEXT NOT NULL/,
    'The name must be snapshotted; nothing can resolve it after the delete.',
  );
});

test('the new table is not born wide open', () => {
  const sql = migrationNaming('event_deletion_requests');
  /*
    🪤 MEASURED, NOT ASSUMED. Dry-running this migration against production
    inside a rolled-back transaction showed `authenticated` holding all seven
    privileges after a REVOKE that named only PUBLIC and anon — a GRANT adds,
    it does not narrow. This asserts the revoke that actually did the work.
  */
  for (const role of ['PUBLIC', 'anon', 'authenticated']) {
    assert.ok(
      sql.includes(
        `REVOKE ALL ON public.event_deletion_requests FROM ${role};`,
      ),
      `A new public table in this schema is created with every privilege for ` +
        `anon AND authenticated. ${role} must be revoked before anything is ` +
        `granted back.`,
    );
  }
  /*
    🚨 PER-COLUMN, BECAUSE THE ROW IS YOURS AND THE FIELD IS NOT. A table-level
    GRANT UPDATE plus the cancel policy is NOT "they may cancel": that policy's
    WITH CHECK constrains user_id and status and says nothing about the other
    nine columns, so one update satisfying it could also rewrite `admin_note` —
    our answer to them — or `reason_code`, or `event_name`. RLS is ROW-level and
    can never protect a column.
  */
  assert.match(
    sql,
    /GRANT UPDATE \(status\) ON public\.event_deletion_requests TO authenticated;/,
    'UPDATE must be granted on `status` alone. Anything wider lets the person ' +
      'who filed a request rewrite the answer they were given.',
  );
  assert.ok(
    !/GRANT INSERT[^;]*\bstatus\b/i.test(sql),
    'INSERT must not name `status` — a filed request can then only take the ' +
      'column default `pending`, so nobody posts one already approved.',
  );
  assert.ok(
    !/GRANT SELECT \([^)]*reviewed_by/i.test(sql),
    '`reviewed_by` is the user id of the member of staff who answered. It is ' +
      'somebody else’s identity and of no use to the person asking — the ' +
      'answer itself reaches them in `admin_note`.',
  );
  assert.ok(
    !/GRANT[^;]*DELETE[^;]*TO authenticated/i.test(sql),
    'Nothing in the product deletes one of these rows.',
  );
  /*
    🪤 ANCHORED TO `CREATE POLICY edr_`, NOT TO `CREATE POLICY`. The migration's
    own header warns, in prose, that a policy with no TO clause defaults to
    PUBLIC — so a bare split counted the WARNING as a sixth policy. A guard that
    matches the sentence explaining a rule is not measuring the rule.
  */
  const policyBlocks = sql.split('CREATE POLICY edr_').slice(1);
  assert.equal(policyBlocks.length, 5, 'Five policies: three self, two admin.');
  for (const b of policyBlocks) {
    assert.ok(
      /\bTO authenticated\b/.test(b.slice(0, 400)),
      'CREATE POLICY with no TO clause defaults to PUBLIC, which includes anon.',
    );
  }
});

test('the notice we send back is a type the database actually has', () => {
  /*
    🚨 THREE NOTIFICATION TYPES HAVE SHIPPED IN THIS REPO THAT POSTGRES NEVER
    HAD. Every one typechecked, every INSERT was refused at runtime, and
    emitNotification only console.errors — so the person was simply never told.
  */
  const sql = migrationNaming("'event_deletion_answered'");
  assert.match(
    sql,
    /ALTER TYPE public\.notification_type ADD VALUE IF NOT EXISTS 'event_deletion_answered'/,
    'The enum value must be added in the same change as the code that emits it.',
  );
  const emit = read(resolve(HERE, 'notification-emit.ts'));
  assert.ok(
    emit.includes("'event_deletion_answered'"),
    'Our answer must reach somebody who is not in the app — the whole point of ' +
      'the request is that they could not do the thing themselves.',
  );
  const notif = read(resolve(HERE, 'notifications.ts'));
  assert.equal(
    count(notif, 'event_deletion_answered'),
    3,
    'The type needs its union member, its label and its colour. A missing ' +
      'label renders the raw enum name at a person.',
  );
});

test('the panel asks why on an ordinary removal AND on a request', () => {
  const src = read(
    resolve(APP, 'dashboard', '(launcher)', '_components', 'event-card-menu.tsx'),
  );
  /*
    🪤 A REGEX WITH A BOUNDARY, NOT A SUBSTRING COUNT. `count(src,
    '<ReasonPicker')` still matches `<ReasonPickerX`, so a rename-style mutation
    left the count at 2 and this assertion reported a clean pass — the same
    prefix trap that let `DISABLED_foo` satisfy a guard looking for `foo`.
  */
  assert.equal(
    (src.match(/<ReasonPicker[\s/>]/g) ?? []).length,
    2,
    'One picker, both places. If the blocked path offered a different set of ' +
      'reasons from the unblocked one, "why do people leave" would be two ' +
      'questions with two answers and neither could be added up.',
  );
  assert.match(
    src,
    /onClick=\{confirmDelete\}[\s\S]{0,300}?typed\.trim\(\)\.length === 0/,
    'Remove must wait on the typed name and NOTHING else. The reason is asked, ' +
      'never demanded — holding somebody’s own celebration hostage to a ' +
      'survey is the product asking a favour on the way out.',
  );
});

test('the HQ delete names Setnayan\'s own money before it destroys it', () => {
  /*
    🚨 THE SECOND DOOR. A couple's panel REFUSES on a settled bill, an official
    receipt or an unchecked payment. HQ → Accounts → Events has a Delete button
    that walks straight past that refusal — which is correct, because answering
    a couple's request IS a removal past the gate. What was wrong is that its
    confirmation named paid VENDORS and nothing else, so the one kind of money
    only HQ can destroy went unmentioned in the sentence somebody reads before
    pressing.

    It still does not block. The person deciding is shown the money first.
  */
  const src = read(
    resolve(APP, 'admin', 'accounts', '_surfaces', 'events-surface.tsx'),
  );
  assert.match(
    src,
    /const message = /,
    'The confirm message must still be composed here.',
  );
  /*
    🪤 THE INTERPOLATIONS ARE COUNTED, NOT THE VARIABLE. A bare /moneyNote/
    matches the `const moneyNote = …` declaration, which survives happily when
    every `${moneyNote}` is stripped out of the message — the mutation went 4→1
    and this assertion reported a clean pass. THREE branches compose that
    message and all three must carry it, or the one branch somebody forgot is
    the one an admin reads.
  */
  assert.equal(
    count(src, '${moneyNote}'),
    3,
    'All three branches of the confirm message must name what was paid to ' +
      'Setnayan, not only paid vendors. A settled bill and a BIR receipt are ' +
      'the part a couple cannot destroy themselves.',
  );
  assert.match(
    src,
    /We could NOT check what was paid to Setnayan/,
    'An unreadable money check must SAY so. A confident silence over a failed ' +
      'read is how this console already shipped a green tick on a query that ' +
      'never ran.',
  );
  for (const signal of ["'receipts'", "'payments'"]) {
    assert.ok(
      src.includes(signal),
      `The surface must read ${signal} — a bill's status alone is rewritable ` +
        `by the buyer, which is why the couple-side gate keys on these two.`,
    );
  }
});

test('the admin removal takes the photographs with it', () => {
  /*
    🚨 UNTIL 2026-08-28 IT DID NOT, and the couple's own confirmation says
    "your photos and everything about this celebration are deleted for good".
    A promise made on one screen is not kept by whichever path happens to run.
  */
  for (const p of [
    resolve(APP, 'admin', 'events', 'actions.ts'),
    resolve(APP, 'admin', 'event-deletions', 'actions.ts'),
  ]) {
    const src = read(p);
    const collectAt = src.indexOf('collectEventMediaRefs(');
    const deleteAt = src.indexOf(".from('events')");
    const sweepAt = src.indexOf('sweepEventMedia(');
    assert.ok(collectAt > 0, `${p} never collects the files.`);
    assert.ok(sweepAt > 0, `${p} never sweeps them.`);
    assert.ok(
      collectAt < deleteAt,
      `${p} collects the files after the DELETE. By then there is no row left ` +
        `to name them — the keys live on the rows that just disappeared.`,
    );
    assert.ok(sweepAt > deleteAt, `${p} sweeps before the row is really gone.`);
  }
});
