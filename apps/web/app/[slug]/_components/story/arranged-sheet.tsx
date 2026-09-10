/**
 * arranged-sheet.tsx — one moment the host arranged by hand, as a reader sees it.
 *
 * Ported from `prototypes/story_make_it_yours_2026-09-10.html` (`.canvas`, `.obj.ph`, `.obj.tx`,
 * `.obj.tx.pill .ed`, `applyLook`) with everything a host uses to EDIT taken off: no ×, no grip,
 * no handle, no selection, nothing focusable but a snippet's own sound button. Step 5 of
 * `10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md`.
 *
 * 🔑 THE SAME COMPOSITION ON EVERY SCREEN. Every length is `calc(var(--sn-u) * N)` in sheet units,
 * and `--sn-u` is one 660th of the sheet's own width (a CSS container) — see `lib/story-sheet.ts`.
 * So a phone draws the host's page smaller, never differently: nothing re-flows, and it is right
 * on the first byte, with JavaScript off and on paper. The sheet is never drawn LARGER than the
 * host's own 660 — enlarged, a photograph the host sized for a page goes soft.
 *
 * A server component. The inline styles are deliberate: the composition is data, not a class
 * somebody can restyle, and step 7's prints render this same component.
 *
 * ⚠ WHAT IT IS HANDED IS ALREADY GATED — `loadStoryPages` → `loadStoryArrangement` applied the
 * guests' layer (S3) and the consent veto (S14). This file draws; it decides nothing.
 */

import { type CSSProperties, type ReactElement } from 'react';
import {
  BACKING_PAD,
  PHOTO_INNER_RADIUS,
  PHOTO_MOUNT,
  PHOTO_RADIUS,
  SHEET_PAPER,
  SHEET_UNIT_VAR,
  SHEET_WORDS_FONT,
  WORDS_LINE_HEIGHT,
  WORDS_MIN_WIDTH,
  WORDS_PAD,
  u,
} from '@/lib/story-sheet';
import { SHEET_WIDTH } from '@/lib/story-arrangement';
import type { DrawnPhoto, DrawnSheet } from '@/lib/story-pages';
import type { SheetWords } from '@/lib/story-sheet';
import { SheetClip } from './sheet-clip';

/** The prototype's `--shadow`. A shadow is not composition, so it is not in sheet units. */
const PAPER_SHADOW = '0 1px 2px rgba(44,42,41,.05), 0 8px 24px -16px rgba(44,42,41,.28)';

export function ArrangedSheet({
  sheet,
  names,
  stills = false,
  label,
}: {
  sheet: DrawnSheet;
  /** Who the story is of — a snippet's spoken label. */
  names: string;
  /**
   * Draw a snippet as its still, with the prototype's ▶ mark — for paper (step 7) and anywhere a
   * moving picture cannot play. The public page plays them.
   */
  stills?: boolean;
  /** What the sheet is called for a screen reader. */
  label: string;
}): ReactElement {
  return (
    <div
      data-arranged-sheet={sheet.momentId}
      style={{ containerType: 'inline-size', width: '100%', maxWidth: SHEET_WIDTH }}
    >
      <figure
        aria-label={label}
        style={
          {
            [SHEET_UNIT_VAR]: `calc(100cqw / ${SHEET_WIDTH})`,
            position: 'relative',
            margin: 0,
            width: '100%',
            height: u(sheet.height),
            background: SHEET_PAPER,
            borderRadius: u(6),
            boxShadow: PAPER_SHADOW,
          } as CSSProperties
        }
      >
        {sheet.objects.map((o) =>
          o.kind === 'words' ? (
            <Words key={o.id} words={o} />
          ) : (
            <Photo key={o.id} photo={o} names={names} stills={stills} />
          ),
        )}
      </figure>
    </div>
  );
}

function Photo({
  photo,
  names,
  stills,
}: {
  photo: DrawnPhoto;
  names: string;
  stills: boolean;
}): ReactElement {
  const plays = photo.kind === 'snippet' && !stills && photo.playSrc;
  return (
    <div
      data-sheet-object={photo.kind}
      style={{
        position: 'absolute',
        boxSizing: 'border-box',
        left: u(photo.x),
        top: u(photo.y),
        width: u(photo.w),
        height: u(photo.h),
        border: `${u(PHOTO_MOUNT)} solid ${SHEET_PAPER}`,
        borderRadius: u(PHOTO_RADIUS),
        background: SHEET_PAPER,
        boxShadow: PAPER_SHADOW,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          borderRadius: u(PHOTO_INNER_RADIUS),
          background: 'rgba(44,42,41,.08)',
        }}
      >
        {plays ? (
          <SheetClip src={photo.playSrc!} posterUrl={photo.src} id={photo.ref} names={names} />
        ) : photo.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.src}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : null}
        {photo.kind === 'snippet' && !plays ? (
          // `.obj.ph .clipbig` — the still says it is a moving picture.
          <span
            aria-hidden
            style={{
              position: 'absolute',
              left: u(5),
              top: u(5),
              padding: `${u(2)} ${u(6)}`,
              borderRadius: u(99),
              background: 'rgba(0,0,0,.6)',
              color: '#fff',
              font: `700 ${u(9)} / 1 var(--font-mono), ui-monospace, monospace`,
            }}
          >
            ▶
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Words({ words }: { words: SheetWords }): ReactElement {
  return (
    <div
      data-sheet-object="words"
      style={{
        position: 'absolute',
        boxSizing: 'border-box',
        left: u(words.x),
        top: u(words.y),
        padding: `${u(WORDS_PAD.top)} ${u(WORDS_PAD.right)} ${u(WORDS_PAD.bottom)} ${u(WORDS_PAD.left)}`,
        minWidth: u(WORDS_MIN_WIDTH),
        maxWidth: u(words.maxWidth),
        // Words sit over photographs, as in the editor (`.obj.tx` is z-index 3).
        zIndex: 3,
        ...(words.turn ? { transform: `rotate(${words.turn}deg)` } : {}),
      }}
    >
      <div
        style={{
          minWidth: u(60),
          font: `400 ${u(words.size)} / ${WORDS_LINE_HEIGHT} ${SHEET_WORDS_FONT}`,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          color: words.backing ? SHEET_PAPER : words.color,
          ...(words.backing
            ? {
                background: words.color,
                padding: `${u(BACKING_PAD.y)} ${u(BACKING_PAD.x)}`,
                borderRadius: u(BACKING_PAD.radius),
              }
            : {}),
        }}
      >
        {words.text}
      </div>
    </div>
  );
}
