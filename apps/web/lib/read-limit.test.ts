/**
 * read-limit.test.ts — A READ PAST ITS LIMIT YIELDS THE HONEST ANSWER, NEVER AN
 * "EMPTY" OR A "NOT FOUND" — and no guest waits for more than the budget.
 *
 * Run with the REAL service client against a stand-in database whose answers
 * can be made to never arrive. What is held:
 *
 *   1 · an ESSENTIAL read that does not answer ends the page with
 *       `GuestPageDidNotLoad` — even when the page's own code had already
 *       decided "not found", an empty list, or a redirect from it;
 *   2 · a DECORATION read that does not answer leaves its part out and the
 *       page is returned, with the lapse logged;
 *   3 · ONE WAIT: a lapsed read is sent once (postgrest-js does not retry it),
 *       and five stalled reads in a row cost one budget, not five limits;
 *   4 · a WRITE is never cut off, and outside the scope nothing changes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { createAdminClient } from './supabase/admin';
import {
  GuestPageDidNotLoad,
  PAGE_BUDGET_MS,
  READ_LIMIT_MS,
  isDecorationRead,
  readName,
  withGuestReadLimit,
  withGuestReadLimitQuiet,
} from './read-limit';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://db.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

type Sent = { what: string; method: string; hadSignal: boolean };

/** A database where the named tables never answer — until the request is given up on. */
function database(stalled: string[]) {
  const sent: Sent[] = [];
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    const what = readName(url);
    const table = what.replace(/\(.*$/, '');
    sent.push({ what, method: init?.method ?? 'GET', hadSignal: Boolean(init?.signal) });
    if (!stalled.includes(table)) {
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } }));
    }
    return new Promise<Response>((_resolve, reject) => {
      // A real fetch rejects with an AbortError when its signal fires; one with no signal waits forever.
      init?.signal?.addEventListener('abort', () => {
        const e = new Error('This operation was aborted');
        e.name = 'AbortError';
        reject(e);
      });
    });
  }) as typeof fetch;
  return sent;
}

const FAST = { readLimitMs: 60, pageBudgetMs: 200 };
const quiet = async <T>(run: () => Promise<T>): Promise<T> => {
  const error = console.error;
  console.error = () => {};
  try {
    return await run();
  } finally {
    console.error = error;
  }
};

test('the limits are seconds — and the page’s budget is more than one read’s', () => {
  assert.ok(READ_LIMIT_MS >= 3_000 && READ_LIMIT_MS <= 8_000, String(READ_LIMIT_MS));
  assert.ok(PAGE_BUDGET_MS > READ_LIMIT_MS && PAGE_BUDGET_MS <= 15_000, String(PAGE_BUDGET_MS));
});

test('1 · the event read never answers: the page is NOT "not found" — it did not load', async () => {
  const sent = database(['events']);
  const started = Date.now();
  const page = () =>
    withGuestReadLimit(
      'slug',
      async () => {
        const admin = createAdminClient();
        const { data } = await admin.from('events').select('event_id, slug').eq('slug', 'maria-and-jose').maybeSingle();
        // What the page's own code does with a read that came back with nothing:
        if (!data) return 'NOT_FOUND — "This link can’t be found."';
        return 'the page';
      },
      FAST,
    );
  const outcome = await quiet(() => page().then((v) => v, (e: unknown) => e));
  assert.ok(outcome instanceof GuestPageDidNotLoad, `a read that never answered was shown as: ${String(outcome)}`);
  assert.ok(Date.now() - started < 1_000, 'the guest waited far past the limit');
  assert.deepEqual(outcome.lapsed.map((l) => l.what), ['events(event_id,slug)']);
  assert.equal(sent.length, 1, `the lapsed read was sent ${sent.length} times — the limit is being multiplied by a retry`);
});

test('1b · …and a redirect or a thrown "not found" decided from it is not believed either', async () => {
  database(['guests']);
  const notFound = Object.assign(new Error('NEXT_HTTP_ERROR_FALLBACK;404'), { digest: 'NEXT_HTTP_ERROR_FALLBACK;404' });
  const outcome = await quiet(() =>
    withGuestReadLimit(
      'slug',
      async () => {
        const { data } = await createAdminClient().from('guests').select('guest_id').eq('guest_id', 'g').maybeSingle();
        if (!data) throw notFound;
        return 'the page';
      },
      FAST,
    ).then((v) => v, (e: unknown) => e),
  );
  assert.ok(outcome instanceof GuestPageDidNotLoad, 'a "not found" thrown because a read never answered reached the guest');
});

test('1c · when every read answers, a real "not found" is still a "not found"', async () => {
  database([]);
  const notFound = new Error('NEXT_HTTP_ERROR_FALLBACK;404');
  const outcome = await withGuestReadLimit(
    'slug',
    async () => {
      const { data } = await createAdminClient().from('events').select('event_id').eq('slug', 'nobody').maybeSingle();
      if (!data) throw notFound;
      return 'the page';
    },
    FAST,
  ).then((v) => v, (e: unknown) => e);
  assert.equal(outcome, notFound, 'an answered read that found nothing is no longer a plain "not found"');
});

