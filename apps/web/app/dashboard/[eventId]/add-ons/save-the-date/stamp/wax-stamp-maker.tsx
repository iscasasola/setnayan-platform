'use client';

/**
 * WaxStampMaker — tap-to-drip / hold-to-pour / press-stamp minting ritual.
 *
 * Redesigned UX (PR3):
 *   tap canvas  → one wax drop falls toward the puddle center
 *   hold canvas → continuous drip stream (puddle grows while held)
 *   "Press the stamp" button appears once waxAmt ≥ MIN_WAX_STAMP
 *   press stamp → 850ms depth-ramp animation, then outcome question
 *   outcome     → colour / finish tweaks · "Love it" or "Try again"
 *
 * Two-canvas stack: WebGL puddle on the bottom canvas; a Canvas-2D overlay
 * above it draws the falling drops and merge ripples each rAF frame.
 *
 * Hot path is all refs — no per-frame React state updates. React state is
 * touched only on phase transitions and when waxAmt crosses new territory
 * (first drop visible, canStamp crossing MIN_WAX_STAMP).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
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

type Props = {
  eventId: string;
  markSvg: string | null;
  monogramText: string;
  defaultWaxColor: string;
  swatches: string[];
  fallbackSeed: number;
  existing: WaxSealConfig | null;
};

type Phase = 'idle' | 'pouring' | 'stamping' | 'outcome';
type Drop = { x: number; y: number; vy: number; r: number };
type Ripple = { cx: number; cy: number; r: number; maxR: number; opa: number };

const PREVIEW = 280;
const CX = PREVIEW / 2;
const CY = PREVIEW / 2;
const DROP_WAX = 0.05;       // wax fraction added per merged drop
const MIN_WAX_STAMP = 0.22;  // stamp button appears above this threshold
const MAX_WAX = 0.96;

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
  const canvasRef = useRef<HTMLCanvasElement>(null);   // WebGL / Canvas-2D puddle
  const overlayRef = useRef<HTMLCanvasElement>(null);  // Canvas-2D drops + ripples

  // ── GL state ─────────────────────────────────────────────────────────────
  const glInitRef = useRef(false);
  const glRef = useRef<WaxSealGLState | null>(null);
  const markRef = useRef<HTMLCanvasElement | null>(null);

  // ── animation refs (never trigger React re-renders in the hot path) ──────
  const drops = useRef<Drop[]>([]);
  const ripples = useRef<Ripple[]>([]);
  const rafRef = useRef(0);
  const drippingRef = useRef(false);
  const lastDropRef = useRef(0);
  const waxAmtRef = useRef(0);
  const puddleVisibleRef = useRef(!!existing);
  const colorRef = useRef(defaultWaxColor);
  // Stable ref to the overlay loop; rAF always calls the newest version
  const overlayLoopRef = useRef<FrameRequestCallback>(() => {});

  // ── React state ───────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>(existing ? 'outcome' : 'idle');
  const [seed, setSeed] = useState(existing?.seed ?? fallbackSeed);
  const [waxChoice, setWaxChoice] = useState<string | 'auto'>(
    existing?.wax.color ?? 'auto',
  );
  const [finish, setFinish] = useState<WaxFinish>(
    existing?.wax.finish ?? 'matte',
  );
  const [waxAmt, setWaxAmt] = useState(existing?.pour.amount ?? 0);
  const [puddleVisible, setPuddleVisible] = useState(!!existing);
  const [savedConfig, setSavedConfig] = useState<WaxSealConfig | null>(existing);
  const [verdict, setVerdict] = useState(existing ? 'Your saved seal.' : '');
  const [savedDepth, setSavedDepth] = useState(existing?.press.depth ?? 0.82);

  const resolvedColor = waxChoice === 'auto' ? defaultWaxColor : waxChoice;
  const markSource: WaxMarkSource = markSvg
    ? /<image[\s/>]/i.test(markSvg)
      ? 'uploaded'
      : 'custom'
    : 'letters';

  // Keep colorRef in sync so the rAF overlay loop sees fresh colours
  useEffect(() => { colorRef.current = resolvedColor; }, [resolvedColor]);

  // ── paint helper ──────────────────────────────────────────────────────────
  // useCallback so it re-creates when the recipe fields change; the ref below
  // ensures the rAF loop always has the latest version without stale closures.
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
          config: cfg,
          mark: markRef.current,
          monogramText,
          waxColor: resolvedColor,
          finish,
          seed,
          size: PREVIEW,
          dpr,
          pressed,
        });
      } else {
        const S = Math.round(PREVIEW * dpr);
        if (cv.width !== S) { cv.width = S; cv.height = S; }
        const ctx = cv.getContext('2d');
        if (!ctx) return;
        paintWaxSeal(ctx, {
          config: cfg,
          mark: markRef.current,
          monogramText,
          waxColor: resolvedColor,
          finish,
          seed,
          size: PREVIEW,
          dpr,
          pressed,
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
          existing.pour.amount,
          true,
          existing.press.depth,
          existing.pour.irregularity,
          existing.pour.bubbles,
        );
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markSvg, monogramText]);

  // Re-paint the outcome seal whenever colour / finish changes
  useEffect(() => {
    if (phase === 'outcome' && savedConfig) {
      paintRef.current(
        savedConfig.pour.amount,
        true,
        savedDepth,
        savedConfig.pour.irregularity,
        savedConfig.pour.bubbles,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, savedConfig, savedDepth, waxChoice, finish]);

  // ── overlay rAF loop (pure-ref hot path, phase captured per-effect) ───────
  //
  // `overlayLoopRef.current` is rebuilt when `phase` changes. React runs effects
  // in declaration order — so this effect fires before the start/stop effect
  // below, meaning the new function is installed before rAF is scheduled.
  useEffect(() => {
    overlayLoopRef.current = () => {
      if (phase !== 'pouring') return;
      const overlay = overlayRef.current;
      if (!overlay) return;
      const ctx = overlay.getContext('2d');
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const S = Math.round(PREVIEW * dpr);
      if (overlay.width !== S || overlay.height !== S) {
        overlay.width = S;
        overlay.height = S;
      }
      ctx.clearRect(0, 0, S, S);

      // Spawn a new drop while holding (one every ~110 ms)
      const now = performance.now();
      if (drippingRef.current && now - lastDropRef.current > 110) {
        lastDropRef.current = now;
        drops.current.push({
          x: CX + (Math.random() - 0.5) * 8,
          y: -8,
          vy: 1.8 + Math.random() * 0.6,
          r: 5 + Math.random() * 3,
        });
      }

      // Decode wax color for overlay drawing
      const hex = (colorRef.current || '#5c2542').replace('#', '');
      const n = parseInt(hex, 16);
      const wr = (n >> 16) & 255;
      const wg = (n >> 8) & 255;
      const wb = n & 255;

      // Thin stream line from the source to the lowest drop in flight
      if (drippingRef.current && drops.current.length > 0) {
        const lowestY = drops.current.reduce((m, d) => Math.max(m, d.y + d.r), -8);
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.beginPath();
        ctx.moveTo(CX, -2);
        ctx.lineTo(CX, Math.min(lowestY, CY - 4));
        ctx.strokeStyle = `rgba(${wr},${wg},${wb},0.32)`;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      }

      // Update drops; merge into the puddle when they reach the center
      const surviving: Drop[] = [];
      let waxChanged = false;
      for (const d of drops.current) {
        d.vy += 0.45;
        d.y += d.vy;
        if (d.y >= CY) {
          const newAmt = Math.min(MAX_WAX, waxAmtRef.current + DROP_WAX);
          waxAmtRef.current = newAmt;
          waxChanged = true;
          if (!puddleVisibleRef.current) {
            puddleVisibleRef.current = true;
            setPuddleVisible(true);
          }
          ripples.current.push({ cx: d.x, cy: CY, r: d.r * 0.4, maxR: 20, opa: 0.72 });
          continue;
        }
        surviving.push(d);
        // Vertical teardrop shape
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
      }

      // Draw and age ripples
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

  // Start / stop the overlay loop when phase changes
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

  // ── pointer events (the canvas stack is the tap / hold target) ───────────
  const handlePointerDown = useCallback(() => {
    if (phase === 'stamping' || phase === 'outcome') return;
    if (phase === 'idle') setPhase('pouring');
    drippingRef.current = true;
    lastDropRef.current = 0; // spawn immediately on next frame
    // One drop on the down-event itself
    drops.current.push({
      x: CX + (Math.random() - 0.5) * 6,
      y: -8,
      vy: 2,
      r: 5 + Math.random() * 2.5,
    });
  }, [phase]);

  const handlePointerUp = useCallback(() => {
    drippingRef.current = false;
  }, []);

  // ── stamp action ──────────────────────────────────────────────────────────
  const doStamp = useCallback(() => {
    setPhase('stamping');
    drippingRef.current = false;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    const ov = overlayRef.current;
    const ctx = ov?.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, ov!.width, ov!.height);

    const amt = waxAmtRef.current;
    const bu = amt > 0.82 ? (amt - 0.82) * 4.5 : 0;
    const DEPTH = 0.84;
    const verdicts = [
      'A clean, crisp press.',
      'Soft and generous — every edge full.',
      'Deep and perfectly set.',
      'Rich and over-poured — gorgeous.',
    ];
    const v = verdicts[Math.min(Math.floor(amt / 0.25), 3)];
    const startedAt = performance.now();

    const ramp = () => {
      const k = Math.min(1, (performance.now() - startedAt) / 850);
      paintRef.current(amt, true, DEPTH * k, 0.3, bu);
      if (k < 1) {
        rafRef.current = requestAnimationFrame(ramp);
      } else {
        const cfg: WaxSealConfig = {
          v: WAX_SEAL_V,
          seed,
          wax: { color: waxChoice === 'auto' ? null : waxChoice, finish },
          pour: { amount: amt, irregularity: 0.3, bubbles: bu },
          press: { crispness: 0.74, depth: DEPTH, offset: [0, 0], skew: 0 },
          mark: { source: markSource },
          isDefault: false,
        };
        setSavedConfig(cfg);
        setSavedDepth(DEPTH);
        setVerdict(v);
        setPhase('outcome');
      }
    };
    rafRef.current = requestAnimationFrame(ramp);
  }, [seed, waxChoice, finish, markSource]);

  // ── reset to fresh pour ───────────────────────────────────────────────────
  const reset = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    drops.current = [];
    ripples.current = [];
    drippingRef.current = false;
    waxAmtRef.current = 0;
    puddleVisibleRef.current = false;
    setWaxAmt(0);
    setPuddleVisible(false);
    setSavedConfig(null);
    setVerdict('');
    setSeed(randSeed());
    setPhase('idle');
    const ov = overlayRef.current;
    const ctx = ov?.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, ov!.width, ov!.height);
    const gl = glRef.current?.gl;
    if (gl) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
  }, []);

  // Final cleanup on unmount
  useEffect(() => () => { cancelAnimationFrame(rafRef.current); }, []);

  const canStamp = waxAmt >= MIN_WAX_STAMP && phase === 'pouring';

  return (
    <section
      id="wax-maker"
      className="overflow-hidden rounded-2xl border border-ink/10 bg-[radial-gradient(120%_100%_at_50%_30%,#241c17_0%,#15110e_72%)] text-cream"
    >
      <div className="flex flex-col items-center gap-6 p-6 sm:p-10">

        {/* ── seal stage (tap / hold target) ─────────────────────────────── */}
        <div
          className="relative touch-none select-none"
          style={{
            width: PREVIEW,
            height: PREVIEW,
            maxWidth: '100%',
            cursor: phase === 'idle' || phase === 'pouring' ? 'crosshair' : 'default',
          }}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* WebGL / Canvas-2D puddle (fades in on the first drop) */}
          <canvas
            ref={canvasRef}
            width={PREVIEW}
            height={PREVIEW}
            aria-hidden
            className="absolute inset-0 block transition-opacity duration-300"
            style={{ width: PREVIEW, height: PREVIEW, opacity: puddleVisible ? 1 : 0 }}
          />

          {/* Drop + ripple overlay (non-interactive) */}
          <canvas
            ref={overlayRef}
            width={PREVIEW}
            height={PREVIEW}
            aria-hidden
            className="pointer-events-none absolute inset-0 block"
            style={{ width: PREVIEW, height: PREVIEW }}
          />

          {/* Idle prompt */}
          {phase === 'idle' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-cream/35">
                Tap to drip · Hold to pour
              </p>
            </div>
          )}

          {/* Wax drip source — thin line at top-center during pour */}
          {phase === 'pouring' && (
            <div
              className="pointer-events-none absolute left-1/2 -translate-x-1/2"
              style={{ top: 0 }}
            >
              <div
                className="mx-auto w-px rounded-b"
                style={{ height: 8, background: resolvedColor, opacity: 0.55 }}
              />
            </div>
          )}

          {/* Stamping label */}
          {phase === 'stamping' && (
            <div className="pointer-events-none absolute inset-x-0 bottom-5 flex justify-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cream/50">
                Setting…
              </p>
            </div>
          )}
        </div>

        {/* ── controls per phase ─────────────────────────────────────────── */}
        <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">

          {(phase === 'idle' || phase === 'pouring') && (
            <>
              {phase === 'idle' && (
                <p className="text-sm text-cream/65">
                  Drip wax to build your seal — then press your stamp into it.
                </p>
              )}
              {phase === 'pouring' && !canStamp && (
                <p className="text-sm text-cream/50">Keep dripping…</p>
              )}
              {canStamp && (
                <button
                  type="button"
                  onClick={doStamp}
                  className="inline-flex min-h-[44px] animate-pulse items-center gap-2 rounded-full bg-cream px-6 text-sm font-semibold text-ink transition hover:bg-cream/90"
                >
                  Press the stamp
                </button>
              )}
            </>
          )}

          {phase === 'outcome' && savedConfig && (
            <>
              {verdict && (
                <p className="flex items-center justify-center gap-1.5 text-sm text-cream/90">
                  <Sparkles aria-hidden className="h-4 w-4 text-[#cb9e4b]" strokeWidth={1.75} />
                  {verdict}
                </p>
              )}

              {/* wax colour */}
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
                        waxChoice === hex
                          ? 'ring-cream'
                          : 'ring-transparent hover:ring-cream/40'
                      }`}
                      style={{ background: hex }}
                    />
                  ))}
                </div>
              </div>

              {/* finish */}
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

              {/* actions */}
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
                  <button
                    type="submit"
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#cb9e4b] px-6 text-sm font-semibold text-ink transition hover:bg-[#b8923f]"
                  >
                    <Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                    Love it — use this seal
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
