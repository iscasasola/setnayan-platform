/**
 * Guard — the supplier can actually be told, and actually answer.
 *
 * The handshake shipped 2026-08-21 with the database half live and NOTHING
 * rendering it: a supplier could be asked and could not reply. These pin the
 * three seams where that would silently happen again.
 */
import { strict as assert } from 'node:assert';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => stripComments(readFileSync(resolve(HERE, p), 'utf8'));

const OVERVIEW = '../lib/vendor-overview.ts';
const SECTIONS = '../app/vendor-dashboard/_components/overview-sections.tsx';
const ASK = '../app/dashboard/[eventId]/delete-actions.ts';
const MENU = '../app/dashboard/(launcher)/_components/event-card-menu.tsx';
const EMIT = '../lib/notification-emit.ts';

test('the four notification types are Postgres enum values, not TS-only', () => {
  /*
    🔑 THE FAILURE WOULD BE SILENT. `notification_type` is a Postgres ENUM. A
    TS-only union member typechecks and then the INSERT fails at runtime — and
    `emitNotification` only console.errors a failed insert, so the supplier is
    told nothing and nothing throws. Same family as the phantom column and the
    phantom RPC argument.
  */
  const migrations = resolve(HERE, '../../../supabase/migrations');
  const { readdirSync } = require('node:fs') as typeof import('node:fs');
  const sql = readdirSync(migrations)
    .filter((f) => f.includes('notification_type_deletion_request'))
    .map((f) => readFileSync(resolve(migrations, f), 'utf8'))
    .join('\n');
  assert.ok(sql.length > 0, 'no migration adds the deletion_request enum values');
  for (const t of [
    'deletion_request_received',
    'deletion_request_nudge',
    'deletion_request_agreed',
    'deletion_request_declined',
  ]) {
    assert.match(
      sql,
      new RegExp(`ADD VALUE IF NOT EXISTS '${t}'`),
      `${t} is a TypeScript union member with no enum value — the insert fails ` +
        'at runtime and nobody is ever told',
    );
  }
  // ⚠ Its own file, no transaction: Postgres forbids USING a new enum value in
  // the transaction that adds it.
  assert.doesNotMatch(sql, /\bBEGIN;/, 'the enum migration must not open a transaction');
});

test('asking a supplier actually notifies them', () => {
  // The RPC marks rows; it does not speak to anybody. A supplier who is never
  // told cannot answer, which leaves the couple blocked forever by a question
  // nobody knows was asked.
  assert.match(
    read(ASK),
    /type: 'deletion_request_received'/,
    'askSuppliersToAgree no longer tells the suppliers — the ask is invisible',
  );
});

test('the deletion emails are transactional, never marketing-gated', () => {
  const src = read(EMIT);
  const gatedStart = src.indexOf('const MARKETING_GATED_EMAIL_TYPES');
  const gated = src.slice(gatedStart, src.indexOf(']);', gatedStart));
  assert.ok(
    !gated.includes('deletion_request'),
    'a deletion_request type is marketing-gated — marketing_opt_in defaults ' +
      'FALSE, so it would never send, exactly as all six lock_request types ' +
      'silently did not',
  );
  const emailStart = src.indexOf('const EMAIL_ENABLED_TYPES');
  const email = src.slice(emailStart, src.indexOf(']);', emailStart));
  assert.ok(
    email.includes('deletion_request_received'),
    'the supplier gets no email when asked, and email is most of the channel',
  );
});

test('the card is mounted, not merely defined', () => {
  // 🔑 A component that exists and is never rendered is the shape this whole
  // feature was in yesterday.
  assert.match(
    read(SECTIONS),
    /card\.kind === 'delete_request' \? \(/,
    'DeleteRequestBody is defined but nothing dispatches to it',
  );
  /*
    🪤 COUNTED, NOT MATCHED. `agreeDeletion={agreeDeletion}` appears TWICE — once
    where the feed passes it down, once where the card body receives it. A
    `match` is satisfied by either, so deleting one left this green while the
    buttons were dead. Both seams must exist.
  */
  const passes = (read(SECTIONS).match(/agreeDeletion=\{agreeDeletion\}/g) ?? []).length;
  assert.equal(
    passes,
    2,
    `agreeDeletion is wired at ${passes} of the 2 seams (the feed passing it ` +
      'down, and the card receiving it). One missing means the buttons do nothing.',
  );
});

test('the request fetch runs BEFORE the event-meta read', () => {
  /*
    🪤 THEY USED TO SHARE A Promise.all, so the request event ids could never be
    in `eventIds` and every card rendered `eventDate: null` — a card asking a
    supplier to commit to a day that never named the day. Ordering is the fix,
    so ordering is what is pinned.
  */
  const src = read(OVERVIEW);
  const fetchAt = src.indexOf('fetchDeletionRequests(admin, vendorProfileId)');
  const metaAt = src.indexOf('const eventMeta = await fetchEventMeta(');
  assert.ok(fetchAt > 0, 'fetchDeletionRequests is never called');
  assert.ok(metaAt > 0, 'the meta read was restructured — recheck this guard');
  assert.ok(
    fetchAt < metaAt,
    'the deletion fetch runs after the meta read again, so no card can show a date',
  );
  assert.match(
    src,
    /\.\.\.deletionRequests\.map\(\(r\) => r\.eventId\)/,
    'the deletion event ids are not fed into the meta lookup',
  );
});

test('the couple can withdraw the ask', () => {
  // withdrawSupplierAsk shipped with ZERO callers while its own docblock cited
  // cancel_vendor_lock_request — granted, tested, uncallable for its whole life
  // — as the thing not to repeat.
  assert.match(
    read(MENU),
    /withdrawSupplierAsk\(fd\)/,
    'the withdraw is unreachable again — a couple who asks by mistake is stuck',
  );
});
