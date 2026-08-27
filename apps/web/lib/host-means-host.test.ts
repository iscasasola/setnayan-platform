/**
 * HOST MEANS HOST — and a seat-holder still gets in.
 *
 * ── WHY THIS GUARD WAS REWRITTEN ────────────────────────────────────────────
 * Rev 1 pinned a HAND-TYPED list of three paths. A THIRD copy of the defect was
 * live in `app/[slug]/hub/page.tsx` the entire time it was green: the same
 * `event_members … .select('member_type')` read, coerced straight to a boolean,
 * so a guest who had merely scanned the event QR read as a HOST and could use
 * `?phase=` to switch on day-of surfaces the couple had not launched. It was not
 * on the list, so nothing could fire. A fourth copy sat in the save-the-date
 * view beacon, silently deleting a guest's view from the couple's own count.
 *
 * 🔑 A HAND-ENUMERATED LIST IS A LIST OF THE DOORS SOMEBODY THOUGHT OF. The
 * sweep below therefore DERIVES its file set from the tree and fails on ANY
 * occurrence of the shape, including one written tomorrow in a file that does
 * not exist yet. `lib/slug-access.ts` used to claim rev 1 "pins BOTH by source
 * so a third copy cannot quietly hold a laxer rule"; it could not, and that
 * sentence is corrected there.
 *
 * ── WHAT IT PINS ────────────────────────────────────────────────────────────
 * 1 · NO UNCONSTRAINED `member_type` READ ANYWHERE (the derived sweep).
 *   `event_members` IS NOT A HOST TABLE — `'guest'` is one of its member types,
 *   written by the event-QR scan-to-join, the cookie link and the cross-device
 *   magic link. Asking for `member_type` and never comparing it is the defect,
 *   whatever the file. An existence check ("are they on this event at all") is
 *   legitimate and simply must not request the column it has no opinion about.
 *
 * 2 · THE TWO SHARED DEFINITIONS FILTER ON THE ONE SHARED CONSTANT.
 *   `loadHostMembership` (app/[slug]/_lib/loaders.ts) and `isSignedInEventHost`
 *   (lib/slug-access.ts) are what every surface is expected to reach for, so
 *   they are asserted positively too — a sweep can only prove the ABSENCE of the
 *   bad shape, never the PRESENCE of the good one.
 *
 * 3 · THE SHARED GATE HAS A SEAT-HOLDER ARM.
 *   The over-wide host check was masking a missing arm: `app/[slug]/page.tsx`
 *   admits a seat-holder on `private`, the shared gate did not. Narrowing host
 *   without adding it would bounce every invited guest whose 60-day cookie has
 *   expired — the ordinary case, since save-the-dates go out 6–12 months ahead.
 *
 * ── MUTATIONS, EACH MEASURED BY OCCURRENCE COUNT ────────────────────────────
 * · gut the member-type filter in EITHER twin → `.in('member_type'` in that file
 *   1 → 0 · RED (rules 1 and 2 both).
 * · re-inline the pre-fix host read in app/[slug]/hub/page.tsx → sweep offenders
 *   0 → 1 · RED.
 * · gut the filter in app/api/std/view/route.ts → offenders 0 → 1 · RED.
 * · delete the seat-holder arm from the shared gate → `findGuestSeatForUser`
 *   in slug-access.ts 1 → 0 · RED.
 * · delete it from the page instead → in page.tsx 2 → 0 · RED.
 * An unmeasured mutation proves nothing; guards have shipped in this repo five
 * separate times protecting nothing, and every one was found by counting.
 *
 * ⚠ AND THE SWEEP IS FLOORED. An empty sweep is the failure mode a derived guard
 * invites: rename a directory or tighten a regex and "0 offenders" reads exactly
 * like a clean tree. The floors fail this test when the scan stops SEEING
 * things, so it cannot go quiet without saying so.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HOST_MEMBER_TYPES, isHostMemberType } from '@/app/[slug]/_lib/host-scope';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

const SHARED_GATE = 'lib/slug-access.ts';
const CACHED_TWIN = join('app', '[slug]', '_lib', 'loaders.ts');
const PAGE = join('app', '[slug]', 'page.tsx');

/** Occurrences of a plain substring — the count is what makes a mutation real. */
function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

// ── THE DERIVED SWEEP ───────────────────────────────────────────────────────

/** Every shipped source file under the app + lib trees. Tests are excluded — a
 *  test may legitimately spell the bad shape out in order to describe it. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next') continue;
      const p = join(dir, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(p);
    }
  };
  for (const root of ['app', 'lib']) walk(join(WEB, root));
  return out;
}

/** How far past a `.from('event_members')` we look for the comparison. Wide
 *  enough to cover a `Promise.all` pair plus the branch that consumes it. */
const WINDOW = 2500;

type Sweep = {
  files: number;
  chains: number;
  selectingMemberType: number;
  offenders: string[];
};

/**
 * Find every `event_members` read that ASKS FOR `member_type` and never compares
 * it — neither in the query (`.in(` / `.eq(` / `.neq(` / `.not(`) nor in the code
 * that consumes the row.
 */
