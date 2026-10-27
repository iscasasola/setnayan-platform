/**
 * THE CHAT FILES RULE (owner 2026-10-28, DECISION_LOG "CHAT FILES") — one test
 * per rule, each RUN, not grepped, wherever the rule is pure:
 *
 *   A · limits are refused SERVER-side, in the owner's words, after compression
 *   B · every photo and video is compressed — no branch sends the raw File
 *   C · kept-forever files are never selected by the sweep
 *   D · the date math (no event date → never expires)
 *   E · a dry run deletes nothing; a delete counts only when a HEAD says 404
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  CHAT_FILE_EXPIRED_LABEL,
  CHAT_FILE_REF_PREFIX,
  CHAT_KEPT_FOREVER_COLUMNS,
  chatFileLimitFor,
  chatFileRefusal,
  expiryDateFor,
  expiryWarningLine,
  isExpired,
  isKeptForever,
  judgeStoredChatFile,
  showsExpiryWarning,
} from '@/lib/chat-file-rules';
import { CHAT_ATTACHMENT_MIME } from '@/lib/chat-attachment-limits';
import {
  CHAT_VIDEO_NOT_COMPRESSED,
  isPreparedChatFile,
  prepareChatFile,
  uploadPreparedChatFile,
  type ChatFileCompressors,
  type PreparedChatFile,
} from '@/lib/chat-file-prepare';
import {
  expiryCutoff,
  isDueForExpiry,
  runChatFileExpirySweepWith,
  type ChatFileCandidate,
  type ChatFileExpiryIO,
} from '@/lib/chat-file-expiry-sweep-core';

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const MB = 1024 * 1024;

// ── A · LIMITS ──────────────────────────────────────────────────────────────

test('A1 · the owner’s numbers and words', () => {
  assert.equal(chatFileLimitFor('video/mp4').maxBytes, 50 * MB);
  assert.equal(chatFileLimitFor('application/pdf').maxBytes, 20 * MB);
  assert.equal(chatFileLimitFor('application/msword').maxBytes, 20 * MB);
  assert.equal(chatFileLimitFor('image/jpeg').maxBytes, 20 * MB);
  assert.equal(
    chatFileLimitFor('video/mp4').tooLargeMessage,
    'That file is over 50 MB. Send a Drive or YouTube link instead.',
  );
  assert.equal(
    chatFileRefusal('application/pdf', 20 * MB + 1),
    'That file is over 20 MB. Send a Drive or YouTube link instead.',
  );
  assert.equal(chatFileRefusal('application/pdf', 20 * MB), null, 'exactly at the limit is allowed');
  assert.equal(chatFileRefusal('video/mp4', 50 * MB + 1)?.includes('50 MB'), true);
  assert.notEqual(chatFileRefusal('video/mp4', Number.NaN), null, 'an unmeasurable size is refused');
});

const T = '11111111-1111-4111-8111-111111111111';
const U = '22222222-2222-4222-8222-222222222222';
const OWN = `${CHAT_FILE_REF_PREFIX}chat/${T}/${U}/abc-clip.mp4`;

test('A2 · the server judges what LANDED (R2 HEAD), not what the phone claimed', () => {
  const base = { ref: OWN, name: 'clip.mp4', threadId: T, userId: U, allowedMime: CHAT_ATTACHMENT_MIME };
  const over = judgeStoredChatFile({ ...base, head: { size: 50 * MB + 1, contentType: 'video/mp4' } });
  assert.deepEqual(over, {
    ok: false,
    message: 'That file is over 50 MB. Send a Drive or YouTube link instead.',
    discard: true,
  });
  const fine = judgeStoredChatFile({ ...base, head: { size: 9 * MB, contentType: 'video/mp4' } });
  assert.equal(fine.ok, true);
  if (fine.ok) assert.equal(fine.attachment.attachment_size_bytes, 9 * MB, 'the size is the HEAD’s');
  // Someone else's folder: refused, and NOT deleted (not the sender's object).
  const other = judgeStoredChatFile({
    ...base,
    ref: `${CHAT_FILE_REF_PREFIX}chat/${T}/someone-else/x.mp4`,
    head: { size: 1, contentType: 'video/mp4' },
  });
  assert.equal(other.ok, false);
  if (!other.ok) assert.equal(other.discard, false);
  // Unreadable HEAD: refused, nothing assumed.
  assert.equal(judgeStoredChatFile({ ...base, head: null }).ok, false);
  // A type the conversation does not take.
  const exe = judgeStoredChatFile({ ...base, head: { size: 10, contentType: 'application/x-msdownload' } });
  assert.equal(exe.ok, false);
});

test('A3 · both server doors call the rule (send core + presign route)', () => {
  const send = read('lib/chat-send.ts');
  assert.match(send, /const limit = chatFileLimitFor\(mime\);/, 'the File path stopped judging by the chat rule');
  assert.match(send, /if \(file\.size > limit\.maxBytes\)/, 'the File path stopped refusing an oversize file');
  assert.match(send, /judgeStoredChatFile\(\{/, 'the uploaded-ref path stopped judging the stored object');
  assert.match(send, /await r2Head\(\{ bucket: R2_BUCKETS\.threadFiles, key \}\)/, 'the size is no longer measured');
  const route = read('app/api/upload/route.ts');
  assert.match(route, /const chatLimit = chatFileLimitFor\(baseContentType\);/);
  assert.match(route, /if \(sizeBytes > chatLimit\.maxBytes\)/, 'the presign route stopped refusing big chat files');
  assert.match(route, /seg\[2\] !== user\.id/, 'a chat presign is no longer pinned to the caller’s own folder');
});

// ── B · ALWAYS COMPRESSED ───────────────────────────────────────────────────

function fakeCompressors(log: string[], opts: { videoFails?: boolean } = {}): ChatFileCompressors {
  return {
    image: async (f) => {
      log.push(`image:${f.name}`);
      return new File([new Uint8Array(100)], 'small.jpg', { type: 'image/jpeg' });
    },
    video: async (f, o) => {
      log.push(`video:${f.name}:${o.profile}`);
      if (opts.videoFails) return f; // the shipped encoder's "could not run" answer
      return new File([new Uint8Array(200)], 'small.mp4', { type: 'video/mp4' });
    },
  };
}
const file = (name: string, type: string, size = 1000) => new File([new Uint8Array(size)], name, { type });

test('B1 · every photo and video goes through its compressor; the original never comes out', async () => {
  for (const [name, type] of [
    ['a.jpg', 'image/jpeg'],
    ['a.png', 'image/png'],
    ['a.webp', 'image/webp'],
    ['a.mp4', 'video/mp4'],
    ['a.mov', 'video/quicktime'],
  ] as const) {
    const log: string[] = [];
    const input = file(name, type);
    const r = await prepareChatFile(input, { compressors: fakeCompressors(log) });
    assert.equal(r.ok, true, name);
    if (r.ok) assert.notEqual(r.prepared.file, input, `${name} came out at its original size`);
    assert.equal(log.length, 1, `${name} skipped its compressor`);
  }
});

test('B2 · a video this phone cannot shrink is refused, never sent as it is', async () => {
  const r = await prepareChatFile(file('big.mp4', 'video/mp4'), {
    compressors: fakeCompressors([], { videoFails: true }),
  });
  assert.deepEqual(r, { ok: false, message: CHAT_VIDEO_NOT_COMPRESSED });
});

test('B3 · the limit is judged AFTER compression', async () => {
  const fat: ChatFileCompressors = {
    image: async () => file('x.jpg', 'image/jpeg', 21 * MB),
    video: async () => file('x.mp4', 'video/mp4', 51 * MB),
  };
  const v = await prepareChatFile(file('a.mp4', 'video/mp4', 60 * MB), { compressors: fat });
  assert.deepEqual(v, { ok: false, message: 'That file is over 50 MB. Send a Drive or YouTube link instead.' });
  const p = await prepareChatFile(file('a.jpg', 'image/jpeg', 30 * MB), { compressors: fat });
  assert.equal(p.ok, false);
  // A 60 MB phone video that compresses to 9 MB goes.
  const ok = await prepareChatFile(file('a.mp4', 'video/mp4', 60 * MB), { compressors: fakeCompressors([]) });
  assert.equal(ok.ok, true);
});

test('B4 · documents have no compressor and go byte-for-byte, under 20 MB', async () => {
  const log: string[] = [];
  const pdf = file('contract.pdf', 'application/pdf', 5 * MB);
  const r = await prepareChatFile(pdf, { compressors: fakeCompressors(log) });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.prepared.file, pdf);
  assert.equal(log.length, 0);
  const big = await prepareChatFile(file('big.pdf', 'application/pdf', 21 * MB), { compressors: fakeCompressors(log) });
  assert.equal(big.ok, false);
});

test('B5 · the uploader takes only a prepared file — a raw File is refused before any request', async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return new Response('{}', { status: 500 });
  }) as typeof fetch;
  const raw = { file: file('a.jpg', 'image/jpeg'), kind: 'photo' } as unknown as PreparedChatFile;
  assert.equal(isPreparedChatFile(raw), false);
  const r = await uploadPreparedChatFile({ threadId: T, userId: U, prepared: raw, fetchImpl });
  assert.equal(r.ok, false);
  assert.equal(calls, 0, 'a raw File reached the network');
});

test('B6 · the prepare helper has no branch that hands back the input photo or video', () => {
  const src = read('lib/chat-file-prepare.ts');
  // The only `out = file` is the initial value; documents and GIFs keep it.
  assert.equal((src.match(/let out: File = file;/g) ?? []).length, 1);
  assert.equal((src.match(/out = await c\.image\(file\)/g) ?? []).length, 1);
  assert.equal((src.match(/out = await c\.video\(file,/g) ?? []).length, 1);
  assert.match(src, /if \(out === file\) return \{ ok: false, message: CHAT_VIDEO_NOT_COMPRESSED \}/);
});

// ── C · KEPT FOREVER ────────────────────────────────────────────────────────

const LONG_AGO = { event_date: '2025-01-10', event_end_date: null, event_date_precision: 'day' };
function row(id: string, extra: Partial<ChatFileCandidate> = {}): ChatFileCandidate {
  return {
    message_id: id,
    thread_id: T,
    attachment_name: `${id}.pdf`,
    attachment_r2_key: `${CHAT_FILE_REF_PREFIX}chat/${T}/${U}/${id}.pdf`,
    events: LONG_AGO,
    ...extra,
  };
}

function fakeIO(rows: ChatFileCandidate[], opts: { kept?: string[]; head?: 'absent' | 'present' | 'unknown' } = {}) {
  const deleted: string[] = [];
  const marked: string[] = [];
  const io: ChatFileExpiryIO = {
    listCandidates: async () => rows,
    refsKeptElsewhere: async (refs) => new Set(refs.filter((r) => opts.kept?.includes(r))),
    deleteObject: async (ref) => {
      deleted.push(ref);
      return 'deleted';
    },
    headObject: async () => opts.head ?? 'absent',
    markExpired: async (id) => {
      marked.push(id);
      return true;
    },
  };
  return { io, deleted, marked };
}
const NOW = new Date('2026-10-28T04:00:00Z');

test('C1 · a file pinned to Decisions, a contract or a payment proof is never deleted', async () => {
  const rows = [
    row('quote', { proposal_id: 'p1' }),
    row('meeting', { appointment_id: 'a1' }),
    row('adjust', { amendment_id: 'm1' }),
    row('offer', { offered_service_id: 'o1' }),
    row('proof'),
    row('plain'),
  ];
  const proofRef = rows[4].attachment_r2_key as string;
  const { io, deleted, marked } = fakeIO(rows, { kept: [proofRef] });
  const s = await runChatFileExpirySweepWith(io, { now: NOW, dryRun: false });
  assert.deepEqual(marked, ['plain']);
  assert.equal(deleted.length, 1);
  assert.equal(s.keptForever, 5);
  for (const c of CHAT_KEPT_FOREVER_COLUMNS) {
    assert.equal(isKeptForever({ [c]: 'x' }), true, c);
  }
});

test('C2 · the real read filters every kept-forever column, so they are not even selected', () => {
  const src = read('lib/chat-file-expiry-sweep.ts');
  assert.match(src, /for \(const c of KEPT_FOREVER_FILTER_COLUMNS\) q = q\.is\(c, null\);/);
  assert.match(src, /from\('event_vendor_payments'\)\.select\('proof_r2_key'\)/);
  assert.match(src, /from\('vendor_contracts'\)\.select\('file_url'\)/);
});

test('C3 · a failed proof read deletes nothing (fail closed)', async () => {
  const { io, deleted } = fakeIO([row('plain')]);
  io.refsKeptElsewhere = async () => {
    throw new Error('read failed');
  };
  const s = await runChatFileExpirySweepWith(io, { now: NOW, dryRun: false });
  assert.equal(deleted.length, 0);
  assert.equal(s.failed, 1);
});

// ── D · DATES ───────────────────────────────────────────────────────────────

test('D1 · 90 days after the event; no date never expires', () => {
  assert.equal(expiryDateFor('2026-01-01'), '2026-04-01');
  assert.equal(expiryDateFor('2026-12-18'), '2027-03-18');
  assert.equal(expiryDateFor('2024-12-01'), '2025-03-01', 'across a leap-free February');
  assert.equal(expiryDateFor(null), null);
  assert.equal(expiryDateFor(undefined), null);
  assert.equal(expiryDateFor(''), null);
  assert.equal(expiryDateFor('2026-06-01', { precision: 'month' }), null, 'a guessed day never expires');
  assert.equal(expiryDateFor('2026-06-01', { endDate: '2026-06-03' }), '2026-09-01', 'counts from the last day');
});

test('D2 · the warning shows for the 14 days before, and not after', () => {
  const ev = '2026-01-01'; // expires 2026-04-01 (Manila day)
  const at = (iso: string) => new Date(`${iso}T04:00:00Z`); // noon in Manila
  assert.equal(showsExpiryWarning(at('2026-03-17'), ev), false);
  assert.equal(showsExpiryWarning(at('2026-03-18'), ev), true);
  assert.equal(showsExpiryWarning(at('2026-03-31'), ev), true);
  assert.equal(showsExpiryWarning(at('2026-04-01'), ev), false);
  assert.equal(showsExpiryWarning(at('2026-03-20'), null), false);
  assert.equal(expiryWarningLine('2026-04-01'), 'These files go on April 1, 2026. Save any you need.');
});

test('D3 · the sweep and the screens agree on the day', () => {
  const r = row('x', { events: { event_date: '2026-07-30', event_end_date: null, event_date_precision: 'day' } });
  // 2026-07-30 + 90 = 2026-10-28.
  assert.equal(isDueForExpiry(r, new Date('2026-10-27T15:59:00Z')), false, 'still the 27th in Manila');
  assert.equal(isDueForExpiry(r, new Date('2026-10-27T16:00:00Z')), true, 'the 28th in Manila');
  assert.equal(expiryCutoff(new Date('2026-10-27T16:00:00Z')), '2026-07-30');
  assert.equal(isDueForExpiry(row('n', { events: { event_date: null, event_end_date: null, event_date_precision: 'day' } }), NOW), false);
  assert.equal(isDueForExpiry(row('m', { events: { event_date: '2025-01-01', event_end_date: null, event_date_precision: 'month' } }), NOW), false);
});

// ── E · DRY RUN, AND MEASURED DELETES ───────────────────────────────────────

test('E1 · a dry run deletes nothing and marks nothing', async () => {
  const { io, deleted, marked } = fakeIO([row('a'), row('b')]);
  const s = await runChatFileExpirySweepWith(io, { now: NOW, dryRun: true });
  assert.equal(deleted.length, 0);
  assert.equal(marked.length, 0);
  assert.equal(s.wouldDelete, 2);
  assert.equal(s.deleted, 0);
});

test('E2 · a delete counts only when R2 then says 404; otherwise the pointer is kept', async () => {
  const still = fakeIO([row('a')], { head: 'present' });
  const s1 = await runChatFileExpirySweepWith(still.io, { now: NOW, dryRun: false });
  assert.equal(s1.deleted, 0);
  assert.equal(s1.unconfirmed, 1);
  assert.equal(still.marked.length, 0, 'marked expired while the object was still there');
  const unk = fakeIO([row('a')], { head: 'unknown' });
  assert.equal((await runChatFileExpirySweepWith(unk.io, { now: NOW, dryRun: false })).deleted, 0);
  const gone = fakeIO([row('a')]);
  const s3 = await runChatFileExpirySweepWith(gone.io, { now: NOW, dryRun: false });
  assert.equal(s3.deleted, 1);
  assert.equal(s3.marked, 1);
});

test('E3 · the job ships OFF and records measured deletes', () => {
  const src = read('lib/chat-file-expiry-sweep.ts');
  assert.match(src, /process\.env\.CHAT_FILE_EXPIRY_ENABLED === 'true'/, 'the switch is no longer opt-in');
  assert.match(src, /opts\.dryRun \?\? !chatFileExpiryEnabled\(\)/, 'switched off no longer means dry run');
  assert.match(src, /return summary\.deleted;/, 'the run record no longer counts measured deletes');
});

// ── F · EXPIRED ─────────────────────────────────────────────────────────────

test('F1 · an expired message keeps its name and reads "File expired"', () => {
  assert.equal(CHAT_FILE_EXPIRED_LABEL, 'File expired');
  assert.equal(isExpired({ attachment_name: 'menu.pdf', attachment_r2_key: null }), true);
  assert.equal(isExpired({ attachment_name: 'menu.pdf', attachment_r2_key: OWN }), false);
  assert.equal(isExpired({ attachment_name: null, attachment_r2_key: null }), false, 'a text message is not expired');
});
