/**
 * 🔒 STAGING LOCK (d) BY BEHAVIOUR — a real `S3Client`, the real middleware, and a request handler that RECORDS
 * every request instead of sending it (nothing leaves this process). Each test reads the URL and body the SDK would
 * have put on the wire, so what is proven is the request itself, not a function's return value.
 *
 * SABOTAGE (each seen red, restored): drop the `Prefix` branch in confineR2Input (the list test fails) · drop the
 * `Delete.Objects` branch (the batch-delete body carries the live key) · add the private bucket to liveReadBuckets
 * (the private read falls back) · move the middleware to the `build` step (the presigned URL keeps the live key).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { confineR2Client } from './staging-r2-confine';

const PREFIX = 'staging/final-check/';
const MEDIA = 'setnayan-media';
const PRIVATE = 'setnayan-thread-files';

type Seen = { method: string; path: string; query: Record<string, unknown>; headers: Record<string, string>; body: string };

/** A client whose every request is recorded; `missing(path)` decides which objects answer 404. */
function recordingClient(missing: (path: string) => boolean = () => false) {
  const seen: Seen[] = [];
  const client = new S3Client({
    region: 'auto',
    endpoint: 'https://example-account.r2.cloudflarestorage.com',
    forcePathStyle: true,
    credentials: { accessKeyId: 'test-access-key', secretAccessKey: 'test-secret-key' },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    requestHandler: {
      async handle(request: {
        method: string;
        path: string;
        query?: Record<string, unknown>;
        headers: Record<string, string>;
        body?: unknown;
      }) {
        const body = typeof request.body === 'string' ? request.body : request.body instanceof Uint8Array ? Buffer.from(request.body).toString('utf8') : '';
        seen.push({ method: request.method, path: decodeURIComponent(request.path), query: request.query ?? {}, headers: request.headers, body });
        const notFound = missing(decodeURIComponent(request.path));
        const xml =
          request.method === 'POST' && 'delete' in (request.query ?? {})
            ? '<?xml version="1.0" encoding="UTF-8"?><DeleteResult></DeleteResult>'
            : request.method === 'GET' && 'list-type' in (request.query ?? {})
              ? '<?xml version="1.0" encoding="UTF-8"?><ListBucketResult><KeyCount>0</KeyCount></ListBucketResult>'
              : request.method === 'PUT' && (request.query ?? {}) && 'x-amz-copy-source' in request.headers
                ? '<?xml version="1.0" encoding="UTF-8"?><CopyObjectResult><ETag>"e"</ETag></CopyObjectResult>'
                : '';
        return {
          response: {
            statusCode: notFound ? 404 : 200,
            reason: notFound ? 'Not Found' : 'OK',
            headers: notFound ? {} : { 'content-type': 'application/xml', etag: '"e"' },
            body: Readable.from(notFound ? [] : [Buffer.from(xml)]),
          },
        };
      },
      updateHttpClientConfig() {},
      httpHandlerConfigs() {
        return {};
      },
    } as never,
  });
  confineR2Client(client, PREFIX, { liveReadBuckets: new Set([MEDIA]) });
  return { client, seen };
}

test('a PUT lands under the staging prefix', async () => {
  const { client, seen } = recordingClient();
  await client.send(new PutObjectCommand({ Bucket: MEDIA, Key: 'vendors/v1/cover.jpg', Body: 'x' }));
  assert.equal(seen.length, 1);
  assert.equal(seen[0]!.method, 'PUT');
  assert.equal(seen[0]!.path, `/${MEDIA}/${PREFIX}vendors/v1/cover.jpg`);
});

test('a DELETE can only reach the staging copy of an object, never the live one', async () => {
  const { client, seen } = recordingClient();
  await client.send(new DeleteObjectCommand({ Bucket: MEDIA, Key: 'events/e1/hero.jpg' }));
  await client.send(new DeleteObjectCommand({ Bucket: MEDIA, Key: `${PREFIX}events/e1/hero.jpg` }));
  assert.deepEqual(
    seen.map((s) => `${s.method} ${s.path}`),
    [`DELETE /${MEDIA}/${PREFIX}events/e1/hero.jpg`, `DELETE /${MEDIA}/${PREFIX}events/e1/hero.jpg`],
    'a key already inside the prefix is not prefixed twice',
  );
});

