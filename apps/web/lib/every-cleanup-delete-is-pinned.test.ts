/**
 * NO FILE MAY DELETE A STORED OBJECT EXCEPT THROUGH THE PINNED CHOKE POINT —
 * the caller list is DERIVED from the source tree, never hand-typed.
 *
 * ── WHAT THIS GUARDS ───────────────────────────────────────────────────────
 * The class: a non-admin writes `r2://<bucket>/<key>` into a column of a row
 * they own, and a cleanup job running with the ADMIN client deletes whatever it
 * names. The rule ("does this object belong to THIS row?") lives once, in
 * lib/cleanup-delete-scope.ts, and the only code that turns a proven target into
 * an R2 delete is lib/cleanup-delete.ts. This suite walks every non-test file in
 * `lib/` and `app/`, strips comments, and finds every file that can reach a raw
 * delete primitive:
 *
 *   r2Delete · deletePublicAsset · DeleteObjectCommand / DeleteObjectsCommand ·
 *   a Supabase storage `.from(…).remove(…)`
 *
 * The set it finds must EQUAL the two files that define primitives + the
 * executor + an exact, reasoned exemption bill. Both directions fail:
 *   • a NEW caller (a new sweep that imports r2Delete) → red, until it goes
 *     through the executor or earns a reasoned line here;
 *   • a line here whose file stopped calling the primitive → red, until the line
 *     is deleted — a bill nobody owes is how an exemption outlives its reason.
 *
 * And no exemption may be a SWEEP-SHAPED file (derived, not listed): anything
 * that claims a periodic job, lives under lib/erasure, or is named for a sweep,
 * a retention job, a purge or a drop must use the executor. A cleanup job is
 * exactly the caller this whole change exists to pin.
 *
 * ⚠ A NAME APPEARING IS NOT THE RULE BEING APPLIED — that was the defect in the
 * guard this replaces (`vendor-identity-retention-sweep-is-bucket-pinned.test.ts`
 * checked that a function NAME appeared, and `const inScope = [...present]` stayed
 * green while the sweep deleted another bucket). The RULE is proved by calling
 * it: cleanup-delete-scope.test.ts and the planner suites. This file proves only
 * that nothing goes AROUND it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { libraryAssetObjectKeyForAdminDelete, stylistAssetObjectKey } from './moodboard-library-key';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');

/** A raw way to delete a stored object. Matched on comment-stripped code. */
const PRIMITIVES: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: 'r2Delete', re: /\br2Delete\b/ },
  { name: 'deletePublicAsset', re: /\bdeletePublicAsset\b/ },
  { name: 'DeleteObject(s)Command', re: /\bDeleteObjects?Command\b/ },
  { name: 'storage remove', re: /\.storage\s*\.\s*from\s*\([^)]*\)\s*\.\s*remove\s*\(/ },
];

/** The two files that DEFINE the primitives. */
const DEFINITIONS = new Set(['lib/r2.ts', 'lib/storage.ts']);

/** The one file every cleanup delete goes through. */
const EXECUTOR = 'lib/cleanup-delete.ts';

/**
 * The exemption bill — every line a reason, and none of them a cleanup job
 * reading a key out of a row a non-admin can write.
 */
const EXEMPT: Readonly<Record<string, string>> = {
  'app/admin/website-media/actions.ts':
    'Admin-pressed, one object per press. Keys come from an R2 LISTING of the media bucket, ' +
    'not from a row anybody else writes, and the page refuses an object that is still referenced.',
  'lib/website-media-server.ts':
    'Retires the site-chrome media an ADMIN just replaced. Candidates are the previous values of ' +
    'admin-only platform settings, filtered to site-media prefixes by retirableKeys, and a fresh ' +
    'reference read must find nothing still pointing at them.',
  'app/admin/verification-docs/actions.ts':
    'Admin-pressed orphan cleaner for the verification bucket: keys come from a LISTING and it ' +
    'refuses any object a verification row still references — the opposite of reading a row key.',
  'app/admin/settings/actions.ts':
    'Replaces platform brand icons. The old value is read from platform_settings, which only an ' +
    'admin can write.',
  'app/api/samahan/story/route.ts':
    'Rolls back the two keys THIS request just minted server-side (samahan/<community>/story-<stamp>) ' +
    'when the row insert fails. No stored value is read.',
  'app/admin/moodboard-library/actions.ts':
    'Admin-pressed, Supabase storage (moodboard-library bucket), not R2. Rolls back a key it just ' +
    'minted, and deletes one asset an admin chose — the stored path held by ' +
    'libraryAssetObjectKeyForAdminDelete (lib/moodboard-library-key.ts) to what that row’s uploader ' +
    'could have filed, so a stylist-forged path cannot aim the admin’s press.',
  'app/vendor-dashboard/moodboard-library/actions.ts':
    'Supabase storage, not R2. Rolls back a key it just minted; the stylist self-delete is pinned ' +
    'inline to the uploader’s own folder by stylistAssetObjectKey (lib/moodboard-library-key.ts).',
};

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) {
      out.push(p);
    }
  }
}

