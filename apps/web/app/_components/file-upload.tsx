'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  UploadCloud,
  X,
} from 'lucide-react';

/**
 * Reusable file-upload widget that targets Cloudflare R2 via the
 * `/api/upload` presigned-URL endpoint.
 *
 * Lifecycle for a single file:
 *   1. User picks a file (drag-drop or file picker).
 *   2. Component validates size + MIME type locally.
 *   3. Component POSTs to /api/upload to get a presigned PUT URL + r2Ref
 *      (the `r2://bucket/key` string we persist) + a 24h display URL.
 *   4. Component PUTs the file body to the presigned URL with progress.
 *   5. On success, emits the r2Ref(s) up to the parent via `onChange`.
 *
 * The widget renders a hidden `<input name=...>` mirroring the current
 * value so a plain `<form action={serverAction}>` reads it via FormData.
 * That keeps existing forms drop-in compatible: replace the URL `<input>`
 * with `<FileUpload name="logo_url" .../>` and the server action keeps
 * reading `formData.get('logo_url')` exactly as before.
 *
 * Mobile + desktop:
 *   - Drag-drop is desktop-only; tap-to-pick covers mobile.
 *   - Camera input is available via the `accept` attribute; on iOS Safari
 *     the file picker will offer Camera as a source automatically.
 */

export type FileUploadBucket =
  | 'media'
  | 'thread-files'
  | 'vendor-contracts'
  | 'samples'
  | 'vendor-verification';

export type FileUploadProps = {
  /** R2 bucket to write to. Maps to one of the four PH-region buckets. */
  bucket: FileUploadBucket;
  /**
   * Prefix under the bucket — interpolate `{vendorId}` / `{orderId}` etc.
   * before passing. The API route sanitizes leading slashes and `..` segments,
   * so it's safe to pass user-derived IDs.
   */
  pathPrefix: string;
  /** Allow multiple files. Defaults to single. */
  multiple?: boolean;
  /** Hard upper bound on number of files when `multiple` is true. */
  maxFiles?: number;
  /** Per-file size cap in megabytes. Defaults to 5 MB. */
  maxSizeMB?: number;
  /**
   * Accepted MIME types — used to filter the file picker and to bail out
   * client-side before the network round-trip.
   */
  acceptedTypes?: string[];
  /**
   * Hidden-input `name` so a parent `<form action={…}>` reads the current
   * value via FormData. For multi-file, multiple inputs are emitted.
   */
  name?: string;
  /** Existing value(s) to display on mount when editing an existing record. */
  currentValue?: string | string[] | null;
  /**
   * Optional map from `r2://…` ref → presigned display URL for rendering
   * thumbnails of pre-existing uploads. The parent server component resolves
   * these via `displayUrlForStoredAsset` before render. Legacy http(s) URLs
   * don't need an entry — the component falls back to using the value itself
   * as the display URL for those.
   */
  initialDisplayUrls?: Record<string, string>;
  /**
   * Called whenever the upload set changes. For single-file mode this is
   * the latest r2Ref (`r2://bucket/key`) or null on clear. For multi mode
   * it's an array of refs in insertion order.
   */
  onChange?: (value: string | string[] | null) => void;
  /** Optional label rendered above the dropzone. */
  label?: string;
  /** Optional help text shown under the dropzone. */
  help?: string;
  /** Disables uploads, used when the parent is reset/saving. */
  disabled?: boolean;
  /** Visual variant — `square` is good for logos, `wide` for evidence. */
  variant?: 'square' | 'wide';
  /**
   * Apply the SETNAYAN watermark to each uploaded image before sending it
   * to R2. Per owner directive 2026-05-21: all photos posted on the app
   * get auto-watermarked EXCEPT event photos. Vendor marketplace photos
   * MUST be watermarked. Non-image files (PDFs etc.) are passed through
   * untouched even when this is true.
   */
  watermark?: boolean;
};

const DEFAULT_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

type UploadedItem = {
  /** Local-only ID for React keys + cancellation. */
  id: string;
  /** The r2Ref string we'll persist (`r2://bucket/key`). */
  r2Ref: string;
  /** Presigned display URL (24h TTL) used for the preview thumbnail. */
  displayUrl: string;
  /** Original filename for accessible labelling. */
  filename: string;
  /** MIME type so we can render an icon for non-image refs (PDF). */
  contentType: string;
};

type InFlightItem = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  progress: number; // 0..100
  xhr: XMLHttpRequest | null;
};

function isImage(contentType: string): boolean {
  return contentType.startsWith('image/');
}

