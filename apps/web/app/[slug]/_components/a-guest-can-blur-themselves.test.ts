/**
 * A GUEST CAN BLUR THEMSELVES, AND IS TOLD WHEN SOMEBODY UNDOES IT
 *
 * Owner rulings 3 and 4 of 2026-08-17: *"Either side toggles it, freely — guest
 * or couple, on or off"*, and because of that, *"the guest is notified if their
 * blur is switched off"*.
 *
 * The live `/privacy` notice has always told guests they can turn FaceBlock on
 * themselves. Until this change the only writer was the COUPLE'S per-guest
 * screen, so a guest had to ask the couple to keep themselves off a wall.
 *
 * 🛡 EVERY ASSERTION HERE IS MUTATION-CHECKED BY OCCURRENCE COUNT. This repo has
 * shipped at least six source-reading guards that passed while the thing they
 * guarded was gone — one matched a bare identifier that a surviving `import`
 * line satisfied, so deleting the JSX left it green three times. Each check
 * below is anchored to something the REGRESSION would actually remove.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const NOTICE = join(HERE, 'face-data-notice.tsx');
const GUEST_ACTIONS = join(HERE, '..', 'actions.ts');
const COUPLE_ACTIONS = join(
  HERE, '..', '..', 'dashboard', '[eventId]', 'guests', '[guestId]', 'actions.ts',
);

/**
 * Source with comments stripped. Every file below carries a docblock naming the
 * exact strings these assertions look for — a raw-source match would find the
 * explanation of the fix and call it the fix.
 */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
}

test('ANCHOR — the three files were read and stripping left code behind', () => {
  for (const [name, path] of [
    ['face-data-notice.tsx', NOTICE],
    ['[slug]/actions.ts', GUEST_ACTIONS],
    ['guests/[guestId]/actions.ts', COUPLE_ACTIONS],
  ] as const) {
    assert.ok(code(path).length > 400, `${name}: stripped to nothing — every assertion below is vacuous`);
  }
});

test('the guest`s own blur control is MOUNTED, not merely imported', () => {
  const src = code(NOTICE);
  // Anchored to the BOUND ACTION, which is what a regression deleting the form
  // would take with it. A bare `setGuestFaceBlock` would survive in the import.
  assert.match(
    src,
    /setGuestFaceBlock\.bind\(/,
    'the guest FaceBlock control is gone — /privacy still tells guests they have one',
  );
  assert.match(src, /action=\{toggleBlur\}/, 'the toggle form is not wired to the action');
});

test('both choices survive — blurring must not swallow "remove my face data"', () => {
  // They are different promises: one is reversible and keeps finding your
  // photos, the other is "forget me". Collapsing them makes the gentle choice
  // cost the guest their photos.
  const src = code(NOTICE);
  assert.match(src, /withdrawFaceConsent\.bind\(/, 'the face-data removal path was dropped');
  assert.match(src, /setGuestFaceBlock\.bind\(/, 'the blur path was dropped');
});

test('the guest control never wears the gold — it fails contrast as text', () => {
  // In this repo the Tailwind slot NAMED `terracotta` is the atelier GOLD
  // (3.37:1 on the page ground, under the 4.5:1 floor); the action colour lives
  // in the slot named `mulberry`. Inherited and backwards, which is why this
  // mistake keeps being made.
  const src = code(NOTICE);
  assert.equal(
    (src.match(/text-terracotta/g) ?? []).length,
    0,
    'gold is being used as text on a guest-facing privacy control',
  );
});

test('a guest can only ever move their OWN switch', () => {
  const src = code(GUEST_ACTIONS);
  const fn = src.slice(src.indexOf('export async function setGuestFaceBlock'));
  const body = fn.slice(0, fn.indexOf('\n}\n') + 1);
  assert.match(body, /readGuestSession\(\)/, 'the blur action does not read the guest session');
  assert.match(
    body,
    /session\.event_id !== eventId \|\| session\.guest_id !== guestId/,
    'the blur action does not pin the session to BOTH the event and the guest',
  );
});

test('switching a guest`s blur OFF tells them — and only on ON → OFF', () => {
  const src = code(COUPLE_ACTIONS);
  assert.match(src, /blurWasOn && !faceblock_enabled/, 'the notice does not fire on the ON → OFF transition');
  assert.match(src, /subject: 'Your face is no longer blurred/, 'the guest is not actually told anything');
});

test('an UNREADABLE previous value sends nothing, rather than something false', () => {
  // `prevGuest` is null on a failed read. `?? false` would read that as "it was
  // off" and skip the notice on every save; `=== true` sends nothing instead.
  // This is a message about somebody's face — a wrong one is worse than none.
  const src = code(COUPLE_ACTIONS);
  assert.match(
    src,
    /\)\?\.faceblock_enabled === true/,
    'the prior blur state is no longer compared with === true — a failed read now decides it',
  );
  // And the dangerous spelling must be absent, not merely un-preferred.
  assert.equal(
    (src.match(/\?\.faceblock_enabled \?\?/g) ?? []).length,
    0,
    'the prior blur state is being defaulted with ?? — a failed read would read as "it was off"',
  );
});

test('the previous blur state is actually SELECTED — a phantom column reads as false', () => {
  // Supabase does not throw on an unknown column: PostgREST rejects the whole
  // statement and the row comes back null, so the notice would silently never
  // fire while every other assertion here still passed.
  const src = code(COUPLE_ACTIONS);
  const sel = src.match(/\.select\(\s*'[^']*faceblock_enabled[^']*'/);
  assert.ok(sel, 'faceblock_enabled is not in the prevGuest select — the notice can never fire');
  assert.match(sel[0], /email/, 'the guest email is not selected — there is nobody to send to');
});
