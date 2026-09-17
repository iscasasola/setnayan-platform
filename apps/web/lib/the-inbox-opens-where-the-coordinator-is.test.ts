/**
 * the-inbox-opens-where-the-coordinator-is.test.ts — DAY-6.
 *
 * "Everything raised today — by the couple, the hosts, or your suppliers — in one
 * list." The coordinator's LIVE console said exactly that, and its only affordance
 * was a `<Link>` to /vendor-dashboard/on-the-day. So reading the list meant LEAVING
 * the fullscreen console mid-wedding and finding the way back.
 *
 * The component was never missing. It was mounted on one surface and linked to from
 * the other — the missing-mount class, and invisible to both the usual methods: a
 * capability search finds `RequestsInbox` and answers "already ships", and nothing
 * renders wrongly, so there is no false branch to catch.
 *
 * ⚠ AND THE EVIDENCE I FIRST GAVE FOR THAT WAS WRONG. I reported that this inbox
 * was "already mounted inline in the song desk". It is not. There are TWO different
 * components called `RequestsInbox` — this one over `event_day_requests`, and the
 * song desk's over `ActSongRequest` — with different props, different tables and
 * different jobs. A name match is not a mechanism match; the real inline mount is
 * `IssuesLog`, on the non-live desk.
 *
 * ── WHAT THIS PINS ─────────────────────────────────────────────────────────────
 *   EXERCISED — `decideRequestsPanel` over its whole input space, and the ORDER of
 *   its branches. Putting a list in place is only an improvement if the list is
 *   honest, and the dangerous case renders identically to success: a refused read
 *   resolving as zero rows, which a coordinator reads mid-wedding as "nothing to
 *   deal with".
 *
 *   PARSED — that the console actually mounts the inbox (the surface is an async
 *   server component), and that the mount is gated on the decision rather than
 *   drawn unconditionally.
 *
 * 🛡 Sabotage-checked, every mutation still parsing and still typechecking, count
 * printed before the colour — including the standing one for any mount guard:
 * gate the mount on a constant `false` and leave it in the file, so a mount COUNT
 * alone stays green.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { decideRequestsPanel, type RequestsPanelInput } from '@/lib/day-requests';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const console_ = stripComments(
  readFileSync(
    join(
      WEB,
      'app', 'vendor-dashboard', 'on-the-day', 'live', '[eventId]',
      '_components', 'floor-command', 'floor-command.tsx',
    ),
    'utf8',
  ),
);
const actions = stripComments(
  readFileSync(join(WEB, 'app', 'vendor-dashboard', 'on-the-day', 'actions.ts'), 'utf8'),
);

const view = (o: Partial<RequestsPanelInput> = {}): RequestsPanelInput => ({
  active: true,
  side: 'coordinator',
  unreadable: false,
  ...o,
});

test('EXERCISED · an unreadable list never renders as an empty one', () => {
  const rows: Array<[string, RequestsPanelInput]> = [
    ['control off', view({ active: false })],
    ['read failed', view({ unreadable: true })],
    ['not booked here', view({ side: null })],
    ['coordinator, readable', view()],
    ['supplier, readable', view({ side: 'vendor' })],
  ];
  for (const [what, v] of rows) console.log(`  ${what.padEnd(22)} → ${decideRequestsPanel(v)}`);

  assert.equal(decideRequestsPanel(view({ unreadable: true })), 'unreadable');
  assert.notEqual(decideRequestsPanel(view({ unreadable: true })), 'inbox');
  assert.equal(decideRequestsPanel(view()), 'inbox');
  assert.equal(decideRequestsPanel(view({ side: 'vendor' })), 'inbox');
  assert.equal(decideRequestsPanel(view({ active: false })), 'gated');
  assert.equal(decideRequestsPanel(view({ side: null })), 'unbooked');
});

test('EXERCISED · `unreadable` is answered BEFORE `side`, and that order is the decision', () => {
  /*
   * A read that failed cannot be trusted to have established which side you are
   * on. Reversing those two lines turns a failure into "you are not booked here"
   * — a different lie behind the same empty screen. The fixture that catches it
   * is the one where BOTH are true at once.
   */
  const both = decideRequestsPanel(view({ unreadable: true, side: null }));
  console.log(`  unreadable AND no side → ${both}`);
  assert.equal(both, 'unreadable', 'a failed read is being reported as "not booked here"');

  // And gating still outranks both: a dark control has nothing to say about a
  // list it is not showing.
  assert.equal(decideRequestsPanel(view({ active: false, unreadable: true })), 'gated');
});

test('PARSED · the live console mounts the inbox, gated on the decision', () => {
  const mounts = console_.match(/<RequestsInbox\b/g)?.length ?? 0;
  console.log(`  <RequestsInbox> on the live console: ${mounts}`);
  assert.equal(mounts, 1, 'the live console no longer shows the requests inbox in place');

  assert.match(console_, /decideRequestsPanel\(/, 'the console stopped asking for the panel state');
  assert.match(
    console_,
    /panel === 'inbox'[\s\S]{0,200}?<RequestsInbox/,
    'the inbox is drawn without asking whether the list can be trusted',
  );
  assert.match(
    console_,
    /panel === 'unreadable' \?/,
    'the console no longer distinguishes a failed read from an empty day',
  );
});

test('PARSED · the view still reports a failed read as unreadable', () => {
  const hits = actions.match(/unreadable:\s*Boolean\(error\)/g)?.length ?? 0;
  console.log(`  unreadable derived from the query error: ${hits}`);
  assert.equal(hits, 1, 'getDayRequestsView stopped reporting a failed read');
  // `!data` alone is not an error — PostgREST returns null data WITH an error,
  // and an absent-but-errorless result is a genuinely empty table.
  assert.doesNotMatch(
    actions,
    /unreadable:\s*(?:!data|Boolean\(!data\))/,
    'an empty table is being reported as an unreadable one',
  );
});
