/**
 * lib/monogram-studio/upload.ts
 *
 * Client-side decode for "upload your own mark" (owner 2026-07-17). One
 * function turns a File into a sanitized pure-paths SVG whose <path>s are the
 * ANIMATABLE ELEMENTS every reveal already understands:
 *
 *   · .svg  — read as text, pushed through the same reject-don't-repair
 *     sanitizer the studio uses (sanitizeStudioSvg). The author's own paths
 *     are the elements.
 *   · .png / .webp — traced in the browser (lib/monogram-studio/trace.ts):
 *     transparent art via the alpha channel, opaque scans via luminance; each
 *     connected piece becomes its own path (= its own element).
 *   · .eps / .ai / anything else — browsers cannot read PostScript; we say so
 *     honestly and point at the free converters instead of pretending.
 */

import { sanitizeStudioSvg } from '@/lib/monogram-studio-shared';
import { traceImageToSvg } from './trace';

export type UploadDecode =
  | { ok: true; svg: string; elements: number; traced: boolean }
  | { ok: false; error: string };

const MAX_FILE_BYTES = 8 * 1024 * 1024;

function countPaths(svg: string): number {
  return (svg.match(/<path[\s>]/gi) ?? []).length;
}

export async function fileToMarkSvg(file: File): Promise<UploadDecode> {
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: 'That file is over 8MB — export a smaller version and try again.' };
  }
  const name = file.name.toLowerCase();
  const type = (file.type || '').toLowerCase();

  if (name.endsWith('.eps') || name.endsWith('.ai') || type.includes('postscript')) {
    return {
      ok: false,
      error:
        'EPS/AI files can’t be read by a browser — export your mark as an SVG or a transparent PNG (any design tool and most free converters can), then upload that.',
    };
  }

  if (name.endsWith('.svg') || type === 'image/svg+xml') {
    const text = await file.text();
    const clean = sanitizeStudioSvg(text);
    if (!clean) {
      return {
        ok: false,
        error:
          'That SVG uses features we can’t accept (scripts, images, or external references). Export it as plain outlined paths and try again.',
      };
    }
    return { ok: true, svg: clean, elements: countPaths(clean), traced: false };
  }

  if (type === 'image/png' || type === 'image/webp' || name.endsWith('.png') || name.endsWith('.webp')) {
    try {
      const bmp = await createImageBitmap(file);
      const traced = traceImageToSvg(bmp, bmp.width, bmp.height);
      try {
        bmp.close();
      } catch {
        /* noop */
      }
      if (!traced) {
        return {
          ok: false,
          error: 'We couldn’t find a mark in that image — a transparent-background PNG works best.',
        };
      }
      const clean = sanitizeStudioSvg(traced.svg);
      if (!clean) return { ok: false, error: 'That image traced too heavy to keep crisp — try a simpler or smaller version.' };
      return { ok: true, svg: clean, elements: traced.elements, traced: true };
    } catch {
      return { ok: false, error: 'We couldn’t read that image — try re-exporting it as a PNG.' };
    }
  }

  return { ok: false, error: 'Upload an SVG or a transparent-background PNG.' };
}
