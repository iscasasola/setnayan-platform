/**
 * lib/erasure/samahan-stories-purge.test.ts — erasure hands a story's R2
 * objects to storage BEFORE deleting the row, and a failed file delete keeps
 * the row (the retry handle). Also pins that eraseUserAccount actually calls
 * purgeSamahanStories BEFORE purgeUserOwnedRecords — the generic
 * SUBJECT_ROW_DELETES loop there deletes the rows, and the rows are the only
 * thing naming the files, so the wrong order orphans every byte silently.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { purgeSamahanStories, type ErasureAdminClient, type ErasureIo } from './purge';
import { refBelongsToRow, type CleanupScope } from '../cleanup-delete-scope';

type Row = { id: number; community_id?: string; r2_object_key: string; poster_r2_key: string };

function makeAdmin(rows: Row[], log: string[]): ErasureAdminClient {
  const admin = {
    from(table: string) {
      return {
        select() {
          return {
            eq: async () => ({ data: table === 'samahan_stories' ? rows : [], error: null }),
          };
        },
        delete() {
          return {
            eq: async (_col: string, id: number) => {
              log.push(`row-delete:${id}`);
              return { error: null };
            },
          };
        },
        insert: async () => ({ error: null }),
      };
    },
  };
  return admin as unknown as ErasureAdminClient;
}

function makeIo(
  log: string[],
  failRefs: Set<string> = new Set(),
  scopes: Array<{ ref: string; scope: CleanupScope }> = [],
): ErasureIo {
  return {
    async deleteStoredAsset(ref: string, scope: CleanupScope) {
      scopes.push({ ref, scope });
      if (failRefs.has(ref)) throw new Error('r2 down');
      log.push(`file-delete:${ref}`);
    },
    async revokeAllSessions() {
      return { ok: true as const, sessionsRevoked: 0 };
    },
  };
}

test('files are handed to storage BEFORE the row is deleted', async () => {
  const log: string[] = [];
  const rows: Row[] = [
    { id: 7, r2_object_key: 'r2://setnayan-media/samahan/c/a.mp4', poster_r2_key: 'r2://setnayan-media/samahan/c/a.jpg' },
  ];
  await purgeSamahanStories(makeAdmin(rows, log), 'user-1', 'actor-1', makeIo(log));
  assert.deepEqual(log, [
    'file-delete:r2://setnayan-media/samahan/c/a.mp4',
    'file-delete:r2://setnayan-media/samahan/c/a.jpg',
    'row-delete:7',
  ]);
});

test('a failed file delete KEEPS the row — the retry handle survives', async () => {
  const log: string[] = [];
  const rows: Row[] = [
    { id: 9, r2_object_key: 'r2://setnayan-media/samahan/c/b.mp4', poster_r2_key: 'r2://setnayan-media/samahan/c/b.jpg' },
  ];
  await purgeSamahanStories(
    makeAdmin(rows, log),
    'user-1',
    'actor-1',
    makeIo(log, new Set(['r2://setnayan-media/samahan/c/b.mp4'])),
  );
  assert.ok(!log.some((l) => l.startsWith('row-delete:')), 'the row must survive a failed file delete');
});

test('eraseUserAccount calls purgeSamahanStories BEFORE purgeUserOwnedRecords (source order)', () => {
  // Source-order pin with comments stripped, so a note MENTIONING the call
  // cannot satisfy it. Both call sites must exist exactly once each.
  const src = fs
    .readFileSync(path.join(__dirname, 'purge.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const stories = [...src.matchAll(/await purgeSamahanStories\(/g)];
  const owned = [...src.matchAll(/await purgeUserOwnedRecords\(/g)];
  assert.equal(stories.length, 1, 'exactly one purgeSamahanStories call');
  assert.equal(owned.length, 1, 'exactly one purgeUserOwnedRecords call');
  assert.ok(
    stories[0]!.index! < owned[0]!.index!,
    'purgeSamahanStories must run before purgeUserOwnedRecords',
  );
});

test('each story file is handed over with ITS OWN samahan’s scope — a forged ref would be refused', async () => {
  // The adapter (app/admin/users/actions.ts) plans every hand-over against the
  // scope that comes with it. So what this pins is that the purge builds that
  // scope from THE ROW'S community — the only thing that makes a stranger's key
  // on the subject's own story row undeletable.
  const C = 'c0000000-0000-4000-8000-000000000001';
  const own = `r2://setnayan-media/samahan/${C}/story-1.mp4`;
  const forged = 'r2://setnayan-vendor-verification/vendors/victim/government_id/gov.png';
  const scopes: Array<{ ref: string; scope: CleanupScope }> = [];
  await purgeSamahanStories(
    makeAdmin([{ id: 3, community_id: C, r2_object_key: own, poster_r2_key: forged }], []),
    'user-1',
    'actor-1',
    makeIo([], new Set(), scopes),
  );
  assert.equal(scopes.length, 2);
  for (const { scope } of scopes) {
    assert.equal(refBelongsToRow(own, scope), true, 'the story’s own clip is not deletable under its scope');
    assert.equal(refBelongsToRow(forged, scope), false, 'a foreign ref on the row is deletable under its scope');
    assert.equal(
      refBelongsToRow('r2://setnayan-media/samahan/c0000000-0000-4000-8000-000000000002/story-1.mp4', scope),
      false,
      'another samahan’s story is deletable under this row’s scope',
    );
  }
});
