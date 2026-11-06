/**
 * "PROPOSE SCHEDULE" IS VISIBLY SHUT, AND SAYS WHY.
 *
 * ── WHAT THIS EXISTS TO CATCH ───────────────────────────────────────────────
 * The destination was never dishonest: the client's Schedule tab refuses before
 * a booking and draws "Unlocks when they book you". The defect was WHERE that
 * sentence lived — a supplier had to leave the conversation and load another
 * screen to meet it, while the launcher sat among eight others that all open.
 * Owner question B2, recommendation (a), the same shape as the Lock ruling:
 * HIDE NOTHING, SAY WHY.
 *
 * Three ways that can silently come undone, so three assertions that count
 * rather than merely look:
 *
 *   1. the gate stops covering a stage, or starts greying one it should not —
 *      `completed` is the dangerous one: it outranks `booked`, so gating on
 *      `booked` alone tells a supplier who already worked the wedding that the
 *      tool "opens once they book you" about a couple who did.
 *   2. the ＋ Tools sheet (since 2026-10-14; it was the rail) stops rendering
 *      the shut branch, or starts hiding the tool instead — a vanished control
 *      teaches a supplier the feature is missing.
 *   3. the reason gets retyped in the sheet, so the button and the destination
 *      can drift apart — the failure this repo keeps producing.
 *
 * ⚠ The href literal must STAY in the route's own file even though the shut
 * branch does not use it: `lint-port-no-lost-controls` reads a route's files
 * for the destinations it offers and only sees a literal after `href=`. Losing
 * it would read as the route having LOST that destination, and the tempting fix
 * — regenerating the baseline — would record a removal that never happened.
 *
 * Run: cd apps/web && npx tsx --test lib/the-schedule-tool-says-why-it-is-shut.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { THREAD_STAGE_HAS_AGREEMENT, VENDOR_THREAD_TOOLS, vendorThreadToolRows } from './vendor-thread-tools';
import { resolveThreadStage, THREAD_STAGE_LABEL } from './vendor-thread-stage';

const WEB = join(__dirname, '..');
const SHEET = 'app/vendor-dashboard/messages/[threadId]/_components/thread-tools-sheet.tsx';
const PAGE = 'app/vendor-dashboard/messages/[threadId]/page.tsx';

/** Source with comments removed — a claim must be about CODE, never about prose. */
function code(rel: string): string {
  const raw = readFileSync(join(WEB, rel), 'utf8');
  assert.ok(raw.length > 2000, `${rel} read as ${raw.length} chars — the scan is not reading it`);
  return stripComments(raw);
}

const SCHEDULE_TOOL = VENDOR_THREAD_TOOLS.find((t) => t.key === 'propose-schedule');

test('0 · the thing being guarded is actually there', () => {
  assert.ok(SCHEDULE_TOOL, 'the propose-schedule tool has left the list');
  assert.ok(
    SCHEDULE_TOOL!.shutUntilAgreement,
    'propose-schedule no longer declares that it is shut before an agreement',
  );
  assert.ok(VENDOR_THREAD_TOOLS.length >= 8, 'the tool list emptied out');
});

test('1 · the gate covers EVERY stage, and completed is open', () => {
  // Every stage resolveThreadStage can return must have a ruling here. Built
  // from the resolver itself, not from a list retyped beside it.
  const everyStage = [
    resolveThreadStage({ completed: true, booked: false, quoted: false, cancelled: false }),
    resolveThreadStage({ completed: false, booked: true, quoted: false, cancelled: false }),
    resolveThreadStage({ completed: false, booked: false, quoted: false, cancelled: true }),
    resolveThreadStage({ completed: false, booked: false, quoted: true, cancelled: false }),
    resolveThreadStage({ completed: false, booked: false, quoted: false, cancelled: false }),
  ];
  assert.deepEqual(
    [...new Set(everyStage)].sort(),
    Object.keys(THREAD_STAGE_LABEL).sort(),
    'the resolver can produce a stage the label map does not name — this guard is reading a stale vocabulary',
  );
  for (const stage of everyStage) {
    assert.equal(
      typeof THREAD_STAGE_HAS_AGREEMENT[stage],
      'boolean',
      `stage "${stage}" has no ruling in THREAD_STAGE_HAS_AGREEMENT`,
    );
  }

  // 🔑 THE ONE THAT MATTERS. completed outranks booked in the resolver, so a
  // supplier who already worked the wedding reads as completed — and the
  // destination still opens for them.
  assert.equal(THREAD_STAGE_HAS_AGREEMENT.completed, true, 'a finished job must not be told to go and get booked');
  assert.equal(THREAD_STAGE_HAS_AGREEMENT.booked, true);
  assert.equal(THREAD_STAGE_HAS_AGREEMENT.inquiry, false);
  assert.equal(THREAD_STAGE_HAS_AGREEMENT.quoted, false);
  assert.equal(THREAD_STAGE_HAS_AGREEMENT.cancelled, false);

  const open = Object.values(THREAD_STAGE_HAS_AGREEMENT).filter(Boolean).length;
  assert.equal(open, 2, `exactly two stages carry an agreement — found ${open}`);
});

