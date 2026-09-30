/**
 * admin-event-page-is-honest.test.ts — the admin event page (2026-09-30).
 *
 * Two promises, both of which fail SILENTLY when broken:
 *
 * (a) "Reopen guest list" really reopens it. Clearing only
 *     `guest_count_locked_at` looks like it worked — and `ensureFinalized`
 *     (lib/pax.ts) re-stamps it on the couple's next visit, because it decides
 *     by the DEADLINE. So the reopen must clear the stamp AND `final_pax` AND
 *     move the deadline into the future, and the action must check the row it
 *     wrote before it says "saved".
 *
 * (b) Every read on /admin/events/[eventId] has an error branch that renders
 *     "Couldn't load" — a refused read never becomes `0` or an empty list
 *     (the contract of lib/guests-read-is-honest.test.ts).
 *
 * 🛡 Sabotage-checked: dropping `final_pax` from the patch, dropping the
 * `.select(` after the update, and deleting one read's `.error` binding each
 * turn this file red (see the PR for the before/after counts).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { guestListReopenPatch, reopenLanded } from '@/lib/admin-reopen-guest-list';
import { guestListIsClosed } from '@/lib/guest-list-closed';

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTION = stripComments(
  readFileSync(join(HERE, '..', 'app', 'admin', 'events', 'actions.ts'), 'utf8'),
);
const PAGE = stripComments(
  readFileSync(join(HERE, '..', 'app', 'admin', 'events', '[eventId]', 'page.tsx'), 'utf8'),
);

const NOW = Date.parse('2026-09-30T08:00:00Z');

/* ── (a) the reopen clears all three columns ─────────────────────────────── */

test('the reopen patch clears the stamp AND final_pax AND sets a future deadline', () => {
  const p = guestListReopenPatch(NOW);
  assert.deepEqual(Object.keys(p).sort(), [
    'final_pax',
    'guest_count_locked_at',
    'guest_list_edit_deadline',
  ]);
  assert.equal(p.guest_count_locked_at, null);
  assert.equal(p.final_pax, null);
  assert.match(p.guest_list_edit_deadline, /^\d{4}-\d{2}-\d{2}$/, 'the column is a DATE');
  assert.equal(p.guest_list_edit_deadline, '2026-10-14');
});

test('after the patch, the question ensureFinalized asks answers OPEN — even for an event already past', () => {
  const p = guestListReopenPatch(NOW);
  for (const eventDate of ['2026-09-01', '2026-10-01', '2027-06-01', null]) {
    assert.equal(
      guestListIsClosed({
        lockedAt: p.guest_count_locked_at,
        editDeadline: p.guest_list_edit_deadline,
        eventDate,
        nowMs: NOW,
      }),
      false,
      `event ${eventDate}: a reopened list must not read as closed, or ensureFinalized re-stamps it on the next visit`,
    );
  }
  // Control: the stamp alone, with the old deadline in the past, is NOT a reopen.
  assert.equal(
    guestListIsClosed({ lockedAt: null, editDeadline: '2026-09-15', eventDate: '2026-10-01', nowMs: NOW }),
    true,
  );
});

test('reopenLanded only says yes to exactly one row carrying the patch', () => {
  const p = guestListReopenPatch(NOW);
  const ok = { guest_count_locked_at: null, final_pax: null, guest_list_edit_deadline: p.guest_list_edit_deadline };
  assert.equal(reopenLanded([ok], p), true);
  assert.equal(reopenLanded([], p), false, 'matched nothing');
  assert.equal(reopenLanded(null, p), false, 'no rows came back');
  assert.equal(reopenLanded([{ ...ok, guest_count_locked_at: '2026-09-30T08:00:01Z' }], p), false, 're-stamped');
  assert.equal(reopenLanded([{ ...ok, final_pax: 120 }], p), false, 'count still frozen');
});

