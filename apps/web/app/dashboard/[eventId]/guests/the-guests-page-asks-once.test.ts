/**
 * the-guests-page-asks-once.test.ts — THE COUPLE'S GUEST LIST IS TWO TRIPS
 * FROM THE DATABASE, AND READS THE EVENT'S ROW ONCE.
 *
 * Owner, 2026-10-20, the afternoon the database moved to Pro: *"why is it
 * still loading slow even if we already went pro on supabase?"* · *"loading
 * the guests"*. The database was healthy (no restarts, cache hit 100 %, two of
 * 35 connections busy) and public pages answered in a quarter of a second. The
 * wait was THIS page: it asked the database TEN times in a row — the role set,
 * the role words, who is looking, the roster, the linked names, the song
 * requests, the invite's words, the linked photos, the linked accounts — and
 * read the same `events` row five times (seven with the layout), though none
 * of those reads needed another's answer.
 *
 * `guests-page-reads.harness.ts` runs the REAL page function (and the real
 * layout beside it) against a stand-in database that counts every request and
 * how deep it ran. What this pins — properties, not phrasing:
 *
 *   1 · the page is at most TWO steps deep: the request's one sign-in check and
 *       the event's row (with the profile) leave first, then everything else
 *       together. Adding an `await` in front of a read — anywhere, in the page
 *       or in a helper it calls — makes it deeper and fails here, however it
 *       is spelled. With a guest's card open it is still two.
 *   2 · the event's row is read ONCE per request by the couple's own client —
 *       the page, the layout, the card and every helper are handed that one
 *       read (`openDashboardEventRow`, lib/event-row-once.ts) — and "what is
 *       this person on this event?" is asked once (lib/event-membership-once.ts).
 *   3 · nothing is asked twice by the page;
 *   4 · 🧯 a failure never renders like success: with the one read REFUSED the
 *       askers each read for themselves and the list is still drawn — never an
 *       empty list, never a page that throws;
 *   5 · 🚪 a delegate the couple never shared the guest list with is still sent
 *       to their own access view, never drawn a list that looks empty.
 *
 *   BEFORE → AFTER (same stand-in, 2026-10-20; 150 ms a trip with
 *   GUESTS_PAGE_READS_DELAY_MS=150):
 *     the page                 22 requests, 10 deep, 5 event-row reads, 1,543 ms
 *                          →   17 requests,  2 deep, 1 event-row read,    311 ms
 *     with a card open         35 requests, 11 deep, 8 event-row reads, 1,686 ms
 *                          →   25 requests,  2 deep, 1 event-row read,    322 ms
 *     layout + page            43 requests,  9 deep, 7 event-row reads, 3 membership reads
 *                          →   39 requests,  4 deep, 1 event-row read,  1 membership read
 *   (The layout's four: sign-in → its membership gate → its chrome → the
 *   account switcher's own second step. The gate stays first on purpose —
 *   `the-event-reads-at-once.test.ts`.)
 *
 * 🛡 Sabotaged (see the PR): an `await accountNamesByGuest(…)` put back in
 * front of the song read turns (1) red; dropping `openDashboardEventRow` from
 * the page turns (2) and (3) red. (Awaiting the sign-in check on its own first
 * does NOT, correctly: it is already one of the two trips.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

type View = {
  redirectedTo: string | null;
  namesHanded: number | null;
  calls: number;
  depth: number;
  eventRowReads: number;
  memberTypeReads: number;
  repeats: string[];
  ms: number;
  steps: string[];
};
type Report = Record<'page' | 'pageWithCard' | 'layoutAndPage' | 'oneReadRefused' | 'delegateWithoutGuestList', View>;

const WEB = join(__dirname, '..', '..', '..', '..');

function measure(): Report {
  const out = execFileSync(join(WEB, '..', '..', 'node_modules', '.bin', 'tsx'), [join(__dirname, 'guests-page-reads.harness.ts')], {
    cwd: WEB,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_OPTIONS: '', GUESTS_PAGE_READS_DELAY_MS: '3' },
    timeout: 180_000,
  });
  const line = out.split('\n').find((l) => l.startsWith('GUESTS_PAGE_READS '));
  assert.ok(line, `the harness printed no report:\n${out.slice(-2000)}`);
  return JSON.parse(line.slice('GUESTS_PAGE_READS '.length)) as Report;
}

const REPORT = measure();
const shape = (v: View) => `${v.calls} requests, ${v.depth} deep\n  ${v.steps.join('\n  ')}`;

/** The agreed small number: the sign-in check + the event row, then everything else at once. */
const MAX_DEPTH = 2;

test('0 · the harness drew the real list — six names — or every number below would be about nothing', () => {
  assert.equal(REPORT.page.redirectedTo, null, `the page redirected to ${REPORT.page.redirectedTo}`);
  assert.equal(REPORT.page.namesHanded, 6, 'the page did not hand its list the stand-in’s six guests');
  assert.equal(REPORT.pageWithCard.namesHanded, 6);
  assert.ok(REPORT.page.calls >= 10, `only ${REPORT.page.calls} requests were counted — the stand-in is not seeing the page`);
});

test(`1 · the page is at most ${MAX_DEPTH} trips deep before its first name — with or without a card open`, () => {
  for (const name of ['page', 'pageWithCard'] as const) {
    const v = REPORT[name];
    assert.ok(
      v.depth <= MAX_DEPTH,
      `${name}: the guest list now waits ${v.depth} database trips in a row (at most ${MAX_DEPTH}). A read was put behind ` +
        `another it does not need — start it beside the others, before THE ONE WAIT:\n${shape(v)}`,
    );
  }
});

test('2 · the event’s row is read ONCE per request, and the membership question asked once', () => {
  for (const name of ['page', 'pageWithCard', 'layoutAndPage'] as const) {
    const v = REPORT[name];
    assert.equal(v.eventRowReads, 1, `${name}: the couple's client read this event's row ${v.eventRowReads} times:\n${shape(v)}`);
    assert.equal(v.memberTypeReads, 1, `${name}: "what is this person on this event?" was asked ${v.memberTypeReads} times:\n${shape(v)}`);
  }
});

test('3 · the page asks nothing twice', () => {
  for (const name of ['page', 'pageWithCard'] as const) {
    assert.deepEqual(REPORT[name].repeats, [], `${name}: the same request was sent more than once`);
  }
  // The layout + page together: no request about THIS event is sent twice.
  const aboutTheEvent = REPORT.layoutAndPage.repeats.filter((r) => /event_id=eq\./.test(r));
  assert.deepEqual(aboutTheEvent, [], 'the layout and the page sent the same question about this event twice');
});

test('4 · 🧯 the one read refused → each asker reads for itself, and the list is still drawn', () => {
  const v = REPORT.oneReadRefused;
  assert.equal(v.redirectedTo, null);
  assert.equal(v.namesHanded, 6, 'with the one read refused the list was not drawn');
  assert.ok(v.eventRowReads > 1, 'with the one read refused nobody read for themselves — its failure was handed out as an answer');
  assert.ok(v.depth <= MAX_DEPTH, `a refused one read made the page deeper:\n${shape(v)}`);
});

test('5 · 🚪 a delegate who may not see the guest list is sent to their own view — never drawn an empty list', () => {
  const v = REPORT.delegateWithoutGuestList;
  assert.equal(v.namesHanded, null, 'a delegate without the guest list was drawn a list');
  assert.match(v.redirectedTo ?? '', /\/dashboard\/[^/]+\/hosts$/, `the delegate was sent to ${v.redirectedTo}`);
});
