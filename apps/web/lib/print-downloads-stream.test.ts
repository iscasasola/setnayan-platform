/**
 * print-downloads-stream.test.ts — EVERY PRINT FILE LEAVES AS A STREAM (live fault 2026-10-17, found measuring PR #6597).
 *
 * A Vercel Function's BUFFERED response body stops at 4.5 MB (413 FUNCTION_PAYLOAD_TOO_LARGE); a streamed one does not. Every guest's
 * pass measured 5.15 MB at 109 guests — production's largest event — so it could not be downloaded. Held here:
 *
 *   1 · `bytesStream` hands back EXACTLY the bytes it was given, in parts no larger than 1 MB — only the transport changes;
 *   2 · a streamed print response carries no Content-Length (the server then sends it chunked) and the file's own headers;
 *   3 · NO print route returns a buffered PDF: every `application/pdf` response of `/api/hub-print/[piece]` and of
 *       `/dashboard/<id>/seating/{print,export,caterer}` is built on `bytesStream(…)`, never `Buffer.from(…)` / `new Uint8Array(…)`;
 *   4 · each of those routes runs under the shipped big-file ceiling, `maxDuration = 300`.
 *
 * SABOTAGE (each seen RED, then restored — see the PR): the pass batch's `pdfResponse` buffered again · the place-card pack buffered
 * again · the caterer's PDF buffered again · `bytesStream` dropping its last part · the seating print route's maxDuration removed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { STREAM_PART_BYTES, bytesStream } from './stream-file';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const ROUTES = [
  'app/api/hub-print/[piece]/route.ts',
  'app/dashboard/[eventId]/seating/print/route.ts',
  'app/dashboard/[eventId]/seating/export/route.ts',
  'app/dashboard/[eventId]/seating/caterer/route.ts',
];

async function readAll(stream: ReadableStream<Uint8Array>): Promise<{ bytes: Uint8Array; parts: number[] }> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return { bytes: out, parts: chunks.map((c) => c.length) };
}

test('1 · bytesStream hands back exactly the bytes, in parts of at most 1 MB', async () => {
  for (const size of [0, 1, STREAM_PART_BYTES - 1, STREAM_PART_BYTES, STREAM_PART_BYTES + 1, 5_400_000, 11_900_000]) {
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i += 4093) bytes[i] = (i * 31) & 0xff;
    const { bytes: got, parts } = await readAll(bytesStream(bytes));
    assert.equal(got.length, size, `${size}: a byte is lost or added`);
    assert.ok(Buffer.from(got).equals(Buffer.from(bytes)), `${size}: the bytes changed`);
    assert.ok(parts.every((p) => p <= STREAM_PART_BYTES), `${size}: a part is larger than 1 MB`);
    assert.equal(parts.length, Math.ceil(size / STREAM_PART_BYTES), `${size}: not one part per MB`);
  }
});

test('2 · a streamed print response has no Content-Length and keeps the file’s own headers', async () => {
  const { NextResponse } = await import('next/server');
  const bytes = new Uint8Array(5_400_000).fill(7);
  const res = new NextResponse(bytesStream(bytes), { status: 200, headers: { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="rosa-ben-passes.pdf"' } });
  assert.equal(res.headers.get('content-length'), null, 'a streamed file names its length — it would be sent whole, not chunked');
  assert.equal(res.headers.get('content-type'), 'application/pdf');
  assert.match(res.headers.get('content-disposition') ?? '', /rosa-ben-passes\.pdf/);
  assert.equal((await readAll(res.body!)).bytes.length, bytes.length);
});

test('3 · no print route returns a buffered PDF — every application/pdf response is built on bytesStream', () => {
  let pdfs = 0;
  for (const rel of ROUTES) {
    const src = read(rel);
    assert.match(src, /import \{ bytesStream \} from '@\/lib\/stream-file';/, `${rel} does not stream`);
    /* Each response that is a PDF: from its `new (Next)Response(` to the content type, the body must be `bytesStream(…)`. */
    for (const m of src.matchAll(/new (?:Next)?Response\(((?:(?!new (?:Next)?Response\()[\s\S]){0,700}?)['"]?[Cc]ontent-[Tt]ype['"]?: 'application\/pdf'/g)) {
      pdfs += 1;
      assert.match(m[1]!.trimStart(), /^bytesStream\(/, `${rel}: a PDF is returned buffered — ${m[1]!.trim().slice(0, 60)}`);
    }
    assert.doesNotMatch(src, /new (?:Next)?Response\((?:Buffer\.from\(bytes\)|new Uint8Array\(pdf\))/, `${rel}: a print file is buffered`);
  }
  /* hub-print's one PDF door (`pdfResponse`), the pack and the chart, the 2D seat plan, the caterer's counts. */
  assert.equal(pdfs, 5, 'a print route’s PDF responses moved — this guard must follow them');
  const hub = read(ROUTES[0]!);
  assert.match(hub, /function pdfResponse\([^)]*\): NextResponse \{\s*return new NextResponse\(bytesStream\(bytes\), \{/, 'the pass batch, the set and every piece are not streamed');
  assert.ok((hub.match(/pdfResponse\(bytes, /g) ?? []).length >= 4, 'a hub-print PDF stopped going through pdfResponse');
});

test('4 · every print route runs under the big-file ceiling — maxDuration 300', () => {
  for (const rel of ROUTES) assert.match(read(rel), /export const maxDuration = 300;/, `${rel} has no 300 s ceiling`);
});
