'use client';

/**
 * WaxStampMaker — the candle-stamp minting ritual (0024 §3 · PR2).
 *
 * The couple pours the wax, waits for it to set (the one skill beat — the 3-zone
 * consistency window from Wax_Seal_Creation_Rules), then presses their monogram
 * die straight in. Every pour mints a one-of-a-kind seal (a deterministic
 * recipe + seed), recoloured from their Mood Board. It then renders with the
 * exact same `paintWaxSeal` the live guest reveal uses, so what they mint is what
 * a guest sees. Free, ₱0 — the recipe is data, the die + colour are read live.
 *
 * UX north star: you cannot get stuck or fail. A plain tap pours; the needle
 * dwells in "ready"; idling auto-presses a perfect seal; there is always a
 * one-tap "mint a clean seal"; prefers-reduced-motion skips the animation.
 * No twist gesture exists (so the no-twist craft rule holds by construction).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, Sparkles, Stamp, Wand2 } from 'lucide-react';
import { buildMarkCanvas, paintWaxSeal } from '@/lib/wax-seal/paint';
import {
  WAX_SEAL_V,
  type WaxFinish,
  type WaxMarkSource,
  type WaxSealConfig,
} from '@/lib/wax-seal/types';
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

type Phase = 'intro' | 'pour' | 'cool' | 'set' | 'confirm';

type Final = {
  amount: number;
  irregularity: number;
  bubbles: number;
  crispness: number;
  depth: number;
  offset: [number, number];
  skew: number;
  isDefault: boolean;
  verdict: string;
};

const PREVIEW = 280; // CSS px

function randSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/** Consistency needle over time (s): hot → dwells in the ready band → firm. */
function needleAt(t: number): number {
  if (t < 1.2) return 1 - (t / 1.2) * 0.26; // 1.00 → 0.74  (HOT, quick)
  if (t < 6) return 0.74 - ((t - 1.2) / 4.8) * 0.4; // 0.74 → 0.34 (READY, dwell)
  if (t < 8) return Math.max(0, 0.34 - ((t - 6) / 2) * 0.34); // 0.34 → 0 (FIRM)
  return 0;
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markRef = useRef<CanvasImageSource | null>(null);
  const rafRef = useRef(0);
  const reduced = useRef(false);
  // The pour's window-level release backstop (so a release ANYWHERE ends it —
  // touch implicit-capture can route pointerup to a now-unmounted node).
  const pourRelease = useRef<((e: Event) => void) | null>(null);
  const endPourRef = useRef<() => void>(() => {});

  // fast-changing animation state (not React state — avoids per-frame re-render)
  const anim = useRef({
    amount: 0.6,
    irregularity: 0.3,
    bubbles: 0,
    depth: 0,
    needle: 1,
    holding: false,
    t0: 0,
    pressedAt: 0,
  });

  const [phase, setPhase] = useState<Phase>(existing ? 'confirm' : 'intro');
  const [seed, setSeed] = useState<number>(existing?.seed ?? fallbackSeed);
  const [waxChoice, setWaxChoice] = useState<string | 'auto'>(existing?.wax.color ?? 'auto');
  const [finish, setFinish] = useState<WaxFinish>(existing?.wax.finish ?? 'matte');
  const [final, setFinal] = useState<Final | null>(
    existing
      ? {
          amount: existing.pour.amount,
          irregularity: existing.pour.irregularity,
          bubbles: existing.pour.bubbles,
          crispness: existing.press.crispness,
          depth: existing.press.depth,
          offset: existing.press.offset,
          skew: existing.press.skew,
          isDefault: existing.isDefault ?? false,
          verdict: 'Your saved seal.',
        }
      : null,
  );
  const [needleUi, setNeedleUi] = useState(1); // mirrors anim.needle for the meter

  const resolvedColor = waxChoice === 'auto' ? defaultWaxColor : waxChoice;
  const markSource: WaxMarkSource = markSvg
    ? /<image[\s/>]/i.test(markSvg)
      ? 'uploaded'
      : 'custom'
    : 'letters';

  // paint the seal canvas from the given levers
  const paint = useCallback(
    (opts: { amount: number; irregularity: number; bubbles: number; crispness: number; depth: number; offset: [number, number]; skew: number; pressed: boolean }) => {
      const cv = canvasRef.current;
      if (!cv) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const S = Math.round(PREVIEW * dpr);
      if (cv.width !== S) {
        cv.width = S;
        cv.height = S;
      }
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      paintWaxSeal(ctx, {
        config: {
          v: WAX_SEAL_V,
          seed,
          wax: { color: waxChoice === 'auto' ? null : waxChoice, finish },
          pour: { amount: opts.amount, irregularity: opts.irregularity, bubbles: opts.bubbles },
          press: { crispness: opts.crispness, depth: opts.depth, offset: opts.offset, skew: opts.skew },
          mark: { source: markSource },
        },
        mark: markRef.current,
        monogramText,
        waxColor: resolvedColor,
        finish,
        seed,
        size: PREVIEW,
        dpr,
        pressed: opts.pressed,
      });
    },
    [seed, waxChoice, finish, resolvedColor, monogramText, markSource],
  );

  // build the die once + detect reduced-motion
  useEffect(() => {
    reduced.current =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    let cancelled = false;
    buildMarkCanvas(markSvg).then((c) => {
      if (!cancelled) {
        markRef.current = c;
        // repaint the current view now the die is ready
        if (final) {
          paint({ ...final, pressed: true });
        } else {
          paint({ amount: anim.current.amount, irregularity: anim.current.irregularity, bubbles: 0, crispness: 0.6, depth: 0, offset: [0, 0], skew: 0, pressed: false });
        }
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markSvg]);

  // re-paint the confirm view whenever colour / finish / final changes
  useEffect(() => {
    if (phase === 'confirm' && final) paint({ ...final, pressed: true });
  }, [phase, final, paint]);

  const stopRaf = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  };

  const enterConfirm = useCallback(
    (vals: Final) => {
      stopRaf();
      setFinal(vals);
      setPhase('confirm');
    },
    [],
  );

  // ── press → set → confirm ──
  const doPress = useCallback(
    (needle: number) => {
      const a = anim.current;
      const ready = needle <= 0.74 && needle >= 0.34;
      const hot = needle > 0.74;
      const crispness = hot ? 0.24 : ready ? 0.52 + Math.random() * 0.16 : 0.82;
      const targetDepth = hot ? 0.6 : ready ? 0.82 : 0.4;
      const bubbles = Math.min(1, a.bubbles + (hot ? 0.28 : 0));
      const offset: [number, number] = [(Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.18];
      const skew = (Math.random() - 0.5) * 0.1;
      const verdict = hot
        ? 'A touch early — soft and dreamy.'
        : ready
          ? 'A crisp, clean press.'
          : 'Set a little firm — quiet and shallow.';
      const finalVals: Final = {
        amount: a.amount,
        irregularity: a.irregularity,
        bubbles,
        crispness,
        depth: targetDepth,
        offset,
        skew,
        isDefault: false,
        verdict,
      };

      if (reduced.current) {
        enterConfirm(finalVals);
        return;
      }

      // brief "setting…" — ramp depth from 0 to target
      setPhase('set');
      a.pressedAt = performance.now();
      const ramp = () => {
        const k = Math.min(1, (performance.now() - a.pressedAt) / 1100);
        paint({
          amount: finalVals.amount,
          irregularity: finalVals.irregularity,
          bubbles: finalVals.bubbles,
          crispness: finalVals.crispness,
          depth: targetDepth * k,
          offset,
          skew,
          pressed: true,
        });
        if (k < 1) {
          rafRef.current = requestAnimationFrame(ramp);
        } else {
          enterConfirm(finalVals);
        }
      };
      stopRaf();
      rafRef.current = requestAnimationFrame(ramp);
    },
    [enterConfirm, paint],
  );

  // ── cool beat: the needle drifts + dwells; press whenever (or auto) ──
  const startCool = useCallback(() => {
    const a = anim.current;
    a.t0 = performance.now();
    setPhase('cool');
    if (reduced.current) {
      a.needle = 0.5;
      doPress(0.5);
      return;
    }
    const loop = () => {
      const t = (performance.now() - a.t0) / 1000;
      a.needle = needleAt(t);
      setNeedleUi(a.needle);
      paint({ amount: a.amount, irregularity: a.irregularity, bubbles: a.bubbles, crispness: 0.6, depth: 0, offset: [0, 0], skew: 0, pressed: false });
      if (t > 6.5) {
        // idled through the window → auto-press a perfect seal
        doPress(0.5);
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    stopRaf();
    rafRef.current = requestAnimationFrame(loop);
  }, [doPress, paint]);

  // ── pour beat: hold to grow the puddle (tap = default puddle) ──
  const detachPourRelease = useCallback(() => {
    const r = pourRelease.current;
    if (r) {
      window.removeEventListener('pointerup', r);
      window.removeEventListener('pointercancel', r);
      pourRelease.current = null;
    }
  }, []);

  const endPour = useCallback(() => {
    const a = anim.current;
    if (!a.holding) return;
    a.holding = false;
    detachPourRelease();
    // A quick tap (no real hold) pours a default-size puddle — you can't pour wrong.
    if (performance.now() - a.t0 < 200) a.amount = 0.6;
    stopRaf();
    startCool();
  }, [startCool, detachPourRelease]);
  endPourRef.current = endPour;

  const startPour = useCallback(() => {
    const a = anim.current;
    a.amount = 0.5;
    a.bubbles = 0;
    a.irregularity = 0.24 + Math.random() * 0.14;
    a.holding = true;
    a.t0 = performance.now();
    setPhase('pour');
    // End the pour on release ANYWHERE (the pour button is a persistent node so
    // its own pointerup fires, but this backstop also covers release off-button
    // / lost capture) → the pour can never get stuck.
    detachPourRelease();
    const release = () => endPourRef.current();
    pourRelease.current = release;
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    const loop = () => {
      if (!a.holding) return;
      const held = (performance.now() - a.t0) / 1000;
      a.amount = Math.min(0.95, 0.5 + held * 0.4);
      if (held > 1.6) a.bubbles = Math.min(0.5, (held - 1.6) * 0.3); // overheat
      paint({ amount: a.amount, irregularity: a.irregularity, bubbles: a.bubbles, crispness: 0.6, depth: 0, offset: [0, 0], skew: 0, pressed: false });
      rafRef.current = requestAnimationFrame(loop);
    };
    stopRaf();
    rafRef.current = requestAnimationFrame(loop);
  }, [paint, detachPourRelease]);

  // one-tap perfect seal (accessibility / "I just want a seal")
  const mintClean = useCallback(() => {
    stopRaf();
    const s = randSeed();
    setSeed(s);
    anim.current.amount = 0.62;
    anim.current.irregularity = 0.28;
    anim.current.bubbles = 0;
    enterConfirm({
      amount: 0.62,
      irregularity: 0.28,
      bubbles: 0,
      crispness: 0.6,
      depth: 0.82,
      offset: [0, 0],
      skew: 0,
      isDefault: true,
      verdict: 'A clean, classic seal.',
    });
  }, [enterConfirm]);

  const pourAgain = useCallback(() => {
    stopRaf();
    setSeed(randSeed());
    setFinal(null);
    anim.current.amount = 0.6;
    anim.current.bubbles = 0;
    anim.current.depth = 0;
    setPhase('intro');
  }, []);

  useEffect(
    () => () => {
      stopRaf();
      detachPourRelease();
    },
    [detachPourRelease],
  );

  const config: WaxSealConfig | null = final
    ? {
        v: WAX_SEAL_V,
        seed,
        wax: { color: waxChoice === 'auto' ? null : waxChoice, finish },
        pour: { amount: final.amount, irregularity: final.irregularity, bubbles: final.bubbles },
        press: { crispness: final.crispness, depth: final.depth, offset: final.offset, skew: final.skew },
        mark: { source: markSource },
        isDefault: final.isDefault,
      }
    : null;

  const zone = needleUi > 0.74 ? 'hot' : needleUi >= 0.34 ? 'ready' : 'firm';

  return (
    <section
      id="wax-maker"
      className="overflow-hidden rounded-2xl border border-ink/10 bg-[radial-gradient(120%_100%_at_50%_30%,#241c17_0%,#15110e_72%)] text-cream"
    >
      <div className="flex flex-col items-center gap-6 p-6 sm:p-10">
        {/* the seal stage */}
        <div className="relative" style={{ width: PREVIEW, maxWidth: '100%' }}>
          <canvas
            ref={canvasRef}
            width={PREVIEW}
            height={PREVIEW}
            aria-hidden
            className={`mx-auto block transition-transform duration-500 ${
              phase === 'set' ? 'scale-[0.98]' : 'scale-100'
            }`}
            style={{ width: PREVIEW, height: PREVIEW, maxWidth: '100%' }}
          />
          {phase === 'intro' ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Stamp aria-hidden className="h-10 w-10 text-cream/40" strokeWidth={1.25} />
            </div>
          ) : null}
        </div>

        {/* the consistency meter (cool beat only) */}
        {phase === 'cool' ? (
          <div className="w-full max-w-sm space-y-2">
            <div className="relative h-3 overflow-hidden rounded-full bg-cream/15">
              {/* the green "ready" band: 0.34..0.74 of the track */}
              <div className="absolute inset-y-0 rounded-full bg-emerald-400/30" style={{ left: '34%', right: '26%' }} />
              <div
                className="absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-cream shadow"
                style={{ left: `calc(${needleUi * 100}% - 2px)` }}
              />
            </div>
            <p className="text-center font-mono text-[11px] uppercase tracking-[0.24em] text-cream/70">
              {zone === 'ready' ? 'Ready — press now' : zone === 'hot' ? 'Too hot — let it set' : 'Setting firm'}
            </p>
          </div>
        ) : null}

        {/* copy + controls per phase */}
        <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
          {phase === 'intro' || phase === 'pour' ? (
            <>
              <p className="text-sm text-cream/75">
                {phase === 'pour'
                  ? 'Hold to pour more wax — let go when the puddle looks right.'
                  : 'This is your stamp. Press it into warm wax to mint your seal — every pour is one of a kind.'}
              </p>
              {/* ONE persistent button across intro→pour: the same DOM node holds
                  the pointer capture, so the release that ends the pour always
                  lands on a handler (touch implicit-capture safe). */}
              <button
                type="button"
                onPointerDown={startPour}
                onPointerUp={endPour}
                onPointerCancel={endPour}
                className="inline-flex min-h-[44px] touch-none select-none items-center gap-2 rounded-full bg-cream px-6 text-sm font-semibold text-ink transition hover:bg-cream/90"
              >
                {phase === 'pour' ? 'Release to set' : 'Pour the wax'}
              </button>
            </>
          ) : null}

          {phase === 'cool' ? (
            <button
              type="button"
              onClick={() => {
                stopRaf();
                doPress(anim.current.needle);
              }}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-cream px-6 text-sm font-semibold text-ink transition hover:bg-cream/90"
            >
              <Stamp aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Press the stamp
            </button>
          ) : null}

          {phase === 'set' ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-cream/70">Setting…</p>
          ) : null}

          {phase === 'confirm' && final ? (
            <>
              <p className="flex items-center justify-center gap-2 text-sm text-cream/85">
                <Sparkles aria-hidden className="h-4 w-4 text-[#cb9e4b]" strokeWidth={1.75} />
                {final.verdict}
              </p>

              {/* wax colour */}
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cream/55">Wax colour</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setWaxChoice('auto')}
                    className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                      waxChoice === 'auto' ? 'bg-cream text-ink' : 'bg-cream/15 text-cream/80 hover:bg-cream/25'
                    }`}
                  >
                    Mood Board
                  </button>
                  {swatches.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Wax ${hex}`}
                      onClick={() => setWaxChoice(hex)}
                      className={`h-7 w-7 rounded-full ring-2 ring-offset-2 ring-offset-[#15110e] transition ${
                        waxChoice === hex ? 'ring-cream' : 'ring-transparent hover:ring-cream/40'
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
                      finish === f ? 'bg-cream text-ink' : 'bg-cream/15 text-cream/80 hover:bg-cream/25'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={pourAgain}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-cream/30 px-5 text-sm font-medium text-cream/85 transition hover:bg-cream/10"
                >
                  <RotateCcw aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  Pour again
                </button>
                <form action={saveWaxSeal}>
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="config" value={JSON.stringify(config)} />
                  <button
                    type="submit"
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#cb9e4b] px-6 text-sm font-semibold text-ink transition hover:bg-[#b8923f]"
                  >
                    Use this seal
                  </button>
                </form>
              </div>
            </>
          ) : null}

          {phase !== 'confirm' ? (
            <button
              type="button"
              onClick={mintClean}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-cream/50 underline-offset-4 hover:text-cream/80 hover:underline"
            >
              <Wand2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Or just mint a clean seal
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
