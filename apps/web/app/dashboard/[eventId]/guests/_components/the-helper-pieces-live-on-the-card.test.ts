/**
 * the-helper-pieces-live-on-the-card.test.ts — the Hosts fold, part 2 (F2).
 *
 * Owner 2026-09-30 (DECISION_LOG "GUEST LIST: ACCESS + CHECK-IN BECOME COLUMNS;
 * HOSTS FOLDS INTO THE GUEST LIST" (6) and "HOSTS FOLD — THREE OWNER ANSWERS"
 * (1)): a limited helper's grants and colour access move under the Access line
 * of THEIR guest card; what they did goes to that card too; when Access goes to
 * None their control ends and the record stays, read-only.
 *
 * MOVED, NEVER REDRAWN: one definition of each piece, the same actions. The
 * Maker draws the same card and must carry none of it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const APP = join(process.cwd(), 'app');
const EVENT = join(APP, 'dashboard', '[eventId]');
const read = (p: string) => stripComments(readFileSync(p, 'utf8'));
const SECTION = read(join(EVENT, 'guests', '_components', 'guest-helper-access.tsx'));

test('the card section reuses the Hosts pieces and their actions — never a copy', () => {
  assert.match(SECTION, /from '@\/app\/dashboard\/\[eventId\]\/_components\/coordinator-seat-controls'/);
  assert.match(SECTION, /from '@\/app\/dashboard\/\[eventId\]\/_components\/coordinator-colour-domains'/);
  assert.match(SECTION, /setDomainAction=\{setCoordinatorColourDomain\.bind\(null, eventId\)\}/);
  assert.match(SECTION, /rejectAction=\{rejectColourChange\.bind\(null, eventId\)\}/);
  assert.doesNotMatch(SECTION, /'use server'|export async function/, 'the card grew its own server action');
  // One definition of each piece, anywhere under app/.
  // `CoordinatorSeatControls` is gone (2026-10-03): its switches and Remove
  // MOVED to Event Details › People with access — the card SHOWS the grant and
  // links there (`ChangeAccessLink`).
  const defs: Record<string, number> = { CoordinatorGrantChips: 0, ChangeAccessLink: 0, CoordinatorColourDomains: 0, CoordinatorSeatControls: 0 };
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx$/.test(n)) {
        const src = read(p);
        for (const k of Object.keys(defs)) if (new RegExp(`function ${k}\\b`).test(src)) defs[k] = (defs[k] ?? 0) + 1;
      }
    }
  };
  walk(APP);
  assert.deepEqual(defs, { CoordinatorGrantChips: 1, ChangeAccessLink: 1, CoordinatorColourDomains: 1, CoordinatorSeatControls: 0 }, 'a Hosts piece was redrawn, or a retired setter came back');
  assert.match(SECTION, /<ChangeAccessLink eventId=\{eventId\} \/>/, 'the helper card lost its door to People with access');
});

test('the helper card sets nothing — access is set in People with access', () => {
  // A helper is removed there by Access → None (`setGuestAccess`), never by the
  // planner's reasoned Remove, and their areas are its dropdowns.
  for (const setter of ['removeHost', 'setDelegateArea', 'setDelegateBudget', 'setDelegatePhotos', 'setGuestAccess']) {
    assert.ok(!SECTION.includes(setter), `the helper card reaches for ${setter}`);
  }
  const people = read(join(EVENT, 'details', '_components', 'people-with-access.tsx'));
  assert.match(people, /row\.kind === 'coordinator' && !row\.isViewer \? \(\s*<RemoveCoordinator/, 'the reasoned Remove is not the coordinator’s alone');
});

test('grants only for a CURRENT limited-helper seat; the record from any seat they held', () => {
  const loader = read(join(process.cwd(), 'lib', 'guest-helper-card.server.ts'));
  assert.match(loader, /const current = seats\.find\(\(s\) => !s\.removed_at\) \?\? null;/);
  assert.match(loader, /const helper = current && !seatIsFullCohost\(current\.role_subtype\) \? current : null;/, 'a co-host or an ended seat gets switches');
  assert.match(loader, /const actor = current\?\.user_id \?\? seats\.find\(\(s\) => s\.user_id\)\?\.user_id \?\? null;/, 'the record ends with the access');
  assert.match(loader, /fetchDelegateActivity\(admin, input\.eventId, 10, actor\)/, 'the card reads a second activity stream');
});

test('it sits under the Access line, on the Guest list\'s card screens only — never in the Maker', () => {
  const body = read(join(EVENT, 'guests', '_components', 'guest-card-body.tsx'));
  const at = body.indexOf('<GuestAccessControl');
  const slot = body.indexOf('{helperAccess ?? null}');
  assert.ok(at > -1 && slot > at, 'the helper pieces are not under the Access line');
  for (const f of [join(EVENT, 'guests', 'page.tsx'), join(EVENT, 'guests', '[guestId]', 'page.tsx')]) {
    assert.match(read(f), /helperAccess=\{/, `${f} does not hand the card its helper pieces`);
    assert.match(read(f), /\.canManageAccess/, `${f} loads the helper pieces for a viewer who cannot manage access`);
  }
  assert.doesNotMatch(read(join(EVENT, 'launch', 'page.tsx')), /GuestHelperAccess|loadGuestHelperCard/, 'the Maker carries the helper pieces');
});
