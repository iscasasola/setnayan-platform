'use client';

import { useRef, useState } from 'react';
import { UploadCloud, Check } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { uploadMonogram, removeUploadedMonogram } from './actions';

/**
 * MonogramUploadCard — "Upload your own monogram" (owner rule 2026-06-15).
 *
 * A couple uploads THEIR OWN mark; it OVERRULES every Setnayan mark (the
 * Cipher/Bespoke AI `monogram_custom_svg` AND the lettered lockup) everywhere
 * the monogram shows. The heavy lifting (sanitize SVG / sharp-wrap raster /
 * persist to `events.monogram_uploaded_svg`) lives in the `uploadMonogram`
 * server action; this card is just the picker + live preview + the active /
 * remove states. The action redirects with an `?upload=` flag the page reads
 * to surface a notice.
 *
 * `activeDataUri` (when present) is the currently-saved uploaded mark, already
 * resolved to a data-URI by the server page, so the card can show it without
 * re-deriving the SVG client-side.
 */
export function MonogramUploadCard({
  eventId,
  activeDataUri,
}: {
  eventId: string;
  activeDataUri: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      setPreview(null);
      setFileName(null);
      return;
    }
    setFileName(f.name);
    setPreview(URL.createObjectURL(f));
  }

  return (
    <section className="rounded-2xl border border-mulberry/20 bg-mulberry/[0.03] p-6 sm:p-8">
      <header className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-mulberry">
          Upload your own
        </p>
        <h2 className="text-xl font-semibold tracking-tight">
          Already have a monogram? Use it.
        </h2>
        <p className="max-w-prose text-sm text-ink/65">
          Upload your own mark and it becomes your monogram everywhere — your
          website, QR codes, and dashboard. It <strong>overrides</strong> the
          lettered and AI-designed marks below.
        </p>
      </header>

      {activeDataUri ? (
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="inline-flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-ink/10 bg-cream">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activeDataUri} alt="Your uploaded monogram" className="h-full w-full object-contain p-1" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1.5 text-sm font-medium text-success-700">
              <Check aria-hidden className="h-4 w-4" strokeWidth={2.5} />
              Your uploaded monogram is active
            </p>
            <p className="mt-0.5 text-xs text-ink/55">
              It’s showing everywhere right now. Remove it to fall back to a
              Setnayan mark, or upload a new file to replace it.
            </p>
            <form action={removeUploadedMonogram} className="mt-2">
              <input type="hidden" name="event_id" value={eventId} />
              <SubmitButton
                className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/5"
                pendingLabel="Removing…"
              >
                Remove &amp; use a Setnayan mark
              </SubmitButton>
            </form>
          </div>
        </div>
      ) : null}

      <form action={uploadMonogram} className="mt-5 space-y-3">
        <input type="hidden" name="event_id" value={eventId} />
        <input
          ref={inputRef}
          id="monogram-file"
          type="file"
          name="file"
          accept="image/svg+xml,image/png,image/jpeg,image/webp"
          onChange={onPick}
          className="sr-only"
        />
        <label
          htmlFor="monogram-file"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-mulberry/30 bg-cream/60 px-4 py-8 text-center transition-colors hover:border-mulberry/60 hover:bg-cream"
        >
          {preview ? (
            <span className="inline-flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border border-ink/10 bg-cream">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Selected monogram preview" className="h-full w-full object-contain p-1" />
            </span>
          ) : (
            <UploadCloud aria-hidden className="h-7 w-7 text-mulberry/70" strokeWidth={1.75} />
          )}
          <span className="text-sm font-medium text-ink/80">
            {fileName ?? (activeDataUri ? 'Choose a different file' : 'Choose a file to upload')}
          </span>
          <span className="text-xs text-ink/50">PNG, JPG, or SVG · up to 4 MB · square works best</span>
        </label>

        <SubmitButton
          className="button-primary w-full sm:w-auto"
          pendingLabel="Uploading…"
          disabled={!preview}
        >
          {activeDataUri ? 'Replace my monogram' : 'Use this monogram'}
        </SubmitButton>
      </form>
    </section>
  );
}
