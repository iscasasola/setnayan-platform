/**
 * GUARD — A FILE WRITTEN OFFLINE GOES ONCE, THE SHIPPED WAY (controller review #2: "one upload kind, reusing
 * lib/papic-upload/store.ts").
 *
 * A supplier with no signal attaches a photo to a message. The phone keeps the file with the queued message (its bytes
 * kept the ONE way bytes are kept offline — `lib/offline/stored-bytes.ts`, which Papic's saved shots use too — and wiped
 * with the rest at sign-out) and judges it at once by type and size. When the signal is back the page sends it the
 * shipped chat way — `prepareChatFile` (compressed, judged) then `uploadPreparedChatFile` (PUT to R2, the sender's own
 * folder) — writes the ref onto the queued item and drops the bytes BEFORE the message goes, so a retry never uploads
 * twice; then the message is sent with only the ref, and the server's shipped core HEADs the object.
 *
 * Sabotages (2026-11-25), each red: the ref not written back before the send (a retry uploads again) · the bytes left in
 * the sync body · the refused file dropped without an answer · a failed upload not counted as a try · `attachmentRef`
 * not passed by the engine · the Safari fallback dropped from `keepBytes`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import type { OfflineItem } from './types';
import {
  readSupplierOutcomes,
  setSupplierMember,
  syncOne,
  useFileDepsForTest,
  useOutcomeStoreForTest,
  type FileSent,
} from './service-handlers/supplier-handler';
import { bytesBack, keepBytes } from './stored-bytes';
import { SUPPLIER_OFFLINE_WIRE } from '@/lib/supplier-offline/replies';

const root = path.join(import.meta.dirname, '..', '..');
const read = (p: string) => stripComments(readFileSync(path.join(root, p), 'utf8'));

const SHOP = '11111111-2222-4333-8444-555555555555';
const ANA = '0b6f1c2e-7a43-4d3e-9b1f-2c5d8e9a0f11';
const THREAD = '7d0c9b8a-6f5e-4d3c-8b2a-191817161514';

function queuedMessage(extraFields: Record<string, string> = {}, withFile = true): OfflineItem {
  const itemId = crypto.randomUUID();
  return {
    item_id: itemId,
    event_id: SHOP,
    queued_at: '2026-11-25T06:14:00.000Z',
    retry_count: 0,
    payload: {
      v: 1,
      itemId,
      shop: SHOP,
      member: ANA,
      phoneTime: '2026-11-25T06:14:00.000Z',
      madeOffline: true,
      kind: 'message.send',
      schema: 2,
      baseVersion: null,
      rowVersion: null,
      seen: null,
      giftsAsOf: null,
      fields: { thread_id: THREAD, body: 'Here is the layout', ...extraFields },
      ageByTriesOnly: true,
      ...(withFile ? { file: { name: 'layout.jpg', blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' }) } } : {}),
    },
  } as unknown as OfflineItem;
}

type Rig = { sends: { threadId: string; member: string; file: File }[]; saved: OfflineItem[]; posts: Record<string, unknown>[]; notes: Record<string, unknown>[] };

function rig(answer: FileSent): Rig {
  const r: Rig = { sends: [], saved: [], posts: [], notes: [] };
  useFileDepsForTest({
    async send(a) {
      r.sends.push(a);
      return answer;
    },
    async save(item) {
      r.saved.push(item);
    },
  });
  useOutcomeStoreForTest({
    all: async () => r.notes as ({ id: string } & Record<string, unknown>)[],
    put: async (row) => void r.notes.push(row),
    remove: async () => undefined,
  });
  setSupplierMember(ANA);
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { fields: { item: string } };
    const item = JSON.parse(body.fields.item) as { itemId: string };
    r.posts.push(JSON.parse(body.fields.item));
    return new Response(JSON.stringify({ v: SUPPLIER_OFFLINE_WIRE, reply: { op: 'sync', ok: true, reply: { status: 'applied', itemId: item.itemId, kind: 'message.send' } } }), { status: 200 });
  }) as typeof fetch;
  return r;
}

const realFetch = globalThis.fetch;
const done = () => {
  globalThis.fetch = realFetch;
  useFileDepsForTest(null);
  useOutcomeStoreForTest(null);
  setSupplierMember(null);
};

test('the file goes once, the shipped way; its ref is written back before the message; the bytes never ride', async () => {
  const r = rig({ ok: true, ref: 'r2://thread-files/x/layout.jpg', name: 'layout.jpg' });
  try {
    const item = queuedMessage();
    assert.deepEqual(await syncOne(item), { ok: true });
    assert.equal(r.sends.length, 1);
    assert.equal(r.sends[0]!.threadId, THREAD);
    assert.equal(r.sends[0]!.member, ANA, 'the file went into someone else’s folder');
    assert.equal(r.sends[0]!.file.name, 'layout.jpg');
    assert.equal(r.sends[0]!.file.type, 'image/jpeg');
    assert.equal(r.sends[0]!.file.size, 4);
    assert.equal(r.saved.length, 1, 'the ref was not written back before the message went (a retry would upload again)');
    const saved = r.saved[0]!.payload as Record<string, unknown> & { fields: Record<string, string> };
    assert.equal(saved.fields.attachment_ref, 'r2://thread-files/x/layout.jpg');
    assert.equal(saved.fields.attachment_name, 'layout.jpg');
    assert.equal('file' in saved, false, 'the bytes stayed on the phone after the upload');
    assert.equal(r.posts.length, 1);
    assert.equal('file' in r.posts[0]!, false, 'the bytes rode the sync');
    assert.equal((r.posts[0]!.fields as Record<string, string>).attachment_ref, 'r2://thread-files/x/layout.jpg');
  } finally {
    done();
  }
});

test('a retry after the upload sends only the message — the file is never uploaded twice', async () => {
  const r = rig({ ok: true, ref: 'never', name: 'never' });
  try {
    await syncOne(queuedMessage({ attachment_ref: 'r2://thread-files/x/a.jpg', attachment_name: 'a.jpg' }, false));
    assert.equal(r.sends.length, 0);
    assert.equal(r.posts.length, 1);
  } finally {
    done();
  }
});

test('a file the chat refuses becomes an answer in its own words — no message, and no bytes kept in the answer', async () => {
  const r = rig({ refused: 'That file is too big to send in chat.' });
  try {
    assert.deepEqual(await syncOne(queuedMessage()), { ok: true }, 'a refused file stayed queued forever');
    assert.equal(r.posts.length, 0, 'the message went without its file');
    const notes = await readSupplierOutcomes(ANA, SHOP);
    assert.equal(notes.length, 1);
    assert.equal(notes[0]!.reply.status, 'refused');
    assert.equal((notes[0]!.reply as { why: string }).why, 'That file is too big to send in chat.');
    assert.equal('file' in (notes[0]!.item as object), false, 'an answer kept the file’s bytes');
  } finally {
    done();
  }
});

test('an upload that fails is a try (online) or waiting (offline) — and the message never goes without it', async () => {
  const r = rig({ failed: 'Couldn’t upload that file.' });
  try {
    const tried = await syncOne(queuedMessage());
    assert.equal(tried.ok, false);
    assert.equal((tried as { waiting?: boolean }).waiting, undefined, 'a failed upload with signal is not counted as a try');
    assert.equal(r.posts.length, 0);
    const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
    try {
      const waiting = await syncOne(queuedMessage());
      assert.equal((waiting as { waiting?: boolean }).waiting, true, 'no signal counted as a try');
    } finally {
      if (nav) Object.defineProperty(globalThis, 'navigator', nav);
      else delete (globalThis as { navigator?: unknown }).navigator;
    }
  } finally {
    done();
  }
});

test('the server sends the ref through the shipped chat core, and stamps a file-only message as written offline', () => {
  const engine = read('lib/supplier-offline/engine.server.ts');
  const fn = engine.slice(engine.indexOf('async function messageSend('), engine.indexOf('async function syncOne('));
  assert.match(fn, /sendChatMessageCore\(ctx\.supabase, \{ threadId, body, attachmentRef: ref \? \{ ref, name: name \|\| 'file' \} : null \}\)/);
  assert.match(fn, /const body = typed\.trim\(\) \? `\$\{typed\}\\n\\n\$\{stamp\}` : ref \? stamp : typed;/);
});

test('one way to keep bytes offline: a Blob, or its bytes where the browser refuses a Blob — Papic and the supplier both', async () => {
  const blob = new Blob([new Uint8Array([9, 8, 7])], { type: 'image/png' });
  let tries = 0;
  const kept = await keepBytes(blob, async (bytes) => {
    tries += 1;
    if ('blob' in bytes) throw new Error('Error preparing Blob/File data to be stored');
    return bytes;
  });
  assert.equal(tries, 2, 'a refused Blob was not kept as its bytes');
  const back = bytesBack(kept as Record<string, unknown>);
  assert.ok(back);
  assert.equal(back!.type, 'image/png');
  assert.deepEqual([...new Uint8Array(await back!.arrayBuffer())], [9, 8, 7]);
  assert.equal(bytesBack({}), null);
  assert.match(read('lib/papic-upload/store.ts'), /await keepBytes\(blob, \(bytes\) =>/, 'Papic keeps its bytes a second way');
  assert.match(read('lib/papic-upload/store.ts'), /return bytesBack\(hit\?\.payload\);/);
  assert.match(read('lib/offline/supplier-queue.ts'), /if \(file\) await keepBytes\(file, \(bytes\) => keep\(\{ file: \{ name: file\.name, \.\.\.bytes \} \}\)\);/);
});
