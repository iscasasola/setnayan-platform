'use client';

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * ✍ A SCENE'S WORDS, EDITED FROM THE SCENE — the Maker's side.
 *
 * Owner, 2026-09-27, writing his own invitation: *"i cannot write a message"* ·
 * *"this is the editor, so we can edit here"* · *"needs to show on the scene
 * editor"* (DECISION_LOG "THE MAKER IS THE EDITOR: WORDS ARE EDITED WHERE THEY
 * ARE SEEN"). Two things, both carried by this one context so the Content
 * boxes (`DetailsBoundField`, `TextPanel`) never need a callback from the
 * server-built panels:
 *
 *   · PREVIEW — what is in a scene's Content box is on the canvas as it is
 *     typed: `preview(key, text)` posts the bridge's `words` message
 *     (`previewSceneWords`, `editor-bridge.tsx`). Nothing is saved by it; Save
 *     puts the words in the draft. The last preview per scene is kept, so a
 *     canvas that reloads while the box is open gets it again (`ready`).
 *   · FOCUS — a tap on the scene's words (canvas or navigator) opens the
 *     scene's Content with the box focused and the cursor at the end. The
 *     shell sets `focus`; the box with that key takes it once.
 *
 * Outside the Maker (the legacy editor page) there is no provider: the boxes
 * behave exactly as before.
 */
export type CanvasWords = {
  preview: (key: string, text: string) => void;
  /** The box stops previewing: the canvas goes back to `saved`. */
  release: (key: string, saved: string) => void;
  focus: { key: string; n: number } | null;
  focused: (n: number) => void;
};

export const CanvasWordsContext = createContext<CanvasWords | null>(null);

/**
 * A Content box's half: returns `preview(text)` for its input, focuses the box
 * when the shell asks for THIS scene, and, when the box goes away, returns the
 * canvas to `saved()` (the words as last saved) — an unsaved preview never
 * outlives its box.
 */
export function useSceneWordsBox(
  key: string | null | undefined,
  box: RefObject<HTMLTextAreaElement | null>,
  saved: () => string,
): (text: string) => void {
  const ctx = useContext(CanvasWordsContext);
  const want = ctx && key && ctx.focus?.key === key ? ctx.focus.n : 0;

  useLayoutEffect(() => {
    if (!want || !ctx) return;
    const t = box.current;
    if (!t) return;
    t.focus({ preventScroll: true });
    const end = t.value.length;
    try {
      t.setSelectionRange(end, end);
    } catch {
      /* a box that cannot place a cursor still has the focus */
    }
    t.scrollIntoView({ block: 'nearest' });
    ctx.focused(want);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [want]);

  /* 🔑 The context's value changes whenever the focus request does, so the box
     reads it through a ref: keying the release on `ctx` would "close" the box
     (and wipe its preview off the canvas) the moment it took the focus. */
  const savedRef = useRef(saved);
  savedRef.current = saved;
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  useEffect(() => {
    if (!key) return;
    return () => ctxRef.current?.release(key, savedRef.current());
  }, [key]);

  return useCallback(
    (text: string) => {
      if (key) ctxRef.current?.preview(key, text);
    },
    [key],
  );
}
