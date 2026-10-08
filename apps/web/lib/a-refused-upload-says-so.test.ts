/**
 * a-refused-upload-says-so.test.ts — AN UPLOAD ALWAYS ENDS, AND A FAILED ONE SAYS SO.
 *
 * Owner, 2026-10-08, testing Studio › Love Story's photo slots on the local copy: *"it does not upload"* — with a
 * picture of one tile stuck at "0%" beside a spinner. Reproduced by the builder on that copy in headless Chromium:
 * `POST /api/upload → 503`, and forty seconds later the tile still read "0%" with its spinner, no line anywhere,
 * and Done held shut on "Uploading… 0%". A failure that looked exactly like "still working".
 *
 * Two faults, both closed here:
 *   · IN DEVELOPMENT (React's Strict Mode, which the local copy runs under) the uploader's "am I mounted" flag was
 *     cleared by the effect's rehearsal cleanup and never set again, so EVERY ending — a refusal, a stall, even a
 *     landing — was dropped on the floor. Production does not rehearse, and was not affected.
 *   · EVERYWHERE the signing request had no clock: one that never answered spun for ever.
 *
 * There is no DOM in this runner (`tsx --test`), so the component cannot be mounted. What is RUN here is the upload
 * itself (`lib/upload-send.ts`, which `<FileUpload>` hands every file to) against a stubbed `fetch`, a stand-in
 * XMLHttpRequest and hand-turned timers; what is PINNED in the source is only the wiring that needs React.
 *
 *   (1) the signer says 503 → refused, with its words and status; storage is never asked
 *   (2) the request throws → network; never a rejection
 *   (3) the signer never answers → stalled after `stallMs`, the request aborted — never a spinner for ever
 *   (4) the PUT never answers → stalled after `stallMs` — and it is NOT read as "the person stopped it"
 *   (5) bytes that keep moving are never killed; silence after them is; a slow answer has its own longer clock
 *   (6) storage refuses, or the connection breaks, mid-PUT → said; a landing lands with the measured figure
 *   (7) ✕ stops it — during the signing too — and that is the ONLY ending with nothing to say
 *   (8) every ending is ONE of four, and a failure is never "landed" and never silent
 *   (9) the words: the uploader's own line per cause, and which server reasons are the person's to read
 *  (10) the wiring: the flag is set on mount; one place handles every ending; a failed file is a tile that says so
 *       with Try again and ✕, joins nothing, and does not hold Done; the Love Story's slots ask for all of it
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { sendToStorage, uploadEnding, uploadProblemLine, uploadRefusalReason, type UploadOutcome } from './upload-send';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/* ── the stand-ins ──────────────────────────────────────────────────────── */

type Listener = (evt: { lengthComputable?: boolean; loaded?: number; total?: number }) => void;
class Target {
  private on = new Map<string, Listener[]>();
  addEventListener(type: string, fn: Listener) {
    this.on.set(type, [...(this.on.get(type) ?? []), fn]);
  }
  emit(type: string, evt: Parameters<Listener>[0] = {}) {
    for (const fn of this.on.get(type) ?? []) fn(evt);
  }
}
/** An XMLHttpRequest that does nothing until the test says what happened. */
class FakeXhr extends Target {
  static made: FakeXhr[] = [];
  upload = new Target();
  status = 0;
  aborted = 0;
  opened: [string, string] | null = null;
  headers: Record<string, string> = {};
  body: unknown = null;
  constructor() {
    super();
    FakeXhr.made.push(this);
  }
  open(method: string, url: string) {
    this.opened = [method, url];
  }
  setRequestHeader(k: string, v: string) {
    this.headers[k] = v;
  }
  send(body: unknown) {
    this.body = body;
  }
  abort() {
    this.aborted += 1;
    this.emit('abort');
  }
}
/** Timers the test turns by hand. */
function clock() {
  let now = 0;
  let seq = 0;
  const pending = new Map<number, { at: number; fn: () => void }>();
  return {
    timers: {
      setTimeout: (fn: () => void, ms: number) => {
        pending.set(++seq, { at: now + ms, fn });
        return seq;
      },
      clearTimeout: (h: unknown) => void pending.delete(h as number),
    },
    advance(ms: number) {
      now += ms;
      for (const [h, t] of [...pending]) {
        if (t.at <= now && pending.delete(h)) t.fn();
      }
    },
    get waiting() {
      return pending.size;
    },
  };
}
const flush = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r));
};
const SIGNED = { uploadUrl: 'https://r2.example/put?sig=1', r2Ref: 'r2://setnayan-media/events/e1/love-story/x.jpg', displayUrl: 'https://r2.example/get' };
const answer = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;
const file = () => new File([new Uint8Array(2048)], 'beach.jpg', { type: 'image/jpeg' });
const STALL = 15_000;
const RESPONSE = 300_000;

