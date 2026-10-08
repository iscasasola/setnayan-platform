/**
 * the-lab-can-upload.test.ts — THE LAB CAN REALLY ADD A PHOTO, AND NOBODY ELSE CAN REACH ITS STAND-IN.
 *
 * Owner, 2026-10-08, on Studio › Love Story in the dev lab: *"it does not upload"*. The lab is his only way to see
 * that page and it has no file storage, so there an upload could never succeed. `app/dev/details-lab/
 * lab-upload-stand-in.ts` stands in for storage: the picked file stays in the browser's memory and a figure is
 * reported in a few steps, through the REAL uploader, slots and row.
 *
 *   (1) RUN: a picked photo's figure goes up in steps to 100 and then it lands — with a ref a moment can hold and the
 *       address the browser holds the file at, told to the lab; and NO request is made.
 *   (2) RUN: the failures can be looked at — a file named `fail…` is refused, one named `stall…` moves nothing and is
 *       given up on after the slots' own wait; ✕ stops one, and it never lands afterwards.
 *   (3) THE SEAM IS THE LAB'S ALONE: only `app/dev/` provides the stand-in, only the Love Story's slots hand one to
 *       the uploader, and the lab's route refuses production.
 *   (4) THE LAB KEEPS WHAT WAS ADDED: the fixture applies the same moment form in memory with the server's own
 *       function, and draws the picked photo from the browser's memory.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { readMomentMedia } from './love-story-moments';
import type { UploadOutcome } from './upload-send';
import { LAB_REF_PREFIX, LAB_UPLOAD_STEP_MS, LAB_UPLOAD_STEPS, labUploadStandIn } from '../app/dev/details-lab/lab-upload-stand-in';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

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
    /** Turn the clock, firing what falls due IN ORDER — a timer set by a timer fires too, when its time comes. */
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        const due = [...pending].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        now = due[1].at;
        pending.delete(due[0]);
        due[1].fn();
      }
      now = end;
    },
    get waiting() {
      return pending.size;
    },
  };
}
const flush = async () => {
  for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r));
};
const photo = (name: string) => new File([new Uint8Array(900)], name, { type: 'image/jpeg' });
const STALL = 15_000;

function start(name: string) {
  const c = clock();
  const landed: [string, string][] = [];
  const seen: number[] = [];
  const send = labUploadStandIn((ref, url) => landed.push([ref, url]), { timers: c.timers, urlOf: (f) => `blob:lab/${f.name}` });
  const run = send({ file: photo(name), bucket: 'media', pathPrefix: 'events/x/love-story', contentType: 'image/jpeg' }, { stallMs: STALL, responseMs: 1, onProgress: (p) => seen.push(p) });
  let out: UploadOutcome | null = null;
  let sent = false;
  void run.done.then((o) => (out = o));
  void run.sent.then(() => (sent = true));
  return { c, run, landed, seen, get out() { return out as UploadOutcome | null; }, get sent() { return sent; } };
}

