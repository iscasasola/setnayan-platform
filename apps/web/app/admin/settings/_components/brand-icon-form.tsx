'use client';

/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from 'react';
import { ImageUp } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { uploadBrandIcon } from '../actions';

/**
 * Brand-icon uploader with a live favicon + logo preview (owner 2026-06-10).
 *
 * The picked file is previewed client-side at the exact sizes it'll appear —
 * 16/32 px browser-tab favicons and a ~48 px in-app logo — so the admin sees
 * what they'll get before committing. The actual derivation (multi-size .ico,
 * opaque apple-touch tile, 512 PNG, SVG passthrough) happens server-side in
 * the uploadBrandIcon action, which redirects back with ?brand_icon=1.
 */
export function BrandIconUploadForm({ replace }: { replace: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (preview) URL.revokeObjectURL(preview);
    if (!f) {
      setPreview(null);
      setFileName(null);
      return;
    }
    setPreview(URL.createObjectURL(f));
    setFileName(f.name);
  }

  return (
    <form
      action={uploadBrandIcon}
      encType="multipart/form-data"
      className="flex flex-col gap-3"
    >
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        required
        onChange={onChange}
        className="block w-full cursor-pointer rounded-md border border-ink/15 bg-cream p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-terracotta/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-terracotta-700 hover:file:bg-terracotta/15"
      />

      {preview ? (
        <div className="flex flex-wrap items-end gap-5 rounded-md border border-ink/10 bg-cream p-4">
          {/* Tab favicon previews (16 + 32) on a neutral tab-bar swatch. */}
          <PreviewSwatch label="Tab · 16px">
            <img src={preview} alt="" width={16} height={16} className="block" />
          </PreviewSwatch>
          <PreviewSwatch label="Tab · 32px">
            <img src={preview} alt="" width={32} height={32} className="block" />
          </PreviewSwatch>
          {/* In-app logo preview (~48px). */}
          <div className="flex flex-col items-center gap-1.5">
            <img
              src={preview}
              alt="In-app logo preview"
              width={48}
              height={48}
              className="block rounded-md"
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
              Logo · 48px
            </span>
          </div>
          {fileName ? (
            <span className="max-w-[12rem] truncate text-xs text-ink/55">
              {fileName}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-end">
        <SubmitButton
          className="inline-flex items-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:cursor-not-allowed disabled:opacity-70"
          pendingLabel="Processing…"
        >
          <ImageUp aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {replace ? 'Replace brand icon' : 'Upload brand icon'}
        </SubmitButton>
      </div>
    </form>
  );
}

function PreviewSwatch({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex h-9 items-center rounded-md border border-ink/10 bg-white px-2 shadow-sm">
        {children}
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/50">
        {label}
      </span>
    </div>
  );
}
