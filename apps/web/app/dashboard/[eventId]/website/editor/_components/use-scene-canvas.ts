'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { HUB_DRAFT_BAR_FIELD, makerRedrawSave, makerSave } from '@/lib/maker-refresh';
import { noteDraftedCanvas } from '@/lib/maker-draft-store';
import { sanitizeHubCanvas, type HubSectionCanvas } from '@/lib/hub-canvas';
import type { ElementDraftAction } from './element-sheet';

/*
 * 💾 ONE SCENE'S CANVAS → THE DRAFT. Used by the scene inspector's tabs
 * (`scene-inspector.tsx`, which re-exports it) and by the lazy Style row
 * (`scene-style-row.tsx`). Its own module on purpose: the Style row travels in
 * the `maker-details` chunk, and importing the inspector for this one hook
 * dragged the inspector and the template picker into that chunk group — one
 * more async chunk in the webpack runtime on EVERY page
 * (`scripts/check-bundle-size.mjs`).
 */

/** Save one scene's canvas into the draft, from the latest canvas (a ref). */
export function useSceneCanvas(
  eventId: string,
  widgetType: string,
  canvas: HubSectionCanvas,
  draftAction: ElementDraftAction,
  /** Told the canvas just written, before it is sent (the Maker's own copy — `noteDraftedCanvas`). */
  onWrote?: (next: HubSectionCanvas) => void,
  /**
   * 🖼 A pick the bridge cannot draw — a scene's Style, a palette look, the
   * Venue map switch: saved HELD and the canvas pages redrawn IN PLACE once it
   * lands (`makerRedrawSave`), never through a whole-Maker render. The Maker
   * keeps its own copy of the canvas (`noteDraftedCanvas`) in place of the
   * render it no longer waits for.
   */
  opts: { redraw?: boolean } = {},
) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(canvas);
  const [shown, setShown] = useState(canvas);
  const json = JSON.stringify(canvas);
  useEffect(() => {
    latest.current = canvas;
    setShown(canvas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [json, widgetType]);
  const save = (change: (c: Record<string, unknown>) => void) => {
    const draft: Record<string, unknown> = { ...latest.current };
    change(draft);
    const next = sanitizeHubCanvas({ canvas: draft });
    latest.current = next;
    setShown(next);
    if (onWrote) onWrote(next);
    else if (opts.redraw) noteDraftedCanvas(widgetType, next, canvas);
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set('intent', 'save');
      fd.set('patch', JSON.stringify({ widgets: { [widgetType]: { canvas: next } } }));
      /* A held save owes no Maker render — the Apply · Undo · Restore count comes back with it. */
      if (opts.redraw) fd.set(HUB_DRAFT_BAR_FIELD, '1');
      const res = opts.redraw
        ? await makerRedrawSave(() => draftAction(eventId, fd), () => router.refresh())
        : // One refresh after the last save in flight (`lib/maker-refresh.ts`).
          await makerSave(() => draftAction(eventId, fd), () => router.refresh());
      if (!res.ok) setError(res.error);
    });
  };
  return { shown, save, pending, error };
}


/**
 * 💾 EVENT FIELDS → THE DRAFT, HELD — for a control beside a scene's looks whose value is the EVENT's, not the
 * scene's canvas (the Dress code's Figures ▾ = `events.dress_code_config.show_figure`, the Mood Board's own
 * switch). The same one draft door and the same held save as a look pick: no whole-Maker render, the pages
 * redrawn in place once it lands, the Apply count carried back with it.
 */
export function useHeldEventsSave(eventId: string, draftAction: ElementDraftAction) {
  const router = useRouter();
  return (events: Record<string, unknown>) => {
    const fd = new FormData();
    fd.set('intent', 'save');
    fd.set('patch', JSON.stringify({ events }));
    fd.set(HUB_DRAFT_BAR_FIELD, '1');
    return makerRedrawSave(() => draftAction(eventId, fd), () => router.refresh());
  };
}
