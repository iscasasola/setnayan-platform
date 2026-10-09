'use client';

import { useState } from 'react';
import { SLIDER_VALUE, Slider } from '@/app/_components/slider';
import { Square } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { FEEL_OFF, type AnimateFeel } from '@/lib/animate-feel';
import { hubElementColor } from '@/lib/element-style';
import type { HubFontKey } from '@/lib/hub-fonts';
import { SP_BG_TILE, SP_BG_TILE_FACE, SP_BG_TILE_NAME, SP_BG_TILE_SLASH, SP_BG_TILE_TONE, SP_DD, SP_DD_BUTTON, SP_LOOK_ROW_LABEL, SP_ROWS_ROW } from '@/lib/maker-stage-room';
import type { MotionFx } from '@/lib/motion-effects';
import {
  RSVP_LOOK_BUTTON_LINES,
  RSVP_LOOK_SIZES,
  type RsvpCardGround,
  type RsvpLineLook,
  type RsvpLookFeel,
  type RsvpLookLine,
  type RsvpLookSize,
  type RsvpMotion,
} from '@/lib/rsvp-look';
import { ColourSheet } from '../../website/editor/_components/colour-well';
import { FontPick } from '../../website/editor/_components/font-pick';
import { Swatch } from './stage-panel/kit';
import { StageAnimate } from './stage-panel/stage-animate';

/**
 * 🎨 STYLE FOR ONE LINE OF THE RSVP STAGE — Font, then Colour · Size on one row (owner 2026-10-09: "shouldn't it be
 * per element?"; 2026-10-10, looking at this panel: *"Should be Font instead of Look and should be drop down"* ·
 * *"i thought our plan for colour is just 1 colour with a color picker pop up?"*).
 *
 *   Font    Event Hub font ▾          the app's ONE font dropdown (`FontPick`, on `PickMenu`) — the same faces a
 *                                     part of the Event Hub is offered; the first choice is the line as designed
 *   Colour  ◍   Size ━━━●━━━ 100%     a cover line's own last row (`stage-panel/stage-look-row.tsx`): ONE circle
 *                                     wearing the line's colour — striped while it is the page's own — that opens
 *                                     the app's ONE colour picker (`ColourSheet`), and the app's slider
 *
 * 🧱 The rows are rows of the toolbar's FOUR (`SP_ROWS_ROW`; the caller is the grid — `maker-rsvp-ask.tsx` `RSVP_ROWS`):
 * Font in row 1 and Colour · Size in row 4, Style's LAST row on every stage (a cover line's Colour · Size is drawn in
 * row 4 by the toolbar itself). They were a column of their own, stacked from the top — 2 px above row 1 and with
 * Colour · Size where no stage has it.
 *
 * Nothing here is a new control: the circle, the picker, the dropdown and the slider are the shipped ones. A colour
 * stored as one of the event's five (a slot, the day before) is shown as that colour; picking stores what the picker
 * hands back, as a cover line does.
 *
 * No look cards: a reply page's lines have no premade looks, and none were invented. A BUTTON (the two answers, the
 * pass's Save) has Font and Size — its colours are Look › Buttons', one set for every button of the event.
 */
