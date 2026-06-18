'use client';

/**
 * WaxStampMaker — pour any amount of wax, then physically push the stamp.
 *
 * UX flow:
 *   tap canvas  → one small drop falls (freedom: small amounts are valid)
 *   hold canvas → continuous stream (larger amount builds up)
 *   wax limit   → MAX_WAX cap stops drops from adding (can still hold)
 *   push stamp  → press & hold the die above the canvas; it descends while
 *                  held and the WebGL impression deepens in real time;
 *                  release when the depth feels right
 *   outcome     → verdict based on achieved press depth + colour/finish tweaks
 *
 * Two-canvas stack: WebGL puddle (bottom) + Canvas-2D drop/ripple overlay (top).
 * The stamp visual lives in an overhead zone above the canvas; its translateY
 * is driven directly via ref in rAF — never through React state.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';
import { paintWaxSeal } from '@/lib/wax-seal/paint';
import {
  WAX_SEAL_V,
  type WaxFinish,
  type WaxMarkSource,
  type WaxSealConfig,
} from '@/lib/wax-seal/types';
import {
  buildDieForGL,
  initWaxSealGL,
  paintWaxSealWebGL,
  type WaxSealGLState,
} from '@/lib/wax-seal/paint-webgl';
import { saveWaxSeal } from '../wax-actions';
import { SubmitButton } from '@/app/_components/submit-button';

type Props = {
  eventId: string;
  markSvg: string | null;
  monogramText: string;
  defaultWaxColor: string;
  swatches: string[];
  fallbackSeed: number;
  existing: WaxSealConfig | null;
};

type Phase = 'idle' | 'pouring' | 'pressing' | 'outcome';
type Drop = { x: number; y: number; vy: number; r: number };
type Ripple = { cx: number; cy: number; r: number; maxR: number; opa: number };

const PREVIEW         = 280;   // canvas side px
const CX              = PREVIEW / 2;
const CY              = PREVIEW / 2;
const STAMP_CLEARANCE = 120;   // overhead zone above canvas px
const STAMP_HANDLE_H  = 34;    // handle height px
const STAMP_DIE_D     = 80;    // die diameter px
const STAMP_H         = STAMP_HANDLE_H + STAMP_DIE_D; // 114 px
// STAMP_TOP: stamp top edge so die bottom aligns with canvas top at rest
// = STAMP_CLEARANCE - STAMP_H = 120 - 114 = 6 px from container top
const STAMP_TOP       = STAMP_CLEARANCE - STAMP_H;    // 6
const STAMP_TRAVEL    = 62;    // max downward travel into canvas px
const DROP_WAX        = 0.05;  // wax per merged drop
const MIN_PRESS       = 0.04;  // minimum wax to allow pressing (≈ 1 drop)
const MAX_WAX         = 0.96;
const MAX_PRESS_DEPTH = 0.86;
const FULL_PRESS_MS   = 2200;  // time to reach MAX_PRESS_DEPTH from press start

function randSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}

export function WaxStampMaker({
  eventId,
  markSvg,
  monogramText,
  defaultWaxColor,
  swatches,
  fallbackSeed,
  existing,
}: Props) {
  // ── canvas refs ──────────────────────────────────────────────────────────
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  // ── stamp visual refs (transform driven directly — never via React state) ─
  const stampRef      = useRef<HTMLDivElement>(null);
  const stampLabelRef = useRef<HTMLParagraphElement>(null);

  // ── GL state ─────────────────────────────────────────────────────────────
  const glInitRef = useRef(false);
  const glRef     = useRef<WaxSealGLState | null>(null);
  const markRef   = useRef<HTMLCanvasElement | null>(null);

  // ── animation refs (hot path — never trigger React re-renders) ───────────
  const drops   = useRef<Drop[]>([]);
  const ripples = useRef<Ripple[]>([]);
  const rafRef      = useRef(0);   // overlay loop rAF id
  const pressRafRef = useRef(0);   // press loop rAF id

  const drippingRef        = useRef(false);
  const lastDropRef        = useRef(0);
  const waxAmtRef          = useRef(0);
  const puddleVisibleRef   = useRef(!!existing);
  const colorRef           = useRef(defaultWaxColor);
  const overlayLoopRef     = useRef<FrameRequestCallback>(() => {});
  const pressLoopRef       = useRef<FrameRequestCallback>(() => {});

  // pressing-specific refs
  const pressStartRef    = useRef(0);
  const pressDepthRef    = useRef(0);
  const isPressActiveRef = useRef(false);
  const finalizeRef      = useRef(() => {});

  // puddle position (hot path — no React state)
  const pudCXRef      = useRef(CX);  // puddle center x in canvas-px (drifts toward tap)
  const tapXRef       = useRef(CX);  // most recent tap x in pour-zone stage-px
  const syncOffsetRef = useRef<() => void>(() => {});

  // ── React state ───────────────────────────────────────────────────────────
  const [phase, setPhase]                 = useState<Phase>(existing ? 'outcome' : 'idle');
  const [seed, setSeed]                   = useState(existing?.seed ?? fallbackSeed);
  const [waxChoice, setWaxChoice]         = useState<string | 'auto'>(existing?.wax.color ?? 'auto');
  const [finish, setFinish]               = useState<WaxFinish>(existing?.wax.finish ?? 'matte');
  const [waxAmt, setWaxAmt]               = useState(existing?.pour.amount ?? 0);
  const [puddleVisible, setPuddleVisible] = useState(!!existing);
  const [savedConfig, setSavedConfig]     = useState<WaxSealConfig | null>(existing);
  const [verdict, setVerdict]             = useState(existing ? 'Your saved seal.' : '');
  const [savedDepth, setSavedDepth]       = useState(existing?.press.depth ?? 0.82);

  const resolvedColor = waxChoice === 'auto' ? defaultWaxColor : waxChoice;
  const markSource: WaxMarkSource = markSvg
    ? /<image[\s/>]/i.test(markSvg) ? 'uploaded' : 'custom'
    : 'letters';

  useEffect(() => { colorRef.current = resolvedColor; }, [resolvedColor]);

  // ── paint helper ──────────────────────────────────────────────────────────
  const paintCb = useCallback(
    (am: number, pressed: boolean, de: number, irr = 0.3, bu = 0) => {
      const cv = canvasRef.current;
      if (!cv) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cfg: WaxSealConfig = {
        v: WAX_SEAL_V,
        seed,
        wax: { color: waxChoice === 'auto' ? null : waxChoice, finish },
        pour: { amount: am, irregularity: irr, bubbles: bu },
        press: { crispness: 0.74, depth: de, offset: [0, 0], skew: 0 },
        mark: { source: markSource },
      };
      const gl = glRef.current;
      if (gl) {
        paintWaxSealWebGL(gl, {
          config: cfg, mark: markRef.current, monogramText,
          waxColor: resolvedColor, finish, seed, size: PREVIEW, dpr, pressed,
        });
      } else {
        const S = Math.round(PREVIEW * dpr);
        if (cv.width !== S) { cv.width = S; cv.height = S; }
        const ctx = cv.getContext('2d');
        if (!ctx) return;
        paintWaxSeal(ctx, {
          config: cfg, mark: markRef.current, monogramText,
          waxColor: resolvedColor, finish, seed, size: PREVIEW, dpr, pressed,
        });
      }
    },
    [seed, waxChoice, finish, resolvedColor, monogramText, markSource],
  );
  const paintRef = useRef(paintCb);
  useEffect(() => { paintRef.current = paintCb; }, [paintCb]);

  // ── GL + die init ─────────────────────────────────────────────────────────
  useEffect(() => {
    const cv = canvasRef.current;
    if (cv && !glInitRef.current) {
      glInitRef.current = true;
      glRef.current = initWaxSealGL(cv);
    }
    let cancelled = false;
    buildDieForGL(markSvg, monogramText).then((c) => {
      if (cancelled) return;
      markRef.current = c;
      if (existing) {
        paintRef.current(
          existing.pour.amount, true, existing.press.depth,
          existing.pour.irregularity, existing.pour.bubbles,
        );
        // Restore horizontal puddle position from saved config
        if (existing.pour.cx_offset && canvasRef.current) {
          const savedDx = existing.pour.cx_offset * CX;
          canvasRef.current.style.transform = `translateX(${savedDx}px)`;
        }
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markSvg, monogramText]);

  // Re-paint outcome seal when colour / finish changes
  useEffect(() => {
    if (phase === 'outcome' && savedConfig) {
      paintRef.current(
        savedConfig.pour.amount, true, savedDepth,
        savedConfig.pour.irregularity, savedConfig.pour.bubbles,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, savedConfig, savedDepth, waxChoice, finish]);

  // Set stamp resting position when it becomes visible (layout effect = no flash)
  useLayoutEffect(() => {
    if (phase !== 'outcome' && stampRef.current) {
      stampRef.current.style.transform = 'translateY(0px)';
      stampRef.current.style.left = `${pudCXRef.current - STAMP_DIE_D / 2}px`;
    }
  }, [phase]);

  // Keeps canvas + stamp aligned to pudCXRef whenever it changes
  useEffect(() => {
    syncOffsetRef.current = () => {
      const dx = pudCXRef.current - CX;
      if (canvasRef.current) canvasRef.current.style.transform = `translateX(${dx}px)`;
      if (overlayRef.current) overlayRef.current.style.transform = `translateX(${dx}px)`;
      if (stampRef.current) stampRef.current.style.left = `${pudCXRef.current - STAMP_DIE_D / 2}px`;
    };
  }, []);

  // ── overlay loop (pour phase) ─────────────────────────────────────────────
  useEffect(() => {
    overlayLoopRef.current = () => {
      if (phase !== 'pouring') return;
      const overlay = overlayRef.current;
      if (!overlay) return;
      const ctx = overlay.getContext('2d');
      if (!ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const S = Math.round(PREVIEW * dpr);
      if (overlay.width !== S || overlay.height !== S) { overlay.width = S; overlay.height = S; }
      ctx.clearRect(0, 0, S, S);

      const now = performance.now();
      if (drippingRef.current && now - lastDropRef.current > 110 && waxAmtRef.current < MAX_WAX) {
        lastDropRef.current = now;
        // Spawn at tap position in canvas coords: visual position = tapXRef in stage
        const spawnDx = pudCXRef.current - CX;
        drops.current.push({
          x: tapXRef.current - spawnDx + (Math.random() - 0.5) * 8,
          y: -8,
          vy: 1.8 + Math.random() * 0.6,
          r: 5 + Math.random() * 3,
        });
      }

      const hex = (colorRef.current || '#5c2542').replace('#', '');
      const n = parseInt(hex, 16);
      const wr = (n >> 16) & 255;
      const wg = (n >> 8) & 255;
      const wb = n & 255;

      // Thin wax stream while dripping (aligned to tap position in canvas coords)
      if (drippingRef.current && drops.current.length > 0) {
        const lowestY = drops.current.reduce((m: number, d: Drop) => Math.max(m, d.y + d.r), -8);
        const streamX = tapXRef.current - (pudCXRef.current - CX);
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.beginPath();
        ctx.moveTo(streamX, -2);
        ctx.lineTo(streamX, Math.min(lowestY, CY - 4));
        ctx.strokeStyle = `rgba(${wr},${wg},${wb},0.32)`;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      }

      // Physics + merge
      const surviving: Drop[] = [];
      let waxChanged = false;
      for (const d of drops.current) {
        d.vy += 0.45;
        d.y  += d.vy;
        if (d.y >= CY) {
          if (waxAmtRef.current < MAX_WAX) {
            waxAmtRef.current = Math.min(MAX_WAX, waxAmtRef.current + DROP_WAX);
            waxChanged = true;
          }
          if (!puddleVisibleRef.current) { puddleVisibleRef.current = true; setPuddleVisible(true); }
          ripples.current.push({ cx: d.x, cy: CY, r: d.r * 0.4, maxR: 20, opa: 0.72 });
          continue;
        }
        surviving.push(d);
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, d.r * 0.52, d.r, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${wr},${wg},${wb},0.9)`;
        ctx.fill();
        ctx.restore();
      }
      drops.current = surviving;

      if (waxChanged) {
        setWaxAmt(waxAmtRef.current);
        const bu = waxAmtRef.current > 0.82 ? (waxAmtRef.current - 0.82) * 4.5 : 0;
        paintRef.current(waxAmtRef.current, false, 0, 0.3, bu);
        syncOffsetRef.current();
      }

      // Ripples
      const alive: Ripple[] = [];
      for (const rip of ripples.current) {
        rip.r = Math.min(rip.r + 1.5, rip.maxR);
        rip.opa -= 0.03;
        if (rip.opa <= 0) continue;
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.beginPath();
        ctx.arc(rip.cx, rip.cy, rip.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${wr},${wg},${wb},${rip.opa})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.restore();
        alive.push(rip);
      }
      ripples.current = alive;

      rafRef.current = requestAnimationFrame(overlayLoopRef.current);
    };
  }, [phase]);

  // Start / stop overlay loop
  useEffect(() => {
    if (phase === 'pouring') {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(overlayLoopRef.current);
    } else {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      const ov = overlayRef.current;
      const ctx = ov?.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, ov!.width, ov!.height);
    }
    return () => { cancelAnimationFrame(rafRef.current); };
  }, [phase]);

  // ── press loop (pressing phase) ───────────────────────────────────────────
  useEffect(() => {
    pressLoopRef.current = () => {
      if (phase !== 'pressing') return;
      const elapsed  = performance.now() - pressStartRef.current;
      const progress = Math.min(1, elapsed / FULL_PRESS_MS);
      const depth    = progress * MAX_PRESS_DEPTH;
      pressDepthRef.current = depth;

      // Move stamp downward — direct DOM, no React re-render
      if (stampRef.current) {
        stampRef.current.style.transform = `translateY(${progress * STAMP_TRAVEL}px)`;
      }

      // Update label text at the sweet-spot threshold
      if (stampLabelRef.current) {
        if (depth >= 0.56 && stampLabelRef.current.dataset.stage !== 'ready') {
          stampLabelRef.current.dataset.stage = 'ready';
          stampLabelRef.current.textContent = 'Release when ready';
          stampLabelRef.current.style.color = `rgba(${parseInt((colorRef.current||'#5c2542').slice(1,3),16)},${parseInt((colorRef.current||'#5c2542').slice(3,5),16)},${parseInt((colorRef.current||'#5c2542').slice(5,7),16)},0.8)`;
        }
      }

      // Paint WebGL in real time as stamp descends
      const amt = waxAmtRef.current;
      const bu  = amt > 0.82 ? (amt - 0.82) * 4.5 : 0;
      paintRef.current(amt, true, depth, 0.3, bu);

      if (isPressActiveRef.current) {
        pressRafRef.current = requestAnimationFrame(pressLoopRef.current);
      }
    };
  }, [phase]);

  // Start press loop when phase becomes 'pressing'
  useEffect(() => {
    if (phase === 'pressing') {
      cancelAnimationFrame(pressRafRef.current);
      pressRafRef.current = requestAnimationFrame(pressLoopRef.current);
    } else {
      cancelAnimationFrame(pressRafRef.current);
      pressRafRef.current = 0;
    }
    return () => { cancelAnimationFrame(pressRafRef.current); };
  }, [phase]);

  // ── finalize press → outcome ───────────────────────────────────────────────
  const finalizePress = useCallback(() => {
    cancelAnimationFrame(pressRafRef.current);
    pressRafRef.current = 0;

    const depth = pressDepthRef.current;
    const amt   = waxAmtRef.current;
    const bu    = amt > 0.82 ? (amt - 0.82) * 4.5 : 0;

    const verdictText =
      depth < 0.28 ? 'A delicate, barely-there impression.'
      : depth < 0.55 ? 'Lightly pressed — subtle and considered.'
      : depth < 0.76 ? 'A crisp, clean press — just right.'
      : 'Pressed deep — full and rich.';

    const cfg: WaxSealConfig = {
      v: WAX_SEAL_V,
      seed,
      wax: { color: waxChoice === 'auto' ? null : waxChoice, finish },
      pour: { amount: amt, irregularity: 0.3, bubbles: bu, cx_offset: (pudCXRef.current - CX) / CX },
      press: { crispness: 0.74, depth: Math.max(0.05, depth), offset: [0, 0], skew: 0 },
      mark: { source: markSource },
      isDefault: false,
    };

    // Reset stamp visual before it's removed from DOM
    if (stampRef.current) stampRef.current.style.transform = 'translateY(0px)';
    if (stampLabelRef.current) {
      stampLabelRef.current.textContent = 'Push to stamp';
      stampLabelRef.current.style.color = 'rgba(240,234,216,0.45)';
      delete stampLabelRef.current.dataset.stage;
    }

    setSavedConfig(cfg);
    setSavedDepth(Math.max(0.05, depth));
    setVerdict(verdictText);
    setPhase('outcome');
  }, [seed, waxChoice, finish, markSource]);

  useEffect(() => { finalizeRef.current = finalizePress; }, [finalizePress]);

  // ── stamp push handler ────────────────────────────────────────────────────
  const handleStampDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    if (waxAmtRef.current < MIN_PRESS) return;
    if (phase !== 'idle' && phase !== 'pouring') return;

    // Stop any ongoing drip
    drippingRef.current = false;
    drops.current = [];
    ripples.current = [];

    // Reset label for this press session
    if (stampLabelRef.current) {
      stampLabelRef.current.textContent = 'Hold…';
      stampLabelRef.current.style.color = 'rgba(240,234,216,0.45)';
      delete stampLabelRef.current.dataset.stage;
    }

    pressStartRef.current    = performance.now();
    isPressActiveRef.current = true;
    pressDepthRef.current    = 0;

    setPhase('pressing');

    const onRelease = () => {
      isPressActiveRef.current = false;
      finalizeRef.current();
    };
    window.addEventListener('pointerup',     onRelease, { once: true });
    window.addEventListener('pointercancel', onRelease, { once: true });
  }, [phase]);

  // ── canvas pour handlers ──────────────────────────────────────────────────
  const handleCanvasDown = useCallback((e: React.PointerEvent) => {
    if (phase === 'pressing' || phase === 'outcome') return;
    e.stopPropagation();

    // Tap position in pour-zone stage coords (clamped to avoid die-edge overhang)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const tapX = Math.max(STAMP_DIE_D * 0.5, Math.min(PREVIEW - STAMP_DIE_D * 0.5, e.clientX - rect.left));
    tapXRef.current = tapX;

    // First tap locks puddle position; subsequent taps blend toward the new tap
    if (!puddleVisibleRef.current) {
      pudCXRef.current = tapX;
    } else {
      pudCXRef.current = pudCXRef.current * 0.70 + tapX * 0.30;
      pudCXRef.current = Math.max(STAMP_DIE_D * 0.5, Math.min(PREVIEW - STAMP_DIE_D * 0.5, pudCXRef.current));
    }

    if (phase === 'idle') setPhase('pouring');
    drippingRef.current = true;
    lastDropRef.current = 0;

    if (waxAmtRef.current < MAX_WAX) {
      const dx = pudCXRef.current - CX;
      drops.current.push({
        x: tapX - dx + (Math.random() - 0.5) * 6, // canvas coords → appear at tapX in stage
        y: -8,
        vy: 2,
        r: 5 + Math.random() * 2.5,
      });
    }
    syncOffsetRef.current();
  }, [phase]);

  const handleCanvasUp = useCallback(() => { drippingRef.current = false; }, []);

  // Drag while holding to steer where wax pours
  const handleCanvasMove = useCallback((e: React.PointerEvent) => {
    if (!drippingRef.current || phase !== 'pouring') return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const tapX = Math.max(STAMP_DIE_D * 0.5, Math.min(PREVIEW - STAMP_DIE_D * 0.5, e.clientX - rect.left));
    tapXRef.current = tapX;
    pudCXRef.current = pudCXRef.current * 0.93 + tapX * 0.07;
    pudCXRef.current = Math.max(STAMP_DIE_D * 0.5, Math.min(PREVIEW - STAMP_DIE_D * 0.5, pudCXRef.current));
    syncOffsetRef.current();
  }, [phase]);

  // ── reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    cancelAnimationFrame(pressRafRef.current);
    rafRef.current = pressRafRef.current = 0;
    drops.current = [];
    ripples.current = [];
    drippingRef.current = false;
    isPressActiveRef.current = false;
    waxAmtRef.current = 0;
    puddleVisibleRef.current = false;
    pressDepthRef.current = 0;
    pudCXRef.current = CX;
    tapXRef.current = CX;
    if (canvasRef.current) canvasRef.current.style.transform = '';
    if (overlayRef.current) overlayRef.current.style.transform = '';
    setWaxAmt(0);
    setPuddleVisible(false);
    setSavedConfig(null);
    setVerdict('');
    setSeed(randSeed());
    setPhase('idle');
    const ov  = overlayRef.current;
    const ctx = ov?.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, ov!.width, ov!.height);
    const gl = glRef.current?.gl;
    if (gl) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
  }, []);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    cancelAnimationFrame(pressRafRef.current);
  }, []);

  // ── derived layout values ─────────────────────────────────────────────────
  const showStamp  = phase !== 'outcome';
  const containerH = showStamp ? STAMP_CLEARANCE + PREVIEW : PREVIEW;
  const canvasTop  = showStamp ? STAMP_CLEARANCE : 0;
  const canPress   = waxAmt >= MIN_PRESS && (phase === 'idle' || phase === 'pouring');
  const atLimit    = waxAmt >= MAX_WAX;

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <section
      id="wax-maker"
      className="overflow-hidden rounded-2xl border border-ink/10 bg-[radial-gradient(120%_100%_at_50%_30%,#241c17_0%,#15110e_72%)] text-cream"
    >
      <div className="flex flex-col items-center gap-6 p-6 sm:p-10">

        {/* ── seal stage ───────────────────────────────────────────────────── */}
        <div
          className="relative touch-none select-none overflow-visible"
          style={{
            width: PREVIEW,
            maxWidth: '100%',
            height: containerH,
            transition: 'height 0.35s ease',
          }}
        >
          {/* ── stamp visual (overhead zone; descends during pressing) ─────── */}
          {showStamp && (
            <div
              ref={stampRef}
              onPointerDown={handleStampDown}
              className="touch-none select-none"
              style={{
                position: 'absolute',
                top: STAMP_TOP,
                width: STAMP_DIE_D,
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: canPress ? 'pointer' : 'default',
                // NOTE: transform is NOT set here — controlled exclusively via ref
              }}
            >
              {/* Handle */}
              <div
                style={{
                  width: 28,
                  height: STAMP_HANDLE_H,
                  background: 'linear-gradient(135deg,#4a3428 0%,#1c140e 100%)',
                  borderRadius: '5px 5px 0 0',
                  boxShadow: '0 -3px 10px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.08)',
                }}
              />
              {/* Die face */}
              <div
                style={{
                  width: STAMP_DIE_D,
                  height: STAMP_DIE_D,
                  borderRadius: '50%',
                  background: 'radial-gradient(ellipse at 38% 30%,#2e2018 0%,#0f0b07 100%)',
                  boxShadow: `0 0 0 2.5px ${resolvedColor}55, 0 5px 18px rgba(0,0,0,0.75), inset 0 1px 3px rgba(255,255,255,0.06)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: resolvedColor,
                  fontFamily: 'Georgia,"Times New Roman",serif',
                  fontStyle: 'italic',
                  fontSize: 21,
                  opacity: canPress ? 1 : 0.38,
                  transition: 'opacity 0.3s',
                }}
              >
                {monogramText}
              </div>
              {/* Press label (text updated directly via ref during pressing) */}
              <p
                ref={stampLabelRef}
                style={{
                  fontSize: 9,
                  letterSpacing: '0.26em',
                  textTransform: 'uppercase',
                  color: 'rgba(240,234,216,0.45)',
                  fontFamily: 'inherit',
                  marginTop: 6,
                  lineHeight: 1,
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              >
                {canPress ? 'Push to stamp' : 'Pour first'}
              </p>
            </div>
          )}

          {/* ── WebGL / Canvas-2D puddle ─────────────────────────────────── */}
          <canvas
            ref={canvasRef}
            width={PREVIEW}
            height={PREVIEW}
            aria-hidden
            className="absolute block"
            style={{
              top: canvasTop,
              left: 0,
              width: PREVIEW,
              height: PREVIEW,
              opacity: puddleVisible ? 1 : 0,
              transition: 'opacity 0.3s, top 0.35s ease',
            }}
          />

          {/* ── Drop + ripple overlay ─────────────────────────────────────── */}
          <canvas
            ref={overlayRef}
            width={PREVIEW}
            height={PREVIEW}
            aria-hidden
            className="pointer-events-none absolute block"
            style={{
              top: canvasTop,
              left: 0,
              width: PREVIEW,
              height: PREVIEW,
              transition: 'top 0.35s ease',
            }}
          />

          {/* ── Pour interaction zone ─────────────────────────────────────── */}
          <div
            className="absolute"
            style={{
              top: canvasTop,
              left: 0,
              width: PREVIEW,
              height: PREVIEW,
              cursor: (phase === 'idle' || phase === 'pouring') ? 'crosshair' : 'default',
              transition: 'top 0.35s ease',
            }}
            onPointerDown={handleCanvasDown}
            onPointerUp={handleCanvasUp}
            onPointerCancel={handleCanvasUp}
            onPointerMove={handleCanvasMove}
          >
            {/* Idle hint */}
            {phase === 'idle' && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-cream/35">
                  Tap to drip · Hold to pour
                </p>
              </div>
            )}

            {/* Wax-at-limit indicator */}
            {atLimit && phase === 'pouring' && (
              <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
                <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-cream/38">
                  Wax at capacity
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── phase controls ───────────────────────────────────────────────── */}
        <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">

          {(phase === 'idle' || phase === 'pouring') && (
            <p className="text-sm text-cream/60">
              {phase === 'idle'
                ? 'Drip any amount of wax — then push the stamp into it.'
                : waxAmt < MIN_PRESS
                  ? 'Keep dripping…'
                  : 'Ready. Pour more or push the stamp above into the wax.'}
            </p>
          )}

          {phase === 'pressing' && (
            <p className="text-sm text-cream/55">
              Hold until the impression feels right — then release.
            </p>
          )}

          {phase === 'outcome' && savedConfig && (
            <>
              {verdict && (
                <p className="flex items-center justify-center gap-1.5 text-sm text-cream/90">
                  <Sparkles aria-hidden className="h-4 w-4 text-[#cb9e4b]" strokeWidth={1.75} />
                  {verdict}
                </p>
              )}

              {/* Wax colour */}
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cream/55">
                  Wax colour
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setWaxChoice('auto')}
                    className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                      waxChoice === 'auto'
                        ? 'bg-cream text-ink'
                        : 'bg-cream/15 text-cream/80 hover:bg-cream/25'
                    }`}
                  >
                    Mood Board
                  </button>
                  {swatches.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Wax colour ${hex}`}
                      onClick={() => setWaxChoice(hex)}
                      className={`h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-[#15110e] transition ${
                        waxChoice === hex ? 'ring-cream' : 'ring-transparent hover:ring-cream/40'
                      }`}
                      style={{ background: hex }}
                    />
                  ))}
                </div>
              </div>

              {/* Finish */}
              <div className="flex items-center gap-2">
                {(['matte', 'glossy'] as WaxFinish[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFinish(f)}
                    className={`rounded-full px-4 py-1 text-[11px] font-medium capitalize transition ${
                      finish === f
                        ? 'bg-cream text-ink'
                        : 'bg-cream/15 text-cream/80 hover:bg-cream/25'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-cream/30 px-5 text-sm font-medium text-cream/85 transition hover:bg-cream/10"
                >
                  <RotateCcw aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  Try again
                </button>
                <form action={saveWaxSeal}>
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="config" value={JSON.stringify(savedConfig)} />
                  <SubmitButton
                    pendingLabel="Saving…"
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#cb9e4b] px-6 text-sm font-semibold text-ink transition hover:bg-[#b8923f]"
                  >
                    <Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                    Love it — use this seal
                  </SubmitButton>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
