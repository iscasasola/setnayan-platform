import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export const PLATFORM_ASSETS_BUCKET = 'platform-assets';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export type UploadResult =
  | { ok: true; publicUrl: string; path: string }
  | { ok: false; error: string };

/**
 * Uploads a file to a public Supabase Storage bucket and returns the public
 * URL. Validates MIME type + size before sending. Server-only — uses the
 * service-role admin client.
 */
export async function uploadPublicAsset(args: {
  bucket?: string;
  pathPrefix: string;
  file: File;
}): Promise<UploadResult> {
  const { bucket = PLATFORM_ASSETS_BUCKET, pathPrefix, file } = args;

  if (!ALLOWED_MIME.has(file.type)) {
    return {
      ok: false,
      error: `Unsupported file type: ${file.type}. Use PNG, JPEG, WebP, or GIF.`,
    };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: 'File is larger than 5 MB.' };
  }

  // Random suffix prevents browser/CDN caching the previous image of the
  // same name when the merchant replaces their QR.
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
  const stamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const path = `${pathPrefix.replace(/^\/+|\/+$/g, '')}/${stamp}-${random}.${ext}`;

  const admin = createAdminClient();
  const arrayBuffer = await file.arrayBuffer();

  const { error } = await admin.storage.from(bucket).upload(path, arrayBuffer, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  const { data: pub } = admin.storage.from(bucket).getPublicUrl(path);
  return { ok: true, publicUrl: pub.publicUrl, path };
}

/**
 * Best-effort delete; we don't roll back the parent record if cleanup fails.
 */
export async function deletePublicAsset(args: {
  bucket?: string;
  publicUrl: string;
}): Promise<void> {
  const { bucket = PLATFORM_ASSETS_BUCKET, publicUrl } = args;
  const marker = `/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return;
  const path = publicUrl.slice(idx + marker.length);
  if (!path) return;

  const admin = createAdminClient();
  await admin.storage.from(bucket).remove([path]);
}
