import 'server-only';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getR2Client, R2_BUCKETS } from '@/lib/r2';

// Shared low-level Drive + R2 byte primitives.
//
// Extracted 2026-06-03 from lib/photo-delivery-release.ts so the new
// universal Drive-copy layer (lib/drive-copy.ts) and the existing 0009
// Photo Delivery worker share ONE proven R2→Drive path instead of two
// copies. Behaviour is identical to the release worker's prior private
// helpers — photo-delivery-release.ts now imports `readR2Object` +
// `uploadFileToDrive` from here.
//
// Context: the 2026-06-03 storage lock makes Cloudflare R2 the system of
// record and Google Drive the couple's permanent copy of six artifacts
// (Papic · Patiktok · Pabati · Pakanta · Monogram · QR codes). Every copy,
// whoever the feeder, reads bytes from R2 and PUTs them into the couple's
// Drive folder via these primitives. Spec: Storage_and_Drive_Copy_Architecture_2026-06-03.md.
//
// Scope: `drive.file` only — we can only touch files/folders this app
// created. That is why folders are created (not searched-for) and tracked
// on our side (drive_copy_folders / events.photo_delivery_folder_id).

/**
 * Read an object out of R2 into memory as a byte array. Default bucket is
 * the shared `media` bucket (where all capture/render/generation output
 * lands). AWS SDK v3 returns an SdkStream whose `transformToByteArray`
 * extension materializes the whole object — fine for per-file Drive
 * uploads where memory is bounded by one artifact at a time.
 */
export async function readR2Object(
  key: string,
  bucket: string = R2_BUCKETS.media,
): Promise<Uint8Array> {
  const client = getR2Client();
  if (!client) throw new Error('r2_not_configured');
  const res = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  if (!res.Body) throw new Error('r2_empty_body');
  const stream = res.Body as unknown as {
    transformToByteArray?: () => Promise<Uint8Array>;
  };
  if (typeof stream.transformToByteArray !== 'function') {
    throw new Error('r2_stream_unsupported');
  }
  return await stream.transformToByteArray();
}

/**
 * Upload one file into a Drive folder via the multipart endpoint. Returns
 * the new Drive file id. `mimeType` defaults to application/octet-stream
 * (the value the Photo Delivery worker has always used); the Drive-copy
 * layer passes real content types (image/jpeg, audio/mpeg, video/mp4, …)
 * so the couple's Drive shows proper previews.
 */
export async function uploadFileToDrive(input: {
  accessToken: string;
  folderId: string;
  fileName: string;
  body: Uint8Array;
  mimeType?: string;
}): Promise<string> {
  const mimeType = input.mimeType ?? 'application/octet-stream';
  const boundary = `setnayan-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const metadata = {
    name: input.fileName,
    parents: [input.folderId],
  };
  const encoder = new TextEncoder();
  const preamble = encoder.encode(
    `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`,
  );
  const closing = encoder.encode(`\r\n--${boundary}--`);

  const body = new Uint8Array(preamble.length + input.body.length + closing.length);
  body.set(preamble, 0);
  body.set(input.body, preamble.length);
  body.set(closing, preamble.length + input.body.length);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`drive_upload_${res.status}:${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error('drive_upload_no_id');
  return json.id;
}

/**
 * Create one folder inside `parentId` (or at Drive root when null) and
 * return its id. Mirrors the folder-create idiom in papic-drive.ts; the
 * Drive-copy layer uses it to lazily build the per-event root folder + the
 * per-artifact subfolders ("Papic", "Pakanta", …). `drive.file` scope
 * means we cannot search for an existing folder, so callers cache the
 * returned id (drive_copy_folders) and reuse it across copies.
 */
export async function createDriveFolder(input: {
  accessToken: string;
  name: string;
  parentId: string | null;
}): Promise<string> {
  const body: Record<string, unknown> = {
    name: input.name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (input.parentId) {
    body.parents = [input.parentId];
  }
  const res = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`drive_folder_create_${res.status}:${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error('drive_folder_create_no_id');
  return json.id;
}
