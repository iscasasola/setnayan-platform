'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { PillSelector } from '@/app/_components/pill-selector';
import { SLIDER_VALUE, Slider } from '@/app/_components/slider';
import { BACKGROUND_SOURCE_LABEL } from '@/lib/background-source';
import { SP_BG_QUIET, SP_BG_ROW, SP_BG_STRIP, SP_BG_TILE, SP_BG_TILE_NAME, SP_LOOK_ROW_LABEL } from '@/lib/maker-stage-room';
import { SCENE_SHADE_MAX, SCENE_SHADE_MIN, sceneShadeSettled, sceneShadeWords } from '@/lib/scene-shade-bar';
import { MakerSheet } from '../stages-studio-parts';
import { Dd, Swatch } from './kit';

/**
 * 🖼 BACKGROUND — the toolbar's third tool, in FOUR ROWS (owner 2026-10-09, verbatim: *"copy the background on studio
 * look"*; `TOOLBAR-SPEC-2026-10-09.md` § BACKGROUND; the approved prototype's `bgRows`). On the scene's SHIPPED
 * background saves — `scene-background-row.tsx` hands every pick in; nothing new is stored.
 *
 *   row 1   the SOURCE ▾, full width, no label (*"remove the Background Text"*): The Event Hub's · Colour · Scene ◆ ·
 *           Upload ◆ — the Look's own names (`lib/background-source.ts`) after the first choice
 *   row 2   that source's choices, ONE row of small pictures swiped sideways:
 *             The Event Hub's  one quiet line
 *             Colour           None · Plain · Diagonal · Glow · Opaque · Frosted
 *             Scene            the ready-made scenes
 *             Upload           ＋ Upload, then the couple's own photos and clips
 *   row 3   the choice's ONE control: a colour → its circle (the one colour picker), with the Opacity bar beside it
 *           on Opaque / Frosted; a picture → ONE "Darker ━●━ Lighter" bar (*"darker lighter line bar"*)
 *   row 4   Framed | Full width — and, for a photo, Still | Parallax
 *
 * NOT DRAWN ANY MORE (owner: *"no picking where just automatic center"* · *"remove how close"* · *"it is meant for
 * just this element"*): In frame, How close, "Use this background on every scene?", "Remove this scene's photo" (pick
 * another source) and the ⓘ's sentence. What was stored for them is still honoured by the page.
 */
export type StageBgSource = 'hub' | 'colour' | 'scene' | 'own';
/** One choice of row 2: its key, its name, the picture it wears (CSS), and whether it moves (a clip). */
export type StageBgTile = { key: string; name: string; picture: CSSProperties; moving?: boolean };

