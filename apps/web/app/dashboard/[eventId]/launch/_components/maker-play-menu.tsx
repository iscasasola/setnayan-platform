'use client';

import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';

/**
 * ▶ PLAY — two choices (owner 2026-09-25, verbatim: *"make choose play scene
 * only or preview stage"*, then *"play scene will play on the scene editor
 * only. play stage will open a new page to play the whole stage"*).
 *
 *   · Play this scene — IN PLACE, in the canvas: the selected section replays
 *     its entrance where it sits and comes to rest. No page, no overlay. The
 *     toolbar only ASKS (a window event); the work area, which owns the canvas,
 *     plays it (`editor-shell.tsx`, `EditorBridge`'s `play`).
 *   · Preview the whole stage — a NEW TAB of `/<slug>?phase=<stage>&preview=draft`:
 *     page-only, the host's draft, host-verified on the page. It never passes
 *     through a dashboard route (`app/[slug]/_lib/editor-canvas.ts`).
 */

/** The toolbar's "Play this scene" fires this; the work area plays it in the canvas. */
export const MAKER_PLAY_SCENE_EVENT = 'setnayan:maker-play-scene';

export function MakerPlayMenu({
  stageHref,
  stageLabel,
  sceneSelected,
}: {
  /** `/<slug>?phase=<stage>&preview=draft`. */
  stageHref: string;
  stageLabel: string;
  /** Is a scene (or a fixed section) selected in the navigator? */
  sceneSelected: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const item =
    'sn-press flex w-full items-center rounded-md px-3 py-2 text-left text-[13px] font-medium text-ink hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label="Play"
        title="Play"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="sn-press inline-flex h-11 w-11 items-center justify-center rounded-full text-ink/70 transition-colors duration-sn-control ease-sn hover:bg-ink/5 hover:text-ink"
      >
        <Play aria-hidden className="h-5 w-5" strokeWidth={1.75} />
      </button>
      {open ? (
        <span role="menu" data-maker-play-menu="" className="sn-glass-bare absolute left-0 top-full z-40 mt-1 w-60 rounded-md p-1">
          <span className="flex items-center gap-1">
            <button
              type="button"
              role="menuitem"
              disabled={!sceneSelected}
              onClick={() => {
                setOpen(false);
                window.dispatchEvent(new Event(MAKER_PLAY_SCENE_EVENT));
              }}
              className={item}
            >
              Play this scene
            </button>
            {!sceneSelected ? (
              <InfoTip label="" ariaLabel="Why Play this scene is off" align="start">
                Pick a scene in the list first — it plays right where it sits.
              </InfoTip>
            ) : null}
          </span>
          <a
            role="menuitem"
            href={stageHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            aria-label="Preview the whole stage in a new tab, as guests meet it"
            className={item}
          >
            Preview the whole {stageLabel}
          </a>
        </span>
      ) : null}
    </span>
  );
}