export function RsvpLineLookRows({
  eventId,
  line,
  now,
  board,
  onPick,
}: {
  eventId: string;
  line: RsvpLookLine;
  now: RsvpLineLook;
  /** The event's five colours, in slot order. */
  board: readonly string[];
  onPick: (patch: { c?: string | null; f?: HubFontKey | null; s?: RsvpLookSize | null }) => void;
}) {
  const [picking, setPicking] = useState(false);
  const button = RSVP_LOOK_BUTTON_LINES.includes(line);
  const size = now.s ?? 100;
  const at = Math.max(0, RSVP_LOOK_SIZES.indexOf(size));
  /* The colour worn: its own, or an older slot's — the event's colour in that place. */
  const colour = hubElementColor(typeof now.c === 'number' ? board[now.c - 1] : now.c);
  return (
    <div className="contents" data-rsvp-line-look={line}>
      <div className={`${SP_ROWS_ROW} row-start-1`} data-rsvp-row="1" data-rsvp-line-look-row="font">
        <span className={SP_LOOK_ROW_LABEL}>Font</span>
        <span className={SP_DD} data-stage-dd="font">
          <FontPick eventId={eventId} label="Font" dataAttr="data-rsvp-look-font" value={now.f ?? null} lead="Event Hub font" onPick={(f) => onPick({ f })} className={SP_DD_BUTTON} />
        </span>
      </div>
      <div className={`${SP_ROWS_ROW} row-start-4`} data-rsvp-row="4" data-rsvp-line-look-row="size">
        {button ? null : (
          <>
            <span className={SP_LOOK_ROW_LABEL}>Colour</span>
            <Swatch
              on
              label={colour ? `Colour ${colour} — change it` : 'The page’s own colour — change it'}
              face={colour ? <span className="absolute inset-0" style={{ background: colour }} /> : <span className="absolute inset-0 bg-[repeating-linear-gradient(45deg,#fff_0_4px,#EDE8DF_4px_8px)]" />}
              onPick={() => setPicking(true)}
              data={{ 'data-rsvp-look-colour': colour ?? 'own' }}
            />
            {picking ? (
              <ColourSheet
                value={colour}
                shown="#2C2A29"
                what="this line"
                palette={board}
                slots={board.length === 5}
                onPick={(hex) => onPick({ c: hex })}
                onUnset={() => onPick({ c: null })}
                onClose={() => setPicking(false)}
              />
            ) : null}
          </>
        )}
        <span className={SP_LOOK_ROW_LABEL}>Size</span>
        <span className="relative flex h-11 min-w-0 flex-1 items-center px-1">
          <Slider label="Text size" data="rsvp-look-size" min={0} max={RSVP_LOOK_SIZES.length - 1} step={1} value={at} valueText={`${size}%`} onChange={(i) => onPick({ s: RSVP_LOOK_SIZES[i] ?? 100 })} />
        </span>
        <span className={`${SLIDER_VALUE} w-[40px]`}>{size}%</span>
      </div>
      {button ? (
        /* Its one line, right over the row it explains (no Colour beside Size). */
        <p className={`${SP_ROWS_ROW} row-start-3 px-1 text-[12.5px] text-[var(--sp-ink)]/70`} data-rsvp-row="3" data-rsvp-line-look-row="button-note">
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
    <div className="contents" data-rsvp-card-ground={picked}>
      <div className={`${SP_ROWS_ROW} row-start-1`} data-rsvp-row="1" role="group" aria-label="The card’s background">
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
      <p className={`${SP_ROWS_ROW} row-start-2 px-1 text-[12.5px] leading-snug text-[var(--sp-ink)]/70`} data-rsvp-row="2">{RSVP_CARD_GROUND_LINE}</p>
    </div>
  );
}

/** BACKGROUND FOR A LINE — it has none of its own: one line says whose it sits on, and the one button opens that. */
export function RsvpLineGroundRow({ onOpenCard }: { onOpenCard: () => void }) {
  return (
    <div className={`${SP_ROWS_ROW} row-start-1 justify-between`} data-rsvp-row="1" data-rsvp-line-ground="">
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
export function RsvpBuildInRows({ now, onPick, error = null }: { now: RsvpMotion; onPick: (patch: { i?: MotionFx | null; v?: RsvpLookFeel | null }) => void; error?: string | null }) {
  const feel: AnimateFeel = now.v ?? 'calm';
  return (
    <StageAnimate
      only="in"
      error={error}
      inFx={now.i ?? null}
      outFx={null}
      onIn={(fx) => onPick({ i: fx })}
      onOut={() => {}}
      does={null}
      move={{ in: { value: feel, onPick: (f) => onPick({ v: f === 'calm' ? null : f }), off: now.i ? null : FEEL_OFF.noEffect }, out: null }}
    />
  );
}
