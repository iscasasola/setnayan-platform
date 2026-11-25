/**
 * 🔒 STAGING LOCK (d), THE SDK HALF — confines an R2 client to `STAGING_R2_PREFIX`.
 *
 * `getR2Client` (lib/r2.ts) is the one constructor every R2 call in the app goes through — the named helpers there
 * AND the ~20 files that `send` their own commands on it. On a staging copy it builds the client through
 * {@link confineR2Client}, which adds ONE middleware at the very first step of every command: the command's input is
 * replaced by `confineR2Input` (lib/staging-locks.ts) before anything is signed, serialised or sent — so a PUT, a
 * DELETE, a COPY, a multipart part, a batch delete and a presigned URL all land under the prefix, and a bucket-level
 * write throws. A staging copy can therefore never write or delete an object the live site owns.
 *
 * Reads go through the same rule, so what a staging copy uploaded is found again by the key it was given. One
 * exception, for reads only: a `GetObject` / `HeadObject` on the PUBLIC media bucket that finds nothing under the
 * prefix is retried once against the live key — that object is public on the open web already, and a read cannot
 * change it. Private buckets never fall back.
 *
 * No `server-only` here on purpose: `lib/staging-r2-confine.test.ts` builds a real `S3Client` with this middleware
 * and a request handler that records instead of sending, and checks every request's URL and body.
 */
import type { S3Client } from '@aws-sdk/client-s3';
import { confineR2Input, R2_READS_THAT_MAY_FALL_BACK } from './staging-locks';

export const STAGING_CONFINE_MIDDLEWARE = 'setnayanStagingConfine';

function isNotFound(e: unknown): boolean {
  const err = e as { name?: unknown; $metadata?: { httpStatusCode?: unknown } } | null;
  return err?.name === 'NotFound' || err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404;
}

/** Adds the confinement middleware to `client` (once) and returns it. */
export function confineR2Client(
  client: S3Client,
  prefix: string,
  opts: { liveReadBuckets: ReadonlySet<string> },
): S3Client {
  client.middlewareStack.remove(STAGING_CONFINE_MIDDLEWARE);
  client.middlewareStack.add(
    (next, context) => async (args) => {
      const name = String((context as { commandName?: unknown }).commandName ?? '').replace(/Command$/, '');
      const original = args.input as Record<string, unknown>;
      const confined = confineR2Input(name, original, prefix);
      try {
        return await next({ ...args, input: confined });
      } catch (e) {
        const mayReadLive =
          R2_READS_THAT_MAY_FALL_BACK.has(name) &&
          typeof original.Bucket === 'string' &&
          opts.liveReadBuckets.has(original.Bucket) &&
          confined.Key !== original.Key &&
          isNotFound(e);
        if (mayReadLive) return next(args);
        throw e;
      }
    },
    { step: 'initialize', name: STAGING_CONFINE_MIDDLEWARE, priority: 'high' },
  );
  return client;
}
