/**
 * lib/papic-photo-mark-of-event.ts — 🏷 which mark an EVENT's photos carry.
 *
 * Kept apart from `lib/papic-photo-mark.ts` (which the camera's chunk and the
 * upload queue carry) so the monogram resolvers stay out of the camera bundle.
 * Both camera mounts ask this one function — `/papic/guest` and the Event Hub's
 * inline camera — so they cannot disagree.
 *
 * Pro (the event's Logo & QR part or Full Pro, measured by the caller with
 * `eventHubPartActive(…, 'logo_qr')`) → the couple's own monogram: their mark
 * as safe SVG when they have one, else their lettered monogram when they
 * designed one; an event with neither → the Setnayan mark. Free → the Setnayan
 * mark.
 *
 * Pure. No I/O.
 */
import { resolveMonogram } from '@/lib/monogram';
import { resolveEventMonogramSvg } from '@/lib/monogram-svg-safe';
import { eventHasOwnMonogram, papicMarkFor, SETNAYAN_PHOTO_MARK, type PapicMark } from '@/lib/papic-photo-mark';

export type MarkEventRow = {
  display_name: string | null;
  monogram_text: string | null;
  monogram_color: string | null;
  monogram_style?: string | null;
  monogram_font_key?: string | null;
  monogram_frame_key?: string | null;
  monogram_custom_svg?: string | null;
  monogram_uploaded_svg?: string | null;
  logo_wanted?: boolean | null;
};

export function photoMarkOfEvent(event: MarkEventRow | null | undefined, pro: boolean): PapicMark {
  if (!pro || !event) return SETNAYAN_PHOTO_MARK;
  const svg = resolveEventMonogramSvg(event);
  const own = eventHasOwnMonogram(event);
  const cfg = own ? resolveMonogram(event) : null;
  return papicMarkFor({
    pro,
    monogramSvg: svg,
    monogramText: cfg?.text ?? null,
    monogramInk: cfg ? (cfg.inkColor ?? cfg.color ?? null) : null,
  });
}
