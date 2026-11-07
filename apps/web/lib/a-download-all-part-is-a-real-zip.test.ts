/**
 * 📦 DOWNLOAD ALL — a built part IS a zip, holds exactly its files, strips a photo's location, and fetches ONE file at
 * a time (owner 2026-11-03: "zips by chapter, ~2 GB numbered parts"). Runs `buildPartZip` against a fake storage
 * client (no network), then opens the uploaded bytes with the system `unzip`.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path, { dirname, join } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import type { S3Client } from '@aws-sdk/client-s3';
import type { DownloadPart } from '@/lib/papic-download-all-core';

/* ── `server-only` shim (same as money-reads-are-honest.test.ts) ─────────── */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = path.join(process.cwd(), '__server_only_stub_download_all__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return STUB;
    return original.call(this, request, ...rest);
  };
}

const HERE = dirname(fileURLToPath(import.meta.url));
let mod: typeof import('@/lib/papic-download-all.server');
let jpegWithGps: Buffer;

before(async () => {
  // Dummy credentials: the link is signed locally (no request leaves the test).
  process.env.R2_ACCOUNT_ID ||= 'test-account';
  process.env.R2_ACCESS_KEY_ID ||= 'test-key';
  process.env.R2_SECRET_ACCESS_KEY ||= 'test-secret';
  mod = await import('@/lib/papic-download-all.server');
  jpegWithGps = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#c24e25' } })
    .jpeg()
    .withExif({ IFD0: { Artist: 'test' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '14/1 35/1 0/1' } })
    .toBuffer();
});

/** A fake S3 client: serves objects, records multipart uploads, and measures how many GETs are open at once. */
function fakeClient(objects: Record<string, Buffer>) {
  const uploaded: Buffer[] = [];
  let open = 0;
  let maxOpen = 0;
  const gets: string[] = [];
  const client = {
    async send(cmd: { constructor: { name: string }; input: Record<string, unknown> }) {
      const name = cmd.constructor.name;
      if (name === 'GetObjectCommand') {
        const key = String(cmd.input.Key);
        gets.push(key);
        const bytes = objects[key];
        if (!bytes) throw Object.assign(new Error('NoSuchKey'), { name: 'NoSuchKey' });
        open += 1;
        maxOpen = Math.max(maxOpen, open);
        const body = Readable.from([bytes]) as Readable & { transformToByteArray: () => Promise<Uint8Array> };
        body.on('end', () => (open -= 1));
        body.transformToByteArray = async () => {
          open -= 1;
          return new Uint8Array(bytes);
        };
        return { Body: body };
      }
      if (name === 'CreateMultipartUploadCommand') return { UploadId: 'u1' };
      if (name === 'UploadPartCommand') {
        uploaded.push(Buffer.from(cmd.input.Body as Buffer));
        return { ETag: `"e${uploaded.length}"` };
      }
      if (name === 'CompleteMultipartUploadCommand' || name === 'AbortMultipartUploadCommand') return {};
      throw new Error(`unexpected ${name}`);
    },
  } as unknown as S3Client;
  return { client, uploaded, gets, maxOpen: () => maxOpen };
}

const partOf = (files: DownloadPart['files']): DownloadPart => ({
  chapterKey: 'cer',
  chapterLabel: 'Ceremony',
  part: 1,
  of: 2,
  files,
  count: files.length,
  bytes: files.reduce((s, f) => s + f.bytes, 0),
});