function run(fetchStub: typeof fetch) {
  FakeXhr.made = [];
  const c = clock();
  const seen: number[] = [];
  let stalls = 0;
  const r = sendToStorage(
    { file: file(), bucket: 'media', pathPrefix: 'events/e1/love-story', contentType: 'image/jpeg' },
    { stallMs: STALL, responseMs: RESPONSE, onProgress: (p) => seen.push(p), onStall: () => (stalls += 1) },
    { fetch: fetchStub, XMLHttpRequest: FakeXhr as unknown as typeof XMLHttpRequest, timers: c.timers },
  );
  let out: UploadOutcome | null = null;
  let sent = false;
  void r.done.then((o) => (out = o));
  void r.sent.then(() => (sent = true));
  return {
    r,
    c,
    seen,
    get stalls() {
      return stalls;
    },
    get out() {
      return out as UploadOutcome | null;
    },
    get sent() {
      return sent;
    },
    get xhr() {
      return FakeXhr.made[0] ?? null;
    },
  };
}
const failed = (o: UploadOutcome | null) => {
  assert.ok(o && !o.ok, `it did not end as a failure: ${JSON.stringify(o)}`);
  return o as Extract<UploadOutcome, { ok: false }>;
};

/* ── the upload itself, RUN ─────────────────────────────────────────────── */

test('(1) the signer says 503: REFUSED, with its words and its status — and storage is never asked', async () => {
  const calls: { url: string; body: string }[] = [];
  const u = run((async (url: string, init: { body: string }) => {
    calls.push({ url, body: init.body });
    return answer(503, { error: 'Uploads are not configured.' });
  }) as unknown as typeof fetch);
  assert.equal(u.out, null, 'anti-vacuity: it had ended before the signer answered');
  await flush();
  const o = failed(u.out);
  assert.deepEqual({ kind: o.kind, step: o.step, says: o.says, status: o.status }, { kind: 'refused', step: 'presign', says: 'Uploads are not configured.', status: 503 });
  assert.equal(FakeXhr.made.length, 0, 'a refused file was sent to storage anyway');
  assert.equal(u.sent, true, 'the busy window never closes: `sent` did not settle');
  assert.equal(u.c.waiting, 0, 'a clock is still running after the run ended');
  // What the signer was asked — the same five facts as before the lift.
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, '/api/upload');
  assert.deepEqual(JSON.parse(calls[0]!.body), { bucket: 'media', pathPrefix: 'events/e1/love-story', filename: 'beach.jpg', contentType: 'image/jpeg', sizeBytes: 2048 });

  // A refusal with no JSON at all (a proxy's HTML page) is still a refusal, with its status — not a crash.
  const html = run((async () => ({ ok: false, status: 502, json: async () => { throw new SyntaxError('Unexpected token <'); } })) as unknown as typeof fetch);
  await flush();
  const h = failed(html.out);
  assert.deepEqual({ kind: h.kind, says: h.says, status: h.status }, { kind: 'refused', says: null, status: 502 });
  // A refusal is read from the STATUS — even when its body happens to look signed.
  const liar = run((async () => answer(500, SIGNED)) as unknown as typeof fetch);
  await flush();
  assert.deepEqual({ kind: failed(liar.out).kind, status: failed(liar.out).status }, { kind: 'refused', status: 500 }, 'a 500 was taken as signed');
  assert.equal(FakeXhr.made.length, 0);
  // A 200 that carries an error, or no URL to PUT to, is a refusal too.
  for (const body of [{ error: 'Too large.' }, { r2Ref: 'r2://x/y' }, null]) {
    const odd = run((async () => answer(200, body)) as unknown as typeof fetch);
    await flush();
    assert.equal(failed(odd.out).kind, 'refused', `a 200 with ${JSON.stringify(body)} was taken as signed`);
    assert.equal(FakeXhr.made.length, 0);
  }
});

