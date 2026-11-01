/**
 * THE ONE WAY A CHAT FILE LEAVES THE PHONE — compressed, then judged, then sent.
 *
 * Owner, 2026-10-28, verbatim: *"alway compress files when sending on chat.
 * never keep original size"*. So:
 *
 *   • a PHOTO always goes through the shipped `compressImageForWeb` (the same
 *     one `FileUpload` uses). GIF is the one exception — drawing it to a canvas
 *     keeps a single frame, so there is no compressor for it that keeps it a GIF.
 *   • a VIDEO always goes through the shipped `compressVideoForWeb`, profile
 *     `web720` (the owner's storage-minimal, still-watchable copy, which NEVER
 *     skips a small clip). If this phone cannot run the encoder, the video is
 *     REFUSED — the original is never sent.
 *   • a PDF / Word / Excel / text file has NO compressor in this app, and it is
 *     evidence that must arrive byte-for-byte, so it goes as it is (≤ 20 MB).
 *
 * The limits (`lib/chat-file-rules.ts`) are judged on the COMPRESSED file, here
 * and again by the server on what actually landed.
 *
 * 🔒 THERE IS NO "SEND ORIGINAL" OPTION AND NO RAW-FILE BRANCH. The send helper
 * below takes only a {@link PreparedChatFile}, and the only function that makes
 * one is {@link prepareChatFile}. `lib/chat-file-prepare.test.ts` runs every
 * kind through it with stand-in compressors and fails if any photo or video
 * comes out as the File that went in.
 *
 * Client-only in practice (canvas / ffmpeg.wasm / fetch), but it imports no
 * React and no server module, so a node test can run it with injected
 * compressors. C1's composer calls it; nothing here draws a pixel.
 */

import {
  CHAT_ATTACHMENT_MIME,
  chatAttachmentLimit,
  isCompressibleImage,
} from '@/lib/chat-attachment-limits';
import {
  CHAT_FILE_TYPE_REFUSAL,
  CHAT_FILE_UPLOAD_FAILED,
  chatFileKind,
  chatFileOwnFolder,
  chatFileRefusal,
  type ChatFileKind,
} from '@/lib/chat-file-rules';

/** When this phone could not shrink a video, it is not sent at its original size. */
export const CHAT_VIDEO_NOT_COMPRESSED =
  'This phone couldn’t shrink that video. Send a Drive or YouTube link instead.';

const PREPARED: unique symbol = Symbol('chat-file-prepared');

/** A chat file that went through {@link prepareChatFile}. Nothing else can build one. */
export type PreparedChatFile = {
  readonly file: File;
  readonly kind: ChatFileKind;
  readonly [PREPARED]: true;
};

export type ChatFileCompressors = {
  image: (file: File) => Promise<File>;
  video: (
    file: File,
    opts: { profile: 'web720'; onProgress?: (p: { ratio: number }) => void; signal?: AbortSignal },
  ) => Promise<File>;
};

/** The shipped compressors, loaded only when a file is actually sent. */
async function shippedCompressors(): Promise<ChatFileCompressors> {
  const [{ compressImageForWeb }, { compressVideoForWeb }] = await Promise.all([
    import('@/lib/image-compress'),
    import('@/lib/video-compress'),
  ]);
  return {
    image: (f) => compressImageForWeb(f),
    video: (f, o) => compressVideoForWeb(f, o),
  };
}

export type PrepareChatFileResult =
  | { ok: true; prepared: PreparedChatFile }
  | { ok: false; message: string };

export async function prepareChatFile(
  file: File,
  opts: {
    onProgress?: (ratio: number) => void;
    signal?: AbortSignal;
    /** Tests only — the browser uses the shipped compressors. */
    compressors?: ChatFileCompressors;
  } = {},
): Promise<PrepareChatFileResult> {
  const mime = (file.type || '').toLowerCase();
  if (!(CHAT_ATTACHMENT_MIME as readonly string[]).includes(mime)) {
    return { ok: false, message: CHAT_FILE_TYPE_REFUSAL };
  }
  // A guard on the phone, before it tries to decode something enormous.
  const source = chatAttachmentLimit(mime);
  if (file.size > source.maxBytes) return { ok: false, message: source.tooLargeMessage };

  const kind = chatFileKind(mime);
  let out: File = file;
  if (kind === 'photo' && isCompressibleImage(mime)) {
    const c = opts.compressors ?? (await shippedCompressors());
    out = await c.image(file);
  } else if (kind === 'video') {
    const c = opts.compressors ?? (await shippedCompressors());
    out = await c.video(file, {
      profile: 'web720',
      onProgress: opts.onProgress ? (p) => opts.onProgress?.(p.ratio) : undefined,
      signal: opts.signal,
    });
    // The encoder hands back the very same File when it could not run. Never
    // keep the original size — refuse instead.
    if (out === file) return { ok: false, message: CHAT_VIDEO_NOT_COMPRESSED };
  }

  const refusal = chatFileRefusal(out.type || mime, out.size);
  if (refusal) return { ok: false, message: refusal };
  return { ok: true, prepared: { file: out, kind, [PREPARED]: true } };
}

/** Is this a value {@link prepareChatFile} produced? */
export function isPreparedChatFile(v: unknown): v is PreparedChatFile {
  return typeof v === 'object' && v !== null && (v as Record<symbol, unknown>)[PREPARED] === true;
}

export type UploadChatFileResult =
  | { ok: true; ref: string; name: string }
  | { ok: false; message: string };

/**
 * PUT a prepared file straight to R2 (`/api/upload` → presigned PUT), into the
 * sender's own folder. Returns the ref + name the send action takes as
 * `attachment_ref` / `attachment_ref_name`. Refuses anything that is not a
 * {@link PreparedChatFile} — there is no way to hand it the raw File.
 */
export async function uploadPreparedChatFile(args: {
  threadId: string;
  userId: string;
  prepared: PreparedChatFile;
  fetchImpl?: typeof fetch;
}): Promise<UploadChatFileResult> {
  if (!isPreparedChatFile(args.prepared)) return { ok: false, message: CHAT_FILE_UPLOAD_FAILED };
  const f = args.fetchImpl ?? fetch;
  const file = args.prepared.file;
  const contentType = file.type || 'application/octet-stream';
  try {
    const res = await f('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bucket: 'thread-files',
        pathPrefix: chatFileOwnFolder(args.threadId, args.userId).replace(/\/$/, ''),
        filename: file.name,
        contentType,
        sizeBytes: file.size,
      }),
    });
    const j = (await res.json().catch(() => ({}))) as {
      error?: string;
      uploadUrl?: string;
      r2Ref?: string;
    };
    if (!res.ok || !j.uploadUrl || !j.r2Ref) {
      return { ok: false, message: j.error || CHAT_FILE_UPLOAD_FAILED };
    }
    const put = await f(j.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
    if (!put.ok) return { ok: false, message: CHAT_FILE_UPLOAD_FAILED };
    return { ok: true, ref: j.r2Ref, name: file.name };
  } catch {
    return { ok: false, message: CHAT_FILE_UPLOAD_FAILED };
  }
}