function bytesToHuman(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Best-effort filename inference from an r2Ref string. Used to label the
 * `currentValue` thumbnails on mount when we don't have a separate filename
 * stored. Falls back to "Existing file" if the suffix lookup fails.
 */
function filenameFromRef(value: string): string {
  if (value.startsWith('r2://')) {
    const rest = value.slice('r2://'.length);
    const slash = rest.indexOf('/');
    if (slash > 0) {
      const key = rest.slice(slash + 1);
      const baseName = key.split('/').pop() ?? '';
      // Object keys are `${prefix}/${uuid}-${origname}`. Strip the UUID
      // prefix when present.
      const dashIdx = baseName.indexOf('-');
      if (
        dashIdx === 36 &&
        /^[0-9a-fA-F-]{36}$/.test(baseName.slice(0, 36))
      ) {
        return baseName.slice(37) || 'Existing file';
      }
      return baseName || 'Existing file';
    }
  }
  try {
    const url = new URL(value);
    return url.pathname.split('/').pop() || 'Existing file';
  } catch {
    return 'Existing file';
  }
}

function contentTypeFromRef(value: string): string {
  const lower = value.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  if (lower.endsWith('.avif')) return 'image/avif';
  // Default to JPEG — most legacy logos are JPEG/PNG; misclassifying lets
  // the thumbnail still render through the <img> tag.
  return 'image/jpeg';
}

export function FileUpload({
  bucket,
  pathPrefix,
  multiple = false,
  maxFiles,
  maxSizeMB = 5,
  acceptedTypes = DEFAULT_TYPES,
  name,
  currentValue,
  initialDisplayUrls,
  onChange,
  label,
  help,
  disabled = false,
  variant = 'square',
  watermark = false,
}: FileUploadProps) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [items, setItems] = useState<UploadedItem[]>([]);
  const [inFlight, setInFlight] = useState<InFlightItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  // We need to seed `items` from `currentValue` on mount AND any time
  // `currentValue` changes (e.g. server re-renders with new defaults after
  // the parent form submits). The seed only fills slots not already
  // represented in `items` — uploads added in this session win.
  useEffect(() => {
    if (!currentValue) return;
    const initial = (
      Array.isArray(currentValue) ? currentValue : [currentValue]
    )
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
      .map(
        (v): UploadedItem => ({
          id: `seed-${v}`,
          r2Ref: v,
          // Legacy http(s) values are their own display URL. For r2:// refs
          // we rely on the parent's resolved map; absent a hit, the
          // thumbnail falls back to the file-icon placeholder which still
          // makes the row useful (filename + remove button).
          displayUrl:
            initialDisplayUrls?.[v] ?? (v.startsWith('r2://') ? '' : v),
          filename: filenameFromRef(v),
          contentType: contentTypeFromRef(v),
        }),
      );
    if (initial.length > 0) {
      setItems((prev) => (prev.length === 0 ? initial : prev));
    }
    // currentValue is intentionally not in the dep array beyond the first
    // pass — we don't want a parent re-render to wipe in-session uploads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Abort any in-flight XHRs so a router navigation doesn't leave a
      // half-finished PUT pinging in the background.
      for (const item of inFlight) {
        if (item.xhr) item.xhr.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const acceptAttr = useMemo(() => acceptedTypes.join(','), [acceptedTypes]);
  const maxBytes = maxSizeMB * 1024 * 1024;
  const effectiveMaxFiles = multiple ? (maxFiles ?? 10) : 1;

  // Memoize the emit so we don't blast the parent with onChange calls on
  // every progress tick — we only emit when `items` (the persisted set)
  // changes.
  const emitChange = useCallback(
    (next: UploadedItem[]) => {
      if (!onChange) return;
      if (multiple) {
        onChange(next.map((i) => i.r2Ref));
      } else {
        onChange(next[0]?.r2Ref ?? null);
      }
    },
    [multiple, onChange],
  );

  const handleFiles = useCallback(
    async (selected: FileList | File[]) => {
      if (disabled) return;
      const files = Array.from(selected);
      if (files.length === 0) return;
      setError(null);

      const currentCount = items.length + inFlight.length;
      const slotsLeft = Math.max(0, effectiveMaxFiles - currentCount);
      if (slotsLeft === 0) {
        setError(
          multiple
            ? `Already at the ${effectiveMaxFiles}-file limit. Remove a file to add a new one.`
            : 'Already have one file. Remove it to replace.',
        );
        return;
      }
      const toUpload = files.slice(0, slotsLeft);
      if (toUpload.length < files.length) {
        setError(
          `Only the first ${toUpload.length} file${toUpload.length === 1 ? '' : 's'} will upload — limit is ${effectiveMaxFiles}.`,
        );
      }

      for (const file of toUpload) {
        // Client-side validation. The server runs this same set in the
        // presign route — this is for fast feedback.
        if (file.size > maxBytes) {
          setError(
            `${file.name} is ${bytesToHuman(file.size)} — max ${maxSizeMB} MB.`,
          );
          continue;
        }
        if (file.type && !acceptedTypes.includes(file.type)) {
          setError(
            `${file.name} is ${file.type || 'an unknown type'} — allowed: ${acceptedTypes.join(', ')}.`,
          );
          continue;
        }

        await uploadOne(file);
      }

      // Reset the underlying input so picking the same file twice still
      // triggers a change event.
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      acceptedTypes,
      disabled,
      effectiveMaxFiles,
      inFlight.length,
      items,
      maxBytes,
      maxSizeMB,
      multiple,
    ],
  );

  /**
   * Single-file upload pipeline:
   *   1. Ask /api/upload for a presigned URL.
   *   2. PUT the bytes via XHR (XHR rather than fetch for upload.onprogress).
   *   3. On success, move the item from `inFlight` into `items` and emit
   *      `onChange` with the full set.
   *
   * Errors at any step roll back the inFlight entry and surface the message
   * via the `error` state.
   */
  async function uploadOne(rawFile: File) {
    const id = `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const initialContentType =
      rawFile.type || (rawFile.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');

    // --- Step 0: watermark (if opted in and the file is an image) ---------
    // Done client-side before presign so the signed `content-length` matches
    // the actual PUT body. Non-image files (PDFs etc.) skip this step.
    let file = rawFile;
    if (watermark && isImage(initialContentType)) {
      try {
        const { watermarkFile } = await import('@/lib/watermark');
        file = await watermarkFile(rawFile, { position: 'bottom-right', opacity: 0.55 });
      } catch (err) {
        // Best-effort: if watermarking fails, fall back to the original file.
        // We don't block uploads on a watermark failure — it's a deterrent,
        // not a security guarantee, and the user shouldn't be stuck.
        console.warn('watermark failed; uploading original', err);
        file = rawFile;
      }
    }
    const contentType = file.type || initialContentType;

    setInFlight((prev) => [
      ...prev,
      {
        id,
        filename: file.name,
        contentType,
        size: file.size,
        progress: 0,
        xhr: null,
      },
    ]);

    // --- Step 1: presign --------------------------------------------------
    let presign: {
      uploadUrl: string;
      r2Ref: string;
      displayUrl: string;
    };
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket,
          pathPrefix,
          filename: file.name,
          contentType,
          sizeBytes: file.size,
        }),
      });
      const data = (await res.json()) as
        | { uploadUrl: string; r2Ref: string; displayUrl: string }
        | { error: string };
      if (!res.ok || 'error' in data) {
        const msg = 'error' in data ? data.error : `Presign failed (${res.status})`;
        if (isMountedRef.current) {
          setError(msg);
          setInFlight((prev) => prev.filter((i) => i.id !== id));
        }
        return;
      }
      presign = data;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Network error.');
        setInFlight((prev) => prev.filter((i) => i.id !== id));
      }
      return;
    }

    // --- Step 2: PUT to R2 via XHR ---------------------------------------
    const xhr = new XMLHttpRequest();
    setInFlight((prev) =>
      prev.map((i) => (i.id === id ? { ...i, xhr } : i)),
    );

    xhr.upload.addEventListener('progress', (evt) => {
      if (!evt.lengthComputable) return;
      const pct = Math.round((evt.loaded / evt.total) * 100);
      setInFlight((prev) =>
        prev.map((i) => (i.id === id ? { ...i, progress: pct } : i)),
      );
    });

    xhr.addEventListener('error', () => {
      if (!isMountedRef.current) return;
      setError(`Upload failed for ${file.name}. Check your connection and retry.`);
      setInFlight((prev) => prev.filter((i) => i.id !== id));
    });

    xhr.addEventListener('abort', () => {
      if (!isMountedRef.current) return;
      setInFlight((prev) => prev.filter((i) => i.id !== id));
    });

    xhr.addEventListener('load', () => {
      if (!isMountedRef.current) return;
      // R2 returns 200 OR 201 on success — anything 2xx is a win.
      if (xhr.status >= 200 && xhr.status < 300) {
        const completed: UploadedItem = {
          id,
          r2Ref: presign.r2Ref,
          displayUrl: presign.displayUrl,
          filename: file.name,
          contentType,
        };
        setItems((prev) => {
          const next = multiple ? [...prev, completed] : [completed];
          emitChange(next);
          return next;
        });
        setInFlight((prev) => prev.filter((i) => i.id !== id));
      } else {
        setError(
          `R2 rejected ${file.name} (status ${xhr.status}). Try a different file or contact support.`,
        );
        setInFlight((prev) => prev.filter((i) => i.id !== id));
      }
    });

    xhr.open('PUT', presign.uploadUrl, true);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.send(file);
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      emitChange(next);
      return next;
    });
  }

  function cancelInFlight(id: string) {
    setInFlight((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.xhr) target.xhr.abort();
      return prev.filter((i) => i.id !== id);
    });
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) void handleFiles(e.target.files);
  }

  function onDrop(e: React.DragEvent<HTMLElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files) void handleFiles(e.dataTransfer.files);
  }

  function onDragOver(e: React.DragEvent<HTMLElement>) {
    e.preventDefault();
    if (!isDragging) setIsDragging(true);
  }

  function onDragLeave(e: React.DragEvent<HTMLElement>) {
    e.preventDefault();
    if (e.currentTarget === e.target) setIsDragging(false);
  }

  const dropzoneHeight = variant === 'square' ? 'min-h-[160px]' : 'min-h-[120px]';
  const atCapacity = items.length + inFlight.length >= effectiveMaxFiles;

  return (
    <div className="space-y-2">
      {label ? (
        <span className="block text-sm font-medium text-ink">{label}</span>
      ) : null}

      {/* Hidden inputs to mirror current value into the parent form's FormData. */}
      {name
        ? (multiple ? items.map((i) => i.r2Ref) : items[0] ? [items[0].r2Ref] : []).map(
            (val, idx) => (
              <input
                key={`hidden-${idx}-${val}`}
                type="hidden"
                name={name}
                value={val}
              />
            ),
          )
        : null}

      {!atCapacity ? (
        <label
          htmlFor={inputId}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className={`flex ${dropzoneHeight} w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-cream px-4 py-6 text-center transition-colors ${
            disabled
              ? 'cursor-not-allowed opacity-60'
              : isDragging
                ? 'border-terracotta bg-terracotta/5'
                : 'border-ink/20 hover:border-terracotta/60 hover:bg-terracotta/[0.03]'
          }`}
        >
          <UploadCloud
            aria-hidden
            className={`h-8 w-8 ${isDragging ? 'text-terracotta' : 'text-ink/45'}`}
            strokeWidth={1.5}
          />
          <span className="text-sm font-medium text-ink/75">
            {isDragging
              ? 'Drop to upload'
              : multiple
                ? 'Drop files or click to choose'
                : 'Drop a file or click to choose'}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            {acceptedTypes
              .map((t) => t.replace('image/', '').replace('application/', '').toUpperCase())
              .join(' · ')}{' '}
            · up to {maxSizeMB} MB
            {multiple ? ` · max ${effectiveMaxFiles}` : ''}
          </span>
          <input
            ref={fileInputRef}
            id={inputId}
            type="file"
            accept={acceptAttr}
            multiple={multiple}
            disabled={disabled}
            onChange={onInputChange}
            className="sr-only"
          />
        </label>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-1.5 rounded-md border border-terracotta/30 bg-terracotta/10 px-3 py-2 text-xs text-terracotta-700"
        >
          <AlertCircle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          <span>{error}</span>
        </p>
      ) : null}

      {(items.length > 0 || inFlight.length > 0) && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-ink/10 bg-cream p-3"
            >
              <Thumbnail
                displayUrl={item.displayUrl}
                contentType={item.contentType}
                alt={item.filename}
              />
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="truncate text-sm font-medium text-ink">
                  {item.filename}
                </p>
                <p className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-700">
                  <CheckCircle2 aria-hidden className="h-3 w-3" strokeWidth={2} />
                  Uploaded
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="rounded-md p-1 text-ink/55 transition-colors hover:bg-ink/5 hover:text-rose-700"
                aria-label={`Remove ${item.filename}`}
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </li>
          ))}
          {inFlight.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-xl border border-ink/10 bg-cream p-3"
            >
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-terracotta/10 text-terracotta">
                <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-medium text-ink">
                  {item.filename}
                </p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
                  <span
                    className="block h-full rounded-full bg-terracotta transition-all"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  {item.progress}% · {bytesToHuman(item.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => cancelInFlight(item.id)}
                className="rounded-md p-1 text-ink/55 transition-colors hover:bg-ink/5 hover:text-rose-700"
                aria-label={`Cancel ${item.filename}`}
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {help ? <p className="block text-xs text-ink/55">{help}</p> : null}
    </div>
  );
}

function Thumbnail({
  displayUrl,
  contentType,
  alt,
}: {
  displayUrl: string;
  contentType: string;
  alt: string;
}) {
  if (isImage(contentType) && displayUrl) {
    return (
      <span className="inline-flex h-12 w-12 shrink-0 overflow-hidden rounded-md border border-ink/10 bg-cream">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={displayUrl}
          alt={alt}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }
  return (
    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-ink/[0.06] text-ink/55">
      <FileText className="h-5 w-5" strokeWidth={1.75} />
    </span>
  );
}