function sourceFiles(): string[] {
  const out: string[] = [];
  for (const top of ['lib', 'app']) walk(join(WEB, top), out);
  return out;
}

/** Every file that can reach a raw delete primitive, with which ones. */
function deriveCallers(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const abs of sourceFiles()) {
    const code = stripComments(readFileSync(abs, 'utf8'));
    const hits = PRIMITIVES.filter((p) => p.re.test(code)).map((p) => p.name);
    if (hits.length > 0) found.set(relative(WEB, abs).split('\\').join('/'), hits);
  }
  return found;
}

/**
 * A file shaped like a cleanup job — derived from what it DOES and where it
 * lives, so a new sweep is recognised without anybody listing it.
 */
function isSweepShaped(rel: string, code: string): boolean {
  if (rel.startsWith('lib/erasure/')) return true;
  if (/(retention|sweep|purge|-drop|drop-|expire|expiry|reap|cleanup)/i.test(rel)) return true;
  if (/\bclaimPeriodicJob\b/.test(code)) return true;
  return false;
}

test('the walk is not vacuous', () => {
  const files = sourceFiles();
  assert.ok(files.length > 1000, `walked only ${files.length} files — the root moved?`);
  const callers = deriveCallers();
  assert.ok(callers.has('lib/r2.ts'), 'the scan no longer sees r2Delete where it is DEFINED — the matcher is broken');
  assert.ok(callers.has(EXECUTOR), 'the scan no longer sees the executor calling r2Delete');
});

test('EVERY caller of a raw delete primitive is the executor or a reasoned exemption — both directions', () => {
  const callers = deriveCallers();
  const expected = new Set<string>([...DEFINITIONS, EXECUTOR, ...Object.keys(EXEMPT)]);

  const unexpected = [...callers.keys()].filter((f) => !expected.has(f));
  assert.deepEqual(
    unexpected.map((f) => `${f} → ${callers.get(f)!.join(', ')}`),
    [],
    'A file reaches a raw delete primitive outside the choke point. If it deletes an object named ' +
      'by a stored column, plan it with lib/cleanup-delete-scope.ts and execute it with ' +
      'lib/cleanup-delete.ts. Only if the key is NOT read from a row a non-admin can write may it ' +
      'earn a reasoned line in EXEMPT.',
  );

  const stale = [...expected].filter((f) => !callers.has(f));
  assert.deepEqual(
    stale,
    [],
    'These files no longer reach a delete primitive — delete their line. A stale exemption is a ' +
      'pre-approved hole for whatever lands in that file next.',
  );
});

test('no exemption is a cleanup job — a sweep, retention, purge or erasure MUST use the executor', () => {
  for (const rel of [...Object.keys(EXEMPT)]) {
    const code = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    assert.equal(
      isSweepShaped(rel, code),
      false,
      `${rel} is sweep-shaped and exempt. A cleanup job reading keys from rows is the exact caller ` +
        'the choke point exists for.',
    );
  }
  // And the derivation is not decoration: the files that ARE cleanup jobs are
  // recognised as such, and none of them touches a primitive directly.
  const sweepShaped = sourceFiles()
    .map((abs) => ({ rel: relative(WEB, abs).split('\\').join('/'), code: stripComments(readFileSync(abs, 'utf8')) }))
    .filter(({ rel, code }) => isSweepShaped(rel, code));
  const names = sweepShaped.map((s) => s.rel);
  for (const known of [
    'lib/papic-fullres-drop.ts',
    'lib/vendor-identity-retention.ts',
    'lib/face-data-retention.ts',
    'lib/event-media-sweep.ts',
    'lib/samahan-stories.ts',
    'lib/erasure/purge.ts',
  ]) {
    assert.ok(names.includes(known), `${known} is no longer recognised as a cleanup job — the derivation drifted`);
  }
  const bypass = sweepShaped.filter(({ code }) => PRIMITIVES.some((p) => p.re.test(code)));
  assert.deepEqual(
    bypass.map((b) => b.rel).filter((r) => r !== EXECUTOR),
    [],
    'A cleanup job reaches a raw delete primitive instead of the executor.',
  );
});

