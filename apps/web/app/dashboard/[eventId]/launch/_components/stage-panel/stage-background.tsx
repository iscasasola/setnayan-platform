'use client';

import { useState, type ReactNode } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { SP_PILL_BUTTON, SP_ROW, SP_ROW_LABEL, SP_SWATCH } from '@/lib/maker-stage-room';
import { MakerSheet } from '../stages-studio-parts';
import { About, Dd } from './kit';

/**
 * 🖼 STYLE › BACKGROUND — the prototype's three rows (`S.sphase === 'bg'`), on the
 * scene's SHIPPED background saves (`scene-background-row.tsx` hands every pick in):
 *
 *   BACKGROUND  The Event Hub's ▾ · WIDTH  Framed ▾     ONE dropdown, its first choice
 *                                                       "The Event Hub's" (the scene wears
 *                                                       the stage's own); Width once it has one
 *   Colour      ■ ■ ■ ■ ■ +                             the five colours, then any colour
 *   GALLERY ▸ · UPLOAD ◆                                the couple's pictures and the ready-made
 *                                                       scenes in one sheet; the in-place upload
 *
 * Opacity rides under the two glasses (shipped, kept); Darker ↔ Lighter rides in the
 * same slot once a photo or video is chosen (`HubSectionCanvas.shade`, owner
 * 2026-10-07); the photo's own Motion and crop live in the Gallery sheet.
 */
export type StageBgChoice = 'hub' | 'none' | 'color' | 'diagonal' | 'glow' | 'glass' | 'frost' | 'media';

export function StageBackground({
  value,
  offerMedia,
  mediaMark,
  onPick,
  shape,
  onShape,
  colours,
  colour,
  onColour,
  customColour,
  opacityRow,
  gallery,
  upload,
  galleryWords,
  pending,
}: {
  value: StageBgChoice;
  offerMedia: boolean;
  /** ◆ beside "Photo or video" — Pro, tried in the draft and asked for at Apply. */
  mediaMark: boolean;
  onPick: (c: StageBgChoice) => void;
  shape: 'framed' | 'full' | null;
  onShape: (s: 'framed' | 'full') => void;
  /** The five colours (the Mood Board's / the theme's), in order. */
  colours: readonly string[];
  colour: string | null;
  onColour: (hex: string) => void;
  /** The shipped Colour panel (`ColourWell`) — "+" opens it. */
  customColour: ReactNode;
  opacityRow: ReactNode;
  gallery: ReactNode;
  upload: ReactNode;
  /** What the Gallery pill reads ("Ours · moving", the picked photo). */
  galleryWords: string;
  pending: boolean;
}) {
  const [sheet, setSheet] = useState<'gallery' | 'upload' | null>(null);
  const [custom, setCustom] = useState(false);
  const tinted = value === 'color' || value === 'diagonal' || value === 'glow' || value === 'glass' || value === 'frost';
  const options = [
    { key: 'hub', label: 'The Event Hub’s' },
    { key: 'none', label: 'None' },
    { key: 'color', label: 'Plain' },
    { key: 'diagonal', label: 'Diagonal' },
    { key: 'glow', label: 'Glow' },
    { key: 'glass', label: 'Opaque' },
    { key: 'frost', label: 'Frosted' },
    ...(offerMedia ? [{ key: 'media', label: mediaMark ? 'Photo or video ◆' : 'Photo or video' }] : []),
  ];
  return (
    <>
      <div className="flex h-11 shrink-0 gap-1.5" data-stage-bg="kind" aria-busy={pending}>
        <Dd small="Background" label="Background" data="bg" value={value} options={options} onPick={(k) => onPick(k as StageBgChoice)} />
        {value !== 'hub' && value !== 'none' ? (
          <Dd
            small="Width"
            label="Width"
            data="bg-width"
            value={shape ?? 'framed'}
            options={[
              { key: 'framed', label: 'Framed' },
              { key: 'full', label: 'Full width' },
            ]}
            onPick={(k) => onShape(k as 'framed' | 'full')}
          />
        ) : null}
      </div>
      <div className={SP_ROW} data-stage-bg="colour">
        <span className={`${SP_ROW_LABEL} !w-[52px] !text-[11px]`}>Colour</span>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-1.5">
          {colours.slice(0, 5).map((c) => {
            const on = tinted && colour?.slice(0, 7).toLowerCase() === c.slice(0, 7).toLowerCase();
            return (
              <button key={c} type="button" aria-pressed={on} aria-label={`Background colour ${c}`} data-stage-swatch={c} onClick={() => onColour(c)} className={SP_SWATCH}>
                <span
                  aria-hidden
                  className={`relative block h-9 w-full rounded-md border border-black/10 ${on ? 'shadow-[0_0_0_2px_#fff,0_0_0_3.5px_var(--sp-cta)]' : ''}`}
                  style={{ background: c }}
                >
                  {on ? <span className="absolute left-1/2 top-1/2 -ml-[3px] -mt-[3px] h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,.2)]" /> : null}
                </span>
              </button>
            );
          })}
          <button type="button" aria-expanded={custom} aria-label="Any colour" data-stage-swatch="more" onClick={() => setCustom((o) => !o)} className={`${SP_SWATCH} max-w-[34px]`}>
            <span aria-hidden className="flex h-9 w-full items-center justify-center rounded-md border border-dashed border-black/10 bg-white text-[14px] font-semibold text-[var(--sp-ink2)]">
              +
            </span>
          </button>
        </div>
      </div>
      {custom ? <div className="shrink-0">{customColour}</div> : null}
      {opacityRow}
      <div className="flex h-11 shrink-0 gap-1.5" data-stage-bg="media">
        <button type="button" data-stage-bg-gallery="" onClick={() => setSheet('gallery')} className={SP_PILL_BUTTON}>
          <small className="shrink-0 text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--sp-mute)]">Gallery</small>
          <span className="min-w-0 flex-1 truncate">{galleryWords}</span>
          <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-[var(--sp-gold)]" strokeWidth={2.2} />
        </button>
        {offerMedia ? (
          <button type="button" data-stage-bg-upload="" onClick={() => setSheet('upload')} className={SP_PILL_BUTTON}>
            <small className="shrink-0 text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--sp-mute)]">Upload{mediaMark ? ' ◆' : ''}</small>
            <span className="min-w-0 flex-1 truncate">Photo or video</span>
            <Plus aria-hidden className="h-3.5 w-3.5 shrink-0 text-[var(--sp-gold)]" strokeWidth={2.2} />
          </button>
        ) : null}
        <About label="Background">
          The Event Hub’s keeps this scene on the stage’s own background. Photo or video is Event Hub Pro — try it here; it goes live when you Apply with it.
        </About>
      </div>
      {sheet === 'gallery' ? (
        <MakerSheet label="Gallery" onClose={() => setSheet(null)}>
          <div className="px-3 pb-2" data-stage-bg-gallery-sheet="">
            {gallery}
          </div>
        </MakerSheet>
      ) : null}
      {sheet === 'upload' ? (
        <MakerSheet label="Upload a photo or video" onClose={() => setSheet(null)}>
          <div className="px-3 pb-2" data-stage-bg-upload-sheet="">
            {upload}
          </div>
        </MakerSheet>
      ) : null}
    </>
  );
}
