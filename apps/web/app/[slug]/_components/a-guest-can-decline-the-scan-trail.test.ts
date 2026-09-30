/**
 * A GUEST CAN DECLINE THE SCAN TRAIL — and can reach the switch to do it.
 *
 * `guests.scan_tracking_opt_out` shipped on 2026-05-13 citing RA 10173 and, for
 * fifteen months, nothing anywhere could turn it on. It is one of the columns
 * `tests/db/gates-have-handles.baseline.txt` calls a gate with no handle. This
 * file guards the handle; `lib/scan-trail.test.ts` guards the gate.
 *
 * 🛡 ANCHORED TO WHAT A REGRESSION WOULD REMOVE. This repo has shipped at least
 * six source-reading guards that stayed green while the thing they guarded was
 * gone — one matched a bare identifier that a surviving `import` line satisfied.
 * The checks below match bound actions and mounted JSX, not names.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const NOTICE = join(HERE, 'scan-trail-notice.tsx');
const SITE_BODY = join(HERE, 'site-body.tsx');
const GUEST_ACTIONS = join(HERE, '..', 'actions.ts');

/**
 * Comments stripped with THE repo's stripper — every file here explains itself
 * in prose that names the exact strings these assertions look for.
 *
 * ⚠ NOT a two-replace regex. That shape strips BLOCK comments first, so a `//`
 * line containing `video/*` opens a comment that closes at the next real `*\/`
 * and blanks everything between — and the guard then asserts against a blank
 * and passes. `scripts/lint-one-comment-stripper.mjs` is a blocking CI guard
 * that stops a second stripper being written; it caught this file.
 */
function code(path: string): string {
  return stripComments(readFileSync(path, 'utf8'));
}

test('ANCHOR — the three files were read and stripping left code behind', () => {
  for (const [name, path] of [
    ['scan-trail-notice.tsx', NOTICE],
    ['site-body.tsx', SITE_BODY],
    ['[slug]/actions.ts', GUEST_ACTIONS],
  ] as const) {
    // NON-WHITESPACE length, deliberately. The repo's stripper replaces a
    // comment's characters with SPACES so that offsets survive, which means a
    // file blanked to nothing but whitespace still has its full `.length` — the
    // exact reading that would make every assertion below vacuous while this
    // anchor reported the file as read.
    const solid = code(path).replace(/\s+/g, '').length;
    assert.ok(solid > 400, `${name}: stripped to ${solid} non-space chars — the assertions are vacuous`);
  }
});

test('the switch is MOUNTED on the guest site, not merely imported', () => {
  const src = code(SITE_BODY);
  assert.match(
    src,
    /<ScanTrailNotice\s+eventId=/,
    'the scan-trail switch is not rendered — the column is a gate with no handle again',
  );
});

