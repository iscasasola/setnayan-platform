'use client';

/**
 * chosen-proof-field.tsx — the receipt you just picked, big enough to check.
 *
 * Owner, live on the payment run, 2026-09-20: *"when i upload a photo, i cannot
 * see it. it is too small. let's make it easy to see?"*
 *
 * The couple's "Amount to pay" form asked for a proof of payment through a bare
 * `<input type="file">`. A browser's own answer to that is a filename in 12px
 * grey next to "Choose File" — on Safari not even that, just the name. The one
 * thing a person needs at that moment is to see WHICH screenshot they attached,
 * because the wrong one gets their payment refused and their date unheld.
 *
 * 🔑 THE UPLOAD PATH IS UNCHANGED, AND THAT IS THE POINT. This is still the same
 * `<input type="file" name="proof">` inside the same `<form onSubmit>`; the file
 * still reaches `recordDeposit` through `new FormData(form)` and is still stored
 * by `uploadDepositProof` into the PRIVATE thread-files bucket. Nothing is
 * uploaded early, nothing is presigned here, and no URL is persisted. The
 * preview is an in-memory `blob:` object URL that exists only in this tab and is
 * revoked the moment the choice changes or the field unmounts.
 *
 * ⚠ NOT `<FileUpload>`. That widget presigns and PUTs to R2 as soon as you pick
 * a file, which would leave an orphaned object in the bucket every time somebody
 * opened this form and cancelled — and `recordDeposit` reads a File, not an
 * `r2://` ref. Swapping it in would have been a bigger change that stored MORE
 * receipts, not fewer.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, ImageOff, X } from 'lucide-react';
import { formatFileSize } from '@/lib/chat-shared-files';

/**
 * The legible size of a picked receipt, as ONE string the guard also reads.
 * `max-h-64` matches `PROOF_IMAGE_CLASS` in proof-image.tsx on purpose: what
 * you see before you send it is the same size as what everyone sees after.
 */
export const CHOSEN_PROOF_IMAGE_CLASS =
  'max-h-64 w-auto rounded-md border border-ink/10 object-contain';

type Chosen = { name: string; size: number; isImage: boolean; objectUrl: string | null };

export type ChosenProofFieldProps = {
  /** The form field name the server action reads. */
  name: string;
  /** The `<label for>` / input id. */
  id: string;
  /** Which types the picker offers. */
  accept?: string;
  /** Label text above the field. */
  label: React.ReactNode;
};

export function ChosenProofField({
  name,
  id,
  accept = 'image/*,application/pdf',
  label,
}: ChosenProofFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [chosen, setChosen] = useState<Chosen | null>(null);
  /** The live `blob:` — read by the unmount cleanup, which state cannot reach. */
  const liveUrl = useRef<string | null>(null);

  /**
   * ONE owner of the object URL. Every path that replaces or clears the choice
   * goes through here, so a `blob:` is revoked exactly once and a long-lived
   * form (this one reopens on a refusal) cannot leak a handle per attempt.
   */
  const replace = useCallback((next: Chosen | null) => {
    if (liveUrl.current) URL.revokeObjectURL(liveUrl.current);
    liveUrl.current = next?.objectUrl ?? null;
    setChosen(next);
  }, []);

  /**
   * ⚠ UNMOUNT ONLY — `[]`, deliberately, and read through a ref.
   * Depending on `chosen` would make React's dev StrictMode remount revoke the
   * URL of a picture that is still on screen: the preview would go blank in
   * development and work in production, the worst possible split. Cancel closing
   * the form unmounts this field, and that is the one case state cannot cover.
   */
  useEffect(() => {
    return () => {
      if (liveUrl.current) URL.revokeObjectURL(liveUrl.current);
      liveUrl.current = null;
    };
  }, []);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    if (!file) {
      replace(null);
      return;
    }
    const isImage = file.type.startsWith('image/');
    replace({
      name: file.name,
      size: file.size,
      isImage,
      // A PDF gets no picture — an <img> would draw a broken-image glyph, which
      // says "this file is wrong" about a file that is fine.
      objectUrl: isImage ? URL.createObjectURL(file) : null,
    });
  }

  function onRemove() {
    // Clear the INPUT, not just the preview: the form is submitted from the
    // input, so a cleared picture with a full input would send the file the
    // person just told us to drop.
    if (inputRef.current) inputRef.current.value = '';
    replace(null);
  }

  const sizeLabel = chosen ? formatFileSize(chosen.size) : null;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[11px] font-medium text-ink/70">
        {label}
      </label>
      <input
        id={id}
        name={name}
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onPick}
        className="block w-full text-xs text-ink/70 file:mr-3 file:rounded-md file:border-0 file:bg-cream file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink hover:file:bg-cream/80"
      />

      {chosen ? (
        <div className="space-y-1.5 rounded-lg border border-ink/10 bg-cream/60 p-2">
          {chosen.isImage && chosen.objectUrl ? (
            // Tap the picture to open it full size in a new tab — the same
            // gesture the sent receipt gets everywhere else (proof-image.tsx).
            <a
              href={chosen.objectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
              aria-label={`Open ${chosen.name} full size`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={chosen.objectUrl} alt={chosen.name} className={CHOSEN_PROOF_IMAGE_CLASS} />
            </a>
          ) : chosen.isImage ? (
            <p className="inline-flex items-center gap-1.5 text-[11px] text-ink/60">
              <ImageOff aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              We couldn&rsquo;t show a preview — the file is still attached.
            </p>
          ) : (
            <p className="inline-flex items-center gap-1.5 text-[11px] text-ink/70">
              <FileText aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Attached — a PDF has no preview here.
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 text-[11px] text-ink/70">
              <span className="block truncate font-medium text-ink">{chosen.name}</span>
              {sizeLabel ? <span className="text-ink/55">{sizeLabel}</span> : null}
            </p>
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-ink/60 transition-colors hover:bg-ink/5 hover:text-danger-700"
            >
              <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              Remove
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
