import 'server-only';
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  UploadPartCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import archiver from 'archiver';
import { logQueryError } from '@/lib/supabase/error-detect';
import { R2_BUCKETS, r2Head, r2List, r2SignedGet, type R2BucketName } from '@/lib/r2';
import { cleanupDelete } from '@/lib/cleanup-delete';
import { downloadAllZipScope } from '@/lib/cleanup-delete-scope';
import { parseStoredAsset } from '@/lib/uploads';
import { stripPhotoMetadata } from '@/lib/papic-derivatives';
import { contentDispositionAttachment } from '@/lib/content-disposition';
import { readMemoriesChapters } from '@/lib/memories-chapters.server';
import {
  entryName,
  partFileName,
  pickDownloadSource,
  planDownloadAll,
  type DownloadFile,
  type DownloadPart,
  type DownloadPlan,
} from '@/lib/papic-download-all-core';

/**
 * 📦 DOWNLOAD ALL — the read and the builder (owner 2026-11-03, "zips by chapter, ~2 GB numbered parts, count + sizes
 * shown up front, per-zip ✓"). The pure plan is `lib/papic-download-all-core.ts`.
 *
 * 🔒 THE HOST'S OWN SESSION READS EVERYTHING. Captures, the chapters and which photo sits in which chapter come through
 * the caller's session — the same `readMemoriesChapters` Memories draws with — so a zip can only hold photos the host
 * is shown. A refused chapter read FAILS CLOSED (no plan), never "everything in Unsorted".
 *
 * 📏 SIZES ARE MEASURED. Each file's stored byte column, or — where it is empty (a raw clip, a photo from before the
 * byte telemetry) — the storage object's own size from a HEAD. A file storage cannot find is left out and COUNTED, and
 * the page says so; it is never shown as downloadable.
 *
 * 🏗 WHY A PART IS BUILT INTO STORAGE AND NOT STREAMED TO THE PHONE. A 2 GB stream from a server function to a phone
 * must finish inside the function's time limit — at 300 s that is ~7 MB/s, faster than many PH mobile connections — and
 * a cut-off stream is a broken zip. So the part is assembled server-to-server into R2 (fast, inside the limit), and the
 * phone gets a direct, resumable download link at any speed. Temporary: deleted after `ZIP_KEEP_HOURS` by the daily
 * runner (`sweepOldDownloadZips`).
 */

/** Where built parts live (a random folder per build — the key is the capability). */
export const ZIP_PREFIX = 'papic-zips/';
/** How long a built part is kept before the daily sweep deletes it. */
export const ZIP_KEEP_HOURS = 48;
/** How long the download link a host is handed stays valid. */
const LINK_TTL_SECONDS = 6 * 60 * 60;
/** R2 multipart parts must be ≥ 5 MiB (except the last); 16 MiB keeps the request count low. */
const UPLOAD_CHUNK = 16 * 1024 * 1024;
const PAGE = 1000;
const HEAD_CONCURRENCY = 8;
const ZIP_BUCKET: R2BucketName = R2_BUCKETS.media;

type CaptureRow = {
  id: string;
  r2_object_key: string | null;
  clip_web_r2_key: string | null;
  display_r2_key: string | null;
  full_res_dropped_at: string | null;
  is_clip: boolean;
  captured_at: string | null;
  orig_bytes: number | null;
  display_bytes: number | null;
  clip_web_bytes: number | null;
};

async function readAllCaptures(supabase: SupabaseClient, eventId: string): Promise<CaptureRow[] | null> {
  const cols =
    'r2_object_key, clip_web_r2_key, display_r2_key, full_res_dropped_at, captured_at, orig_bytes, display_bytes, clip_web_bytes';
  const out: CaptureRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('papic_photos')
      .select(`photo_id, photo_type, ${cols}`)
      .eq('event_id', eventId)
      .is('hidden_at', null)
      .eq('moderation_state', 'clean')
      .order('photo_id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      logQueryError('DownloadAll.seat', error, { event_id: eventId });
      return null;
    }
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      out.push({ ...(r as unknown as CaptureRow), id: String(r.photo_id), is_clip: r.photo_type === 'clip' });
    }
    if ((data ?? []).length < PAGE) break;
  }
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('papic_guest_captures')
      .select(`capture_id, media_type, ${cols}`)
      .eq('event_id', eventId)
      .is('hidden_at', null)
      .eq('moderation_state', 'clean')
      .order('capture_id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      logQueryError('DownloadAll.guest', error, { event_id: eventId });
      return null;
    }
    for (const r of (data ?? []) as Record<string, unknown>[]) {
      out.push({ ...(r as unknown as CaptureRow), id: String(r.capture_id), is_clip: r.media_type === 'clip' });
    }
    if ((data ?? []).length < PAGE) break;
  }
  return out;
}

