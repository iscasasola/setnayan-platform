/**
 * A MOUNTED ACTION KEEPS ITS CONTROL.
 *
 * 🚨 THE DISEASE THIS PINS, MEASURED ON 2026-09-03. A dead-code sweep found 31
 * exported server actions with zero references. Most were superseded and got
 * deleted. Four were not: they were CORRECT, HARDENED, AND UNREACHABLE, because
 * the UI that called them was removed or never mounted, and nothing anywhere
 * said so. The couple-facing cost of each:
 *
 *   • `revokeArea` — answerAccessRequest can GRANT all eight delegate areas and
 *     only two could ever be taken back. Sharing the guest list, seat plan,
 *     schedule, suppliers, invitations or mood board with a coordinator was a
 *     ONE-WAY DOOR.
 *   • `saveRsvpBackdrop` / `clearRsvpBackdrop` — the legacy /site-editor route
 *     was retired and its one unique setting deliberately ported here so it
 *     would not die. The actions arrived; the control did not. The public
 *     invitation kept RENDERING events.rsvp_backdrop while nothing on earth
 *     could write it.
 *   • `updateSponsor` — no way to fix a typo in a ninong's name. The only route
 *     was remove-and-re-add, which hard-DELETEs the row and throws away the
 *     invitation, the answer, and the link to the auto-created guest.
 *   • `updateVendorEventSet` — no way to rename a band's set. The only route was
 *     delete-and-recreate, and set songs are ON DELETE CASCADE.
 *
 * 🔑 EVERY ONE OF THESE PASSED EVERY TEST IN THE REPO. A server action with no
 * caller is not a failure any suite can see: it compiles, it lints, its own unit
 * tests (where they exist) still pass. The absence lives in the JOIN between an
 * action and a component, and nothing was looking there.
 *
 * ── WHAT GOING RED MEANS ────────────────────────────────────────────────────
 *
 * Somebody removed the last caller of an action listed here. That is sometimes
 * right! But it is never right SILENTLY, which is the whole point. You have
 * exactly two honest answers:
 *
 *   1. The capability is genuinely gone — delete the action too, and leave a
 *      note naming what superseded it (see the RETIRED notes this sweep left in
 *      studio/save-the-date/actions.ts, guests/groups-actions.ts and friends).
 *   2. The capability is deferred, not dead — take it off this list and write
 *      the reasoning where the action lives, the way lib/vendor-invite-actions.ts
 *      does: "mount them; do not rebuild them."
 *
 * Do NOT satisfy this by deleting the entry and moving on. The entry IS the
 * record that somebody decided.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { stripComments } from './strip-comments';

/**
 * Actions that were dead, were triaged as real capabilities, and are wired now.
 *
 * `definedIn` is the file that EXPORTS it — references there do not count as a
 * caller, which is the trap the sweep that found these had to be corrected for:
 * a caller-grep that skips the defining file reports `foo()` dead when
 * `fooForm()` in the same file calls it, and one that FORGETS to skip it counts
 * the definition line as its own caller. Both directions are wrong; this counts
 * matches in every OTHER file.
 */
const MUST_STAY_REACHABLE: ReadonlyArray<{ fn: string; definedIn: string; lostMeans: string }> = [
  {
    fn: 'revokeArea',
    definedIn: 'app/dashboard/[eventId]/access-requests/actions.ts',
    lostMeans: 'sharing an area with a coordinator becomes a one-way door again',
  },
  {
    fn: 'saveRsvpBackdrop',
    definedIn: 'app/dashboard/[eventId]/website/editor/actions.ts',
    lostMeans: 'the public site renders a backdrop nobody can set',
  },
  {
    fn: 'clearRsvpBackdrop',
    definedIn: 'app/dashboard/[eventId]/website/editor/actions.ts',
    lostMeans: 'a couple cannot turn their backdrop off',
  },
  {
    fn: 'updateSponsor',
    definedIn: 'app/dashboard/[eventId]/sponsors/actions.ts',
    lostMeans: 'fixing a sponsor typo goes back to destroying the invitation and the answer',
  },
  {
    fn: 'updateVendorEventSet',
    definedIn: 'app/vendor-dashboard/on-the-day/actions.ts',
    lostMeans: 'renaming a set goes back to cascading the setlist away',
  },
];

/** Every .ts/.tsx under app/ + lib/, minus test files — the caller search space. */
function sourceFiles(): string[] {
  const out = execSync(
    "grep -rl --include=*.ts --include=*.tsx '' app lib || true",
    { encoding: 'utf8', shell: '/bin/bash', maxBuffer: 64 * 1024 * 1024 },
  );
  return out.split('\n').filter((f) => f && !f.includes('.test.'));
}

const FILES = sourceFiles();

test('the caller search space is real', () => {
  // A guard whose corpus silently empties passes forever. 4,000+ files today;
  // anything under 500 means the grep broke, not that the repo shrank.
  assert.ok(FILES.length > 500, `expected the app+lib sources, found ${FILES.length}`);
});

for (const { fn, definedIn, lostMeans } of MUST_STAY_REACHABLE) {
  test(`${fn} is still called from somewhere — else ${lostMeans}`, () => {
    // Word-boundary match on COMMENT-STRIPPED source: a docblock that merely
    // names the action (this file is full of them, and so is every RETIRED note
    // the sweep left behind) must never read as a caller.
    const re = new RegExp(`\\b${fn}\\b`);
    const callers = FILES.filter(
      (f) => f !== definedIn && re.test(stripComments(readFileSync(f, 'utf8'))),
    );
    assert.ok(
      callers.length > 0,
      `${fn} has no caller outside ${definedIn}. If that is deliberate, delete the ` +
        `action and note what replaced it, or drop it from MUST_STAY_REACHABLE with ` +
        `the reasoning written where the action lives — do not just remove the entry.`,
    );
  });

  test(`${fn} still exists where this guard says it does`, () => {
    // Anchored on the SYMBOL, never a line number. If the action moves file, this
    // fails loudly rather than the caller check quietly searching for nothing —
    // an action deleted outright would otherwise make the caller test pass on a
    // stray mention elsewhere.
    const src = stripComments(readFileSync(definedIn, 'utf8'));
    assert.match(
      src,
      new RegExp(`export async function ${fn}\\b`),
      `${fn} is no longer exported from ${definedIn} — update this guard's entry`,
    );
  });
}
