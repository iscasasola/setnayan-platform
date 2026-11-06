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
 * cross-origin frame throws on `location`.
 *
 * 🔌 A FAILED LOAD IS NOT AN ESCAPE (walk 2026-11-01). A frame whose load FAILS
 * (the server restarting, the phone offline) is shown the browser's own error
 * page — which is cross-origin, so it throws exactly like a link to elsewhere,
 * and the canvas used to say "That link leads out of your page" over a page
 * nobody had touched. The two are told apart by one fact: you cannot follow a
 * link out of a page you never reached. Until the frame has shown the couple's
 * page once (for this frame), anything else it lands on is a failed load — it
 * says so and offers Try again. Only after that is a departure an escape.
 * 🕰 AND A LOAD THAT FIRES NOTHING (WebKit — every iPhone). Measured: an iframe
 * whose document request fails in WebKit fires NO `load`, NO `error`, and stays
 * on `about:blank` — the canvas stayed white forever, identical to "still
 * loading". So a frame that has not reached the page within
 * `CANVAS_STALL_MS` says so ("taking longer than it should") with Try again;
 * the moment the page does land, the cover lifts on its own.
 * `canvasLanding` decides it; `the-maker-canvas-is-only-the-page.test.ts` and
 * `a-failed-canvas-load-says-it-failed.test.ts` hold it.
 */

/** Is this frame path still the couple's page? `/cale-ice`, `/cale-ice/everyone`
 *  (a View-as door) — yes. `/dashboard/…`, `/login` — no. */
export function framePathIsThePage(pathname: string, pagePath: string): boolean {
  const base = pagePath.replace(/\/+$/, '');
  if (!base) return false;
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** What one landing of the canvas frame means. */
export type CanvasLanding = 'blank' | 'page' | 'escaped' | 'failed' | 'stalled';

/** How long a frame may stay blank before the canvas says it is taking too long. */
export const CANVAS_STALL_MS = 20_000;

/** A frame that never reached the page and is still on `about:blank` when the wait runs out has stalled. */
export function canvasStalled(path: string | null, reached: boolean): boolean {
  return !reached && path === 'blank';
}

/**
 * 🔌 One landing of the frame, judged. `path` is the frame's own pathname, `null` when it cannot be read (a
 * cross-origin document: the browser's error page, or somewhere else entirely); `'blank'` is `about:blank`, the frame
 * before its first load. `reached` — has this frame shown the couple's page yet?
 */
export function canvasLanding(path: string | null, pagePath: string, reached: boolean): CanvasLanding {
  if (path === 'blank') return 'blank';
  if (path !== null && framePathIsThePage(path, pagePath)) return 'page';
  return reached ? 'escaped' : 'failed';
}

/** Read the frame's path: `null` when it cannot be read. */
function framePath(frame: HTMLIFrameElement): string | null {
  try {
    return frame.contentWindow?.location.pathname ?? null;
  } catch {
    return null; // cross-origin: not the couple's page
  }
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
  const [landing, setLanding] = useState<CanvasLanding>('blank');
  /** Each Try again re-arms the stall wait (a retry that fires nothing again must say so again). */
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setLanding('blank');
    const frame = frameRef.current;
    if (!frame) return;
    /* The frame shown under a new `resetKey` has usually loaded already (the double buffer swaps it in on its load),
       so where it stands NOW is its first landing; every later load is judged against it. */
    let reached = false;
    const judge = () => {
      const next = canvasLanding(framePath(frame), pagePath, reached);
      if (next === 'blank') return;
      if (next === 'page') reached = true;
      setLanding(next);
    };
    if (frame.contentDocument?.readyState === 'complete' || framePath(frame) === null) judge();
    frame.addEventListener('load', judge);
    const stall = window.setTimeout(() => {
      if (canvasStalled(framePath(frame), reached)) setLanding('stalled');
    }, CANVAS_STALL_MS);
    return () => {
      window.clearTimeout(stall);
      frame.removeEventListener('load', judge);
    };
  }, [frameRef, pagePath, resetKey, attempt]);

  if (landing === 'failed' || landing === 'stalled') {
    return (
      <div
        role="alert"
        data-maker-canvas-failed=""
        className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-md bg-cream px-6 text-center"
      >
        <p className="max-w-sm text-sm text-ink/75">
          {landing === 'failed'
            ? <>Your {stageLabel} page didn&rsquo;t load. Check your connection, then try again.</>
            : <>Your {stageLabel} page is taking longer than it should to load. Check your connection, then try again.</>}
        </p>
        <button
          type="button"
          onClick={() => {
            setLanding('blank');
            setAttempt((n) => n + 1);
            onBack();
          }}
          className="sn-press inline-flex min-h-10 items-center rounded-full bg-ink px-4 text-[13px] font-semibold text-cream hover:bg-ink/90"
        >
          Try again
        </button>
      </div>
    );
  }
  if (landing !== 'escaped') return null;
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
          setLanding('blank');
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