function sweepEventMemberReads(): Sweep {
  const files = sourceFiles();
  let chains = 0;
  let selectingMemberType = 0;
  const offenders: string[] = [];

  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    let i = 0;
    while ((i = src.indexOf(".from('event_members')", i)) !== -1) {
      chains++;
      const win = src.slice(i, i + WINDOW);
      const selected = /\.select\(\s*['"`][^'"`]*member_type/.exec(win);
      if (selected) {
        selectingMemberType++;
        const constrainedInQuery = /\.(in|eq|neq|not)\(\s*['"`]member_type/.test(win);
        const consumed =
          /member_type/.test(win.slice(selected.index + selected[0].length)) ||
          /isHostMemberType|HOST_MEMBER_TYPES/.test(win);
        if (!constrainedInQuery && !consumed) {
          offenders.push(`${relative(WEB, file)}:${src.slice(0, i).split('\n').length}`);
        }
      }
      i += 10;
    }
  }
  return { files: files.length, chains, selectingMemberType, offenders };
}

test('NO event_members read asks for member_type and then never compares it', () => {
  const sweep = sweepEventMemberReads();

  // THE FLOOR FIRST. A sweep that has stopped seeing anything reports zero
  // offenders, which is indistinguishable from a clean tree. These numbers sit
  // deliberately far below the real counts when this was written (3,275 files ·
  // 235 reads · 97 selecting member_type) so ordinary churn never trips them and
  // a scan gone blind always does.
  assert.ok(
    sweep.files >= 500,
    `the sweep found only ${sweep.files} source files — it has gone blind, not clean`,
  );
  assert.ok(
    sweep.chains >= 50,
    `only ${sweep.chains} event_members reads found — either the query spelling ` +
      'changed or the walk no longer reaches the tree. An empty sweep is not a pass.',
  );
  assert.ok(
    sweep.selectingMemberType >= 20,
    `only ${sweep.selectingMemberType} reads select member_type — the .select() ` +
      'match no longer recognises the real spelling; this guard is now decoration',
  );

  assert.deepEqual(
    sweep.offenders,
    [],
    'These reads ask event_members for `member_type` and never compare it, so ANY ' +
      "member row — a QR-scan guest's included — answers the question. That is the " +
      'bug host-scope.ts was written to kill, and it shipped three times. Either ' +
      'filter on HOST_MEMBER_TYPES, or stop selecting a column you have no opinion ' +
      `about.\n${sweep.offenders.map((o) => `  · ${o}`).join('\n')}`,
  );
});

// ── THE POSITIVE PINS ───────────────────────────────────────────────────────

test('both shared host reads FILTER on member_type, not merely select it', () => {
  const filter = ".in('member_type', [...HOST_MEMBER_TYPES])";
  const found = [SHARED_GATE, CACHED_TWIN].map((f) => count(read(f), filter));
  assert.deepEqual(
    found,
    [1, 1],
    `each of ${SHARED_GATE} and ${CACHED_TWIN} must filter event_members on ` +
      'HOST_MEMBER_TYPES. A read that selects member_type without comparing it ' +
      'treats a QR-scan guest as a host — the bug host-scope.ts was written to kill.',
  );
});

test('both shared host reads import the ONE definition, never a retyped literal', () => {
  for (const file of [SHARED_GATE, CACHED_TWIN]) {
    assert.ok(
      /import\s*\{[^}]*HOST_MEMBER_TYPES/.test(read(file)),
      `${file} must import HOST_MEMBER_TYPES rather than retype 'couple'/'coordinator'`,
    );
  }
});

test("'guest' is not a host, and the host set is exactly couple + coordinator", () => {
  assert.equal(isHostMemberType('guest'), false);
  assert.equal(isHostMemberType(null), false);
  assert.equal(isHostMemberType('couple'), true);
  assert.deepEqual([...HOST_MEMBER_TYPES], ['couple', 'coordinator']);
});

test('the shared gate admits a SEAT-HOLDER, exactly as the page already does', () => {
  // The CALL, not the import or a comment naming it — a file-level count cannot
  // say whether the arm still runs.
  const gate = count(read(SHARED_GATE), 'findGuestSeatForUser(eventId');
  const page = count(read(PAGE), 'findGuestSeatForUser(event.event_id');
  assert.ok(
    gate >= 1,
    'lib/slug-access.ts must admit a signed-in seat-holder. Without this arm the ' +
      'host narrowing bounces every invited guest whose 60-day cookie has expired ' +
      'off all seven sub-routes — the case the page was rewritten to admit.',
  );
  assert.ok(
    page >= 1,
    'app/[slug]/page.tsx lost its seat-holder arm — the two gates have diverged again',
  );
});

test('the seat-holder arm is not fenced behind invited_accounts only', () => {
  const src = read(SHARED_GATE);
  const seatAt = src.indexOf('findGuestSeatForUser(eventId');
  const invitedAt = src.indexOf('requiresInvitedAccount(visibility)');
  assert.ok(seatAt > 0 && invitedAt > 0, 'both arms must exist in the shared gate');
  assert.ok(
    seatAt < invitedAt,
    'the seat-holder arm must run BEFORE (and outside) the invited_accounts ' +
      "branch — a 'private' event admits seat-holders too, which is what the page does",
  );
});
