'use client';

import { useEffect, useState } from 'react';
import {
  BLOCK_GROUNDS,
  BLOCK_GROUND_LINE,
  BLOCK_GROUND_NAME,
  BLOCK_MARK_ATTR,
  blockGroundToday,
  blockLooksWithGround,
  readBlockLooks,
  type BlockGround,
  type BlockLookBlock,
} from '@/lib/block-looks';
import { SP_BG_TILE, SP_BG_TILE_FACE, SP_BG_TILE_NAME, SP_BG_TILE_SLASH, SP_BG_TILE_TONE, SP_ROWS, SP_ROWS_ROW } from '@/lib/maker-stage-room';
import { useBlockLooksDraft } from './block-animate';

const SHOWN_FRAME = 'iframe[data-maker-canvas-frame="shown"]';

/** The block as the canvas on screen draws it: the element after its mark — or after the Maker's marker between. */
function blockOnCanvas(block: BlockLookBlock): Element | null {
  const doc = document.querySelector<HTMLIFrameElement>(SHOWN_FRAME)?.contentDocument ?? null;
  const after = doc?.querySelector(`[${BLOCK_MARK_ATTR}="${block}"]`)?.nextElementSibling ?? null;
  return after?.hasAttribute('data-maker-section') ? after.nextElementSibling : after;
}

/**
 * 🃏 BACKGROUND FOR A FIXED BLOCK — the Wedding March, The details, E-Gifts, Happening now (owner 2026-10-09:
 * Background for every block; `lib/block-looks.ts`).
 *
 * The RSVP card's own three tiles — None · Plain · Frosted (`rsvp-line-look.tsx` `RsvpCardGroundRows`: the same face,
 * the same ring on the picked one, its name written on it) — and one plain sentence under them. With nothing kept the
 * tile that IS today's look is the picked one (Plain where the block is a card, None where it stands bare), and
 * picking that one keeps nothing. Saved through the blocks' one save (`useBlockLooksDraft`): on the canvas at the
 * tap, in the draft behind it, live on Apply.
 */
export function BlockGroundRows({ block }: { block: BlockLookBlock }) {
  const { eventId, prefs, error, saveWhole } = useBlockLooksDraft();
  /* What the block wears with nothing kept. The details is asked of the canvas: its plate is a card, its other two
     drawings are bare. */
  const [today, setToday] = useState<BlockGround>(() => blockGroundToday(block, null));
  useEffect(() => setToday(blockGroundToday(block, blockOnCanvas(block))), [block]);
  const picked = readBlockLooks(prefs)[block]?.g ?? today;
  return (
    <div className={SP_ROWS} data-block-ground={block} data-block-ground-now={picked}>
      {/* `px-1`: the picked tile's ring reaches 4 px past its face, and the frame cuts what leaves it — the first
          tile's ring lost its left side at the frame's edge (seen in the Maker lab, 2026-10-10). */}
      <div className={`${SP_ROWS_ROW} row-start-1 px-1`} role="group" aria-label="This block’s background">
        {BLOCK_GROUNDS.map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={g === picked}
            aria-label={BLOCK_GROUND_NAME[g]}
            data-block-ground-tile={g}
            onClick={() => (eventId ? saveWhole(blockLooksWithGround(prefs, block, g === today ? null : g)) : undefined)}
            className={SP_BG_TILE}
          >
            <span className={SP_BG_TILE_FACE} style={g === 'frost' ? { background: 'linear-gradient(135deg, rgba(255,255,255,.9), rgba(217,185,154,.55))' } : undefined} data-tile-face={g === 'none' ? 'none' : 'flat'}>
              {g === 'none' ? <span aria-hidden className={SP_BG_TILE_SLASH} /> : null}
              <span data-tile-name="ink" className={`${SP_BG_TILE_NAME} ${SP_BG_TILE_TONE.ink}`}>
                {BLOCK_GROUND_NAME[g]}
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className={`${SP_ROWS_ROW} row-start-2 px-1 text-[12.5px] leading-snug text-[var(--sp-ink)]/70`}>{BLOCK_GROUND_LINE}</p>
      {error ? (
        <p role="alert" className={`${SP_ROWS_ROW} row-start-3 px-1 text-[12.5px] leading-snug text-[var(--sp-ink)]`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
