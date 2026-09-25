'use client';

import { useEffect, useState, type RefObject } from 'react';

/**
 * 🪞 THE MAKER NEVER EMBEDS ITSELF (owner 2026-09-25, verbatim: *"the scene is
 * now wrong. it used to be just the scene. now you embeded the editor inside
 * the editor"*).
 *
 * The canvas is an iframe of the couple's own page. The page used to carry the
 * host's chrome — "Edit this site", the bottom bar's "Manage" — and every one of
 * those is a link into the dashboard. A tap inside the canvas navigated the
 * FRAME, and the frame then drew the whole Maker inside the Maker.
 *
 * The page no longer draws that chrome in the canvas (`isEditorCanvas`,
 * `app/[slug]/_lib/editor-canvas.ts`). These two guards are the defence behind
 * it, because a link can come back in any of a hundred places:
 *
 *   1. `CanvasStaysOnThePage` — after every load, the canvas asks its own frame
 *      where it is. Anywhere but the couple's page (a dashboard route, the
 *      Maker, a login screen) and the frame is covered by a plain placeholder
 *      instead of being shown.
 *   2. `MakerRefusesToBeFramed` — if the Maker ever does load inside a frame,
 *      it covers itself with "Preview unavailable" rather than drawing a second
 *      editor.
 *
 * Both are same-origin reads (the canvas is same-origin by construction); a
 * cross-origin frame throws on `location`, and that is treated as escaped too.
 */

/** Is this frame path still the couple's page? `/cale-ice`, `/cale-ice/everyone`
 *  (a View-as door) — yes. `/dashboard/…`, `/login` — no. */
export function framePathIsThePage(pathname: string, pagePath: string): boolean {
  const base = pagePath.replace(/\/+$/, '');
  if (!base) return false;
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function CanvasStaysOnThePage({
  frameRef,
  pagePath,
  resetKey,
  stageLabel,
  onBack,
}: {
  frameRef: RefObject<HTMLIFrameElement | null>;
  /** `/<slug>` — the only place the canvas may be. */
  pagePath: string;
  /** Changes whenever the iframe is re-keyed (stage, render stamp). */
  resetKey: string;
  stageLabel: string;
  /** Reload the canvas on the page. */
  onBack: () => void;
}) {
  const [escaped, setEscaped] = useState(false);

  useEffect(() => {
    setEscaped(false);
    const frame = frameRef.current;
    if (!frame) return;
    const check = () => {
      let path: string | null = null;
      try {
        path = frame.contentWindow?.location.pathname ?? null;
      } catch {
        path = null; // cross-origin: not the couple's page
      }
      // `about:blank` is the frame before its first load — not an escape.
      if (path === 'blank') return;
      setEscaped(path === null || !framePathIsThePage(path, pagePath));
    };
    frame.addEventListener('load', check);
    return () => frame.removeEventListener('load', check);
  }, [frameRef, pagePath, resetKey]);

  if (!escaped) return null;
  return (
    <div
      role="status"
      data-maker-canvas-escaped=""
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-md bg-cream px-6 text-center"
    >
      <p className="max-w-sm text-sm text-ink/75">
        That link leads out of your {stageLabel} page, so it isn&rsquo;t shown here. The preview only ever
        shows your page.
      </p>
      <button
        type="button"
        onClick={() => {
          setEscaped(false);
          onBack();
        }}
        className="sn-press inline-flex min-h-10 items-center rounded-full bg-ink px-4 text-[13px] font-semibold text-cream hover:bg-ink/90"
      >
        Back to your page
      </button>
    </div>
  );
}

export function MakerRefusesToBeFramed() {
  const [framed, setFramed] = useState(false);
  useEffect(() => {
    try {
      setFramed(window.top !== window.self);
    } catch {
      setFramed(true); // a cross-origin parent cannot even be compared
    }
  }, []);
  if (!framed) return null;
  return (
    <div
      role="alert"
      data-maker-framed=""
      className="fixed inset-0 z-[2000] flex items-center justify-center bg-cream px-6 text-center"
    >
      <p className="max-w-sm text-sm text-ink/75">
        Preview unavailable — the Event Hub Maker can&rsquo;t open inside a preview.
      </p>
    </div>
  );
}