test('a batch delete names only staging keys in its body', async () => {
  const { client, seen } = recordingClient();
  await client.send(
    new DeleteObjectsCommand({ Bucket: MEDIA, Delete: { Objects: [{ Key: 'papic/a.jpg' }, { Key: 'papic/b.jpg' }] } }),
  );
  assert.equal(seen.length, 1);
  assert.match(seen[0]!.body, new RegExp(`<Key>${PREFIX}papic/a.jpg</Key>`));
  assert.match(seen[0]!.body, new RegExp(`<Key>${PREFIX}papic/b.jpg</Key>`));
  assert.doesNotMatch(seen[0]!.body, /<Key>papic\//, 'no live key may appear in a staging batch delete');
});

test('a copy reads and writes inside the prefix', async () => {
  const { client, seen } = recordingClient();
  await client.send(new CopyObjectCommand({ Bucket: MEDIA, CopySource: `${MEDIA}/old/a.jpg`, Key: 'new/a.jpg' }));
  assert.equal(seen[0]!.path, `/${MEDIA}/${PREFIX}new/a.jpg`);
  assert.equal(decodeURIComponent(seen[0]!.headers['x-amz-copy-source'] ?? ''), `${MEDIA}/${PREFIX}old/a.jpg`);
});

test('a list without a prefix lists only the staging folder', async () => {
  const { client, seen } = recordingClient();
  await client.send(new ListObjectsV2Command({ Bucket: MEDIA }));
  await client.send(new ListObjectsV2Command({ Bucket: MEDIA, Prefix: 'events/e1/' }));
  assert.equal(seen[0]!.query.prefix, PREFIX);
  assert.equal(seen[1]!.query.prefix, `${PREFIX}events/e1/`);
});

test('a bucket-level write is refused before anything is sent', async () => {
  const { client, seen } = recordingClient();
  await assert.rejects(
    client.send(new PutBucketCorsCommand({ Bucket: MEDIA, CORSConfiguration: { CORSRules: [] } })),
    /bucket-level write/,
  );
  assert.equal(seen.length, 0);
});

test('a presigned PUT URL carries the prefix (the browser uploads inside it)', async () => {
  const { client, seen } = recordingClient();
  const url = await getSignedUrl(client, new PutObjectCommand({ Bucket: MEDIA, Key: 'payments/p1.png' }), { expiresIn: 60 });
  assert.equal(decodeURIComponent(new URL(url).pathname), `/${MEDIA}/${PREFIX}payments/p1.png`);
  assert.equal(seen.length, 0, 'presigning sends nothing');
});

test('a read finds what staging wrote, and a PUBLIC media read falls back to the live object', async () => {
  const { client, seen } = recordingClient((path) => path.startsWith(`/${MEDIA}/${PREFIX}`) && path.endsWith('hero.jpg'));
  await client.send(new HeadObjectCommand({ Bucket: MEDIA, Key: 'site/hero.jpg' }));
  assert.deepEqual(
    seen.map((s) => `${s.method} ${s.path}`),
    [`HEAD /${MEDIA}/${PREFIX}site/hero.jpg`, `HEAD /${MEDIA}/site/hero.jpg`],
    'staging first, then the live public object — a read, never a write',
  );
  seen.length = 0;
  await client.send(new GetObjectCommand({ Bucket: MEDIA, Key: 'vendors/v1/cover.jpg' }));
  assert.deepEqual(seen.map((s) => s.path), [`/${MEDIA}/${PREFIX}vendors/v1/cover.jpg`], 'found in staging: no second request');
});

test('a PRIVATE bucket never falls back to a live object', async () => {
  const { client, seen } = recordingClient(() => true);
  await assert.rejects(client.send(new GetObjectCommand({ Bucket: PRIVATE, Key: 'threads/t1/file.pdf' })));
  assert.deepEqual(seen.map((s) => s.path), [`/${PRIVATE}/${PREFIX}threads/t1/file.pdf`]);
});

test('the caller’s command input is never mutated', async () => {
  const { client } = recordingClient();
  const input = { Bucket: MEDIA, Key: 'vendors/v1/cover.jpg', Body: 'x' };
  await client.send(new PutObjectCommand(input));
  assert.equal(input.Key, 'vendors/v1/cover.jpg');
});
