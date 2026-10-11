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

type View = { calls: number; depth: number; byPhase: Record<string, { calls: number; depthAfter: number }>; steps: string[] };
type Report = Record<'strangerBeforeTheDay' | 'strangerOnTheDay' | 'invitedBeforeTheDay' | 'invitedOnTheDay', View>;

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
  event facts, the bundle list beside the orders read, and the one platform
  switch the schedule waited on.
*/
const PINNED: Record<keyof Report, { calls: number; depth: number }> = {
  strangerBeforeTheDay: { calls: 23, depth: 5 },
  strangerOnTheDay: { calls: 23, depth: 6 },
  invitedBeforeTheDay: { calls: 34, depth: 12 },
  invitedOnTheDay: { calls: 37, depth: 16 },
};

test('the harness is looking at the page’s loaders — the shell is read first, alone, once', () => {
  for (const view of Object.values(REPORT)) {
    assert.equal(view.steps[0], '1 events(event_id,public_id,…)');
    assert.equal(view.byPhase.shell?.calls, 1);
    assert.ok(view.calls >= 10, 'the view sent almost nothing — the loaders are not being run');
  }
});

for (const [name, pinned] of Object.entries(PINNED) as Array<[keyof Report, { calls: number; depth: number }]>) {
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
