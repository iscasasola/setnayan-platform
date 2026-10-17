/**
 * guest-page-reads.test.ts — HOW MANY REQUESTS THE GUEST PAGE SENDS, AND HOW
 * DEEP THEY RUN — counted, per kind of viewer.
 *
 * Measured in production, 2026-10-11: `/{slug}` sent 31–34 database requests
 * in 15–17 steps one after another, and read the same `events` row 11 times.
 * A guest waits for the STEPS: each one is a round trip that could not leave
 * until the one before it came back.
 *
 * `lib/guest-page-reads.harness.ts` runs the page's own loaders, in the order
 * and shape the page asks them, against a stand-in database that counts every
 * request and how deep it ran. This file pins what it reports. A read that
 * starts waiting on one it does not need makes a view deeper and fails here;
 * so does a read asked twice.
 *
 * ⚠ WHAT THE NUMBERS ARE. The stand-in event is a public wedding, hosted by an
 * ordinary account, with nothing bought, nothing on its page and every feature
 * flag at its default — so these are a FLOOR for the shape, not production's
 * count (production adds the promo-window reads, the roam reads, the event
 * type's profile, the session cookie's check). What is held is the SHAPE:
 * which reads leave together. The real number is read from the page's own
 * `[server-timing]` line and the database's log.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

type View = {
  calls: number;
  eventsReads: number;
  shellExtraKeys: string[];
  depth: number;
  byPhase: Record<string, { calls: number; depthAfter: number }>;
  steps: string[];
  widgetIds: string[];
  ownRowReads: number;
  shellEventId: string;
};
const VIEWS = [
  'coldInvitedOnTheDay',
  'strangerBeforeTheDay',
  'strangerOnTheDay',
  'invitedBeforeTheDay',
  'invitedOnTheDay',
  'hostCanvas',
  'freshAfterAWrite',
  'warmAgainAfterTheWrite',
  'coldWithOrders',
  'strangerWithOrders',
  'invitedWithOrders',
] as const;
type Report = Record<(typeof VIEWS)[number] | 'addressMovedMidRead' | 'addressMovedNextView', View> & { rememberedKeys: string[] };


const WEB = join(__dirname, '..');

function measure(): Report {
  const out = execFileSync(join(WEB, '..', '..', 'node_modules', '.bin', 'tsx'), ['lib/guest-page-reads.harness.ts'], {
    cwd: WEB,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_OPTIONS: '' },
    timeout: 120_000,
  });
  const line = out.split('\n').find((l) => l.startsWith('GUEST_PAGE_READS '));
  assert.ok(line, `the harness printed no report:\n${out.slice(-2000)}`);
  return JSON.parse(line.slice('GUEST_PAGE_READS '.length)) as Report;
}

const REPORT = measure();
const summary = (v: View) => `${v.calls} requests, ${v.depth} deep\n  ${v.steps.join('\n  ')}`;

/** The pinned shape: requests, and steps one after another. */
/*
  THE SAME VIEWS, BEFORE ANYTHING WAS MOVED (commit 72a55ba82, same stand-in):
    a stranger          23 requests, 10 deep
    an invited guest    34 requests, 17 deep   (37 / 20 on the day)
  Side by side (2026-10-12): the live layer's five reads, the entourage's three
  event facts, the bundle list beside the orders read, the one platform switch
  the schedule waited on, and — for an invited guest — the dozen reads about
  them that leave as soon as their row is known to be theirs.

  THE EVENT'S ROW ONCE (2026-10-12, `lib/event-row-once.ts`): the view read the
  same \`events\` row 8 times (a stranger) to 11 times (an invited guest) — the
  shell, then once per fact somebody wanted from it. One read now carries them
  all: 23 → 16 requests for a stranger (17 on the day), 34 → 24 for an invited
  guest (37 → 28 on the day).

  FEWER REQUESTS, SAME ANSWERS (2026-10-12):
    · the Venue scene's stored choices come from the scene rows the view reads
      anyway, not from a second read of `invitation_widgets`        −1, every view
    · "is the guest camera on?" is asked once per render, not three times
      (the pool RPC twice more)                                      −2, invited
    · the data-privacy controls a view asks about are one read       −1, invited
    · the guest's tagging answer rides in with their own row         −1, invited
  …and an invited guest's own reads leave beside the day-of layer instead of
  after it (the loader is handed the schedule as a promise): 7 → 6 steps
  before the day, 8 → 6 on it.

  THE GUEST-LOAD FIX (2026-10-13, a signed-in guest sometimes saw "This
  invitation didn't load" when the free database stalled mid-render):
    · the platform's own settings — bundle list, promo windows, privacy
      controls, reveal look, event-type profile — are remembered ACROSS
      requests (`lib/global-settings-cache.ts`): −2 requests on every warm view
      (the profile read was not counted here before: it went through the
      viewer's session, which the harness has none of);
    · every per-event ownership fact (orders, comp, internal host, founder
      seat) leaves in ONE round trip instead of three: 5 → 3 deep for a
      stranger before the day, 6 → 4 for every other view.
  The views are now measured WARM (the harness fills its data-cache stand-in
  with one unreported visit first); the first visit of a minute is pinned on
  its own as \`coldInvitedOnTheDay\`.
*/
/*
  THE PAGE READS A STAMP (2026-10-18, event-day load L3 · `lib/event-shared-reads.ts`,
  migration 20271275959355). What every viewer of the event sees alike is
  remembered under the event's stamp, and the per-event ownership facts are ONE
  request. Same stand-in, before → after:
    a stranger                      13 → 3   (14 → 4 on the day)
    an invited guest                17 → 6   (21 → 10 on the day)
    the first view after a change   24 → 22  (one step deeper: the stamp leaves first)
    an event WITH orders            stranger 19 → 7 · invited 31 → 18 · first view 31 → 26
      (it asked one basket request per product — 3 here — and now none)
  What is left on a warm view is the stamp, the facts, the camera pool's state
  and what is read about the viewer — none of it remembered, on purpose.
*/
const PINNED: Record<(typeof VIEWS)[number], { calls: number; depth: number }> = {
  coldInvitedOnTheDay: { calls: 22, depth: 6 },
  strangerBeforeTheDay: { calls: 3, depth: 3 },
  strangerOnTheDay: { calls: 4, depth: 3 },
  invitedBeforeTheDay: { calls: 6, depth: 4 },
  invitedOnTheDay: { calls: 10, depth: 4 },
  hostCanvas: { calls: 10, depth: 3 },
  freshAfterAWrite: { calls: 11, depth: 4 },
  warmAgainAfterTheWrite: { calls: 3, depth: 3 },
  coldWithOrders: { calls: 26, depth: 7 },
  strangerWithOrders: { calls: 7, depth: 6 },
  invitedWithOrders: { calls: 18, depth: 6 },
};