test('2 · the ＋ sheet lists the tool SHUT, not hidden, and keeps the destination literal', () => {
  // The decision is EXECUTED, not grepped: before an agreement the row is there, shut, with the list's reason.
  const before = vendorThreadToolRows({ hasAgreement: false, askOpen: false, paymentsToConfirm: 0, guestCountChanges: 0 });
  const row = before.find((r) => r.tool.key === 'propose-schedule');
  assert.ok(row, 'the schedule tool vanished before an agreement — the ruling is hide NOTHING, say why');
  assert.deepEqual(row!.shut, SCHEDULE_TOOL!.shutUntilAgreement, 'before an agreement the tool must be shut with the list\'s reason');
  const after = vendorThreadToolRows({ hasAgreement: true, askOpen: false, paymentsToConfirm: 0, guestCountChanges: 0 });
  assert.equal(after.find((r) => r.tool.key === 'propose-schedule')?.shut, null, 'once booked the tool must open');

  const sheet = code(SHEET);
  // The shut branch renders a disabled-but-reachable control with the reason tied to it.
  const shutAt = sheet.indexOf('if (shut) {');
  assert.ok(shutAt > 0, 'the sheet has no shut branch — a shut tool would render live');
  const shutBranch = sheet.slice(shutAt, sheet.indexOf('return (', sheet.indexOf('return (', shutAt) + 8));
  assert.match(shutBranch, /aria-disabled="true"/, 'the shut control must announce itself as disabled');
  assert.match(shutBranch, /aria-describedby=\{reasonId\}/, 'the reason must be tied to the control, not stranded beside it');
  assert.match(shutBranch, /tabIndex=\{0\}/, 'the shut control must stay reachable by keyboard');
  assert.ok(
    !/\bdisabled\b(?!=")/.test(shutBranch.replace(/aria-disabled/g, '')),
    'a real `disabled` leaves the tab order, so a keyboard user never hears the reason',
  );
  // The destination literal must survive in the route's own files.
  assert.match(
    sheet,
    /`\/vendor-dashboard\/clients\/\$\{eventId\}\?tab=schedule`/,
    'the schedule href literal is gone from this route — lint-port-no-lost-controls will read it as a lost destination',
  );
});

test('3 · the reason is NOT retyped in the sheet — one sentence, one home', () => {
  const reason = SCHEDULE_TOOL!.shutUntilAgreement!.reason;
  assert.ok(reason.length > 8, 'the reason is too short to be a sentence');
  const sheet = code(SHEET);
  assert.ok(
    !sheet.includes(reason),
    `the sheet spells out "${reason}" itself — it must render the row's reason so the button and the destination cannot drift`,
  );
  assert.match(sheet, /\{shut\.reason\}/, 'the reason must come from the list');
});

test('4 · the page reads the STAGE VALUE, never the pill label', () => {
  const page = code(PAGE);
  assert.match(
    page,
    /hasAgreement:\s*THREAD_STAGE_HAS_AGREEMENT\[railStage\]/,
    'the page no longer resolves the agreement from the exhaustive map',
  );
  // A control read off display text is how this repo once drew "C" for "Camera off".
  assert.ok(
    !/hasAgreement:[^,\n]*THREAD_STAGE_LABEL/.test(page),
    'the agreement is being read from the stage PILL — that is display text',
  );
});
