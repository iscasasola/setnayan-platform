'use client';

import { Camera, Loader2, Sparkles } from 'lucide-react';
import { FileUpload } from '@/app/_components/file-upload';

/**
 * Step 1 content for the Photo tab of the AI Catalog Generator.
 *
 * Wraps the shared `<FileUpload>` widget with menu-scan-specific config:
 *   - bucket: `media` (10 MB cap matches printed-menu phone photos)
 *   - prefix: `vendors/{vendorProfileId}/menu-scan/` so the server action
 *     can validate ownership by prefix match (see actions.ts)
 *   - accept: PNG/JPEG/HEIC/WEBP + PDF — these cover what vendors actually
 *     paste in (camera shots, Word/Excel screenshots, Facebook menu posts)
 *
 * The component is presentational only — it does NOT call the server action.
 * The parent (`ai-catalog-generator.tsx`) owns the photo list, the
 * "Generate catalog from photos" button, and the transition to the preview
 * step. Keeping this component thin makes it easy for the parallel
 * voice-input agent's component to mirror the same contract.
 */

type Props = {
  vendorProfileId: string;
  photoR2Keys: string[];
  onChange: (refs: string[]) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  error: string | null;
};

// MIME types that the upload API route's whitelist accepts AND that Claude
// vision can OCR reliably. PDF is included for vendors who only have a
// digital pricelist (common with newer caterers using Canva exports).
const PHOTO_ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
];

const MAX_PHOTOS = 6;

export function PhotoOcrInput({
  vendorProfileId,
  photoR2Keys,
  onChange,
  onGenerate,
  isGenerating,
  error,
}: Props) {
  // FileUpload emits `string | string[] | null` based on `multiple`. We pass
  // `multiple` so it's always `string[] | null` here — normalize to `[]`.
  const handleChange = (value: string | string[] | null) => {
    if (value === null) {
      onChange([]);
      return;
    }
    onChange(Array.isArray(value) ? value : [value]);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
      <div className="space-y-1">
        <label className="block text-sm font-medium text-ink">
          Upload photos of your menu, pricelist, or service brochure
        </label>
        <p className="text-xs text-ink/60">
          Snap a clear photo of each page — we&rsquo;ll read the package names
          and prices and build your draft catalog. Works with printed menus,
          Word/Excel screenshots, and Facebook posts.
        </p>
      </div>

      <FileUpload
        bucket="media"
        pathPrefix={`vendors/${vendorProfileId}/menu-scan`}
        multiple
        maxFiles={MAX_PHOTOS}
        maxSizeMB={10}
        acceptedTypes={PHOTO_ACCEPTED_TYPES}
        onChange={handleChange}
        variant="wide"
        disabled={isGenerating}
        help="Tip: spread your menu out flat in good lighting. Avoid glare on glossy pages."
      />

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
          <Camera aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          {photoR2Keys.length} of {MAX_PHOTOS} photos uploaded
        </span>
        <button
          type="button"
          onClick={onGenerate}
          disabled={isGenerating || photoR2Keys.length === 0}
          className="button-primary inline-flex items-center gap-2"
          aria-busy={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2
                aria-hidden
                className="h-4 w-4 animate-spin"
                strokeWidth={2.25}
              />
              Reading menu&hellip;
            </>
          ) : (
            <>
              <Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Generate catalog from photos
            </>
          )}
        </button>
      </div>
    </div>
  );
}
