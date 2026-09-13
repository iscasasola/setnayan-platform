/**
 * THE DOOR ITSELF — does the guest's opt-out actually stop a row being written?
 *
 * `every-scan-goes-through-one-door.test.ts` proves nothing else writes the
 * table. This proves the thing everything now routes through does what the
 * switch says. Both halves are needed: a perfectly enforced choke point that
 * records everybody is the same product we had before.
 *
 * Every case below asserts on WHETHER AN INSERT WAS ISSUED, not on the return
 * value alone — the callers ignore the return value, so a function that
 * reported `declined` and inserted anyway would satisfy a weaker test and
 * violate every guest who used the switch.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { recordScan, anonymizeIp } from './scan-trail';

type Inserted = Record<string, unknown>;

/**
 * A Supabase client stub with exactly the two query shapes `recordScan` issues:
 * `from('guests').select().eq().eq().maybeSingle()` and
 * `from('scan_events').insert()`. Records every insert so the test can assert
 * on silence.
 */
function stubClient(opts: {
  guest?: { scan_tracking_opt_out: unknown } | null;
  readError?: { message: string };
  insertError?: { message: string };
  throwOn?: 'guests' | 'scan_events';
}) {
  const inserts: Inserted[] = [];
  const client = {
    from(table: string) {
      if (opts.throwOn === table) throw new Error(`no client for ${table}`);
      if (table === 'guests') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: opts.readError ? null : (opts.guest ?? null),
                  error: opts.readError ?? null,
                }),
              }),
            }),
          }),
        };
      }
      return {
        insert: async (row: Inserted) => {
          inserts.push(row);
          return { error: opts.insertError ?? null };
        },
      };
    },
  } as never;
  return { client, inserts };
}

const SCAN = {
  eventId: 'evt-1',
  guestId: 'gst-1',
  entry: 'invite_link',
  userAgent: 'Mozilla/5.0',
  forwardedFor: '203.0.113.42, 70.41.3.18',
} as const;

test('a guest who has NOT opted out is recorded, with the shape the table expects', async () => {
  const { client, inserts } = stubClient({ guest: { scan_tracking_opt_out: false } });
  assert.equal(await recordScan(client, SCAN), 'recorded');
  assert.equal(inserts.length, 1);
  assert.deepEqual(inserts[0], {
    event_id: 'evt-1',
    guest_id: 'gst-1',
    source: 'browser',
    scanner_user_id: null,
    user_agent: 'Mozilla/5.0',
    // First hop of the XFF chain, truncated. The client's IP is the FIRST
    // entry; taking the last would record a proxy and call it the guest.
    ip_anon: '203.0.113.0',
    context: { entry: 'invite_link' },
  });
});

test('a guest who HAS opted out gets no row — the whole point', async () => {
  const { client, inserts } = stubClient({ guest: { scan_tracking_opt_out: true } });
  assert.equal(await recordScan(client, SCAN), 'declined');
  assert.deepEqual(inserts, [], 'a scan was recorded for a guest who opted out');
});

test('FAILS CLOSED — an unreadable flag records nothing', async () => {
  // The direction matters more than the outcome. Recording on a failed read is
  // how a switch quietly stops working: nothing errors, the guest sees their
  // choice stored, and the trail keeps filling.
  const read = stubClient({ readError: { message: 'permission denied' } });
  assert.equal(await recordScan(read.client, SCAN), 'failed');
  assert.deepEqual(read.inserts, [], 'a read error recorded a scan anyway');

  const missing = stubClient({ guest: null });
  assert.equal(await recordScan(missing.client, SCAN), 'failed');
  assert.deepEqual(missing.inserts, [], 'a missing guest row recorded a scan anyway');
});

test('FAILS CLOSED — a null or undefined flag is not read as consent', async () => {
  // `guests.scan_tracking_opt_out` is NOT NULL DEFAULT FALSE, so these shapes
  // mean the column was not returned (a renamed column, a narrowed select, a
  // PostgREST shape change) — never "they did not opt out".
  for (const value of [null, undefined, 'false', 0]) {
    const { client, inserts } = stubClient({
      guest: { scan_tracking_opt_out: value },
    });
    assert.equal(await recordScan(client, SCAN), 'declined', `flag ${String(value)}`);
    assert.deepEqual(inserts, [], `flag ${String(value)} was treated as consent`);
  }
});

test('never throws into a redirect path — a triage record cannot keep a guest out', async () => {
  const guestsThrows = stubClient({ throwOn: 'guests' });
  assert.equal(await recordScan(guestsThrows.client, SCAN), 'failed');

  const insertThrows = stubClient({
    guest: { scan_tracking_opt_out: false },
    throwOn: 'scan_events',
  });
  assert.equal(await recordScan(insertThrows.client, SCAN), 'failed');

  const insertErrors = stubClient({
    guest: { scan_tracking_opt_out: false },
    insertError: { message: 'fk violation' },
  });
  assert.equal(await recordScan(insertErrors.client, SCAN), 'failed');
});

test('a crew scan carries the scanner; a self-scan carries null', async () => {
  const { client, inserts } = stubClient({ guest: { scan_tracking_opt_out: false } });
  await recordScan(client, {
    eventId: 'evt-1',
    guestId: 'gst-1',
    entry: 'personal_qr_scan',
    source: 'coordinator',
    scannerUserId: 'usr-9',
  });
  assert.equal(inserts[0]!.source, 'coordinator');
  assert.equal(inserts[0]!.scanner_user_id, 'usr-9');
  assert.equal(inserts[0]!.ip_anon, null, 'no forwarded-for must yield null, not a bare ".0"');
});

// ── ip_anon ────────────────────────────────────────────────────────────────
// `scan_events.ip_anon`'s own comment: "first 3 octets only per RA 10173".

test('IPv4 keeps three octets', () => {
  assert.equal(anonymizeIp('203.0.113.42'), '203.0.113.0');
  assert.equal(anonymizeIp('203.0.113.42, 70.41.3.18'), '203.0.113.0');
  assert.equal(anonymizeIp('  203.0.113.42  '), '203.0.113.0');
});

test('nothing in, nothing stored', () => {
  assert.equal(anonymizeIp(''), null);
  assert.equal(anonymizeIp(null), null);
  assert.equal(anonymizeIp(undefined), null);
});

test('IPv6 IS TRUNCATED — the bug all three old copies shared', () => {
  // `split('.').slice(0, 3).join('.')` on an address with no dots returns it
  // WHOLE, so the previous code stored the full IPv6 address and appended
  // ".0" — in the column that exists to truncate it.
  const full = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
  const stored = anonymizeIp(full);
  assert.equal(stored, '2001:0db8:85a3::');
  assert.ok(!stored!.includes('8a2e'), 'the host half of the address is still stored');
  assert.ok(!stored!.startsWith(full), 'the full address is still being stored');
});
