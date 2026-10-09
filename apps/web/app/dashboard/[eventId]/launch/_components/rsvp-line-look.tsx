'use client';

import { SLIDER_VALUE, Slider } from '@/app/_components/slider';
import { SP_LOOK_ROW, SP_LOOK_ROW_LABEL } from '@/lib/maker-stage-room';
import { RSVP_LOOK_BUTTON_LINES, RSVP_LOOK_SIZES, type RsvpLineLook, type RsvpLookLine, type RsvpLookSize, type RsvpLookSlot } from '@/lib/rsvp-look';
import { Swatch } from './stage-panel/kit';

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