test('the switch is NOT hidden behind ANY condition — it renders for every guest', () => {
  // FaceDataNotice renders only for `photo_source === 'selfie'`. Every guest
  // leaves a scan trail, so putting this control inside that branch would hide
  // it from most of the people it exists for.
  //
  // 🔑 THE WINDOW IS ON THE LEFT, AND THAT IS THE WHOLE LESSON. A gate is
  // written BEFORE the element it gates — a check that slices forward from the
  // mount cannot see `{guest.photo_source === 'selfie' ? …}` wrapped around it.
  //
  // ⚖ 2026-09-30 — IT MOVED INTO "YOUR DETAILS" (owner: off the page body, into
  // the guest's details sheet, as one small line; RA 10173 — moved, never gone).
  // So there are exactly TWO mounts and they are COMPLEMENTS of one expression:
  // inside `<RsvpSheet>` (which renders iff `plan.rsvpShouldRender`), and in the
  // body iff NOT `plan.rsvpShouldRender`. Every recognised guest gets exactly one.
  // The stripper keeps offsets and leaves `{      }` for a JSX comment; drop them.
  const src = code(SITE_BODY).replace(/\{\s*\}/g, ' ');
  const mounts = [...src.matchAll(/<ScanTrailNotice\b/g)].map((m) => m.index!);
  assert.equal(mounts.length, 2, `expected the sheet mount + the no-sheet fallback, found ${mounts.length}`);

  const sheetOpen = src.indexOf('<RsvpSheet');
  const sheetClose = src.indexOf('</RsvpSheet>');
  assert.ok(sheetOpen > -1 && sheetClose > sheetOpen, 'the reply sheet is gone — re-point this guard');
  const inSheet = mounts.filter((at) => at > sheetOpen && at < sheetClose);
  const inBody = mounts.filter((at) => at < sheetOpen || at > sheetClose);
  assert.equal(inSheet.length, 1, 'the switch is not inside "Your details"');
  assert.equal(inBody.length, 1, 'there is no body fallback for a page with no reply sheet');

  // The sheet's own gate, and the fallback's gate, are the same expression negated.
  const sheetGate = src.slice(0, sheetOpen).trimEnd();
  assert.match(sheetGate.slice(-40), /\{plan\.rsvpShouldRender \? \($/, 'the reply sheet is no longer gated on plan.rsvpShouldRender');
  const bodyGate = src.slice(0, inBody[0]).trimEnd();
  assert.match(
    bodyGate.slice(-60),
    /\{plan\.rsvpShouldRender \? null : \($/,
    `the body fallback is not the exact complement of the sheet's gate. It is preceded by: …${bodyGate.slice(-60)}`,
  );
  // Inside the sheet, nothing between the wrapper and the mount decides anything.
  const beforeSheetMount = src.slice(0, inSheet[0]).trimEnd();
  assert.equal(
    beforeSheetMount.slice(-1),
    '>',
    `the switch inside "Your details" sits inside a conditional. It is preceded by: …${beforeSheetMount.slice(-60)}`,
  );
  // The face notice keeps its own gate — this must be an addition, not a move.
  assert.match(src, /photo_source === 'selfie'/, 'the face notice lost its selfie gate');
});

test('the control is wired to the action — a form with no action is a dead switch', () => {
  const src = code(NOTICE);
  assert.match(
    src,
    /setGuestScanTracking\.bind\(/,
    'the toggle is no longer bound to the server action',
  );
  assert.match(src, /action=\{toggle\}/, 'the form is not wired to the bound action');
  // It must offer the OPPOSITE of the stored value, or the button does nothing.
  // S41b: the flip moved into `scanOptOutTarget` (so a refused read — null —
  // offers the protective value); its truth table is EXECUTED in
  // `lib/guest-privacy-reads-are-honest.test.ts`, and this pins the wiring.
  assert.match(src, /guestId,\s*scanOptOutTarget\(optedOut\)\)/, 'the toggle no longer flips the stored value');
  assert.match(src, /return current !== true;/, 'scanOptOutTarget no longer returns the opposite of the stored value');
});

test('the control reads the stored value at render, so it cannot show the wrong position', () => {
  const src = code(NOTICE);
  assert.match(src, /readScanOptOut\(eventId, guestId\)/, 'the current setting is no longer read');
  assert.match(
    src,
    /scan_tracking_opt_out === true/,
    'the display no longer requires a positive true — a failed read could claim the guest is untracked',
  );
});

test('the OFF state tells the guest what it costs', () => {
  // The trail's only reader is the first-arrival greeting. A guest who turns
  // this off stops being welcomed on arrival, and finding that out by accident
  // is how a privacy control earns a reputation for breaking things.
  const src = code(NOTICE);
  assert.match(
    src,
    /greet you the same way every time/,
    'the cost sentence is gone — the OFF state now claims a free lunch',
  );
});

test('a guest can only ever move their OWN switch', () => {
  const src = code(GUEST_ACTIONS);
  const fn = src.slice(src.indexOf('export async function setGuestScanTracking'));
  const body = fn.slice(0, fn.indexOf('\n}\n') + 1);
  assert.ok(body.length > 200, 'setGuestScanTracking is missing — the switch has no writer');
  assert.match(body, /readGuestSession\(\)/, 'the action does not read the guest session');
  assert.match(
    body,
    /session\.event_id !== eventId \|\| session\.guest_id !== guestId/,
    'the action does not pin the session to BOTH the event and the guest',
  );
  // The write must be pinned the same way, or a valid session for one guest
  // could move a row selected by something else.
  assert.match(
    body,
    /\.eq\('event_id', eventId\)\s*\.eq\('guest_id', guestId\)/,
    'the update is not pinned to both the event and the guest',
  );
});

test('the guest control never wears the gold — it fails contrast as text', () => {
  // The Tailwind slot NAMED `terracotta` is the atelier GOLD (3.37:1, under the
  // 4.5:1 floor); the action colour lives in the slot named `mulberry`.
  const src = code(NOTICE);
  assert.equal(
    (src.match(/text-terracotta/g) ?? []).length,
    0,
    'gold is being used as text on a guest-facing privacy control',
  );
});
