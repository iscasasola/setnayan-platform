'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import { CameraLookFace, useCameraLookShown, useCanvasBrand } from './camera-face';

/**
 * 🎛 THE DAY › CAMERA — THE PAGE IS THE CAMERA (owner 2026-10-09, verbatim: *"Camera is a full screen design"* ·
 * *"edit is greyed out too. only have style"*; `TOOLBAR-SPEC-2026-10-09.md` "The Day › Camera"; the approved
 * prototype's `.smp.camfull`): on the Camera page the sample IS the camera, edge to edge, ONE part — the look
 * picked, drawn at the screen's size, changing the moment another look is tapped.
 *
 * It was a small grey shape and a caption (`MakerPageStandIn`), with no marker — so nothing on the page could be
 * tapped, nothing was picked on arriving, and the Camera's three looks could not be reached at all (seen on the
 * Maker lab, 2026-10-09: every tool live over four empty rows).
 *
 * THE SAME MECHANISM AS THE REVEAL (`stage-tools.tsx` "THE PAGE IN STAGES"): the part is drawn INTO the canvas from
 * the toolbar — the canvas is the couple's own page, a same-origin frame — over the canvas's own Camera page
 * (`[data-stages-page="camera"]`, `site-body.tsx` `rest()`), and a tap on it picks it. Nothing of this is in the
 * guest's page, and the live camera is never opened in the Maker (`the-maker-canvas-draws-no-camera.test.ts`): the
 * screen is the camera's own PIECES (`camera-face.tsx` `CameraLookFace`), a drawing.
 *
 *   · EDGE TO EDGE: it fills the page shown above the guests' bar and the toolbar — measured, and measured again
 *     when either moves (▶ plays, the whole-page preview, the phone turned); the page under it does not scroll.
 *   · PICKED ON ARRIVING, once per arrival (owner: something is always picked) — and by a tap, like any part.
 *   · PICKED, it wears the frame INSIDE its edge and its name (the prototype's `.camfull .pt.on`): the frame every
 *     other part wears is drawn outside the part, where a part that fills the page has no room.
 *   · NEVER A FLASH OF THE OLD SHAPE: a pick saves and the canvas loads again behind the one on screen (the Maker's
 *     buffered frame) — the camera is drawn in the page ON ITS WAY the moment it says it is up, so it is already
 *     there when that page is shown.
 *
 * Draws nothing where the canvas has no Camera page (a canvas drawn as one page).
 */
const CANVAS_FRAMES = 'iframe[data-maker-canvas-frame]';
const SHOWN_FRAME = 'iframe[data-maker-canvas-frame="shown"]';
/** The canvas's own Camera page (`site-body.tsx` `rest()` — its stand-in is put away while the camera is drawn). */
const CAMERA_PAGE = '[data-stages-page="camera"]';
const HOST_ID = 'sn-stage-camera';
const CSS_ID = 'sn-stage-camera-css';
/** The canvas's bridge is up — it has bound the page's parts (`editor-bridge.tsx`), so the page's own React owns it. */
const CANVAS_IS_UP = '[data-setnayan-editor-bound]';
/** After the page has changed and the part held from the page before has been let go (`stage-tools.tsx`). */
const ARRIVE_MS = 240;
/** How often, and how many times, the canvas's Camera page is looked for while it is not there yet (~6 s in all). */
const FIND_EVERY_MS = 300;
const FIND_TRIES = 20;

/** The height (in the canvas's own px) of the page that can be SEEN: under the frame's top, above the guests' bar and the toolbar. */
function seenHeight(): number | null {
  const frame = document.querySelector<HTMLIFrameElement>(SHOWN_FRAME);
  if (!frame) return null;
  const fr = frame.getBoundingClientRect();
  const lt = document.querySelector('[data-maker-lower-third]')?.getBoundingClientRect();
  const bar = document.querySelector('[data-stage-guest-bar]')?.getBoundingClientRect();
  const bottom = Math.min(fr.bottom, lt ? lt.top : window.innerHeight, bar && bar.height > 0 ? bar.top : window.innerHeight);
  const k = frame.clientWidth > 0 ? fr.width / frame.clientWidth : 1;
  const h = (bottom - fr.top) / (k || 1);
  return h > 40 ? Math.round(h) : null;
}

