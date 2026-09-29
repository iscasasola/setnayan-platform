'use client';

import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import {
  PREVIEW_SAME_VIEW_QUERY,
  previewCarriesPlace,
  previewOpensInSameView,
} from '@/lib/maker-preview-way-back';
import { useMaker } from './maker-context';

/**
 * ▶ PLAY — two choices (owner 2026-09-25, verbatim: *"make choose play scene
 * only or preview stage"*, then *"play scene will play on the scene editor
 * only. play stage will open a new page to play the whole stage"*).
 *
 *   · Play this scene — IN PLACE, in the canvas: the selected section replays
 *     its entrance where it sits and comes to rest. No page, no overlay. The
 *     toolbar only ASKS (a window event); the work area, which owns the canvas,
 *     plays it (`editor-shell.tsx`, `EditorBridge`'s `play`).
 *   · Preview the whole stage — `/<slug>?phase=<stage>&preview=draft`:
 *     page-only, the host's draft, host-verified on the page. It never passes
 *     through a dashboard route (`app/[slug]/_lib/editor-canvas.ts`).
 *
 * ↩ EVERY PREVIEW HAS A WAY BACK (DECISION_LOG 2026-09-28; owner, verbatim:
 * *"no way to get back"*). The preview carries where the couple was — the
 * scene, or the made-once page — so its "Back to the Maker" lands there
 * (`previewCarriesPlace`). On a phone and in any installed shell it opens in
 * the SAME view, because a new tab there is a dead end (`previewOpensInSameView`);
 * a desktop browser keeps the new tab, and that tab carries the way back too.
 */

/**
 * 🧰 KEYNOTE'S LABELLED TOOL BUTTON (the approved prototype's top bar: *"Exit,
 * left, with its word under the icon (Keynote's labelled buttons)"*). The word
 * shows from `md`; on a phone the button is its 44 px icon, the word its name.
 */
export const MAKER_TOOL_BUTTON =
  'sn-press inline-flex h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 text-ink/70 transition-colors duration-sn-control ease-sn hover:bg-ink/5 hover:text-ink aria-pressed:bg-ink/[0.09] aria-pressed:text-ink aria-expanded:bg-ink/[0.09] md:h-12 md:min-w-[3.25rem]';
export const MAKER_TOOL_WORD = 'hidden text-[10.5px] font-semibold leading-none md:block';

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

  const maker = useMaker();
  const previewHref = previewCarriesPlace(stageHref, maker?.selection);

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
        data-maker-tool="play"
        className={MAKER_TOOL_BUTTON}
      >
        <Play aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        <span className={MAKER_TOOL_WORD}>Play</span>
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
          <PreviewStageLink
            href={previewHref}
            stageLabel={stageLabel}
            storeShell={Boolean(maker?.storeShell)}
            className={item}
            onPicked={() => setOpen(false)}
          />
        </span>
      ) : null}
    </span>
  );
}

/**
 * "Preview the whole <stage>" — decided when the menu OPENS (it is never
 * server-rendered open, so reading the window here cannot mismatch hydration):
 * the same view on a phone or in an installed shell, a new tab on a desktop
 * browser (`previewOpensInSameView`). The guided flow's Ready screen draws the
 * same link (its words in `text`), only once it is mounted in the browser.
 */
export function PreviewStageLink({
  href,
  stageLabel,
  storeShell,
  className,
  onPicked,
  text,
}: {
  href: string;
  stageLabel: string;
  storeShell: boolean;
  className: string;
  onPicked: () => void;
  /** The link's words (default "Preview the whole <stage>"). */
  text?: string;
}) {
  const sameView = previewOpensInSameView({
    storeShell,
    userAgent: navigator.userAgent,
    cookie: document.cookie,
    standalone: window.matchMedia('(display-mode: standalone)').matches,
    narrow: window.matchMedia(PREVIEW_SAME_VIEW_QUERY).matches,
  });
  return (
    <a
      role="menuitem"
      href={href}
      target={sameView ? undefined : '_blank'}
      rel={sameView ? undefined : 'noopener noreferrer'}
      onClick={onPicked}
      aria-label={
        sameView
          ? `Preview the whole ${stageLabel} as guests meet it`
          : `Preview the whole ${stageLabel} in a new tab, as guests meet it`
      }
      data-preview-same-view={sameView ? '1' : '0'}
      className={className}
    >
      {text ?? `Preview the whole ${stageLabel}`}
    </a>
  );
}