test('2 · a decoration read that never answers leaves its part out — the page is returned, and it is logged', async () => {
  database(['event_recaps', 'orders']);
  const logged: string[] = [];
  const error = console.error;
  console.error = (...args: unknown[]) => logged.push(args.map(String).join(' '));
  try {
    const page = await withGuestReadLimit(
      'slug',
      async () => {
        const admin = createAdminClient();
        const [recap, orders, event] = await Promise.all([
          admin.from('event_recaps').select('status').eq('event_id', 'e').maybeSingle(),
          admin.from('orders').select('status').eq('event_id', 'e'),
          admin.from('events').select('event_id').eq('slug', 's'),
        ]);
        return { albumDoor: recap.data ? 'shown' : 'left out', owned: (orders.data ?? []).length > 0, eventRead: !event.error };
      },
      FAST,
    );
    assert.deepEqual(page, { albumDoor: 'left out', owned: false, eventRead: true });
  } finally {
    console.error = error;
  }
  const line = logged.find((l) => l.includes('read-limit:slug'));
  assert.ok(line, 'the lapse was not logged');
  assert.match(line, /"severity":"graceful_degrade"/);
  assert.match(line, /event_recaps/);
});

test('2b · what counts as decoration is a short, named list — everything else is essential', () => {
  for (const what of ['orders', 'bundle_components', 'rpc/event_host_is_internal', 'event_recaps', 'events(rsvp_backdrop)', 'guest_checkins', 'scan_events']) {
    assert.equal(isDecorationRead(what), true, what);
  }
  for (const what of ['events(event_id,slug)', 'guests', 'invitation_widgets', 'event_schedule_blocks', 'event_vendors', 'event_seat_assignments', 'data_privacy_controls', 'a_table_added_tomorrow']) {
    assert.equal(isDecorationRead(what), false, `${what} would be silently left out of a guest's page`);
  }
});

test('2c · the Welcome door’s open-wish count is decoration — alone it never takes the invitation down (production 2026-10-15 08:50)', async () => {
  // Measured: a database stall lapsed ONLY `event_wish_items` (the event had answered), and the guest
  // was shown the failure page for a count whose own caller already says "no list" when unread.
  database(['event_wish_items']);
  const page = await quiet(() =>
    withGuestReadLimit(
      'slug/invitation-body',
      async () => {
        const admin = createAdminClient();
        const [event, wishes] = await Promise.all([
          admin.from('events').select('event_id').eq('slug', 's'),
          admin.from('event_wish_items').select('wish_item_id', { count: 'exact', head: true }).eq('event_id', 'e').is('got_at', null),
        ]);
        return { eventRead: !event.error, wishDoor: wishes.error ? 'names no list' : 'names the list' };
      },
      FAST,
    ),
  );
  assert.deepEqual(page, { eventRead: true, wishDoor: 'names no list' });
  assert.equal(isDecorationRead('event_wish_items'), true);
});

test('3 · five stalled reads in a row cost ONE budget, not five limits', async () => {
  database(['invitation_widgets']);
  const started = Date.now();
  const outcome = await quiet(() =>
    withGuestReadLimit(
      'slug',
      async () => {
        const admin = createAdminClient();
        for (let i = 0; i < 5; i += 1) await admin.from('invitation_widgets').select('widget_id').eq('event_id', `e${i}`);
        return 'the page';
      },
      { readLimitMs: 150, pageBudgetMs: 250 },
    ).then((v) => v, (e: unknown) => e),
  );
  const took = Date.now() - started;
  assert.ok(outcome instanceof GuestPageDidNotLoad);
  assert.equal(outcome.lapsed.length, 5);
  assert.ok(took < 600, `five stalled reads took ${took} ms — each waited its own limit (5 × 150 = 750)`);
});

test('4 · a write is never cut off, and outside the scope no read is limited', async () => {
  const sent = database([]);
  await withGuestReadLimit(
    'slug',
    async () => {
      const admin = createAdminClient();
      await admin.from('events').update({ std_launched_at: 'now' }).eq('event_id', 'e');
      await admin.from('scan_events').insert({ guest_id: 'g' });
      await admin.from('events').select('event_id').eq('event_id', 'e');
      await admin.rpc('event_host_is_internal', { p_event_id: 'e' });
    },
    FAST,
  );
  assert.deepEqual(
    sent.map((s) => [s.method, s.hadSignal]),
    [['PATCH', false], ['POST', false], ['GET', true], ['POST', true]],
    'a write was given the bounded wait, or a read was not',
  );
  sent.length = 0;
  await createAdminClient().from('events').select('event_id').eq('event_id', 'e');
  assert.deepEqual(sent.map((s) => s.hadSignal), [false], 'a read outside any guest page was limited');
});

test('the quiet form bounds the wait and never throws for a lapse — the layout must not be the one to fail', async () => {
  database(['events']);
  const out = await quiet(() =>
    withGuestReadLimitQuiet(
      'slug/layout',
      async () => {
        const { data } = await createAdminClient().from('events').select('event_id').eq('slug', 's').maybeSingle();
        return data ? 'dressed' : 'plain';
      },
      FAST,
    ),
  );
  assert.equal(out, 'plain');
});
