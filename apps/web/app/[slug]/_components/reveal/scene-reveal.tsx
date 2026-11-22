'use client';

/**
 * 🎭 SceneReveal — ONE STAGE for every reveal that is not the veil: Beach curtains · Envelope (classic, gatefold) ·
 * Fabric · Scratch · Smoke · Cathedral doors · Petals · Fireworks (owner 23 Nov 2026, DECISION_LOG "NINE REVEALS
 * SHIP; THE GIFT BOX IS HELD"; drawing specs `prototypes/reveals_round3_veil_rules_2026-11-23/`, artifact
 * U4pTTfGDn6TBxA3PixFPLq v12–13).
 *
 * The stage runs the SHARED MOTION RULES (`lib/reveal-motion.ts`) — the veil's, read off `veil-reveal.tsx`: one tap
 * opens it hands-free over the couple's speed (9 · 12 · 16 s, curve `handsFreeTarget`), every frame the motion
 * closes 5 % of what is left (`stepLift`), a swipe the way it opens throws it open, and it is "revealed" at 98.5 %.
 * No scene has timing of its own: a solid scene's own clock is the lift (tau = lift × its length), as on the drawing.
 * While it opens the camera pushes in (`pushedZ`); the doors fly their own camera down the aisle.
 *
 * 📦 three.js and this file load only through `next/dynamic` from the overlay, and each reveal's own scene is a
 * further chunk (`LOADERS`), with its art in `public/reveal/art/` — a reveal's engine loads only when that reveal is
 * the one chosen. The guest page's first load carries none of it.
 *
 * Locked (owner): the reveal is always first · ONE tap opens it (Scratch opens at 60 % rubbed) · nothing behind
 * plays until it is opened · the unveil starts the music — `onUnveil` runs synchronously inside the tap's own
 * `pointerup` (and the press primes the song, `primeUnveilPress`, as the veil's does) · ♿ reduced motion: the closed
 * reveal stands STILL (one frame, no loop) and the tap cross-fades it away (`still`, REVEAL_REDUCED_FADE_MS).
 * A phone without WebGL, or a scene that fails to load, never gates the guest: it is revealed at once.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { REVEAL_MOTION, REVEAL_REDUCED_FADE_MS, handsFreeTarget, pushedZ, readGesture, revealDt, snapRevealSpeed, stepLift } from '@/lib/reveal-motion';
import { REVEAL_TEMPLATE_IDS, type RevealTemplateId } from '@/lib/reveal-config-pure';
import { claimVeilHold, primeUnveilPress } from '@/lib/hub-veil';
import { CAMZ, FOV, FZ, LEGACY_FOV, LEGACY_H, disposeScene, logoMask, seeded, type ArtName, type Ctx, type Pt, type Scene, type SceneState } from './scenes/kit';

/** Each reveal's scene, in its own chunk. The veil's is its still face only (reduced motion); the live veil is `veil-reveal.tsx`. */
const LOADERS: Record<RevealTemplateId, () => Promise<() => Scene>> = {
  'veil-sheer': () => import('./scenes/drape').then((m) => m.veilStill),
  'beach-curtains': () => import('./scenes/drape').then((m) => m.beachCurtains),
  fabric: () => import('./scenes/drape').then((m) => m.fabric),
  'envelope-classic': () => import('./scenes/envelope').then((m) => m.envelopeClassic),
  'envelope-gatefold': () => import('./scenes/envelope').then((m) => m.envelopeGatefold),
  scratch: () => import('./scenes/air').then((m) => m.scratch),
  smoke: () => import('./scenes/air').then((m) => m.smoke),
  'cathedral-doors': () => import('./scenes/doors').then((m) => m.cathedralDoors),
  petals: () => import('./scenes/bloom').then((m) => m.petals),
  fireworks: () => import('./scenes/bloom').then((m) => m.fireworks),
};

/** The drawing's art for the scenes (sample art drawn for the reveals — `public/reveal/art/`). */
const artUrl = (name: ArtName) => `/reveal/art/${name}.webp`;

