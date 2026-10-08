'use client';

import { useState, type ReactNode } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { SP_PILL_BUTTON, SP_ROW, SP_ROW_LABEL } from '@/lib/maker-stage-room';
import { MakerSheet } from '../stages-studio-parts';
import { About, Dd, Swatch, SwatchMore } from './kit';

/**
 * 🖼 STYLE › BACKGROUND — the prototype's three rows (`S.sphase === 'bg'`), on the
 * scene's SHIPPED background saves (`scene-background-row.tsx` hands every pick in):
 *
 *   BACKGROUND  The Event Hub's ▾ · WIDTH  Framed ▾     ONE dropdown, its first choice
 *                                                       "The Event Hub's" (the scene wears
 *                                                       the stage's own); Width once it has one
 *   Colour      ● ● ● ● ● +                             the five colour CIRCLES (the approved gallery's
 *                                                       kind 21), then any colour ("+" opens the one
 *                                                       colour picker, owner 2026-10-08)
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
  /** "+" opens the ONE colour picker (`ColourSheet`, colour-well.tsx) — handed the way to close it. */
  customColour: (close: () => void) => ReactNode;
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
            return <Swatch key={c} on={on} label={`Background colour ${c}`} face={<span className="absolute inset-0" style={{ background: c }} />} onPick={() => onColour(c)} data={{ 'data-stage-swatch': c }} />;
          })}
          <SwatchMore open={custom} onOpen={() => setCustom(true)} data={{ 'data-stage-swatch': 'more' }} />
        </div>
      </div>
      {custom ? customColour(() => setCustom(false)) : null}
      {opacityRow}
      <div className="flex h-11 shrink-0 gap-1.5" data-stage-bg="media">
        <button type="button" data-stage-bg-gallery="" onClick={() => setSheet('gallery')} className={SP_PILL_BUTTON}>
          <small className="shrink-0 text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--sp-mute)]">Gallery</small>
          <span className="min-w-0 flex-1 truncate">{galleryWords}</span>
          <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-sn-accent" strokeWidth={2.2} />
        </button>
        {offerMedia ? (
          <button type="button" data-stage-bg-upload="" onClick={() => setSheet('upload')} className={SP_PILL_BUTTON}>
            <small className="shrink-0 text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--sp-mute)]">Upload{mediaMark ? ' ◆' : ''}</small>
            <span className="min-w-0 flex-1 truncate">Photo or video</span>
            <Plus aria-hidden className="h-3.5 w-3.5 shrink-0 text-sn-accent" strokeWidth={2.2} />
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