test('(2) the request throws: NETWORK — the run still ends, and never rejects', async () => {
  const boom = new TypeError('Failed to fetch');
  const u = run((async () => {
    throw boom;
  }) as unknown as typeof fetch);
  await flush();
  const o = failed(u.out);
  assert.deepEqual({ kind: o.kind, step: o.step, status: o.status }, { kind: 'network', step: 'presign', status: null });
  assert.equal(o.error, boom, 'the Problems list loses what was thrown');
  assert.equal(u.sent, true);
  assert.equal(u.c.waiting, 0);
});

test('(3) the signer NEVER answers: stalled after stallMs, the request aborted — never a spinner for ever', async () => {
  let signal: AbortSignal | null = null;
  const u = run(((_: string, init: { signal: AbortSignal }) => {
    signal = init.signal;
    return new Promise<Response>(() => {});
  }) as unknown as typeof fetch);
  await flush();
  u.c.advance(STALL - 1);
  await flush();
  assert.equal(u.out, null, 'it gave up before the clock ran out');
  assert.equal(u.sent, false);
  u.c.advance(1);
  await flush();
  const o = failed(u.out);
  assert.deepEqual({ kind: o.kind, step: o.step }, { kind: 'stalled', step: 'presign' });
  assert.equal(u.stalls, 1, 'the Problems list was not told (or was told twice)');
  assert.equal((signal as AbortSignal | null)?.aborted, true, 'the dead request was left open');
  assert.equal(u.sent, true, 'the busy window never closes');
  assert.equal(FakeXhr.made.length, 0);
});

test('(4) the PUT never answers: stalled after stallMs — and NOT read as "the person stopped it"', async () => {
  const u = run((async () => answer(200, SIGNED)) as unknown as typeof fetch);
  await flush();
  assert.equal(u.sent, true, 'the bytes are on their way and the busy window was not told');
  assert.equal(u.out, null);
  assert.deepEqual(u.xhr!.opened, ['PUT', SIGNED.uploadUrl]);
  assert.equal(u.xhr!.headers['Content-Type'], 'image/jpeg');
  assert.ok(u.xhr!.body instanceof File, 'the file itself was not what was sent');
  u.c.advance(STALL - 1);
  await flush();
  assert.equal(u.out, null, 'it gave up before the clock ran out');
  u.c.advance(1);
  await flush();
  const o = failed(u.out);
  assert.deepEqual({ kind: o.kind, step: o.step }, { kind: 'stalled', step: 'put' }, 'a stall was reported as a stop — and a stop says nothing');
  assert.equal(u.xhr!.aborted, 1, 'the dead PUT was left open');
  assert.equal(u.stalls, 1);
  assert.equal(u.c.waiting, 0);
});

test('(5) bytes that keep moving are never killed; silence after them is; a slow ANSWER has its own longer clock', async () => {
  const u = run((async () => answer(200, SIGNED)) as unknown as typeof fetch);
  await flush();
  // A slow but healthy transfer: a little every 10 s, for a minute — far past stallMs in total.
  for (let i = 1; i <= 6; i++) {
    u.c.advance(10_000);
    u.xhr!.upload.emit('progress', { lengthComputable: true, loaded: i * 300, total: 2048 });
  }
  await flush();
  assert.equal(u.out, null, 'a healthy slow upload was killed by a total-duration cap');
  assert.deepEqual(u.seen, [15, 29, 44, 59, 73, 88], 'the figure is not the one measured from the PUT');
  // Every byte handed over: the transfer clock gives way to the response clock.
  u.xhr!.upload.emit('progress', { lengthComputable: true, loaded: 2048, total: 2048 });
  u.xhr!.upload.emit('loadend');
  u.c.advance(STALL * 4);
  await flush();
  assert.equal(u.out, null, 'storage was given only the transfer clock to answer in');
  u.c.advance(RESPONSE);
  await flush();
  assert.equal(failed(u.out).kind, 'stalled', 'a response that never comes spins for ever');

  // Bytes move, then nothing: dead stallMs after the LAST byte, not after the first.
  const v = run((async () => answer(200, SIGNED)) as unknown as typeof fetch);
  await flush();
  v.c.advance(9_000);
  v.xhr!.upload.emit('progress', { lengthComputable: false });
  v.c.advance(STALL - 1);
  await flush();
  assert.equal(v.out, null, 'the clock was not reset by bytes whose total is unknown');
  assert.deepEqual(v.seen, [], 'a figure was invented for an upload that cannot be measured');
  v.c.advance(1);
  await flush();
  assert.equal(failed(v.out).kind, 'stalled');
});