const views = () => VIEWS.map((name) => [name, REPORT[name]] as const);
/** How many times a view asked for `what` (a table, or `rpc/<name>`). */
const asked = (v: View, what: string) => v.steps.filter((st) => st.replace(/^\d+ /, '').split('  ←')[0] === what).length;

test('the event’s row is read AT MOST ONCE per view — and the page’s own row carries none of the extras', () => {
  for (const [name, view] of views()) {
    assert.ok(
      view.eventsReads <= 1,
      `${name} read the \`events\` row ${view.eventsReads} times: a reader is asking the database for columns of a row the render already holds (\`eventRowOnce\`, lib/event-row-once.ts).\n${summary(view)}`,
    );
    assert.deepEqual(view.shellExtraKeys, [], `${name}: the page's own event row now carries ${view.shellExtraKeys.join(', ')} — it must stay the row it always was`);
  }
});

test('the harness is looking at the page’s loaders — the stamp is read first, alone, once; the row only after a change', () => {
  for (const [name, view] of views()) {
    assert.equal(view.steps[0]?.split('  ←')[0], '1 rpc/event_public_stamp', `${name}: the view did not begin with the stamp\n${summary(view)}`);
    assert.equal(asked(view, 'rpc/event_public_stamp'), 1, `${name}: the stamp was read more than once`);
  }
  for (const name of ['coldInvitedOnTheDay', 'freshAfterAWrite', 'coldWithOrders'] as const) {
    assert.equal(REPORT[name].eventsReads, 1, `${name} came after a change and must read the row`);
  }
  assert.ok(REPORT.coldInvitedOnTheDay.calls >= 10, 'the first view sent almost nothing — the loaders are not being run');
});

