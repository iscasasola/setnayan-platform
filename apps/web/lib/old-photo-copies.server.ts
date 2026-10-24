import 'server-only';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getR2Client, r2HeadOutcome, r2Upload } from '@/lib/r2';
import { encodeR2Ref, parseStoredAsset } from '@/lib/uploads';
import { COPIES_PER_PRESS, WEB_JPEG_QUALITY, WEB_LONG_EDGE, isOversized, webCopyKey } from '@/lib/old-photo-copies';

/**
 * old-photo-copies.server.ts — "Make small copies of old photos" (owner 2026-10-23), the server half.
 *
 * Read side ({@link listOldPhotos}, the dry run the admin page draws on every open): the covers that still point at
 * an original with no copy (`media_web_copy_candidates()`), each with its stored size from a HEAD on the object —
 * nothing is downloaded, nothing written.
 *
 * Write side ({@link makeSmallCopies}, ONLY from the admin's press): for each oversized original, download it, write a
 * web-size JPEG beside it, then `apply_media_web_copy()` points the cover at the copy — only if the cover still names
 * that original — and records the pair. Sequential and capped per press ({@link COPIES_PER_PRESS}): each copy decodes a
 * large image. The original is never deleted, moved or overwritten.
 */

export type OldPhoto = { eventId: string; originalRef: string; bytes: number | null };

export type OldPhotoList =
  | { ok: true; candidates: number; oversized: OldPhoto[]; unsized: number; oversizedBytes: number }
  | { ok: false; error: string };

/** The dry run: every cover still on an original, sized; the oversized ones listed largest first. */
export async function listOldPhotos(admin: SupabaseClient): Promise<OldPhotoList> {
  const { data, error } = await admin.rpc('media_web_copy_candidates', { p_limit: 1000 });
  // A refused read is said, never drawn as "nothing to do".
  if (error) return { ok: false, error: `${error.code ?? ''} ${error.message}`.trim() };
  const rows = (data ?? []) as Array<{ event_id: string; original_ref: string }>;
  // A HEAD per object (no download), eight at a time.
  const sized: OldPhoto[] = [];
  for (let i = 0; i < rows.length; i += 8) {
    const batch = await Promise.all(
      rows.slice(i, i + 8).map(async (row): Promise<OldPhoto | null> => {
        const parsed = parseStoredAsset(row.original_ref);
        if (!parsed || parsed.kind !== 'r2') return null;
        const head = await r2HeadOutcome({ bucket: parsed.bucket, key: parsed.key });
        return { eventId: row.event_id, originalRef: row.original_ref, bytes: head.kind === 'present' && Number.isFinite(head.head.size) ? head.head.size : null };
      }),
    );
    for (const p of batch) if (p) sized.push(p);
  }
  const oversized = sized.filter((p) => isOversized(p.bytes)).sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0));
  return {
    ok: true,
    candidates: rows.length,
    oversized,
    unsized: sized.filter((p) => p.bytes === null).length,
    oversizedBytes: oversized.reduce((n, p) => n + (p.bytes ?? 0), 0),
  };
}

async function originalBytes(ref: string): Promise<{ bytes: Uint8Array; bucket: 'setnayan-media'; key: string } | null> {
  const parsed = parseStoredAsset(ref);
  if (!parsed || parsed.kind !== 'r2' || parsed.bucket !== 'setnayan-media') return null;
  const client = getR2Client();
  if (!client) return null;
  const res = await client.send(new GetObjectCommand({ Bucket: parsed.bucket, Key: parsed.key }));
  const body = res.Body as unknown as { transformToByteArray?: () => Promise<Uint8Array> } | null;
  if (!body || typeof body.transformToByteArray !== 'function') return null;
  return { bytes: await body.transformToByteArray(), bucket: parsed.bucket, key: parsed.key };
}

/** The web-size copy: orientation baked in, long edge {@link WEB_LONG_EDGE}, JPEG, metadata stripped. */
export async function webCopyOf(input: Uint8Array): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return await sharp(input)
    .rotate()
    .resize({ width: WEB_LONG_EDGE, height: WEB_LONG_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: WEB_JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}

export type CopyRun =
  | { ok: true; made: number; skipped: number; savedBytes: number; remaining: number | null }
  | { ok: false; error: string };

/** The press: up to {@link COPIES_PER_PRESS} copies, largest originals first. */
export async function makeSmallCopies(admin: SupabaseClient, madeBy: string | null): Promise<CopyRun> {
  const list = await listOldPhotos(admin);
  if (!list.ok) return list;
  let made = 0;
  let skipped = 0;
  let savedBytes = 0;
  for (const photo of list.oversized.slice(0, COPIES_PER_PRESS)) {
    try {
      const original = await originalBytes(photo.originalRef);
      if (!original) {
        skipped++;
        continue;
      }
      const copy = await webCopyOf(original.bytes);
      // Kept only when it is smaller — otherwise the original stays the cover, untouched.
      if (copy.byteLength >= original.bytes.byteLength) {
        skipped++;
        continue;
      }
      const key = webCopyKey(original.key);
      await r2Upload({ bucket: original.bucket, key, body: copy, contentType: 'image/jpeg' });
      const { data, error } = await admin.rpc('apply_media_web_copy', {
        p_event_id: photo.eventId,
        p_original_ref: photo.originalRef,
        p_web_ref: encodeR2Ref(original.bucket, key),
        p_original_bytes: original.bytes.byteLength,
        p_web_bytes: copy.byteLength,
        p_made_by: madeBy,
      });
      if (error) console.error('[supabase-error] lib/old-photo-copies.server.ts · rpc:apply_media_web_copy', error);
      if (error || data !== true) {
        skipped++;
        continue;
      }
      made++;
      savedBytes += original.bytes.byteLength - copy.byteLength;
    } catch (err) {
      console.error('[old-photo-copies] a copy could not be made:', photo.originalRef, err instanceof Error ? err.message : err);
      skipped++;
    }
  }
  const after = await listOldPhotos(admin);
  return { ok: true, made, skipped, savedBytes, remaining: after.ok ? after.oversized.length : null };
}

/**
 * 🖨 PRINTS KEEP THE ORIGINAL. A cover pointed at its web copy is swapped back to the original for a print-size
 * picture (`lib/print-set.server.ts`), so paper never prints the small copy. One read of the ledger; a refused read
 * leaves the copy (still a sharp 2048-px picture) rather than failing the print.
 */
export async function originalForPrint(admin: SupabaseClient, eventId: string, ref: string | null | undefined): Promise<string | null> {
  if (!ref || !ref.endsWith('.web.jpg')) return ref ?? null;
  const { data, error } = await admin
    .from('media_web_copies')
    .select('original_ref')
    .eq('event_id', eventId)
    .eq('web_ref', ref)
    .maybeSingle();
  if (error) console.error('[supabase-error] lib/old-photo-copies.server.ts · from:media_web_copies.select', error);
  if (error || !data) return ref;
  return (data as { original_ref: string }).original_ref;
}
