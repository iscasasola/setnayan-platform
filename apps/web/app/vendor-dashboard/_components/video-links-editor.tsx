'use client';

import { useState } from 'react';
import { Plus, X, Play, ExternalLink } from 'lucide-react';
import { parseVideoLink } from '@/lib/video-embed';

/**
 * "Featured videos" editor — a repeater of up to 10 external video URL inputs.
 *
 * Each row emits a hidden-less plain `<input name="gallery_video_links">`, so
 * `formData.getAll('gallery_video_links')` in `saveVendorProfile` returns every
 * entry (matching the <FileUpload multiple/> → getAll pattern already used for
 * the portfolio). Blank rows are dropped server-side; each surviving URL is
 * re-validated through `parseVideoLink` there too, so this client validation is
 * a helpful preview, not the security boundary.
 *
 * YouTube & Vimeo links show an inline-player badge; Instagram / Facebook /
 * TikTok / other links show a link-out badge — mirroring how the public page
 * renders them.
 */

const MAX_LINKS = 10;

export function VideoLinksEditor({
  name,
  initial,
}: {
  name: string;
  initial: string[];
}) {
  // Always keep at least one (empty) row so the vendor has somewhere to paste.
  const [rows, setRows] = useState<string[]>(() =>
    initial.length > 0 ? initial.slice(0, MAX_LINKS) : [''],
  );

  function update(idx: number, value: string) {
    setRows((prev) => prev.map((r, i) => (i === idx ? value : r)));
  }

  function remove(idx: number) {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length > 0 ? next : [''];
    });
  }

  function add() {
    setRows((prev) => (prev.length >= MAX_LINKS ? prev : [...prev, '']));
  }

  return (
    <div className="space-y-2">
      {rows.map((value, idx) => {
        const trimmed = value.trim();
        const parsed = trimmed ? parseVideoLink(trimmed) : null;
        const invalid = trimmed.length > 0 && parsed === null;
        return (
          <div key={idx} className="space-y-1">
            <div className="flex items-center gap-2">
              <input
                name={name}
                type="url"
                inputMode="url"
                value={value}
                onChange={(e) => update(idx, e.target.value)}
                placeholder="https://youtube.com/watch?v=…  ·  https://vimeo.com/…"
                className="input-field flex-1"
                aria-invalid={invalid || undefined}
              />
              <button
                type="button"
                onClick={() => remove(idx)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-ink/15 text-ink/55 transition hover:border-terracotta/40 hover:text-terracotta"
                aria-label="Remove this video link"
              >
                <X aria-hidden className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            {parsed ? (
              <p className="flex items-center gap-1.5 pl-1 text-xs text-ink/55">
                {parsed.kind === 'iframe' ? (
                  <Play aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                ) : (
                  <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                )}
                {parsed.kind === 'iframe'
                  ? `${parsed.label} — plays inline`
                  : `${parsed.label} — opens in a new tab`}
              </p>
            ) : invalid ? (
              <p className="pl-1 text-xs text-terracotta">
                That doesn&rsquo;t look like a video link. Paste a full https:// URL.
              </p>
            ) : null}
          </div>
        );
      })}
      {rows.length < MAX_LINKS ? (
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-ink/25 px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:border-terracotta/40 hover:text-terracotta"
        >
          <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Add another video
        </button>
      ) : (
        <p className="pl-1 text-xs text-ink/45">Up to {MAX_LINKS} videos.</p>
      )}
    </div>
  );
}