test('the cleanup jobs actually delete THROUGH the executor, not merely avoid the primitive', () => {
  // Without this, deleting the delete entirely would also satisfy the test above.
  for (const rel of [
    'lib/papic-fullres-drop.ts',
    'lib/vendor-identity-retention.ts',
    'lib/face-data-retention.ts',
    'lib/event-media-sweep.ts',
    'lib/samahan-stories.ts',
    'lib/std-video-gate.ts',
    'app/admin/users/actions.ts',
    'app/[slug]/actions.ts',
    'app/dashboard/[eventId]/guests/[guestId]/actions.ts',
  ]) {
    // Import lines removed first: an import that is never USED is exactly the
    // shape of a job that stopped going through the executor. A use is a call
    // OR the executor handed over as the delete dependency.
    const code = stripComments(readFileSync(join(WEB, rel), 'utf8'))
      .split('\n')
      .filter((l) => !/^\s*import\b/.test(l) && !/^\s*}\s*from\s/.test(l))
      .join('\n');
    assert.match(
      code,
      /\b(executeCleanupDelete|cleanupDelete)\s*\(|:\s*executeCleanupDelete\b/,
      `${rel} no longer calls the executor — either it stopped deleting (say so) or it found another road.`,
    );
  }
});

test('nobody outside the rule’s own module forges a scope or a target with a cast', () => {
  // The runtime identity check refuses a forged one anyway; this keeps the
  // attempt out of the codebase so nobody reads a cast as a sanctioned pattern.
  const offenders: string[] = [];
  for (const abs of sourceFiles()) {
    const rel = relative(WEB, abs).split('\\').join('/');
    if (rel === 'lib/cleanup-delete-scope.ts') continue;
    const code = stripComments(readFileSync(abs, 'utf8'));
    if (/\bas\s+(unknown\s+as\s+)?(CleanupScope|PlannedDelete)\b/.test(code)) offenders.push(rel);
  }
  assert.deepEqual(offenders, []);
});

test('the stylist self-delete keeps to the uploader’s own folder', () => {
  const U = '0b3a1f2c-1111-4222-8333-444455556666';
  assert.equal(stylistAssetObjectKey(`moodboard-library/${U}/abc.jpg`, U), `${U}/abc.jpg`);
  for (const forged of [
    'moodboard-library/someone-else/abc.jpg',
    `moodboard-library/${U}-x/abc.jpg`,
    `moodboard-library/${U}/../someone-else/abc.jpg`,
    `moodboard-library/${U}/`,
    `other-bucket/${U}/abc.jpg`,
    `${U}/abc.jpg`,
    'moodboard-library/abc.jpg',
  ]) {
    assert.equal(stylistAssetObjectKey(forged, U), null, forged);
  }
  assert.equal(stylistAssetObjectKey(`moodboard-library/${U}/a.jpg`, '../x'), null);
  assert.equal(stylistAssetObjectKey(null, U), null);
});

test('the admin delete of a library asset keeps to what that row’s uploader could have filed', () => {
  const U = '0b3a1f2c-1111-4222-8333-444455556666';
  const ROOT = 'moodboard-library/9f1c2d3e-4a5b-4c6d-8e7f-001122334455.png';
  // A stylist's own upload — reachable whoever presses delete.
  assert.equal(libraryAssetObjectKeyForAdminDelete(`moodboard-library/${U}/a.jpg`, U, true), `${U}/a.jpg`);
  // An admin's own root upload — reachable only when the uploader is NOT a vendor.
  assert.equal(libraryAssetObjectKeyForAdminDelete(ROOT, U, false), ROOT.slice('moodboard-library/'.length));
  // 🔒 A stylist re-pointing their row at a root placeholder, or at another stylist.
  assert.equal(libraryAssetObjectKeyForAdminDelete(ROOT, U, true), null);
  for (const forged of [
    'moodboard-library/someone-else/abc.jpg',
    `moodboard-library/${U}/../someone-else/abc.jpg`,
    'moodboard-library/not-a-uuid.png',
    'moodboard-library/9f1c2d3e-4a5b-4c6d-8e7f-001122334455.png/x',
    'other-bucket/9f1c2d3e-4a5b-4c6d-8e7f-001122334455.png',
  ]) {
    assert.equal(libraryAssetObjectKeyForAdminDelete(forged, U, false), null, forged);
    assert.equal(libraryAssetObjectKeyForAdminDelete(forged, U, true), null, forged);
  }
});

test('WIRING: both moodboard deletes remove only what the pinned key functions return', () => {
  // A wiring pin, named as one: the RULES are proved by calling them above. This
  // pins that the two actions still pass their stored path THROUGH them.
  for (const [rel, fn] of [
    ['app/vendor-dashboard/moodboard-library/actions.ts', 'stylistAssetObjectKey'],
    ['app/admin/moodboard-library/actions.ts', 'libraryAssetObjectKeyForAdminDelete'],
  ] as const) {
    const code = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    assert.match(code, new RegExp(`const key = ${fn}\\(row\\.storage_path, row\\.uploaded_by`), `${rel} no longer plans the key`);
    assert.doesNotMatch(code, /storage_path\.replace\(/, `${rel} reads storage_path back verbatim again`);
  }
});
