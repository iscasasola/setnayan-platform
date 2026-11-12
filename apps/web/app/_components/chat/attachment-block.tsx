'use client';

/**
 * # A FILE ON A CHAT MESSAGE — the one renderer, in a bubble and in a decision.
 *
 * Moved out of `chat-message-stream.tsx` (owner 12 Nov 2026: *"can we add media files in a decision?"*) so the opened
 * decision (`decision-panel.tsx`) draws a filed photo, video or file with the SAME component the conversation does,
 * never a second renderer.
 *
 * - `variant="bubble"` (the stream): an image is a lazy thumbnail linking to the full file; anything else a compact file
 *   chip with name, size and an open/download link. Unchanged from the stream's own copy.
 * - `variant="filed"` (a decision): ONE row for every kind — a small tile (the photo itself · a ▶ play tile for a video ·
 *   a file icon) beside its name and "Photo · 1.2 MB". Before this, a caption-less photo filed under a decision drew a
 *   blank row ("A message you can't see here"), the failure that renders like emptiness.
 *
 * 🔒 `url` is ALWAYS `/api/chat/attachment/<message_id>` (the stream) or `chatAttachmentHref` (a decision) — the route
 * that re-proves the viewer is in the thread on every request. Never a stored `attachment_url`.
 *
 * 👆 `gate` — the stream's double-tap (lib/chat-double-tap.ts `attachmentTap`). It sees the tap before the link does;
 * when it takes the tap it hands back `open`, which follows the link exactly as a tap would (OpenFileLink's in-app sheet
 * on the phone app, the anchor's own target on the web) — or never, if the second tap opened the filing picker.
 */
import { useRef } from 'react';
import { FileText, Image as ImageIcon, Play, Share } from 'lucide-react';

import { OpenFileLink } from '@/app/_components/open-file-link';
import { formatCount } from '@/lib/format-number';

export function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${formatCount(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${formatCount(kb, kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  return `${formatCount(mb, mb < 10 ? 1 : 0)} MB`;
}

export type AttachmentKind = 'image' | 'video' | 'file';

export function attachmentKind(mime: string | null | undefined): AttachmentKind {
  const m = (mime ?? '').toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  return 'file';
}

/** "Photo" · "Video" · "PDF" · "DOCX" · "File" — what a person calls it. */
export function attachmentTypeLabel(mime: string | null | undefined, name: string | null | undefined): string {
  const kind = attachmentKind(mime);
  if (kind === 'image') return 'Photo';
  if (kind === 'video') return 'Video';
  if ((mime ?? '').toLowerCase() === 'application/pdf') return 'PDF';
  const ext = (name ?? '').match(/\.([a-z0-9]{1,5})$/i)?.[1];
  return ext ? ext.toUpperCase() : 'File';
}

/** A tap the stream's double-tap rule may hold: `true` = it took the tap (and calls `open` later, or not at all). */
export type AttachmentGate = (open: () => void) => boolean;

export function AttachmentBlock({
  url,
  name,
  mime,
  sizeBytes,
  owns,
  hasBody,
  variant = 'bubble',
  gate,
}: {
  url: string;
  name: string | null;
  mime: string | null;
  sizeBytes: number | null;
  owns: boolean;
  hasBody: boolean;
  variant?: 'bubble' | 'filed';
  gate?: AttachmentGate;
}) {
  const kind = attachmentKind(mime);
  const label = name?.trim() || (kind === 'image' ? 'Image' : kind === 'video' ? 'Video' : 'Attachment');
  const size = formatBytes(sizeBytes);
  // The one tap that `open` replays must pass the gate untouched.
  const replaying = useRef(false);

  let block: React.ReactNode;
  if (variant === 'filed') {
    block = (
      <OpenFileLink
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        download={kind === 'file' ? name ?? undefined : undefined}
        aria-label={`Open ${label}`}
        className={`flex min-h-11 items-center gap-3 rounded-xl bg-ink/[0.06] p-1.5 pr-3 text-ink ${hasBody ? 'mt-2' : ''}`}
        data-filed-attachment={kind}
      >
        <span
          aria-hidden
          className={`relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg ${
            kind === 'video' ? 'bg-ink/80 text-white' : 'bg-ink/[0.08] text-ink/60'
          }`}
        >
          {kind === 'image' ? (
            <>
              <ImageIcon className="h-6 w-6" strokeWidth={1.75} />
              {/* eslint-disable-next-line @next/next/no-img-element -- a private chat file behind the attachment route; next/image cannot proxy it */}
              <img
                src={url}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
                // A thumbnail that cannot load leaves the photo icon showing — never a broken-image glyph.
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </>
          ) : kind === 'video' ? (
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-ink">
              <Play className="ml-0.5 h-4 w-4" fill="currentColor" strokeWidth={1.75} />
            </span>
          ) : (
            <FileText className="h-6 w-6" strokeWidth={1.75} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{label}</span>
          <span className="block text-[12px] text-ink/60">
            {attachmentTypeLabel(mime, name)}
            {size ? ` · ${size}` : ''}
          </span>
        </span>
      </OpenFileLink>
    );
  } else if (kind === 'image') {
    block = (
      <OpenFileLink
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`block overflow-hidden rounded-xl ${hasBody ? 'mt-2' : ''}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded R2 asset; next/image needs a configured loader/domain for arbitrary R2 hosts */}
        <img src={url} alt={label} loading="lazy" className="max-h-64 max-w-full rounded-xl object-cover" />
      </OpenFileLink>
    );
  } else {
    block = (
      <OpenFileLink
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        download={name ?? undefined}
        className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${hasBody ? 'mt-2' : ''} ${
          owns ? 'bg-cream/20 text-cream hover:bg-cream/30' : 'bg-ink/[0.06] text-ink hover:bg-ink/10'
        }`}
      >
        <FileText className="h-5 w-5 shrink-0 opacity-80" strokeWidth={1.75} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{label}</span>
          {size ? <span className={`block text-[11px] ${owns ? 'text-cream/70' : 'text-ink/55'}`}>{size}</span> : null}
        </span>
        <Share aria-hidden className="h-4 w-4 shrink-0 opacity-70" strokeWidth={1.75} />
      </OpenFileLink>
    );
  }

  if (!gate) return block;
  return (
    <span
      className="block"
      data-attachment-gate=""
      onClickCapture={(e) => {
        if (replaying.current) {
          replaying.current = false;
          return;
        }
        const link = (e.target as Element).closest('a');
        if (!link) return;
        const took = gate(() => {
          replaying.current = true;
          link.click();
        });
        if (took) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      {block}
    </span>
  );
}