test('the uploaded part opens as a zip holding exactly its files, named in capture order', async () => {
  assert.ok((await sharp(jpegWithGps).metadata()).exif, 'self-check: the test photo carries EXIF before the strip');
  const clip = Buffer.alloc(300_000, 7);
  const fake = fakeClient({ 'papic/p1.jpg': jpegWithGps, 'papic/c1.mp4': clip, 'papic/d1.avif': Buffer.from('avif-bytes') });
  const built = await mod.buildPartZip(
    fake.client,
    'ev1',
    'Maria & Jose',
    partOf([
      { id: 'p1', kind: 'photo', ref: 'r2://setnayan-media/papic/p1.jpg', needsStrip: true, ext: 'jpg', at: '2027-02-14T01:00:00Z', bytes: jpegWithGps.length, chapters: ['cer'] },
      { id: 'c1', kind: 'clip', ref: 'r2://setnayan-media/papic/c1.mp4', needsStrip: false, ext: 'mp4', at: '2027-02-14T02:00:00Z', bytes: clip.length, chapters: ['cer'] },
      { id: 'd1', kind: 'photo', ref: 'r2://setnayan-media/papic/d1.avif', needsStrip: false, ext: 'avif', at: '2027-02-14T03:00:00Z', bytes: 10, chapters: ['cer'] },
    ]),
  );
  assert.equal(built.fileName, 'Maria & Jose — Ceremony — part 1 of 2.zip');
  assert.equal(built.included, 3);
  assert.equal(built.skipped, 0);
  assert.match(built.url, /papic-zips%2Fev1%2F|papic-zips\/ev1\//, 'the link points at the built part');
  assert.match(decodeURIComponent(built.url), /attachment/, 'the link downloads instead of opening in the tab');

  const dir = mkdtempSync(join(tmpdir(), 'dl-all-'));
  const zipPath = join(dir, 'part.zip');
  writeFileSync(zipPath, Buffer.concat(fake.uploaded));
  const listing = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' }).trim().split('\n');
  assert.deepEqual(listing, ['2027-02-14-0001-p1.jpg', '2027-02-14-0002-c1.mp4', '2027-02-14-0003-d1.avif']);
  execFileSync('unzip', ['-q', '-o', zipPath, '-d', dir]);
  assert.equal(readFileSync(join(dir, '2027-02-14-0002-c1.mp4')).length, clip.length, 'a clip goes in byte for byte');
  const photoMeta = await sharp(readFileSync(join(dir, '2027-02-14-0001-p1.jpg'))).metadata();
  assert.equal(photoMeta.exif, undefined, 'the photo left with its location data still in it');
});

test('ONE file is fetched at a time — the next is opened only after the zip took the last', async () => {
  const objs: Record<string, Buffer> = {};
  const files: DownloadPart['files'] = [];
  for (let i = 0; i < 12; i++) {
    objs[`papic/v${i}.mp4`] = Buffer.alloc(200_000, i);
    files.push({ id: `v${i}`, kind: 'clip', ref: `r2://setnayan-media/papic/v${i}.mp4`, needsStrip: false, ext: 'mp4', at: `2027-02-14T0${i % 10}:00:00Z`, bytes: 200_000, chapters: [] });
  }
  const fake = fakeClient(objs);
  const built = await mod.buildPartZip(fake.client, 'ev1', 'E', partOf(files));
  assert.equal(built.included, 12);
  assert.equal(fake.maxOpen(), 1, `${fake.maxOpen()} files were open at once — memory is no longer bounded`);
});

test('a file storage cannot read is left out and counted, never fatal', async () => {
  const fake = fakeClient({ 'papic/ok.mp4': Buffer.alloc(1000, 1) });
  const built = await mod.buildPartZip(
    fake.client,
    'ev1',
    'E',
    partOf([
      { id: 'gone', kind: 'clip', ref: 'r2://setnayan-media/papic/gone.mp4', needsStrip: false, ext: 'mp4', at: null, bytes: 1, chapters: [] },
      { id: 'ok', kind: 'clip', ref: 'r2://setnayan-media/papic/ok.mp4', needsStrip: false, ext: 'mp4', at: null, bytes: 1000, chapters: [] },
    ]),
  );
  assert.equal(built.included, 1);
  assert.equal(built.skipped, 1);
});

test('the routes and the page are hosts-only, re-read the plan, and refuse a part that changed', () => {
  const route = readFileSync(join(HERE, '../app/dashboard/[eventId]/studio/papic/gallery-zip/part/route.ts'), 'utf8');
  assert.match(route, /member_type !== 'couple'/);
  assert.match(route, /readDownloadPlan\(supabase, eventId\)/, 'the part is built from the host’s own read');
  assert.match(route, /partFingerprint\(target\) !== fp/, 'a changed part is no longer refused');
  const page = readFileSync(join(HERE, '../app/dashboard/[eventId]/memories/download-all/page.tsx'), 'utf8');
  assert.match(page, /member_type !== 'couple'/);
  const server = readFileSync(join(HERE, 'papic-download-all.server.ts'), 'utf8');
  assert.match(server, /chapterRead\.refused\) return \{ ok: false/, 'a refused chapter read must fail closed');
  assert.match(server, /chapterRead\.withheld\.has\(r\.id\)/, 'a withheld photo would reach a zip');
  assert.match(readFileSync(join(HERE, 'daily-email-jobs.ts'), 'utf8'), /runClaimedJob\('download-all-zip-sweep'/);
  assert.match(readFileSync(join(HERE, 'periodic-job-registry.ts'), 'utf8'), /key: 'download-all-zip-sweep'/);
  const library = readFileSync(join(HERE, '../app/dashboard/(account)/library/page.tsx'), 'utf8');
  assert.match(library, /\/memories\/download-all/, 'Library’s Download all no longer opens the parts page');
});
