/**
 * a-control-that-works-for-whoever-sees-it — W5-C items 2 and 3.
 *
 * ONE RULE, TWO SCREENS: never show somebody a control that refuses them, and
 * never tell somebody something the product already knows the answer to.
 *
 *   · The owner ribbon offered "Edit this site" to every host the capability
 *     admitted — including a `coordinator` member and every accepted delegate,
 *     all of whom the site editor redirects. They pressed it and were bounced.
 *   · The Live Studio controller said "Phone joined · A phone holds CH 3" on
 *     every channel, while `panood_camera_operators.claimer_user_id` had
 *     recorded WHO since the seat was claimed.
 *
 * 🔑 EVERY ASSERTION BELOW IS ANCHORED TO A STRING THAT MUST APPEAR IN THE
 * FILE THAT RENDERS OR DECIDES, not to a symbol name — a rename is not the
 * regression these exist to catch; deleting the behaviour is.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { crewHolderName } from './papic-crew-roster';

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8');

// ── 1 · THE DEAD END ───────────────────────────────────────────────────────

test('the editor still gates on member_type couple — the premise of the fix', () => {
  // If this ever stops being true, the ribbon's split is pointless and should
  // be revisited rather than left as a rule with no reason.
  const editor = read('app/dashboard/[eventId]/website/editor/page.tsx');
  assert.match(
    editor,
    /\.eq\('member_type', 'couple'\)/,
    'the site editor stopped gating on couple membership — re-decide the ribbon doorway',
  );
});

test('the ribbon asks the SAME column the editor does, not a second notion of "can edit"', () => {
  const loaders = read('app/[slug]/_lib/loaders.ts');
  assert.match(loaders, /loadCoupleMembership/);
  assert.match(
    loaders,
    /\.eq\('member_type', 'couple'\)/,
    'loadCoupleMembership stopped reading the column the editor checks',
  );
  const page = read('app/[slug]/page.tsx');
  assert.match(
    page,
    /checkSiteEditing:\s*\(userId\)\s*=>\s*loadCoupleMembership\(/,
    'the site page stopped resolving whether this host may edit',
  );
});

test('the ribbon component prints the model’s label, never a hardcoded one', () => {
  const ribbon = read('app/[slug]/_components/owner-ribbon.tsx');
  assert.match(ribbon, /\{model\.editorLabel\}/);
  assert.ok(
    !/>\s*Edit this site\s*</.test(ribbon),
    'the component hardcodes "Edit this site" again, so the model’s decision is dead',
  );
});

// ── 2 · WHO HOLDS THE CAMERA ───────────────────────────────────────────────

test('the channel reader joins the claimer to a name, on the SERVICE-ROLE client', () => {
  const src = read('lib/live-studio-channel-cameras.ts');
  assert.match(src, /holderName/, 'the channel view stopped carrying who holds the camera');
  assert.match(
    src,
    /admin\s*\n?\s*\.from\('users'\)/,
    'the holder-name read moved off the service-role client — public.users has ' +
      'no policy for reading another person, so it would silently return zero ' +
      'rows and every camera would read as unheld',
  );
  assert.match(src, /crewHolderName\(/, 'the shared Papic fallback is no longer used');
});

test('the controller names the holder instead of saying "a phone"', () => {
  const src = read('app/panood/control/[eventId]/page.tsx');
  assert.match(src, /camera\.holderName/, 'the controller stopped reading the holder');
  assert.ok(
    !/A phone holds CH \{channel\}/.test(src),
    'the anonymous sentence is back on the screen a host reads during the ceremony',
  );
});

test('an anonymous claim still reads as somebody, never as a blank', () => {
  // The join is login-free by design, so a claimed seat with no display name is
  // an ordinary state — and a blank where a name should be reads as a bug.
  assert.equal(crewHolderName(null), 'Someone');
  assert.equal(crewHolderName('   '), 'Someone');
  assert.equal(crewHolderName('Tita Baby'), 'Tita Baby');
});

test('an unclaimed channel has no holder at all — not "Someone"', () => {
  // "Someone holds CH 4" on a channel nobody has joined would send a host
  // looking for a camera operator who does not exist.
  const src = read('lib/live-studio-channel-cameras.ts');
  assert.match(
    src,
    /holderName:\s*claimed\s*\?/,
    'holderName stopped depending on the seat actually being claimed',
  );
});