test('(6) storage refuses, or the connection breaks, mid-PUT: said. A landing lands, with the measured figure', async () => {
  const refused = run((async () => answer(200, SIGNED)) as unknown as typeof fetch);
  await flush();
  refused.xhr!.status = 403;
  refused.xhr!.emit('load');
  await flush();
  const r = failed(refused.out);
  assert.deepEqual({ kind: r.kind, step: r.step, status: r.status }, { kind: 'refused', step: 'put', status: 403 });

  const broke = run((async () => answer(200, SIGNED)) as unknown as typeof fetch);
  await flush();
  broke.xhr!.emit('error');
  await flush();
  const b = failed(broke.out);
  assert.deepEqual({ kind: b.kind, step: b.step }, { kind: 'network', step: 'put' });

  const landed = run((async () => answer(200, SIGNED)) as unknown as typeof fetch);
  await flush();
  landed.xhr!.upload.emit('progress', { lengthComputable: true, loaded: 1024, total: 2048 });
  landed.xhr!.status = 201;
  landed.xhr!.emit('load');
  await flush();
  assert.deepEqual(landed.out, { ok: true, r2Ref: SIGNED.r2Ref, displayUrl: SIGNED.displayUrl });
  assert.deepEqual(landed.seen, [50]);
  assert.equal(landed.c.waiting, 0, 'the clock outlived the upload — it would report a stall on a file that landed');
  // ONE ending: whatever arrives afterwards changes nothing and reports nothing.
  landed.xhr!.upload.emit('progress', { lengthComputable: true, loaded: 2048, total: 2048 });
  landed.xhr!.emit('error');
  landed.c.advance(RESPONSE * 2);
  await flush();
  assert.equal(landed.out?.ok, true);
  assert.deepEqual(landed.seen, [50], 'a figure was reported after the upload had ended');
  assert.equal(landed.stalls, 0);
});

test('(7) ✕ stops it — during the signing too — and that is the only ending with nothing to say', async () => {
  let signal: AbortSignal | null = null;
  const early = run(((_: string, init: { signal: AbortSignal }) => {
    signal = init.signal;
    return new Promise<Response>(() => {});
  }) as unknown as typeof fetch);
  await flush();
  early.r.cancel();
  await flush();
  assert.deepEqual({ kind: failed(early.out).kind, step: failed(early.out).step }, { kind: 'cancelled', step: 'presign' });
  assert.equal((signal as AbortSignal | null)?.aborted, true);
  assert.equal(FakeXhr.made.length, 0, 'a stopped file went on to storage');
  assert.equal(early.stalls, 0);
  early.c.advance(STALL * 2);
  assert.equal(early.stalls, 0, 'a stopped upload was later reported as stalled');

  const late = run((async () => answer(200, SIGNED)) as unknown as typeof fetch);
  await flush();
  late.r.cancel();
  await flush();
  assert.equal(failed(late.out).kind, 'cancelled');
  assert.equal(late.xhr!.aborted, 1);
  assert.equal(uploadProblemLine(late.out!, 'beach.jpg'), null);
});

/* ── what the uploader does with an ending ──────────────────────────────── */

const ENDINGS: UploadOutcome[] = [
  { ok: false, kind: 'refused', step: 'presign', says: 'Uploads are not configured.', status: 503 },
  { ok: false, kind: 'refused', step: 'presign', says: 'That photo is over 10 MB.', status: 413 },
  { ok: false, kind: 'refused', step: 'put', says: null, status: 403 },
  { ok: false, kind: 'network', step: 'presign', says: null, status: null, error: new TypeError('Failed to fetch') },
  { ok: false, kind: 'network', step: 'put', says: null, status: null },
  { ok: false, kind: 'stalled', step: 'presign', says: null, status: null },
  { ok: false, kind: 'stalled', step: 'put', says: null, status: null },
];

test('(8) every ending is one of four — and a failure is never "landed", and never silent', () => {
  assert.equal(uploadEnding({ ok: true, r2Ref: 'r2://a/b', displayUrl: '' }, true), 'landed');
  assert.equal(uploadEnding({ ok: true, r2Ref: 'r2://a/b', displayUrl: '' }, false), 'landed');
  for (const step of ['presign', 'put'] as const) {
    const stop: UploadOutcome = { ok: false, kind: 'cancelled', step, says: null, status: null };
    assert.equal(uploadEnding(stop, true), 'stopped');
    assert.equal(uploadEnding(stop, false), 'stopped');
  }
  for (const out of ENDINGS) {
    assert.equal(uploadEnding(out, true), 'tile', `with failedSays, ${JSON.stringify(out)} is not a tile that says so`);
    assert.equal(uploadEnding(out, false), 'line', `${JSON.stringify(out)} is not said in the uploader’s line`);
    // …and for a caller with no tile there is always a line to say.
    assert.ok((uploadProblemLine(out, 'beach.jpg') ?? '').length > 8, `${JSON.stringify(out)} has no words`);
  }
});

