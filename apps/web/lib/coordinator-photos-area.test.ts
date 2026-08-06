/**
 * coordinator-photos-area.test.ts — a coordinator may see the couple's guest
 * photos, but ONLY once the couple approves it (owner 2026-08-06).
 *
 * 🚨 THE DANGEROUS HALF IS THE TYPESCRIPT MIRROR, NOT THE DATABASE.
 * `public.moderator_area_level` fails CLOSED — its `ELSE NULL` covers any area
 * it does not name. `resolveAreaLevel` in TypeScript fails OPEN: its tail
 * returns 'edit' for any delegate carrying `edit_all`. Adding `photos` to the
 * union without an explicit branch would therefore have handed the couple's
 * guest photos to every existing delegate — including the accepted planner row
 * live in production — with no approval and nothing on screen to show it.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  resolveAreaLevel,
  COORDINATOR_AREAS,
  DELEGATE_AREAS,
  DELEGATE_AREA_LABEL,
  type ModeratorPermissions,
} from './delegate-areas';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = join(WEB, '..', '..', 'supabase', 'migrations');
const sql = () =>
  readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
    .join('\n')
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');

const FULL: ModeratorPermissions = {
  edit_all: true,
  checkout: true,
  invite_hosts: true,
  remove_hosts: true,
};

test('a delegate with NO photos key gets nothing — even with edit_all', () => {
  // This is the whole test file in one line. The permissions object below is
  // exactly the shipped `wedding_planner_external` template, and exactly the
  // shape of the accepted row sitting in production.
  assert.equal(resolveAreaLevel(FULL, 'photos'), null);
  assert.equal(resolveAreaLevel({ ...FULL, areas: {} }, 'photos'), null);
  assert.equal(resolveAreaLevel({ ...FULL, edit_all: false }, 'photos'), null);
  assert.equal(resolveAreaLevel(null, 'photos'), null);
});

test('approval is what turns it on, and it can be either level', () => {
  assert.equal(resolveAreaLevel({ ...FULL, areas: { photos: 'view' } }, 'photos'), 'view');
  assert.equal(resolveAreaLevel({ ...FULL, areas: { photos: 'edit' } }, 'photos'), 'edit');
  // And an explicit null revokes it again — the couple can take it back.
  assert.equal(resolveAreaLevel({ ...FULL, areas: { photos: null } }, 'photos'), null);
});

test('the coordinator default is OFF', () => {
  assert.equal(COORDINATOR_AREAS.photos ?? null, null);
  assert.ok('photos' in COORDINATOR_AREAS, 'written as an explicit null, like budget, not left absent');
});

test('the area is a first-class one, not a special case', () => {
  assert.ok(DELEGATE_AREAS.includes('photos'), 'photos is missing from the area list');
  assert.ok(DELEGATE_AREA_LABEL.photos, 'photos has no human label — a permission nobody can name');
  // Every other area keeps working — a regression here would silently change
  // what an existing coordinator can do.
  assert.equal(resolveAreaLevel(FULL, 'guest_list'), 'edit');
  assert.equal(resolveAreaLevel(FULL, 'mood_board'), 'view');
  assert.equal(resolveAreaLevel(FULL, 'budget'), 'view');
});

test('the couple has a CONTROL that grants it — a permission needs a handle', () => {
  // 🚨 THE SHAPE THIS CODEBASE KEEPS RE-DISCOVERING. Four times in a week a
  // column shipped with readers and no writer — face mode, the livestream
  // audience, the vendor venue picker, and the guest byline I built myself the
  // same day. A permission the couple holds and cannot exercise is the same
  // defect wearing different clothes.
  const actions = readFileSync(
    join(WEB, 'app/dashboard/[eventId]/hosts/actions.ts'),
    'utf8',
  );
  assert.ok(
    // \b or a rename to `setDelegatePhotosX` satisfies the prefix and the guard
    // passes on a function that no longer exists under that name.
    /export async function setDelegatePhotos\b/.test(actions),
    'Nothing can grant the photos area. The policies exist, the default refuses, ' +
      'and the couple has no way to say yes.',
  );
  assert.ok(
    /areas\.photos = grant === 'view' \? 'view' : null/.test(actions),
    'The grant no longer writes an explicit null on withdrawal. Deleting the key ' +
      'instead would fall through to the resolver tail, which FAILS OPEN for a ' +
      'delegate with edit_all — withdrawal must be written down, not implied.',
  );
  assert.ok(
    /requireCoupleMembership/.test(actions.slice(actions.indexOf('setDelegatePhotos'), actions.indexOf('setDelegatePhotos') + 900)),
    'The grant is not couple-gated — a coordinator could widen their own access.',
  );

  const page = readFileSync(join(WEB, 'app/dashboard/[eventId]/hosts/page.tsx'), 'utf8');
  assert.ok(
    /action=\{setDelegatePhotos\}/.test(page),
    'The action exists but no screen calls it — a handle nobody can reach.',
  );
});

test('both photo tables gained a read policy routed through the one gate', () => {
  const s = sql();
  for (const p of [
    'papic_photos_moderator_photos_read',
    'papic_guest_captures_moderator_photos_read',
  ]) {
    assert.ok(new RegExp(`CREATE POLICY ${p}`).test(s), `${p} is gone`);
  }
  const count = [...s.matchAll(/moderator_area_level\(event_id, 'photos'\) IN \('view', 'edit'\)/g)].length;
  assert.equal(
    count,
    2,
    'the photo policies stopped going through moderator_area_level. Enforcement ' +
      'must stay in exactly one place, or a second answer to "may they see this" ' +
      'eventually disagrees with the first.',
  );
});

test('the database gate itself was not rewritten', () => {
  // Its ELSE NULL is the fail-closed behaviour and its first branch already
  // honours an explicit key. Editing it would risk the one part that is right.
  const s = sql();
  assert.ok(
    !/CREATE OR REPLACE FUNCTION public\.moderator_area_level[\s\S]{0,400}photos/.test(s),
    'moderator_area_level was rewritten to name photos. It does not need to — ' +
      'its ELSE NULL already refuses any area it has not been told about.',
  );
});