test('(1) a picked photo: the figure goes up in steps to 100, then it lands — a ref a moment can hold, held in the browser — and no request is made', async () => {
  const real = { fetch: globalThis.fetch, xhr: (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest };
  let asked = 0;
  globalThis.fetch = (() => {
    asked += 1;
    throw new Error('the lab made a request');
  }) as never;
  (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = class {
    constructor() {
      asked += 1;
    }
  };
  try {
    const u = start('Beach.JPG');
    await flush();
    assert.equal(u.sent, true, 'the uploader’s busy window never closes');
    assert.deepEqual(u.seen, [], 'a figure before any time has passed');
    assert.ok(LAB_UPLOAD_STEPS.length >= 4, 'anti-vacuity: the lab shows fewer than a few steps');
    for (let i = 0; i < LAB_UPLOAD_STEPS.length; i++) {
      u.c.advance(LAB_UPLOAD_STEP_MS);
      await flush();
      assert.deepEqual(u.seen, LAB_UPLOAD_STEPS.slice(0, i + 1), 'the figure jumped, or went backwards');
      assert.equal(u.out, null, `it landed at ${u.seen.at(-1)}% — before the figure had been seen`);
    }
    assert.equal(u.seen.at(-1), 100);
    assert.ok(u.seen.every((p, i) => i === 0 || p > u.seen[i - 1]!), 'the figure does not only go up');
    u.c.advance(LAB_UPLOAD_STEP_MS);
    await flush();
    assert.ok(u.out?.ok, 'the photo never landed');
    const { r2Ref, displayUrl } = u.out as Extract<UploadOutcome, { ok: true }>;
    assert.ok(r2Ref.startsWith(LAB_REF_PREFIX));
    assert.deepEqual(readMomentMedia([r2Ref]), [r2Ref], 'a moment refuses the lab’s ref — the square’s count would never go up');
    assert.equal(displayUrl, 'blob:lab/Beach.JPG', 'the photo shown is not the one picked');
    assert.deepEqual(u.landed, [[r2Ref, displayUrl]], 'the lab was not told where the browser holds it');
    assert.equal(u.c.waiting, 0);
    assert.equal(asked, 0, 'the stand-in made a request');
    // A second photo gets its own ref.
    const send = labUploadStandIn(() => {}, { timers: u.c.timers, urlOf: () => 'blob:x' });
    const refs: string[] = [];
    for (const n of ['a.png', 'b.webp']) {
      void send({ file: photo(n), bucket: 'media', pathPrefix: 'p', contentType: 'image/png' }, { stallMs: STALL, responseMs: 1 }).done.then((o) => o.ok && refs.push(o.r2Ref));
      u.c.advance(LAB_UPLOAD_STEP_MS * (LAB_UPLOAD_STEPS.length + 1));
      await flush();
    }
    assert.equal(new Set(refs).size, 2);
    assert.match(refs[0]!, /\.png$/);
    assert.match(refs[1]!, /\.webp$/);
  } finally {
    globalThis.fetch = real.fetch;
    (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = real.xhr;
  }
});

test('(2) the failures can be looked at: `fail…` is refused, `stall…` moves nothing and is given up on, ✕ stops one for good', async () => {
  const f = start('fail-this.jpg');
  f.c.advance(LAB_UPLOAD_STEP_MS * (LAB_UPLOAD_STEPS.length + 2));
  await flush();
  assert.equal(f.out?.ok, false);
  assert.deepEqual({ kind: (f.out as { kind: string }).kind, status: (f.out as { status: number }).status }, { kind: 'refused', status: 503 });
  assert.deepEqual(f.landed, [], 'a refused photo landed');
  assert.equal(f.c.waiting, 0);

  const s = start('STALL.jpg');
  s.c.advance(STALL - 1);
  await flush();
  assert.equal(s.out, null, 'it was given up on before the slots’ own wait');
  assert.deepEqual(s.seen, [], 'a figure was shown for a photo that moves nothing');
  s.c.advance(1);
  await flush();
  assert.equal((s.out as { kind?: string } | null)?.kind, 'stalled');
  assert.deepEqual(s.landed, []);

  const x = start('beach.jpg');
  x.c.advance(LAB_UPLOAD_STEP_MS * 2);
  await flush();
  x.run.cancel();
  await flush();
  assert.equal((x.out as { kind?: string } | null)?.kind, 'cancelled');
  x.c.advance(LAB_UPLOAD_STEP_MS * 20);
  await flush();
  assert.deepEqual(x.landed, [], 'a stopped photo landed afterwards');
  assert.equal(x.seen.length, 2, 'a stopped photo kept reporting');
});

/** Every source file under `dir` (not a test). */
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

test('(3) the seam is the lab’s alone: only app/dev provides the stand-in, only the Love Story’s slots hand one on, and the lab refuses production', () => {
  const files = [...walk('app'), ...walk('lib'), ...walk('components')];
  assert.ok(files.length > 2000, `anti-vacuity: only ${files.length} files were read`);
  const SLOTS = 'app/dashboard/[eventId]/website/our-story/_components/moment-order-cards.tsx';
  const providers: string[] = [];
  const standIns: string[] = [];
  const senders: string[] = [];
  for (const f of files) {
    const src = read(f);
    if (/SlotsUploadStandIn\.Provider/.test(src)) providers.push(f);
    if (/labUploadStandIn|lab-upload-stand-in/.test(src)) standIns.push(f);
    // An uploader handed a `send` — whoever draws `<FileUpload … send=`.
    if (/<FileUpload\b[^>]*?\ssend=/s.test(src)) senders.push(f);
  }
  assert.deepEqual(providers, ['app/dev/details-lab/studio-lab-fixtures.tsx'], 'a screen a person can reach provides the stand-in for storage');
  assert.deepEqual(standIns.sort(), ['app/dev/details-lab/lab-upload-stand-in.ts', 'app/dev/details-lab/studio-lab-fixtures.tsx'], 'the stand-in is loaded outside the lab');
  assert.deepEqual(senders, [SLOTS], 'another uploader was handed a stand-in for storage');
  // The slots hand on ONLY what the context holds — null (everywhere but the lab) means real storage.
  const slots = read(SLOTS);
  assert.match(slots, /export const SlotsUploadStandIn = createContext<UploadSend \| null>\(null\);/);
  assert.match(slots, /const standIn = useContext\(SlotsUploadStandIn\);/);
  assert.match(slots, /send=\{standIn \?\? undefined\}/);
  assert.match(read('app/_components/file-upload.tsx'), /run = \(send \?\? lib\.sendToStorage\)\(/, 'without a stand-in the uploader no longer sends to real storage');
  // The fixtures are drawn by the lab's pages only, and the lab's route refuses production before anything else.
  const drawers = files.filter((f) => /studio-lab-fixtures/.test(read(f)));
  assert.ok(drawers.length > 0 && drawers.every((f) => f.startsWith('app/dev/')), `the lab's fixtures are drawn outside the lab: ${drawers.join(', ')}`);
  assert.match(read('app/dev/maker-lab/page.tsx'), /export default async function MakerLabPage\([^)]*\)[^{]*\{\s*if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/);
});

test('(4) the lab keeps what was added: the same moment form, applied in memory by the server’s own function; the photo drawn from the browser’s memory', () => {
  const lab = read('app/dev/details-lab/studio-lab-fixtures.tsx');
  assert.match(lab, /<SlotsUploadStandIn\.Provider value=\{standIn\}>\s*<LiveLoveStoryBook/);
  assert.match(lab, /labUploadStandIn\(\(ref, url\) => \{\s*held\.current\.push\(url\);\s*setUrls\(\(all\) => \(\{ \.\.\.all, \[ref\]: url \}\)\);\s*\}\)/, 'the picked photo is never added to the pictures the lab can draw');
  assert.match(lab, /mediaUrls=\{urls\}/);
  assert.match(lab, /action=\{labMomentAction\}/);
  const action = lab.slice(lab.indexOf('async function labMomentAction'), lab.indexOf('export function LabStudioLoveStory'));
  assert.match(action, /const keep = \(moments: typeof before\) => editLoveStory\(\{ eventId: EVENT, next: \{ \.\.\.now, moments \}, server: STORY,/);
  assert.match(action, /const r = applyMomentIntent\(before, intent, fd\);\s*if \(!r\.ok\) throw new MomentNotKept\(r\.error\);\s*await keep\(r\.after\);/);
  assert.doesNotMatch(lab, /fetch\(|XMLHttpRequest|'use server'/, 'the lab reaches for a server');
});