test('(9) the words: the uploader’s own line per cause, and which server reasons are the person’s to read', () => {
  const line = (i: number) => uploadProblemLine(ENDINGS[i]!, 'beach.jpg');
  assert.equal(line(0), 'Uploads are not configured.');
  assert.equal(line(2), 'R2 rejected beach.jpg (status 403). Try a different file or contact support.');
  assert.equal(line(3), 'Failed to fetch');
  assert.equal(line(4), 'Upload failed for beach.jpg. Check your connection and retry.');
  assert.equal(line(5), 'beach.jpg stopped uploading — check your connection and pick it again.');
  assert.equal(line(6), 'beach.jpg stopped uploading — check your connection and pick it again.');
  assert.equal(uploadProblemLine({ ok: false, kind: 'refused', step: 'presign', says: null, status: 502 }, 'a.jpg'), 'Presign failed (502)');
  assert.equal(uploadProblemLine({ ok: false, kind: 'network', step: 'presign', says: null, status: null }, 'a.jpg'), 'Network error.');
  // Beside a tile that already says "Couldn't upload this photo.": a 4xx's reason is the person's (too large, the
  // allowance is full); a 5xx's is the operator's and stays out of a couple's sheet; a broken connection has none.
  assert.equal(uploadRefusalReason(ENDINGS[1]!), 'That photo is over 10 MB.');
  assert.equal(uploadRefusalReason(ENDINGS[0]!), null, 'a couple is shown the operator’s 503 words');
  for (const i of [2, 3, 4, 5, 6]) assert.equal(uploadRefusalReason(ENDINGS[i]!), null);
});

/* ── the wiring that needs React (pinned — no DOM in this runner) ────────── */