/** This stage's canvases that are UP — the one on screen, and one loading behind it (the Maker's buffered frame). */
function stageCanvasesUp(stage: LifecyclePhase): Document[] {
  const out: Document[] = [];
  for (const f of Array.from(document.querySelectorAll<HTMLIFrameElement>(CANVAS_FRAMES))) {
    try {
      /* Only THIS stage's (never another stage warmed behind the canvas). */
      if (new URL(f.src, window.location.href).searchParams.get('phase') !== stage) continue;
      const doc = f.contentDocument;
      /* 🧷 ONLY ON A PAGE THAT HAS FINISHED LOADING. The canvas is the couple's own page, drawn by its own React: a
         node put into it before that React has taken the page over is a page the server did not send, and the whole
         page is thrown away and drawn again (seen on the Maker lab, 2026-10-10: "Hydration failed"). The bridge
         marks the page's parts once it is up — the camera waits for that. */
      if (doc?.querySelector(CANVAS_IS_UP) && doc.querySelector(CAMERA_PAGE)) out.push(doc);
    } catch {
      /* a frame we cannot reach draws no camera — its page keeps its stand-in */
    }
  }
  return out;
}

/** Take the camera off a canvas: its box and the rule that put the page's own stand-in away. */
function takeOff(hosts: readonly HTMLElement[]): void {
  for (const h of hosts) {
    h.ownerDocument.getElementById(CSS_ID)?.remove();
    h.remove();
  }
}

