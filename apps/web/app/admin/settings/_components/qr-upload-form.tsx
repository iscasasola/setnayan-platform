'use client';

import { useRef, useState, useTransition } from 'react';
import { Loader2, Upload } from 'lucide-react';
import jsQR from 'jsqr';
import { uploadMerchantQr } from '../actions';

// Square edge length we down-scale the cropped QR to before upload.
const TARGET_SIZE = 512;
// Extra padding around the QR bounding square, as a fraction of the QR side.
// 12% gives the scanner a comfortable quiet zone in the rendered preview.
const PADDING_RATIO = 0.12;

type ProcessStatus =
  | { kind: 'idle' }
  | { kind: 'processing' }
  | { kind: 'detected' }
  | { kind: 'fallback-center' }
  | { kind: 'raw-passthrough'; reason: string }
  | { kind: 'error'; message: string };

export function QrUploadForm({
  kind,
  replace,
}: {
  kind: 'bdo' | 'gcash';
  replace: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<ProcessStatus>({ kind: 'idle' });
  // Holds whatever we'll actually upload: either the cropped 512×512 PNG, or
  // the unmodified original (when the browser couldn't decode the source). We
  // bypass the `<input>`'s own .files entirely so we don't have to worry about
  // DataTransfer quirks across browsers.
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleFile(source: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFileToUpload(null);
    setStatus({ kind: 'processing' });

    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(source);
    } catch {
      // Browser couldn't decode the source (HEIC on Chrome/Firefox, corrupt
      // file, etc.). Pass the original through so the server still gets it.
      setFileToUpload(source);
      setStatus({
        kind: 'raw-passthrough',
        reason:
          "Your browser couldn't preview this image format — we'll upload it as-is and the server will store it untouched.",
      });
      return;
    }

    try {
      const src = document.createElement('canvas');
      src.width = bitmap.width;
      src.height = bitmap.height;
      const srcCtx = src.getContext('2d');
      if (!srcCtx) throw new Error('Canvas 2D not available in this browser');
      srcCtx.drawImage(bitmap, 0, 0);
      const data = srcCtx.getImageData(0, 0, bitmap.width, bitmap.height);

      const code = jsQR(data.data, data.width, data.height, {
        inversionAttempts: 'attemptBoth',
      });

      let cropX: number;
      let cropY: number;
      let cropSize: number;
      let nextStatus: 'detected' | 'fallback-center';

      if (code) {
        const corners = [
          code.location.topLeftCorner,
          code.location.topRightCorner,
          code.location.bottomLeftCorner,
          code.location.bottomRightCorner,
        ];
        const xs = corners.map((c) => c.x);
        const ys = corners.map((c) => c.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const qrSide = Math.max(maxX - minX, maxY - minY);
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const padded = qrSide * (1 + PADDING_RATIO * 2);
        // Shrink the padded square if it would overflow the image — keeps the
        // crop centered on the QR without bleeding off the edge.
        const halfMax = Math.min(cx, cy, bitmap.width - cx, bitmap.height - cy);
        cropSize = Math.min(padded, halfMax * 2);
        cropX = cx - cropSize / 2;
        cropY = cy - cropSize / 2;
        nextStatus = 'detected';
      } else {
        cropSize = Math.min(bitmap.width, bitmap.height);
        cropX = (bitmap.width - cropSize) / 2;
        cropY = (bitmap.height - cropSize) / 2;
        nextStatus = 'fallback-center';
      }

      const out = document.createElement('canvas');
      out.width = TARGET_SIZE;
      out.height = TARGET_SIZE;
      const outCtx = out.getContext('2d');
      if (!outCtx) throw new Error('Canvas 2D not available in this browser');
      // White background so transparent source PNGs still render a clean square.
      outCtx.fillStyle = '#ffffff';
      outCtx.fillRect(0, 0, TARGET_SIZE, TARGET_SIZE);
      outCtx.imageSmoothingEnabled = true;
      outCtx.imageSmoothingQuality = 'high';
      outCtx.drawImage(
        bitmap,
        cropX,
        cropY,
        cropSize,
        cropSize,
        0,
        0,
        TARGET_SIZE,
        TARGET_SIZE,
      );
      bitmap.close?.();

      const blob = await new Promise<Blob | null>((resolve) =>
        out.toBlob(resolve, 'image/png'),
      );
      if (!blob) throw new Error('Failed to encode the cropped image');

      const cropped = new File([blob], `qr-${kind}.png`, { type: 'image/png' });
      setFileToUpload(cropped);
      setPreviewUrl(URL.createObjectURL(blob));
      setStatus({ kind: nextStatus });
    } catch (err) {
      bitmap.close?.();
      setStatus({
        kind: 'error',
        message:
          err instanceof Error ? err.message : 'Failed to process the image',
      });
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    void handleFile(f);
  }

  function clear() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFileToUpload(null);
    setStatus({ kind: 'idle' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!fileToUpload) return;
    const formData = new FormData();
    formData.set('kind', kind);
    formData.set('file', fileToUpload);
    startTransition(async () => {
      // Server action will redirect on success — that propagates through the
      // transition and lands us back on the page with the `qr_uploaded=1` flag.
      await uploadMerchantQr(formData);
    });
  }

  const submitDisabled =
    !fileToUpload || isPending || status.kind === 'processing';

  return (
    <form
      onSubmit={onSubmit}
      encType="multipart/form-data"
      className="flex flex-col gap-3 border-t border-ink/10 pt-3"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif"
        required
        onChange={onFileChange}
        className="block w-full cursor-pointer rounded-md border border-ink/15 bg-cream p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-terracotta/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-terracotta-700 hover:file:bg-terracotta/15"
      />

      {status.kind === 'processing' ? (
        <p className="rounded-md border border-ink/15 bg-cream p-3 text-xs text-ink/65">
          Looking for the QR code…
        </p>
      ) : null}

      {previewUrl ? (
        <div className="flex flex-wrap items-start gap-4 rounded-md border border-ink/10 bg-cream p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Cropped preview"
            className="h-32 w-32 rounded-md border border-ink/15 bg-white object-contain"
          />
          <div className="flex-1 space-y-1 text-xs text-ink/70">
            {status.kind === 'detected' ? (
              <p className="font-medium text-emerald-700">
                QR detected — cropped to a 512×512 square with a quiet-zone margin.
              </p>
            ) : null}
            {status.kind === 'fallback-center' ? (
              <p className="font-medium text-amber-700">
                Couldn&rsquo;t auto-detect a QR. Using a centered square crop —
                review the preview before uploading.
              </p>
            ) : null}
            <p>
              Press <strong>{replace ? 'Replace' : 'Upload'}</strong> to save, or{' '}
              <button
                type="button"
                onClick={clear}
                className="text-ink/55 underline underline-offset-2 hover:text-ink/80"
              >
                clear
              </button>{' '}
              to pick another file.
            </p>
          </div>
        </div>
      ) : null}

      {status.kind === 'raw-passthrough' ? (
        <p className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-800">
          {status.reason}
        </p>
      ) : null}

      {status.kind === 'error' ? (
        <p className="rounded-md border border-terracotta/30 bg-terracotta/10 p-3 text-xs text-terracotta-700">
          {status.message}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitDisabled}
          aria-busy={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-terracotta px-4 py-2 text-sm font-medium text-cream hover:bg-terracotta-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              Uploading…
            </>
          ) : (
            <>
              <Upload aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              {replace ? 'Replace' : 'Upload'}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