test('(10) the wiring: the flag is set on mount; ONE place handles every ending; a failed file is a tile that says so, joins nothing, and does not hold Done', async () => {
  const up = read('app/_components/file-upload.tsx');
  // The flag is SET by the effect, not only cleared by its cleanup (Strict Mode rehearses the cleanup once).
  assert.match(up, /useEffect\(\(\) => \{\s*isMountedRef\.current = true;\s*return \(\) => \{\s*isMountedRef\.current = false;/, 'under Strict Mode every ending is dropped: the mounted flag is cleared and never set');
  assert.equal((up.match(/isMountedRef\.current = true/g) ?? []).length, 1);
  // The uploader hands every file to the run above — loaded at the first upload, never with the page.
  assert.doesNotMatch(up, /import \{[^}]*\} from '@\/lib\/upload-send'/, 'the upload run rides the first load again');
  assert.doesNotMatch(up, /XMLHttpRequest|fetch\('\/api\/upload'|createStallWatchdog/, 'the uploader signs or PUTs by itself again — outside the run that always ends');
  assert.match(up, /lib = await import\('@\/lib\/upload-send'\);\s*run = \(send \?\? lib\.sendToStorage\)\(/);
  assert.match(up, /stallMs: stallMs \?\? UPLOAD_STALL_MS,\s*responseMs: UPLOAD_RESPONSE_MS,/);
  // …and fetched the moment the file picker is opened, so the first upload does not wait on it (a failed fetch is
  // swallowed THERE only: the upload itself asks again, and says so).
  assert.match(up, /type="file"[\s\S]{0,900}?onClick=\{\(\) => void import\('@\/lib\/upload-send'\)\.catch\(\(\) => \{\}\)\}/, 'the first upload waits on its own code');
  // ONE place handles every ending, however the run ended — and the code that could not even be loaded is one too.
  assert.match(up, /void run\.done\.then\(ended\);/);
  assert.match(up, /\} catch \(error\) \{\s*return ended\(\{ ok: false, kind: 'network', step: 'presign', says: null, status: null, error \}\);\s*\}/);
  assert.match(up, /await run\.sent;\s*\}/, 'the busy window no longer waits for the bytes to be on their way');
  const ended = up.slice(up.indexOf('const ended = (out: UploadOutcome) => {'), up.indexOf('let run: ReturnType<UploadSend>;'));
  assert.ok(ended.length > 400, 'anti-vacuity: `ended` was not found');
  // Whatever the ending, the tile in flight leaves `inFlight` FIRST — that is what lets go of Done (`onItsWay`).
  assert.match(ended, /^const ended = \(out: UploadOutcome\) => \{\s*if \(!isMountedRef\.current\) return;\s*setInFlight\(\(prev\) => prev\.filter\(\(i\) => i\.id !== id\)\);\s*const ending = lib \? lib\.uploadEnding\(out, keepsFailed\) : keepsFailed \? 'tile' : 'line';/);
  assert.match(up, /const onItsWay = preparing \|\| inFlight\.length > 0;/, 'a failed tile holds Done shut');
  // Only a landing joins the value.
  assert.equal((ended.match(/emitChange\(|setItems\(/g) ?? []).length, 2);
  assert.match(ended, /if \(out\.ok && ending === 'landed'\) \{[\s\S]*?setItems\([\s\S]*?emitChange\(next\);[\s\S]*?return;\s*\}\s*if \(ending === 'stopped'\) return;/);
  // A failure: the tile (the picked file itself, to try again) — or the line. Never neither.
  assert.match(ended, /if \(ending === 'tile'\) \{\s*setFailed\(\(prev\) => \[\.\.\.prev, \{ id, file: rawFile \}\]\);\s*const reason = lib\?\.uploadRefusalReason\(out\) \?\? null;\s*if \(reason\) setError\(reason\);\s*return;\s*\}\s*setError\(lib\?\.uploadProblemLine\(out, file\.name\) \?\? 'Network error\.'\);\s*\};\s*$/);
  assert.match(up, /const keepsFailed = Boolean\(failedSays\) && variant === 'gallery';/);
  // THE TILE: says the caller's words, Try again sends the same file, ✕ removes it — no spinner, no tick.
  const tile = up.slice(up.indexOf('{failed.map((item) => ('), up.indexOf('</ul>', up.indexOf('{failed.map((item) => (')));
  assert.ok(tile.length > 300, 'anti-vacuity: the failed tile was not found');
  assert.match(tile, /role="alert"\s*data-upload-failed=""/);
  assert.match(tile, /\{failedSays\}/);
  assert.match(tile, /data-upload-retry=""\s*onClick=\{\(\) => retryFailed\(item\)\}[\s\S]*?>\s*Try again\s*<\/button>/);
  assert.match(tile, /onClick=\{\(\) => dropFailed\(item\.id\)\}[\s\S]*?aria-label=\{`Remove \$\{item\.file\.name\}`\}/);
  assert.doesNotMatch(tile, /Loader2|animate-spin|CheckCircle2|item\.progress/, 'a failed tile looks like one still working, or one that landed');
  assert.match(up, /function retryFailed\(item: FailedItem\) \{\s*if \(!busyRef\.current && !atCapacity\) dropFailed\(item\.id\);\s*void handleFiles\(\[item\.file\]\);\s*\}/, 'Try again does not send the file through the pick’s own door');
  assert.match(up, /\{\(isGallery && \(inFlight\.length > 0 \|\| items\.length > 0\)\) \|\| failed\.length > 0 \? \(/, 'a slot whose only tile failed draws no grid at all');
  // The hidden inputs — the value a form posts — are built from `items` alone.
  assert.doesNotMatch(up.slice(up.indexOf('{name'), up.indexOf('{blockedSubmit ?')), /failed/);

  // THE LOVE STORY'S SLOTS ask for it: the words, and 15 seconds.
  const { PHOTO_NOT_UPLOADED, PHOTO_STALL_MS } = await import('../app/dashboard/[eventId]/website/our-story/_components/moment-order-cards');
  assert.equal(PHOTO_NOT_UPLOADED, 'Couldn’t upload this photo.');
  assert.equal(PHOTO_STALL_MS, 15_000);
  const slots = read('app/dashboard/[eventId]/website/our-story/_components/moment-order-cards.tsx');
  assert.match(slots, /variant="gallery"\s*failedSays=\{PHOTO_NOT_UPLOADED\}\s*stallMs=\{PHOTO_STALL_MS\}/);
  // …and "press Done" is offered only for something that was actually kept in the slots.
  assert.match(slots, /\) : changed && !busy \? \(/);
});
