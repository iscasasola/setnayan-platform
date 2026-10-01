'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { makerSave } from '@/lib/maker-refresh';
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
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set('intent', 'save');
      fd.set('patch', JSON.stringify({ widgets: { [widgetType]: { canvas: next } } }));
      // One refresh after the last save in flight (`lib/maker-refresh.ts`).
      const res = await makerSave(() => draftAction(eventId, fd), () => router.refresh());
      if (!res.ok) setError(res.error);
    });
  };
  return { shown, save, pending, error };
}

