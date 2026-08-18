/**
 * stage-notes-recipients-bundle.test.ts — the emcee who was booked inside a
 * bundle, driven through the REAL fetcher with stubbed clients.
 *
 * `fetchEmceeRecipients` used to hardcode `serviceCategories: null`, so the
 * answer came from `event_vendors.category` alone — one summary value on a
 * booking that can carry several jobs. The band who also emcees, booked as one
 * package, summarised to "band", matched no host tile, and the coordinator's
 * whole "Tell the host" section rendered nothing. A wedding with a host read as
 * a wedding with none.
 *
 * These drive the fetcher itself rather than the pure picker, because the pure
 * picker ALREADY accepted service categories and always passed — the defect was
 * entirely in what the fetcher handed it. A test over the picker cannot fail on
 * this bug.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fetchEmceeRecipients } from './stage-notes-recipients';

const EVENT = 'evt-1';

type Stub = { rows: unknown[]; error?: unknown; calls: string[] };

/** Minimal PostgREST-shaped stub: every filter returns `this`, then awaits. */
function client(tables: Record<string, Stub>) {
  return {
    from(table: string) {
      const stub = tables[table] ?? { rows: [], calls: [] };
      stub.calls.push(table);
      const chain: Record<string, unknown> = {};
      const self = () => chain;
      for (const m of ['select', 'eq', 'not', 'in', 'order', 'limit']) {
        chain[m] = self;
      }
      // Awaiting the chain resolves the read.
      (chain as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
        resolve({ data: stub.rows, error: stub.error ?? null });
      return chain;
    },
  } as never;
}

/** A booking whose SUMMARY says "band" but whose services include the host job. */
const BUNDLE_BOOKING = {
  vendor_name: 'Saysay Live Band',
  category: 'band',
  linked_vendor_profile_id: 'vp-band',
  requested_service_ids: ['svc-band', 'svc-emcee'],
};

test('the band who also emcees IS offered — the bundle no longer hides them', async () => {
  const hosts = await fetchEmceeRecipients(
    client({ event_vendors: { rows: [BUNDLE_BOOKING], calls: [] } }),
    EVENT,
    client({
      vendor_services: {
        rows: [
          { vendor_service_id: 'svc-band', category: 'band' },
          { vendor_service_id: 'svc-emcee', category: 'host_mc' },
        ],
        calls: [],
      },
    }),
  );

  assert.equal(hosts.length, 1, 'the bundled emcee was not offered');
  assert.equal(hosts[0]?.vendorProfileId, 'vp-band');
  assert.equal(hosts[0]?.name, 'Saysay Live Band');
});

test('a failed service read degrades to the booking summary — never narrows', async () => {
  // The service read failing must leave the shipped answer intact, not delete a
  // host the summary column already named.
  const hosts = await fetchEmceeRecipients(
    client({
      event_vendors: {
        rows: [
          {
            vendor_name: 'Kuya Mike',
            category: 'host_mc',
            linked_vendor_profile_id: 'vp-mc',
            requested_service_ids: ['svc-x'],
          },
        ],
        calls: [],
      },
    }),
    EVENT,
    client({ vendor_services: { rows: [], error: { message: 'denied' }, calls: [] } }),
  );

  assert.equal(hosts.length, 1, 'a failed service read removed a host the summary named');
  assert.equal(hosts[0]?.vendorProfileId, 'vp-mc');
});

test('a supplier who is neither, by summary or by service, is still not offered', async () => {
  // The union may only ever ADD. If this ever returns someone, the change has
  // stopped being a widening and become a leak of the wrong recipient.
  const hosts = await fetchEmceeRecipients(
    client({
      event_vendors: {
        rows: [
          {
            vendor_name: 'Blooms by Lia',
            category: 'florist',
            linked_vendor_profile_id: 'vp-flor',
            requested_service_ids: ['svc-flowers'],
          },
        ],
        calls: [],
      },
    }),
    EVENT,
    client({
      vendor_services: {
        rows: [{ vendor_service_id: 'svc-flowers', category: 'florist' }],
        calls: [],
      },
    }),
  );

  assert.equal(hosts.length, 0, 'a florist was offered as the host');
});

test('a booking with no services at all still resolves from its summary', async () => {
  // Historic bookings predate services entirely; replacing (rather than
  // unioning) would narrow them to nothing.
  const hosts = await fetchEmceeRecipients(
    client({
      event_vendors: {
        rows: [
          {
            vendor_name: 'Old Booking',
            category: 'host_mc',
            linked_vendor_profile_id: 'vp-old',
            requested_service_ids: null,
          },
        ],
        calls: [],
      },
    }),
    EVENT,
    client({ vendor_services: { rows: [], calls: [] } }),
  );

  assert.equal(hosts.length, 1);
  assert.equal(hosts[0]?.vendorProfileId, 'vp-old');
});