test('✓ A HOST’S APPLY IS ON THE VERY NEXT VIEW — the stamp moved, so the scenes are read again and the new one is there', () => {
  const before = REPORT.strangerBeforeTheDay;
  const fresh = REPORT.freshAfterAWrite;
  const again = REPORT.warmAgainAfterTheWrite;
  assert.deepEqual(before.widgetIds, ['w-hero'], 'the stand-in did not start with one scene');
  assert.equal(asked(before, 'invitation_widgets'), 0, 'a warm view asked for the scenes — nothing is being remembered');
  assert.equal(asked(fresh, 'invitation_widgets'), 1, 'the view after the write did not read the scenes again — it was handed the old ones');
  assert.deepEqual(fresh.widgetIds, ['w-hero', 'w-applied'], 'the view after the write does not show what the host applied');
  assert.equal(asked(again, 'invitation_widgets'), 0, 'the view after that one asked again — the new answer was not remembered');
  assert.deepEqual(again.widgetIds, ['w-hero', 'w-applied']);
});

test('🔒 NOTHING ABOUT ONE GUEST IS REMEMBERED — their own row is read on every view, and no remembered key names a guest', () => {
  for (const name of ['coldInvitedOnTheDay', 'invitedBeforeTheDay', 'invitedOnTheDay', 'coldWithOrders', 'invitedWithOrders'] as const) {
    assert.equal(REPORT[name].ownRowReads, 1, `${name}: the guest's own row was not read from the database`);
  }
  for (const name of ['strangerBeforeTheDay', 'strangerOnTheDay', 'strangerWithOrders'] as const) {
    assert.equal(REPORT[name].ownRowReads, 0, `${name}: a stranger's view read a guest's row`);
  }
  assert.ok(REPORT.rememberedKeys.length > 5, 'the data cache holds nothing — the harness is not seeing the cache');
  for (const key of REPORT.rememberedKeys) {
    assert.ok(!/guest_id=eq|00000000-0000-4000-8000-0000000000a1/.test(key), `a remembered read names a guest: ${key.slice(0, 300)}`);
  }
});

test('🎨 THE MAKER’S CANVAS IS NEVER SERVED A REMEMBERED READ — only the shell rides the stamp', () => {
  const canvas = REPORT.hostCanvas;
  for (const table of ['invitation_widgets', 'event_vendors', 'guests', 'event_schedule_blocks', 'march_not_walking', 'event_floor_plan']) {
    assert.equal(asked(canvas, table), 1, `the canvas did not read ${table} from the database\n${summary(canvas)}`);
  }
});

test('🔀 A ROW IS FILED ONLY UNDER ITS OWN EVENT’S STAMP — an address that moved between the two reads files nothing', () => {
  const mid = REPORT.addressMovedMidRead;
  assert.equal(mid.eventsReads, 1, 'the view did not read the row');
  const next = REPORT.addressMovedNextView;
  assert.equal(next.eventsReads, 1, 'the next view was handed a filed row — one event’s row filed under another’s stamp');
  assert.equal(next.shellEventId, '00000000-0000-4000-8000-0000000000e2', 'the next view was shown the other event’s row');
});

test('💳 AN EVENT WITH ORDERS ASKS ITS OWNERSHIP FACTS ONCE — no request per product, no per-fact reads', () => {
  for (const name of ['coldWithOrders', 'strangerWithOrders', 'invitedWithOrders', 'strangerBeforeTheDay', 'invitedOnTheDay'] as const) {
    const v = REPORT[name];
    assert.equal(asked(v, 'rpc/event_entitlement_facts'), 1, `${name}: the facts were not asked exactly once\n${summary(v)}`);
    for (const per of ['orders', 'rpc/event_basket_orders_granting', 'rpc/event_comp_active_skus', 'rpc/event_host_is_internal', 'rpc/event_host_holds_founder_seat']) {
      assert.equal(asked(v, per), 0, `${name} still asked ${per} — the facts did not answer it`);
    }
  }
});

for (const [name, pinned] of Object.entries(PINNED) as Array<[(typeof VIEWS)[number], { calls: number; depth: number }]>) {
  test(`${name}: ${pinned.calls} requests, ${pinned.depth} deep`, () => {
    const view = REPORT[name];
    assert.ok(
      view.depth <= pinned.depth,
      `${name} got DEEPER (${view.depth} steps, was ${pinned.depth}): a read is waiting on one it does not need.\n${summary(view)}`,
    );
    assert.ok(
      view.calls <= pinned.calls,
      `${name} sends MORE requests (${view.calls}, was ${pinned.calls}): a read is being asked that was not, or asked twice.\n${summary(view)}`,
    );
    // Better is a decision too: lower the pin, so the gain cannot quietly slip back.
    assert.deepEqual(
      { calls: view.calls, depth: view.depth },
      pinned,
      `${name} improved — lower the pin in this file to hold it.\n${summary(view)}`,
    );
  });
}