type Props = {
  kind: RevealTemplateId;
  /** ⏱ Hands-free seconds (9 · 12 · 16) — the couple's, else the house's 12. */
  speedSec?: number;
  /** The couple's initials, e.g. "A & J" — the lettered logo, and the names on the scratch foil. */
  monogram: string;
  /** The couple's mark — the logo woven, pressed and stamped into the reveal. */
  markSvg?: string | null;
  /** The veil's tulle colour — used by the veil's still face (reduced motion). */
  veilColor?: string;
  /** ♿ Reduced motion: the closed reveal, still; a tap cross-fades it away. */
  still?: boolean;
  /** Previews: open by itself (after `autoplayAfterMs`), no hand needed. */
  autoplay?: boolean;
  autoplayAfterMs?: number;
  onAutoLift?: () => void;
  /** Small previews: backing resolution capped at 1×. */
  lowRes?: boolean;
  /** The closed reveal is drawn (the overlay's plain backing can go). */
  onReady?: () => void;
  /** 👆 INSIDE the unveil gesture (tap / swipe / scratch past 60 %): the page and the music start here. */
  onUnveil?: () => void;
  /** The motion is through — the page beneath may take over. */
  onRevealed: () => void;
  /** …and the reveal has faded off the screen. */
  onCleared?: () => void;
};

type Grab = { t0: number; x0: number; y0: number; nx: number; ny: number };

