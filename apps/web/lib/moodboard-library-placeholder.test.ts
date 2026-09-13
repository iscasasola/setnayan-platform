/**
 * MB23 · the write-side half of "no bring-up placeholder reaches a couple".
 *
 * Migration `20271205919528` retires the placeholder rows that exist today, and
 * `tests/db/no-placeholder-photo-is-ever-live.db.test.ts` keeps them retired.
 * Neither can stop an admin clicking Publish on the row tomorrow. This does:
 * `approveAsset` calls `assertNotPlaceholder`, which throws.
 *
 * The exact rows these cases are built from were read off prod on 2026-09-05.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertNotPlaceholder,
  isPlaceholderAsset,
  isPlaceholderHost,
  placeholderRefusal,
} from './moodboard-library-placeholder';

// ── the two rows that were live when the owner filed the bug ────────────────
const CHURCH = {
  source: 'internet_placeholder',
  storage_path: 'https://picsum.photos/seed/setnayan-church-1/1200/800',
};
// ── an already-retired row whose host is Pexels, not picsum ─────────────────
const PEXELS = {
  source: 'internet_placeholder',
  storage_path: 'https://images.pexels.com/photos/34799986/pexels-photo-34799986.jpeg',
};
// ── real artwork: the attire figures and the app-served florals ─────────────
const FIGURE = {
  source: 'recraft_v3',
  storage_path:
    'https://pub-37d64fe618584c2981a88610a55dd439.r2.dev/moodboard-library/figure_attire/elegant-simple-classic/bride.svg',
};
const FLORAL = { source: 'setnayan_seed', storage_path: '/moodboard-seed/florals/bouquet.webp' };
/**
 * MB24 moved the re-cut modern-minimalist bride to the same app-served shape as
 * the florals. Pinned here because the alternative, if this predicate ever
 * refused an app-relative path, would be to host the artwork on R2 instead —
 * and that is the wrong repair. A `/moodboard-seed/…` path has no host to judge;
 * refusing one would be a bug in the predicate, not a reason to move the file.
 */
const RECUT_BRIDE = {
  source: 'higgsfield_generated',
  storage_path: '/moodboard-seed/figure_attire/modern-minimalist/bride.svg',
};

test('the two rows the owner saw are placeholders', () => {
  assert.equal(isPlaceholderAsset(CHURCH), true);
  assert.equal(isPlaceholderAsset(PEXELS), true);
});

test('real artwork is not', () => {
  assert.equal(isPlaceholderAsset(FIGURE), false);
  assert.equal(isPlaceholderAsset(FLORAL), false, 'an app-relative path has no host to judge');
  assert.equal(
    isPlaceholderAsset(RECUT_BRIDE),
    false,
    'the app-served attire figure MB24 added is real artwork; refusing it would block the ' +
      'admin from approving the asset this app serves itself',
  );
  assert.equal(placeholderRefusal(RECUT_BRIDE), null);
});

test('the host test and the source test each catch rows the other misses', () => {
  // Both halves are load-bearing; this is why the predicate ORs them.
  assert.equal(
    isPlaceholderAsset({ source: null, storage_path: CHURCH.storage_path }),
    true,
    'a row whose source was cleared on a later edit is still a picsum photo',
  );
  assert.equal(
    isPlaceholderAsset({ source: 'internet_placeholder', storage_path: FIGURE.storage_path }),
    true,
    'a row that declares itself a placeholder is one even on our own host',
  );
});

test('the host test matches the HOST, not the string', () => {
  assert.equal(isPlaceholderHost('https://picsum.photos/seed/x/1/1'), true);
  assert.equal(isPlaceholderHost('https://images.pexels.com/photos/1.jpeg'), true, 'subdomain');
  assert.equal(
    isPlaceholderHost(
      'https://pub-37d64fe618584c2981a88610a55dd439.r2.dev/moodboard-library/venue_scene/picsum.photos-replacement.webp',
    ),
    false,
    'a real R2 object that merely NAMES the old host must stay approvable — a substring ' +
      'match here would refuse the very asset that replaces the placeholder',
  );
  assert.equal(isPlaceholderHost('/moodboard-seed/florals/bouquet.webp'), false);
  assert.equal(isPlaceholderHost(null), false);
});

test('the refusal names which test fired', () => {
  assert.match(placeholderRefusal(CHURCH)!, /internet_placeholder/);
  assert.match(
    placeholderRefusal({ source: null, storage_path: CHURCH.storage_path })!,
    /picsum\.photos/,
  );
  assert.equal(placeholderRefusal(FIGURE), null);
});

// ── the guard as approveAsset calls it ──────────────────────────────────────

/** Stands in for `admin.from(…).select(…).eq(…).maybeSingle()`. */
const fetching = (row: unknown, error: { message: string } | null = null) => async () => ({
  data: row,
  error,
});

test('approving a placeholder throws', async () => {
  await assert.rejects(
    () => assertNotPlaceholder(fetching(CHURCH)),
    /must not be published to couples/,
  );
});

test('approving real artwork does not throw', async () => {
  await assertNotPlaceholder(fetching(FIGURE));
});

test('a read failure is a refusal, not a silent approval', async () => {
  // If the SELECT errors and the guard shrugs, every row approves unchecked and
  // the guard is decoration.
  await assert.rejects(
    () => assertNotPlaceholder(fetching(null, { message: 'boom' })),
    /could not read asset/,
  );
  await assert.rejects(() => assertNotPlaceholder(fetching(null)), /not found/);
});

// ── the wiring, not just the rule ──────────────────────────────────────────
//
// 🪤 THE PREDICATE PASSING IS NOT THE ACTION REFUSING. Every assertion above
// stayed green when `assertNotPlaceholder(admin, assetId)` was deleted from
// `approveAsset` — a perfectly tested rule that nothing called. Same shape as
// [[a-flag-in-an-object-is-not-ink-in-the-pixels]]: the rule was present, the
// enforcement was not.
//
// `approveAsset` is a 'use server' action over two Supabase clients, so calling
// it here would mean mocking the module graph. The cheaper honest guard is to
// read its BODY and require the call — with the window ending at the CLOSING
// BRACE, never at "the next export", so a mention in the next function's
// docblock cannot satisfy it (see [[a-source-guards-window-must-end-at-the-brace]]
// and `mood-board/the-render-pool-pick-is-free.test.ts`, which this mirrors).

import { readFileSync } from 'node:fs';

const ACTIONS = new URL('../app/admin/moodboard-library/actions.ts', import.meta.url);

function bodyOf(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  assert.notEqual(start, -1, `${name} is gone — this guard now watches nothing`);
  const end = source.indexOf('\n}\n', start);
  assert.notEqual(end, -1, `${name} has no closing brace at column 0`);
  return source.slice(start, end + 3);
}

test('approveAsset actually calls the guard', () => {
  const body = bodyOf(readFileSync(ACTIONS, 'utf8'), 'approveAsset');
  assert.match(
    body,
    /await assertNotPlaceholder\(/,
    'approveAsset no longer refuses placeholders. One admin click can put a picsum ' +
      'stock photograph back in front of every couple, and migration 20271205919528 ' +
      'plus the db guard only describe the rows that exist today. Restore the ' +
      '`await assertNotPlaceholder(() => admin.from(…).maybeSingle())` call.',
  );
  assert.ok(
    body.indexOf('assertNotPlaceholder') < body.indexOf('.update('),
    'the refusal must run BEFORE the UPDATE — checking afterwards approves the row ' +
      'and then complains about it.',
  );
});
