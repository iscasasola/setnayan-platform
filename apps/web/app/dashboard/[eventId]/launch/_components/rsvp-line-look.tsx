'use client';

import { SLIDER_VALUE, Slider } from '@/app/_components/slider';
import { Square } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { FEEL_OFF, type AnimateFeel } from '@/lib/animate-feel';
import { SP_BG_TILE, SP_BG_TILE_FACE, SP_BG_TILE_NAME, SP_BG_TILE_SLASH, SP_BG_TILE_TONE, SP_LOOK_ROW, SP_LOOK_ROW_LABEL } from '@/lib/maker-stage-room';
import type { MotionFx } from '@/lib/motion-effects';
import {
  RSVP_LOOK_BUTTON_LINES,
  RSVP_LOOK_SIZES,
  type RsvpCardGround,
  type RsvpLineLook,
  type RsvpLookFeel,
  type RsvpLookLine,
  type RsvpLookSize,
  type RsvpLookSlot,
  type RsvpMotion,
} from '@/lib/rsvp-look';
import { Swatch } from './stage-panel/kit';
import { StageAnimate } from './stage-panel/stage-animate';

/**
 * 🎨 STYLE FOR ONE LINE OF THE RSVP STAGE — Colour and Size (owner 2026-10-09: "shouldn't it be per element?").
 *
 * The same two controls a cover's line has (`stage-panel/stage-look-row.tsx`: the swatch, the slider, the same row),
 * with one difference the stored shape asks for: a colour is one of the EVENT'S OWN five (a slot, so it follows the
 * colours if they change, and nothing typed by hand is ever stored) — never the any-colour picker.
 *
 * No look cards: a reply page's lines have no premade looks, and none were invented. A BUTTON (the two answers, the
 * pass's Save) has Size only — its colours are Look › Buttons', one set for every button of the event.
 */
export function RsvpLineLookRows({
  line,
  now,
  board,
  onPick,
}: {
  line: RsvpLookLine;
  now: RsvpLineLook;
  /** The event's five colours, in slot order. */
  board: readonly string[];
  onPick: (patch: { c?: RsvpLookSlot | null; s?: RsvpLookSize | null }) => void;
}) {
  const button = RSVP_LOOK_BUTTON_LINES.includes(line);
  const size = now.s ?? 100;
  const at = Math.max(0, RSVP_LOOK_SIZES.indexOf(size));
  return (
    <div className="flex flex-col" data-rsvp-line-look={line}>
      {button ? null : (
        <div className={`${SP_LOOK_ROW} min-h-11`} data-rsvp-line-look-row="colour">
          <span className={SP_LOOK_ROW_LABEL}>Colour</span>
          <Swatch
            on={!now.c}
            label="The page’s own colour"
            face={<span className="absolute inset-0 bg-[repeating-linear-gradient(45deg,#fff_0_4px,#EDE8DF_4px_8px)]" />}
            onPick={() => onPick({ c: null })}
            data={{ 'data-rsvp-look-colour': 'own' }}
          />
          {board.slice(0, 5).map((hex, i) => (
            <Swatch
              key={hex + i}
              on={now.c === i + 1}
              label={`Colour ${i + 1} of your event’s colours`}
              face={<span className="absolute inset-0" style={{ background: hex }} />}
              onPick={() => onPick({ c: (i + 1) as RsvpLookSlot })}
              data={{ 'data-rsvp-look-colour': String(i + 1) }}
            />
          ))}
        </div>
      )}
      <div className={`${SP_LOOK_ROW} min-h-11`} data-rsvp-line-look-row="size">
        <span className={SP_LOOK_ROW_LABEL}>Size</span>
        <span className="relative flex h-11 min-w-0 flex-1 items-center px-1">
          <Slider label="Text size" data="rsvp-look-size" min={0} max={RSVP_LOOK_SIZES.length - 1} step={1} value={at} valueText={`${size}%`} onChange={(i) => onPick({ s: RSVP_LOOK_SIZES[i] ?? 100 })} />
        </span>
        <span className={`${SLIDER_VALUE} w-[40px]`}>{size}%</span>
      </div>
      {button ? (
        <p className="px-1 pt-1 text-[12.5px] text-[var(--sp-ink)]/70" data-rsvp-line-look-row="button-note">
          A button’s colours are your Look’s.
        </p>
      ) : null}
    </div>
  );
}

