import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

export const PLATFORM_ASSETS_BUCKET = 'platform-assets';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/avif',
]);

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB

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

  // file.type can be empty if the browser couldn't detect (some older
  // Android browsers do this for HEIC). Fall back to extension sniffing.
  const declaredType = file.type || sniffMimeFromName(file.name);
  if (!declaredType || !ALLOWED_MIME.has(declaredType)) {
    return {
      ok: false,
      error: `Unsupported file type: ${file.type || 'unknown'}. Use PNG, JPEG, WebP, GIF, or HEIC.`,
    };
  }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `File is ${(file.size / 1024 / 1024).toFixed(1)} MB — max is 6 MB.`,
    };
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
    contentType: declaredType,
    cacheControl: '3600',
    upsert: false,
  });
  if (error) {
    console.error('[storage] upload failed', { bucket, path, error });
    return { ok: false, error: error.message };
  }

  const { data: pub } = admin.storage.from(bucket).getPublicUrl(path);
  return { ok: true, publicUrl: pub.publicUrl, path };
}

function sniffMimeFromName(name: string): string | null {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    case 'avif':
      return 'image/avif';
    default:
      return null;
  }
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