test('the action applies the patch, selects the row back, and checks it before saying saved', () => {
  const start = ACTION.indexOf("'reopen_guest_list'");
  assert.ok(start > 0, 'the reopen intent must exist on the admin events action');
  const branch = ACTION.slice(start, ACTION.indexOf("redirectBack('saved', 'guest_list_reopened')", start));
  assert.match(branch, /\.update\(patch\)[\s\S]*?\.select\(/, 'the updated row must be .select()ed back');
  assert.match(branch, /guestListReopenPatch\(\)/, 'the patch comes from the pure helper');
  assert.match(branch, /reopenLanded\(/, 'and is checked before "saved"');
  assert.match(branch, /admin_audit_log/, 'and the reopen is recorded');
  assert.match(branch, /createAdminClient|admin\s*\.from/, 'through the service-role client');
  assert.doesNotMatch(ACTION, /export async function reopenGuestList/, 'no new exported action — the budget is at its ceiling');
});

test('the face-mode switch no longer returns silently', () => {
  const fn = ACTION.slice(ACTION.indexOf('export async function setEventFaceMode'));
  assert.match(fn, /\.update\(\{ papic_face_mode: mode \}\)[\s\S]*?\.select\('papic_face_mode'\)/);
  assert.doesNotMatch(fn, /\n\s*return;\n/, 'every exit redirects with ?saved= or ?error=');
  assert.match(fn, /'face_mode_failed'/);
  assert.match(fn, /'face_mode_not_applied'/);
});

/* ── (b) every read on the page has an error branch ──────────────────────── */

test('every read on the admin event page binds its error', () => {
  const froms = PAGE.match(/\.from\('/g) ?? [];
  const holders = [...PAGE.matchAll(/const (\w+)\s*=\s*(?:\w+(?:\.\w+)*\s*\?\s*)?await admin\b/g)].map(
    (m) => m[1]!,
  );
  // The three head-count reads share `liveGuests()` and are judged by countCell.
  const sharedCountReader = /const liveGuests = \(\) =>\s*admin\s*\.from\('guests'\)/.test(PAGE) ? 1 : 0;
  assert.equal(
    holders.length + sharedCountReader,
    froms.length,
    `a read was added that this guard cannot see (${froms.length} .from() calls, ${holders.length} named reads + ${sharedCountReader} shared) — name it and bind its error`,
  );
  const unbound = holders.filter((h) => !new RegExp(`\\b${h}\\.error\\b`).test(PAGE));
  assert.deepEqual(unbound, [], 'each read must have its .error decide what renders');
});

test('the head-count reads render "Couldn\'t load", never 0, on error', () => {
  assert.match(PAGE, /const countCell = \(r[^)]*\) =>\s*r\.error \|\| r\.count === null \? COULD_NOT_LOAD/);
  for (const r of ['totalRead', 'yesRead', 'declinedRead']) {
    assert.match(PAGE, new RegExp(`countCell\\(${r}\\)`), `${r} must render through countCell`);
  }
  assert.match(PAGE, /const COULD_NOT_LOAD = "Couldn't load"/);
});

test('the face list and hosts hand a refused read to the render, not to []', () => {
  assert.match(PAGE, /readError=\{guestsRead\.error\}/);
  assert.match(PAGE, /faceRows: FaceRow\[\] \| null = guestsRead\.error\s*\?\s*null/);
  assert.match(PAGE, /hosts = hostsError \? null/);
  assert.match(PAGE, /hosts === null \?/);
  assert.match(PAGE, /enrolledIds === null \? COULD_NOT_LOAD/);
  assert.match(
    PAGE,
    /\(enrolRead\.count \?\? -1\) !== enrolRows\.length/,
    'a server-truncated enrolment read must not mark the rest "not enrolled"',
  );
});

test('the face read takes guest_id only — never a vector, asset or score', () => {
  const m = PAGE.match(/\.from\('guest_face_enrollments'\)\s*\.select\('([^']*)'/);
  assert.ok(m, 'the enrolment read must be a single-literal select');
  assert.equal(m![1], 'guest_id');
});