/** Run `fn` over `items` with at most `n` in flight. */
async function mapLimit<T, R>(items: readonly T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

export type DownloadPlanRead =
  | { ok: true; plan: DownloadPlan; eventName: string; missing: number }
  | { ok: false; reason: 'read_failed' | 'chapters_refused' };

export async function readDownloadPlan(supabase: SupabaseClient, eventId: string): Promise<DownloadPlanRead> {
  const [rows, chapterRead, ev] = await Promise.all([
    readAllCaptures(supabase, eventId),
    readMemoriesChapters(supabase, eventId),
    supabase.from('events').select('display_name').eq('event_id', eventId).maybeSingle(),
  ]);
  if (!rows) return { ok: false, reason: 'read_failed' };
  if (chapterRead.refused) return { ok: false, reason: 'chapters_refused' };

  const candidates: (DownloadFile & { measured: number | null })[] = [];
  for (const r of rows) {
    if (chapterRead.withheld.has(r.id)) continue;
    const src = pickDownloadSource(r.r2_object_key, r.display_r2_key, r.full_res_dropped_at, r.is_clip, r.clip_web_r2_key);
    if (!src) continue;
    const stored =
      src.measuredBy === 'orig_bytes' ? r.orig_bytes : src.measuredBy === 'display_bytes' ? r.display_bytes : src.measuredBy === 'clip_web_bytes' ? r.clip_web_bytes : null;
    const measured = typeof stored === 'number' && Number.isFinite(stored) && stored > 0 ? Number(stored) : null;
    candidates.push({
      id: r.id,
      kind: r.is_clip ? 'clip' : 'photo',
      ref: src.ref,
      needsStrip: src.needsStrip,
      ext: src.ext,
      at: r.captured_at,
      bytes: measured ?? 0,
      measured,
      chapters: chapterRead.ofPhoto.get(r.id)?.in ?? [],
    });
  }

  // Where no size is stored, ask storage. A file storage cannot find is not downloadable — counted, never listed.
  let missing = 0;
  const sized = await mapLimit(candidates, HEAD_CONCURRENCY, async (c) => {
    if (c.measured !== null) return c;
    const parsed = parseStoredAsset(c.ref);
    if (!parsed || parsed.kind !== 'r2') return null;
    const head = await r2Head({ bucket: parsed.bucket as R2BucketName, key: parsed.key }).catch(() => null);
    if (!head || !Number.isFinite(head.size) || head.size <= 0) return null;
    return { ...c, bytes: head.size };
  });
  const files: DownloadFile[] = [];
  for (const s of sized) {
    if (!s) {
      missing += 1;
      continue;
    }
    const { measured: _m, ...file } = s;
    void _m;
    files.push(file);
  }

  const chapters = chapterRead.chapters.filter((c) => c.listed).map((c) => ({ id: c.id, label: c.label }));
  const eventName = ((ev.data as { display_name?: string | null } | null)?.display_name ?? '').trim() || 'Setnayan';
  return { ok: true, plan: planDownloadAll(files, chapters), eventName, missing };
}

/** One file's bytes as they go into the zip: a stream straight from storage, or a re-encoded photo with no metadata. */
async function openEntry(client: S3Client, file: DownloadFile): Promise<Readable | Buffer | null> {
  const parsed = parseStoredAsset(file.ref);
  if (!parsed || parsed.kind !== 'r2') return null;
  const obj = await client.send(new GetObjectCommand({ Bucket: parsed.bucket, Key: parsed.key }));
  if (!obj.Body) return null;
  if (!file.needsStrip) return obj.Body as Readable;
  // A photo original may carry GPS: it never leaves raw. If the strip fails the photo is LEFT OUT, never shipped raw.
  const bytes = await obj.Body.transformToByteArray();
  try {
    return await stripPhotoMetadata(bytes);
  } catch {
    return null;
  }
}

export type BuiltPart = { url: string; fileName: string; included: number; skipped: number };

/**
 * Build one part into storage and hand back a download link. Memory stays bounded: ONE file is fetched at a time (the
 * next is opened only after archiver has taken the last — its `entry` event), and the zip leaves in 16 MiB upload
 * chunks. (The old one-zip route appended every file before the zip drained, so its "bounded memory" never held.)
 */
export async function buildPartZip(client: S3Client, eventId: string, eventName: string, part: DownloadPart): Promise<BuiltPart> {
  const fileName = partFileName(eventName, part);
  const key = `${ZIP_PREFIX}${eventId}/${randomBytes(16).toString('hex')}/${part.chapterKey}-${part.part}.zip`;
  const archive = archiver('zip', { store: true });

  let included = 0;
  let skipped = 0;
  const feed = (async () => {
    for (const [i, file] of part.files.entries()) {
      let body: Readable | Buffer | null = null;
      try {
        body = await openEntry(client, file);
      } catch {
        body = null;
      }
      if (!body) {
        skipped += 1;
        continue;
      }
      const taken = new Promise<void>((resolve, reject) => {
        const onEntry = () => {
          archive.off('error', onError);
          resolve();
        };
        const onError = (e: Error) => {
          archive.off('entry', onEntry);
          reject(e);
        };
        archive.once('entry', onEntry);
        archive.once('error', onError);
      });
      archive.append(body, { name: entryName(file, i) });
      await taken;
      included += 1;
    }
    await archive.finalize();
  })();

  const { UploadId } = await client.send(
    new CreateMultipartUploadCommand({ Bucket: ZIP_BUCKET, Key: key, ContentType: 'application/zip' }),
  );
  if (!UploadId) throw new Error('could not start the upload');
  const etags: { ETag: string; PartNumber: number }[] = [];
  try {
    let pending: Buffer[] = [];
    let pendingBytes = 0;
    const flush = async () => {
      if (pendingBytes === 0) return;
      const PartNumber = etags.length + 1;
      const res = await client.send(
        new UploadPartCommand({ Bucket: ZIP_BUCKET, Key: key, UploadId, PartNumber, Body: Buffer.concat(pending, pendingBytes) }),
      );
      etags.push({ ETag: res.ETag ?? '', PartNumber });
      pending = [];
      pendingBytes = 0;
    };
    for await (const chunk of archive as unknown as AsyncIterable<Buffer>) {
      pending.push(chunk);
      pendingBytes += chunk.length;
      if (pendingBytes >= UPLOAD_CHUNK) await flush();
    }
    await feed;
    await flush();
    if (included === 0) throw new Error('no file could be read');
    await client.send(
      new CompleteMultipartUploadCommand({ Bucket: ZIP_BUCKET, Key: key, UploadId, MultipartUpload: { Parts: etags } }),
    );
  } catch (e) {
    archive.abort();
    await client.send(new AbortMultipartUploadCommand({ Bucket: ZIP_BUCKET, Key: key, UploadId })).catch(() => {});
    throw e;
  }

  const url = await r2SignedGet({
    bucket: ZIP_BUCKET,
    key,
    expiresIn: LINK_TTL_SECONDS,
    responseContentDisposition: contentDispositionAttachment(fileName),
  });
  return { url, fileName, included, skipped };
}

/** Daily: delete built parts older than `ZIP_KEEP_HOURS`. Returns how many went, or null when the listing failed. */
export async function sweepOldDownloadZips(nowMs: number = Date.now()): Promise<number | null> {
  try {
    const { objects } = await r2List({ bucket: ZIP_BUCKET, prefix: ZIP_PREFIX, maxKeys: 5000 });
    const cutoff = nowMs - ZIP_KEEP_HOURS * 3_600_000;
    let deleted = 0;
    for (const o of objects) {
      if (!o.key.startsWith(ZIP_PREFIX)) continue;
      if (!o.lastModified || o.lastModified.getTime() > cutoff) continue;
      // Through the cleanup executor: the key must sit in ITS OWN event's zip folder (`downloadAllZipScope`).
      const eventId = o.key.slice(ZIP_PREFIX.length).split('/')[0] ?? '';
      const outcome = await cleanupDelete(`r2://${ZIP_BUCKET}/${o.key}`, downloadAllZipScope(eventId)).catch(() => 'refused' as const);
      if (outcome === 'deleted') deleted += 1;
    }
    return deleted;
  } catch (e) {
    console.error('[download-all] sweep failed:', (e as Error)?.message ?? e);
    return null;
  }
}