/* ── 🃏 BACKGROUND ─────────────────────────────────────────────────────────────────────────────────────────────── */

/** The card's three grounds, in the approved prototype's order and words (`public/review/rsvp-per-element.html`). */
export const RSVP_CARD_TILES: ReadonlyArray<{ key: 'none' | 'plain' | 'frost'; name: string }> = [
  { key: 'none', name: 'None' },
  { key: 'plain', name: 'Plain' },
  { key: 'frost', name: 'Frosted' },
];
export const RSVP_CARD_GROUND_LINE = 'Behind the card is the Look’s background — the same one every page wears.';
export const RSVP_LINE_GROUND_LINE = 'This sits on the RSVP card’s background.';

/**
 * BACKGROUND FOR THE CARD — None · Plain · Frosted, as the toolbar's own picture tiles (`stage-background.tsx`'s
 * tile: the same face, the same ring when picked, its name written on it). Plain is today's card and stores nothing.
 */
export function RsvpCardGroundRows({ now, onPick }: { now: RsvpCardGround | null; onPick: (ground: RsvpCardGround | null) => void }) {
  const picked = now ?? 'plain';
  return (
    <div className="flex flex-col" data-rsvp-card-ground={picked}>
      <div className={`${SP_LOOK_ROW} min-h-[var(--sp-rh,44px)]`} role="group" aria-label="The card’s background">
        {RSVP_CARD_TILES.map((t) => (
          <button key={t.key} type="button" aria-pressed={t.key === picked} aria-label={t.name} data-rsvp-card-tile={t.key} onClick={() => onPick(t.key === 'plain' ? null : t.key)} className={SP_BG_TILE}>
            <span className={SP_BG_TILE_FACE} style={t.key === 'frost' ? { background: 'linear-gradient(135deg, rgba(255,255,255,.9), rgba(217,185,154,.55))' } : undefined} data-tile-face={t.key === 'none' ? 'none' : 'flat'}>
              {t.key === 'none' ? <span aria-hidden className={SP_BG_TILE_SLASH} /> : null}
              <span data-tile-name="ink" className={`${SP_BG_TILE_NAME} ${SP_BG_TILE_TONE.ink}`}>
                {t.name}
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className="px-1 pt-1 text-[12.5px] text-[var(--sp-ink)]/70">{RSVP_CARD_GROUND_LINE}</p>
    </div>
  );
}

/** BACKGROUND FOR A LINE — it has none of its own: one line says whose it sits on, and the one button opens that. */
export function RsvpLineGroundRow({ onOpenCard }: { onOpenCard: () => void }) {
  return (
    <div className={`${SP_LOOK_ROW} min-h-11 justify-between`} data-rsvp-line-ground="">
      <p className="min-w-0 text-[13px] text-[var(--sp-ink)]">{RSVP_LINE_GROUND_LINE}</p>
      <span className="shrink-0" data-rsvp-open-card="">
        <ActionButton tone="neutral" icon={Square} label="Open the card" onClick={onOpenCard} />
      </span>
    </div>
  );
}

/* ── ✨ ANIMATE ─────────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * ANIMATE FOR A LINE OR THE CARD — its Build in, on the toolbar's own Animate (`StageAnimate`, `only="in"`): Fade ·
 * Blur · Move · Size, the side or the way the ON ones need, and Movement ◆ (Quick · Calm · Cinematic). A reply page
 * is one screen with no scroll to follow and no exit, so Action and Build out are not offered — never drawn dead.
 */
export function RsvpBuildInRows({ now, onPick }: { now: RsvpMotion; onPick: (patch: { i?: MotionFx | null; v?: RsvpLookFeel | null }) => void }) {
  const feel: AnimateFeel = now.v ?? 'calm';
  return (
    <StageAnimate
      only="in"
      inFx={now.i ?? null}
      outFx={null}
      onIn={(fx) => onPick({ i: fx })}
      onOut={() => {}}
      does={null}
      move={{ in: { value: feel, onPick: (f) => onPick({ v: f === 'calm' ? null : f }), off: now.i ? null : FEEL_OFF.noEffect }, out: null }}
    />
  );
}
