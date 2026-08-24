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

type Row = { id: number; r2_object_key: string; poster_r2_key: string };

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

function makeIo(log: string[], failRefs: Set<string> = new Set()): ErasureIo {
  return {
    async deleteStoredAsset(ref: string) {
      if (failRefs.has(ref)) throw new Error('r2 down');
      log.push(`file-delete:${ref}`);
    },
    async deletePublicAssetUrl() {},
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