export function CameraPage({
  stage,
  on,
  picked,
  held,
  onPick,
}: {
  /** The stage whose canvas is on screen. */
  stage: LifecyclePhase;
  /** The Camera's page is the one on screen. */
  on: boolean;
  /** The Camera is the part picked. */
  picked: boolean;
  /** A part — any part — is held (on arriving the Camera is picked only when none is). */
  held: boolean;
  onPick: () => void;
}) {
  const look = useCameraLookShown();
  const [hosts, setHosts] = useState<readonly HTMLElement[]>([]);
  /** Bumped whenever a canvas says it is ready — a page under the camera is a new document. */
  const [canvas, setCanvas] = useState(0);
  const brand = useCanvasBrand(canvas);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const heldRef = useRef(held);
  heldRef.current = held;

  useEffect(() => {
    const onReady = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data as { source?: unknown; t?: unknown } | null;
      if (d?.source === 'setnayan-site' && d.t === 'ready') setCanvas((n) => n + 1);
    };
    window.addEventListener('message', onReady);
    return () => window.removeEventListener('message', onReady);
  }, []);

  /* ── the camera's box, on the canvas's own Camera page ── */
  const made = useRef<HTMLElement[]>([]);
  const tries = useRef(0);
  useEffect(() => {
    tries.current = 0;
    if (on) return;
    /* Another page: the camera goes, and each canvas's own page is as it drew it. */
    takeOff(made.current);
    made.current = [];
    setHosts([]);
  }, [on]);
  useEffect(
    () => () => {
      takeOff(made.current);
      made.current = [];
    },
    [],
  );
  useEffect(() => {
    if (!on) return;
    /* A canvas that was replaced has gone, and its camera with it. */
    made.current = made.current.filter((h) => h.isConnected && h.ownerDocument.defaultView !== null);
    for (const doc of stageCanvasesUp(stage)) {
      if (made.current.some((h) => h.ownerDocument === doc)) continue;
      const page = doc.querySelector<HTMLElement>(CAMERA_PAGE);
      if (!page) continue;
      doc.getElementById(HOST_ID)?.remove();
      const host = doc.createElement('section');
      host.id = HOST_ID;
      host.setAttribute('data-maker-camera-part', '');
      host.setAttribute('aria-label', 'Camera');
      host.style.cssText = 'position:fixed;left:0;right:0;top:0;height:100vh;z-index:5;cursor:pointer;overflow:hidden';
      const h = seenHeight();
      if (h !== null) host.style.height = `${h}px`;
      host.addEventListener('click', (e) => {
        /* A tap on the camera PICKS it — and is never the page's "tap on the ground" (which lets a part go). */
        e.preventDefault();
        e.stopPropagation();
        onPickRef.current();
      });
      page.appendChild(host);
      /* The canvas's own stand-in for this page steps aside, and the page under the camera does not scroll. */
      const css = doc.createElement('style');
      css.id = CSS_ID;
      css.textContent = `${CAMERA_PAGE}>:not(#${HOST_ID}){display:none!important}html:has(#${HOST_ID}),html:has(#${HOST_ID}) body{overflow:hidden!important}`;
      doc.head.appendChild(css);
      made.current.push(host);
    }
    setHosts((was) => (was.length === made.current.length && was.every((h, i) => h === made.current[i]) ? was : [...made.current]));
    if (made.current.length > 0) {
      tries.current = 0;
      return;
    }
    /* The stage's canvas may still be on its way (a page asked for before it has loaded, a warmed frame shown
       without saying so again): looked for again, a few times — never for ever, never drawn on a guess. */
    if (tries.current >= FIND_TRIES) return;
    tries.current += 1;
    const again = window.setTimeout(() => setCanvas((n) => n + 1), FIND_EVERY_MS);
    return () => window.clearTimeout(again);
  }, [on, canvas, stage]);

  /* ── edge to edge: as tall as the page that can be seen ── */
  useEffect(() => {
    if (hosts.length === 0) return;
    const fit = () => {
      const h = seenHeight();
      if (h !== null) for (const host of hosts) host.style.height = `${h}px`;
    };
    fit();
    /* The toolbar and the guests' bar slide (▶, the whole-page preview): measured while they move, and once they rest. */
    const timers = [120, 300, 700].map((ms) => window.setTimeout(fit, ms));
    window.addEventListener('resize', fit);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    const lower = document.querySelector('[data-maker-lower-third]');
    if (ro && lower) ro.observe(lower);
    const mo = new MutationObserver(() => window.setTimeout(fit, 260));
    const shell = document.querySelector('[data-maker-shell]');
    if (shell) mo.observe(shell, { attributes: true, attributeFilter: ['data-stage-playing', 'data-stage-previewing'] });
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener('resize', fit);
      ro?.disconnect();
      mo.disconnect();
    };
  }, [hosts]);

  /* ── picked on arriving (once per arrival) ── */
  const drawn = hosts.length > 0;
  useEffect(() => {
    if (!drawn) return;
    const t = window.setTimeout(() => {
      if (!heldRef.current) onPickRef.current();
    }, ARRIVE_MS);
    return () => window.clearTimeout(t);
  }, [drawn]);

  return (
    <>
      {hosts.map((host, i) =>
        createPortal(
          <>
            <CameraLookFace look={look} logo={brand.logo} accent={brand.accent} screen />
            {picked ? (
              <>
                {/* The frame, INSIDE the edge (prototype `.camfull .pt.on::after`), and the part's name on it. */}
                <span aria-hidden data-camera-part-frame="" className="pointer-events-none absolute inset-0 z-[3] border-[3px] border-sn-accent" />
                <span
                  data-camera-part-name=""
                  className="pointer-events-none absolute left-2.5 top-[62px] z-[4] rounded-sm bg-sn-accent px-[7px] py-[3px] font-sans text-[9px] font-bold uppercase leading-[1.2] tracking-[0.14em] text-sn-on-accent"
                >
                  Camera
                </span>
              </>
            ) : null}
          </>,
          host,
          `camera-${i}`,
        ),
      )}
    </>
  );
}