export default function SceneReveal(props: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const hitRef = useRef<HTMLDivElement>(null);
  const cb = useRef(props);
  cb.current = props;

  useEffect(() => {
    const mount = mountRef.current;
    const hit = hitRef.current;
    if (!mount || !hit) return;
    const { kind, still = false, autoplay = false, autoplayAfterMs = 0, lowRes = false } = cb.current;
    const speed = snapRevealSpeed(cb.current.speedSec);
    let dead = false;
    let cleared = false;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));
    /* never gate the guest: whatever fails, the page is revealed */
    const giveUp = () => {
      if (dead || cleared) return;
      cleared = true;
      cb.current.onReady?.();
      cb.current.onRevealed();
      cb.current.onCleared?.();
    };

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: true });
    } catch {
      giveUp();
      return;
    }
    const cv = renderer.domElement;
    cv.style.display = 'block';
    cv.style.width = '100%';
    cv.style.height = '100%';
    cv.style.opacity = '0';
    mount.appendChild(cv);
    const size = () => ({ w: cv.clientWidth || window.innerWidth || 375, h: cv.clientHeight || window.innerHeight || 667 });
    let { w: pw, h: ph } = size();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowRes ? 1 : 2));
    renderer.setSize(pw, ph, false);
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, pw / ph, 0.1, 100);
    camera.position.set(0, 0, CAMZ);

    let sc: Scene | null = null;
    let state: SceneState = 'closed';
    let lift = 0;
    let target = 0;
    let auto = false;
    let autoT = 0;
    let locked = false;
    let feather = 0;
    let t = 0;
    let ptau = 0;
    let z0 = CAMZ;
    let raf = 0;
    let last = performance.now();
    const grabs = new Map<number, Grab>();
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const hitv = new THREE.Vector3();
    const world = (nx: number, ny: number, z: number): Pt => {
      ray.setFromCamera(new THREE.Vector2(nx, ny), camera);
      plane.constant = -z;
      return ray.ray.intersectPlane(plane, hitv) ? { x: hitv.x, y: hitv.y } : { x: 0, y: 0 };
    };
    const ndc = (e: PointerEvent): [number, number] => {
      const r = cv.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2];
    };

    /* ── the open ────────────────────────────────────────────────────────── */
    const startAuto = () => {
      auto = true;
      autoT = 0;
      locked = true;
    };
    const setLift = (v: number) => {
      auto = false;
      target = v;
      locked = v > 0.3;
    };
    /** The unveil: once. `gesture` — inside a guest's own touch, where the music may start. */
    const opened = (nx: number, ny: number, gesture: boolean) => {
      if (state !== 'closed' || !sc) return;
      state = 'opening';
      const w = world(nx, ny, FZ);
      sc.opened?.(w.x, w.y, nx, ny);
      if (gesture) {
        try {
          cb.current.onUnveil?.();
        } catch {
          /* a listener never stops the open */
        }
      }
    };
    const tapOpen = (nx: number, ny: number, gesture: boolean) => {
      if (!sc || sc.noTap) return;
      if (!locked && target < 1) {
        opened(nx, ny, gesture);
        startAuto();
      }
    };
    /** ♿ still: the tap cross-fades the closed reveal away. */
    const fadeAway = (ms: number) => {
      cv.style.transition = `opacity ${ms}ms ease-out`;
      cv.style.opacity = '0';
      later(() => {
        if (dead) return;
        cleared = true;
        cb.current.onCleared?.();
      }, ms);
    };
    const stillOpen = (gesture: boolean) => {
      if (state !== 'closed') return;
      state = 'open';
      if (gesture) {
        try {
          cb.current.onUnveil?.();
        } catch {
          /* never stops the open */
        }
      }
      cb.current.onRevealed();
      fadeAway(REVEAL_REDUCED_FADE_MS);
    };

    /* ── one frame ───────────────────────────────────────────────────────── */
    const tick = (realDt: number) => {
      if (!sc) return;
      const dt = 1 / 60;
      t += dt;
      if (auto) {
        autoT += realDt / speed;
        const p = Math.min(1, autoT);
        target = handsFreeTarget(p);
        if (p > 0.3) feather = Math.round(speed * REVEAL_MOTION.FEATHER_FPS);
        if (autoT >= 1) {
          auto = false;
          target = 1;
        }
      }
      if (feather > 0) feather--;
      lift = stepLift(lift, target);
      if (sc.legacyT) {
        const T = sc.legacyT / 0.97;
        if (state === 'closed') sc.step(dt, t, -1, false);
        else {
          const tau = lift * T;
          const d2 = Math.max(0, tau - ptau);
          ptau = tau;
          sc.step(d2, t, tau, false);
        }
      } else sc.step(dt, t, lift, feather > 0);
      if (!sc.ownCam) camera.position.z = pushedZ(z0, sc.push ?? REVEAL_MOTION.PUSH, lift);
      if (lift > REVEAL_MOTION.DONE && state !== 'open') {
        state = 'open';
        cb.current.onRevealed();
        fadeAway(sc.fadeMs ?? 700);
      }
    };
    const loop = (now: number) => {
      raf = 0;
      if (dead || cleared) return;
      const realDt = revealDt(now, last);
      last = now;
      tick(realDt);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };

    /* ── touch, exactly as the veil reads it ─────────────────────────────── */
    const onDown = (e: PointerEvent) => {
      // 👇 the press primes the song, so a swipe's or a scratch's later play() is allowed (PR #7129)
      primeUnveilPress();
      if (!sc) return;
      const [nx, ny] = ndc(e);
      grabs.set(e.pointerId, { t0: performance.now(), x0: e.clientX, y0: e.clientY, nx, ny });
      try {
        hit.setPointerCapture(e.pointerId);
      } catch {
        /* not capturable */
      }
      if (!still && state === 'closed') sc.grab?.(e.pointerId, world(nx, ny, FZ), nx, ny);
    };
    const onMove = (e: PointerEvent) => {
      const g = grabs.get(e.pointerId);
      if (!g || !sc || still) return;
      const [nx, ny] = ndc(e);
      g.nx = nx;
      g.ny = ny;
      sc.drag?.(e.pointerId, world(nx, ny, sc.dragZ ?? FZ), nx, ny);
    };
    const onUp = (e: PointerEvent) => {
      const g = grabs.get(e.pointerId);
      if (!g || !sc) return;
      grabs.delete(e.pointerId);
      const [nx, ny] = ndc(e);
      const gesture = readGesture({ dx: e.clientX - g.x0, dy: e.clientY - g.y0, ms: performance.now() - g.t0, dir: sc.dir });
      if (still) {
        if (gesture !== 'hold' || sc.noTap) stillOpen(true);
        return;
      }
      sc.release?.(e.pointerId, nx, ny);
      if (sc.noTap) return;
      if (gesture === 'open') {
        opened(nx, ny, true);
        setLift(1);
      } else if (gesture === 'tap') tapOpen(nx, ny, true);
      /* 'close' is not offered: one unveil per visit (the page and the song have already started) */
    };
    const onCancel = (e: PointerEvent) => {
      grabs.delete(e.pointerId);
      sc?.release?.(e.pointerId, 0, 0);
    };
    hit.addEventListener('pointerdown', onDown);
    hit.addEventListener('pointermove', onMove);
    hit.addEventListener('pointerup', onUp);
    hit.addEventListener('pointercancel', onCancel);

    /* ── resize: re-fit, never rebuild (a rebuild would re-close an opening reveal) ── */
    const ro =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => {
            const s = size();
            if (s.w < 2 || s.h < 2 || (s.w === pw && s.h === ph)) return;
            pw = s.w;
            ph = s.h;
            renderer.setSize(pw, ph, false);
            camera.aspect = pw / ph;
            camera.updateProjectionMatrix();
            if (still && sc) renderer.render(scene, camera);
          })
        : null;
    ro?.observe(cv);

    /* ── build ───────────────────────────────────────────────────────────── */
    const build = async () => {
      const make = await LOADERS[kind]();
      const logo = await logoMask(cb.current.markSvg, cb.current.monogram);
      if (dead) return;
      const s = make();
      const aspect = pw / ph;
      const legacy = !!s.legacyT;
      const H = LEGACY_H;
      const W = H * aspect;
      if (legacy) {
        camera.fov = LEGACY_FOV;
        camera.position.set(0, 0, H / 2 / Math.tan((LEGACY_FOV / 2) * (Math.PI / 180)));
        camera.updateProjectionMatrix();
      }
      z0 = camera.position.z;
      renderer.outputColorSpace = s.srgb || s.pbr ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
      renderer.toneMapping = s.pbr ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
      renderer.toneMappingExposure = s.exposure ?? 1;
      const vh = (CAMZ - FZ) * Math.tan((FOV * Math.PI) / 360);
      const ctx: Ctx = {
        renderer,
        scene,
        camera,
        W,
        H,
        HW: W / 2,
        HH: H / 2,
        vw: vh * aspect,
        vh,
        px: { w: pw, h: ph },
        rand: seeded(7 + REVEAL_TEMPLATE_IDS.indexOf(kind) * 13),
        art: (name) =>
          new Promise<HTMLImageElement>((res, rej) => {
            const im = new Image();
            im.decoding = 'async';
            im.onload = () => res(im);
            im.onerror = () => rej(new Error(`reveal art ${name}`));
            im.src = artUrl(name);
          }),
        logo,
        names: cb.current.monogram,
        veilColor: cb.current.veilColor ?? '#f3ece1',
        open: (nx, ny) => {
          if (still) return stillOpen(false);
          if (state !== 'closed') return;
          opened(nx, ny, true);
          startAuto();
        },
        state: () => state,
        progress: () => undefined,
      };
      /* 💡 the drawing's colours are raw numbers (three.js r128) — build them so (see scenes/kit.ts) */
      const cm = THREE.ColorManagement.enabled;
      THREE.ColorManagement.enabled = false;
      try {
        await s.init(ctx);
      } finally {
        THREE.ColorManagement.enabled = cm;
      }
      if (dead) {
        s.dispose?.();
        return;
      }
      sc = s;
      /* the closed reveal, drawn */
      sc.step(1 / 60, 0, legacy ? -1 : 0, false);
      renderer.render(scene, camera);
      cv.style.opacity = '1';
      hit.style.pointerEvents = 'auto';
      hit.style.touchAction = 'none';
      // 🙈 the reveal is really up and can be opened: the page behind stays held until it is (`lib/hub-veil.ts`)
      claimVeilHold();
      cb.current.onReady?.();
      if (still) return;
      if (autoplay) {
        const go = () => {
          if (dead || state !== 'closed' || !sc) return;
          cb.current.onAutoLift?.();
          if (sc.demo) sc.demo();
          else {
            opened(0, 0.1, false);
            startAuto();
          }
        };
        if (autoplayAfterMs > 0) later(go, autoplayAfterMs);
        else go();
      }
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    build().catch(() => giveUp());

    return () => {
      dead = true;
      if (raf) cancelAnimationFrame(raf);
      for (const id of timers) window.clearTimeout(id);
      ro?.disconnect();
      hit.removeEventListener('pointerdown', onDown);
      hit.removeEventListener('pointermove', onMove);
      hit.removeEventListener('pointerup', onUp);
      hit.removeEventListener('pointercancel', onCancel);
      sc?.dispose?.();
      disposeScene(scene);
      renderer.dispose();
      if (cv.parentNode) cv.parentNode.removeChild(cv);
    };
    // Mount-once: the stage owns its own lifecycle; callbacks are read through `cb`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={mountRef} className="absolute inset-0" style={{ pointerEvents: 'none' }} aria-hidden data-scene-reveal={props.kind}>
      {/* The hit-zone: it starts 'none' and is armed only once the closed reveal is drawn — any path that never gets
          there (no WebGL, a failed load) leaves the page usable, never a sheet of glass (the veil's rule). */}
      <div ref={hitRef} className="absolute inset-0" style={{ pointerEvents: 'none' }} />
    </div>
  );
}