export function StageBackground({
  source,
  sources,
  onSource,
  tiles,
  tile,
  onTile,
  onUpload,
  upload,
  colour,
  customColour,
  opacity,
  shade,
  shape,
  onShape,
  motion,
  onMotion,
  pending,
}: {
  /** The source the stored background IS, and the ones offered (each with ◆ where Apply asks for Event Hub Pro). */
  source: StageBgSource;
  sources: ReadonlyArray<{ key: StageBgSource; pro: boolean }>;
  onSource: (s: StageBgSource) => void;
  /** Row 2's choices for the source on show, and the one worn now. */
  tiles: readonly StageBgTile[];
  tile: string | null;
  onTile: (key: string) => void;
  /** Upload's first tile opens the in-place upload — null: not offered on this source. */
  onUpload: boolean;
  upload: ReactNode;
  /** Row 3 on a colour: the colour worn (the one circle) and its picker — null: not a colour. */
  colour: string | null;
  customColour: (close: () => void) => ReactNode;
  /** …with the glass's own opacity beside it — null: not a glass. */
  opacity: { value: number; min: number; max: number; step: number; onChange: (n: number) => void } | null;
  /** Row 3 on a picture: the bar — its position, what the page shows while it moves, what is kept on release. */
  shade: { at: number; onMove: (at: number) => void; onKeep: (at: number) => void } | null;
  /** Row 4 — null: the source has no shape (the Event Hub's own, None). */
  shape: 'framed' | 'full' | null;
  onShape: (s: 'framed' | 'full') => void;
  motion: 'still' | 'parallax' | null;
  onMotion: (m: 'still' | 'parallax') => void;
  pending: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [picking, setPicking] = useState(false);
  /* The bar's own position while it is dragged; the stored one otherwise. */
  const [live, setLive] = useState<number | null>(null);
  useEffect(() => setLive(null), [shade?.at]);
  /* The choice worn now is brought into view in its row. */
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const s = strip.current;
    const on = s?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (s && on) s.scrollTo({ left: Math.max(0, on.offsetLeft + on.offsetWidth / 2 - s.clientWidth / 2) });
  }, [source, tile]);
  const at = live ?? shade?.at ?? 0;
  return (
    <>
      {/* ══ ROW 1 — the source ══ */}
      <div className={`${SP_BG_ROW} row-start-1`} data-stage-bg="source" aria-busy={pending}>
        <Dd
          small=""
          label="Background"
          data="bg"
          value={source}
          options={sources.map((s) => ({ key: s.key, label: `${s.key === 'hub' ? 'The Event Hub’s' : BACKGROUND_SOURCE_LABEL[s.key]}${s.pro ? ' ◆' : ''}` }))}
          onPick={(k) => onSource(k as StageBgSource)}
        />
      </div>
      {/* ══ ROW 2 — its choices ══ */}
      <div className="row-start-2 min-w-0" data-stage-bg="choices">
        {source === 'hub' ? (
          <p className={`${SP_BG_ROW} ${SP_BG_QUIET}`}>Uses the Event Hub’s own background.</p>
        ) : (
          <div ref={strip} role="group" aria-label={`${BACKGROUND_SOURCE_LABEL[source]} backgrounds`} data-stage-bg-strip={source} className={SP_BG_STRIP}>
            {onUpload ? (
              <button type="button" aria-haspopup="dialog" data-stage-bg-tile="upload" onClick={() => setUploading(true)} className={`${SP_BG_TILE} !items-center gap-1 text-[13px] font-semibold text-[var(--sp-ink)]`}>
                <Plus aria-hidden className="h-4 w-4 text-sn-accent" strokeWidth={2.4} />
                Upload
              </button>
            ) : null}
            {tiles.map((t) => (
              <button key={t.key} type="button" aria-pressed={t.key === tile} aria-label={t.name} data-stage-bg-tile={t.key} onClick={() => onTile(t.key)} className={SP_BG_TILE} style={t.picture}>
                <span className={SP_BG_TILE_NAME}>
                  {t.moving ? '▶ ' : ''}
                  {t.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      {/* ══ ROW 3 — the choice's one control ══ */}
      {colour !== null ? (
        <div className={`${SP_BG_ROW} row-start-3`} data-stage-bg="colour">
          <span className={SP_LOOK_ROW_LABEL}>Colour</span>
          <Swatch on label={`Background colour ${colour} — change it`} face={<span className="absolute inset-0" style={{ background: colour }} />} onPick={() => setPicking(true)} data={{ 'data-stage-swatch': colour }} />
          {opacity ? (
            <>
              <span className={SP_LOOK_ROW_LABEL}>Opacity</span>
              <span className="relative flex h-11 min-w-0 flex-1 items-center px-1" data-stage-bg-opacity="">
                <Slider label="Opacity" data="scene-opacity" min={opacity.min} max={opacity.max} step={opacity.step} value={opacity.value} valueText={`${opacity.value}%`} onChange={opacity.onChange} />
              </span>
              <span className={`${SLIDER_VALUE} w-10`}>{opacity.value}%</span>
            </>
          ) : null}
          {picking ? customColour(() => setPicking(false)) : null}
        </div>
      ) : shade ? (
        <div className={`${SP_BG_ROW} row-start-3`} data-stage-bg="shade">
          <span className={`${SP_LOOK_ROW_LABEL} !text-[12px] !text-[var(--sp-mute)]`}>Darker</span>
          <span className="relative flex h-11 min-w-0 flex-1 items-center px-1" data-stage-bg-shade={sceneShadeSettled(at)}>
            <Slider
              label="Darker or lighter"
              data="scene-shade"
              min={SCENE_SHADE_MIN}
              max={SCENE_SHADE_MAX}
              step={1}
              value={at}
              valueText={sceneShadeWords(at)}
              onChange={(n) => {
                setLive(n);
                shade.onMove(n);
              }}
              /* ONE write, when the thumb is let go — on the stop it settles on, and only if that is a change. */
              onCommit={(n) => {
                const settled = sceneShadeSettled(n);
                setLive(settled);
                if (settled !== shade.at) shade.onKeep(settled);
                else shade.onMove(settled);
              }}
            />
          </span>
          <span className={`${SP_LOOK_ROW_LABEL} !text-[12px] !text-[var(--sp-mute)]`}>Lighter</span>
        </div>
      ) : null}
      {/* ══ ROW 4 — its shape ══ */}
      {shape ? (
        <div className={`${SP_BG_ROW} row-start-4`} data-stage-bg="shape">
          <PillSelector
            label="Width"
            data="bg-width"
            value={shape}
            options={[
              { key: 'framed', label: 'Framed' },
              { key: 'full', label: 'Full width' },
            ]}
            onPick={(k) => onShape(k)}
          />
          {motion ? (
            <PillSelector
              label="How the photo moves"
              data="bg-motion"
              value={motion}
              options={[
                { key: 'still', label: 'Still' },
                { key: 'parallax', label: 'Parallax' },
              ]}
              onPick={(k) => onMotion(k)}
            />
          ) : null}
        </div>
      ) : null}
      {uploading ? (
        <MakerSheet label="Upload a photo or video" onClose={() => setUploading(false)}>
          <div className="px-3 pb-2" data-stage-bg-upload-sheet="">
            {upload}
          </div>
        </MakerSheet>
      ) : null}
    </>
  );
}
