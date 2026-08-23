'use client';

import { useMemo } from 'react';

import { FileUpload } from '@/app/_components/file-upload';

/**
 * Showcase media for a service card (service-card redesign · Phase 3c):
 * one short video (≤30s) + up to 5 photos. Persists to
 * vendor_services.showcase_video_r2_key / showcase_photo_r2_keys (migration
 * 20270502342558; the photos column has a cardinality ≤5 CHECK).
 *
 * primary_photo_r2_key stays the card COVER — this is the gallery + the clip.
 * Photos are watermarked (owner directive 2026-05-21: vendor marketplace
 * photos MUST carry the SETNAYAN watermark). The video is auto-compressed
 * in-browser (ffmpeg.wasm) to a streaming-friendly size before upload.
 */

const SHOWCASE_VIDEO_MAX_SECONDS = 30;

/**
 * Read a local video File's duration via a hidden <video> element (same
 * metadata pattern as the STD media picker's poster extractor). Resolves null
 * when the duration can't be read — the validator FAILS OPEN in that case so
 * a codec the browser can't probe still uploads (the cap is a UI guardrail,
 * not a security boundary).
 */
function readVideoDurationSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    let settled = false;
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const done = (d: number | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(d);
    };
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    video.onloadedmetadata = () => {
      const d = video.duration;
      done(Number.isFinite(d) && d > 0 ? d : null);
    };
    video.onerror = () => done(null);
    // Never hang the picker on a stuck decode.
    setTimeout(() => done(null), 8000);
  });
}

/**
 * Validate the picked clip AND hand its measured length back to the caller.
 *
 * ── WHY THE MEASUREMENT ESCAPES ─────────────────────────────────────────────
 * The duration was already being read here and thrown away, so the canvas's
 * card face could only say `▶ clip` — a placeholder standing in for a number
 * the browser had just computed. `report` lets a caller (the canvas) label the
 * pill with the real length.
 *
 * TWO RULES, both load-bearing:
 *   • CLEAR FIRST. Every call reports `null` before probing, so a REPLACEMENT
 *     clip whose duration cannot be read can never inherit the previous file's
 *     number. A stale duration on a different clip is a fabricated fact.
 *   • NEVER FABRICATE. An unprobeable codec reports `null` and the caller
 *     falls back to the placeholder. The validator still FAILS OPEN (the cap is
 *     a UI guardrail, not a security boundary) — and it must, because the
 *     `compressVideo` pass carries the real cap as an output trim.
 *
 * A rejected file also reports its duration: the picker shows the error and
 * keeps no file, so the caller's `hasClip` stays false and nothing renders it.
 */
function makeShowcaseVideoValidator(
  report?: (seconds: number | null) => void,
): (file: File) => Promise<string | null> {
  return async (file: File) => {
    report?.(null);
    const d = await readVideoDurationSeconds(file);
    report?.(d);
    // +0.9s tolerance: container metadata often rounds a true 30.0s clip up.
    if (d !== null && d > SHOWCASE_VIDEO_MAX_SECONDS + 0.9) {
      const secs = Math.round(d);
      return `That clip is ${secs}s — the showcase video caps at ${SHOWCASE_VIDEO_MAX_SECONDS} seconds. Trim it and try again.`;
    }
    return null;
  };
}

export function ShowcaseMediaFields({
  vendorProfileId,
  videoCurrent,
  photosCurrent,
  displayUrls,
  onClipDurationSeconds,
}: {
  vendorProfileId: string;
  /** Existing r2 refs when editing; null/empty on create. */
  videoCurrent?: string | null;
  photosCurrent?: string[];
  /** ref → presigned display URL map for edit-mode thumbnails. */
  displayUrls?: Record<string, string>;
  /**
   * The measured length of the clip the vendor just picked, in seconds, or
   * `null` when it could not be read. DELIBERATELY NOT A FORM FIELD: this is a
   * local measurement of a local file, not something the card posts, and the
   * canvas is one form whose input-name set is pinned against the wizard's
   * (lib/canvas-field-parity.test.ts). A callback keeps the number out of the
   * wire and off the server, which never had a use for it.
   *
   * NOT PERSISTED, on purpose. Storing it would mean a column with no reader —
   * the only surface that shows a clip pill is the canvas, which always has the
   * file in hand. Add the column when something asks for it, not before.
   */
  onClipDurationSeconds?: (seconds: number | null) => void;
}) {
  const validateVideo = useMemo(
    () => makeShowcaseVideoValidator(onClipDurationSeconds),
    [onClipDurationSeconds],
  );
  return (
    <div
      className="space-y-3 rounded-xl border p-3"
      style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}
    >
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
          Showcase media
        </p>
        <p className="text-xs" style={{ color: 'var(--m-slate-2)' }}>
          Show couples the real thing — a short clip and your best shots sell
          this card better than any description.
        </p>
      </div>
      <FileUpload
        bucket="media"
        pathPrefix={`vendors/${vendorProfileId}/services/showcase`}
        name="showcase_photo_r2_keys"
        multiple
        maxFiles={5}
        maxSizeMB={5}
        acceptedTypes={['image/png', 'image/jpeg', 'image/webp']}
        watermark
        compressImage
        qrGuard
        variant="wide"
        label="Photos (up to 5)"
        help="PNG, JPEG, or WebP up to 5 MB each. Your cover photo stays separate — these are the gallery."
        currentValue={photosCurrent && photosCurrent.length ? photosCurrent : null}
        initialDisplayUrls={displayUrls}
      />
      <FileUpload
        bucket="media"
        pathPrefix={`vendors/${vendorProfileId}/services/showcase`}
        name="showcase_video_r2_key"
        maxSizeMB={200}
        acceptedTypes={['video/mp4', 'video/quicktime', 'video/webm']}
        compressVideo
        maxVideoDurationS={SHOWCASE_VIDEO_MAX_SECONDS}
        validateFile={validateVideo}
        qrGuard
        variant="wide"
        label="Video (up to 30 seconds)"
        help="One short clip — booth in action, a real setup, the vibe. We compress it for smooth playback."
        currentValue={videoCurrent ?? null}
        initialDisplayUrls={displayUrls}
      />
    </div>
  );
}
