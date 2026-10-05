/**
 * apps/web/lib/celebration-engine.ts
 *
 * 🎉 THE WHEN YES CELEBRATION'S ENGINE — one canvas, no libraries, translated
 * from the approved prototype (`prototypes/when_yes_celebration_2026-10-06_fable.html`,
 * "THE ENGINE"; DECISION_LOG '"WHEN YES" GETS A CELEBRATION (PRO)').
 *
 *   · Confetti  — a burst from the top, falls, fades            · 2.7 s
 *   · Fireworks — four bursts                                    · 3.0 s
 *   · Petals    — drift and tumble                               · 3.0 s
 *   · Sparklers — a short shimmer around the guest's NAME only   · 2.3 s
 *   · reduced motion — every pick becomes ONE calm wash          · 1.6 s
 *
 * Each plays ONCE and CLEARS ITSELF: when it ends every pixel is cleared, and a
 * clock WATCHDOG ends it even if frames stop (a hidden tab, a switched app) — a
 * guest who comes back never finds it still going, and nothing stays over the
 * ticket. Particle size is scaled to the canvas and CAPPED (1.8×), so a 1440
 * screen is not a 4× phone; the device pixel ratio is capped at 2.
 *
 * Loaded ONLY by `import()` from the guest page's celebration and the Maker's
 * dropdown previews — never in a shared bundle, never in the Maker's first load.
 * Browser-only (canvas, rAF); a pure module otherwise.
 */
import type { RsvpCelebration } from './rsvp-celebration';

const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)]!;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Where the sparklers shimmer — the guest's name, in canvas pixels. */
export type CelebrationRect = { x: number; y: number; w: number; h: number };

type System = {
  duration: number;
  step(t: number, dt: number): void;
  draw(ctx: CanvasRenderingContext2D, t: number): void;
};

/** How long each pick plays, in seconds (the reduced-motion wash is `CALM_SECONDS`). */
export const CELEBRATION_SECONDS: Readonly<Record<Exclude<RsvpCelebration, 'none'>, number>> = {
  confetti: 2.7,
  fireworks: 3.0,
  petals: 3.0,
  sparklers: 2.3,
};
export const CALM_SECONDS = 1.6;
/** The watchdog's grace past an effect's own length. */
export const WATCHDOG_GRACE_SECONDS = 0.4;

function sysConfetti(w: number, h: number, c: readonly string[], s: number): System {
  const n = clamp(Math.round(150 * s * s), 18, 320);
  const ps = Array.from({ length: n }, () => ({
    x: w * rnd(0.3, 0.7),
    y: -rnd(0.02, 0.1) * h,
    vx: rnd(-1, 1) * 230 * s,
    vy: rnd(40, 260) * s,
    w: rnd(6, 10) * s,
    h: rnd(10, 16) * s,
    rot: rnd(0, TAU),
    vr: rnd(-7, 7),
    col: pick(c),
    ph: rnd(0, TAU),
    delay: rnd(0, 0.3),
  }));
  return {
    duration: CELEBRATION_SECONDS.confetti,
    step(t, dt) {
      for (const p of ps) {
        if (t < p.delay) continue;
        p.vy += 520 * s * dt;
        p.vy *= Math.pow(0.985, dt * 60);
        p.vx *= Math.pow(0.985, dt * 60);
        p.vx += Math.sin(t * 4 + p.ph) * 60 * s * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
      }
    },
    draw(ctx, t) {
      const fade = t > 2.0 ? clamp(1 - (t - 2.0) / 0.7, 0, 1) : 1;
      for (const p of ps) {
        if (t < p.delay) continue;
        ctx.globalAlpha = fade;
        ctx.fillStyle = p.col;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(Math.max(0.15, Math.abs(Math.cos(t * 6 + p.ph))), 1);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
  };
}

function sysFireworks(w: number, h: number, c: readonly string[], s: number): System {
  type Spark = { x: number; y: number; vx: number; vy: number; life: number; col: string; r: number };
  const bursts = [0, 0.45, 0.95, 1.4].map((t0, i) => ({
    t0,
    x: w * rnd(0.22, 0.78),
    y: h * rnd(0.14, 0.42),
    a: c[i % c.length]!,
    b: c[(i + 2) % c.length]!,
    ps: null as Spark[] | null,
  }));
  const drag = 0.97;
  return {
    duration: CELEBRATION_SECONDS.fireworks,
    step(t, dt) {
      for (const b of bursts) {
        if (t >= b.t0 && !b.ps) {
          const n = clamp(Math.round(70 * s), 16, 140);
          b.ps = Array.from({ length: n }, () => {
            const a = rnd(0, TAU);
            const v = rnd(50, 210) * s;
            return { x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.9, 1.5), col: Math.random() < 0.55 ? b.a : b.b, r: rnd(1.4, 3) * s };
          });
        }
        if (b.ps)
          for (const p of b.ps) {
            p.vx *= Math.pow(drag, dt * 60);
            p.vy = p.vy * Math.pow(drag, dt * 60) + 95 * s * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
          }
      }
    },
    draw(ctx, t) {
      const fadeAll = t > 2.4 ? clamp(1 - (t - 2.4) / 0.6, 0, 1) : 1;
      for (const b of bursts) {
        if (!b.ps) continue;
        const age = t - b.t0;
        if (age < 0.16) {
          ctx.globalAlpha = (1 - age / 0.16) * 0.5 * fadeAll;
          ctx.strokeStyle = b.a;
          ctx.lineWidth = 2 * s;
          ctx.beginPath();
          ctx.arc(b.x, b.y, age * 260 * s, 0, TAU);
          ctx.stroke();
        }
        for (const p of b.ps) {
          const a = clamp(1 - age / p.life, 0, 1);
          if (a <= 0) continue;
          ctx.globalAlpha = a * fadeAll;
          ctx.strokeStyle = p.col;
          ctx.fillStyle = p.col;
          ctx.lineWidth = p.r;
          ctx.beginPath();
          ctx.moveTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 0.8, 0, TAU);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    },
  };
}

function sysPetals(w: number, h: number, c: readonly string[], s: number): System {
  const n = clamp(Math.round(40 * s * s), 10, 90);
  const ps = Array.from({ length: n }, () => ({
    x: rnd(0, w),
    y: -rnd(0.02, 0.25) * h,
    delay: rnd(0, 1.1),
    vy: rnd(70, 135) * s,
    sway: rnd(30, 70) * s,
    swf: rnd(1.2, 2.6),
    ph: rnd(0, TAU),
    rot: rnd(0, TAU),
    vr: rnd(-2.2, 2.2),
    size: rnd(7, 12) * s,
    col: pick(c),
  }));
  return {
    duration: CELEBRATION_SECONDS.petals,
    step(t, dt) {
      for (const p of ps) {
        if (t < p.delay) continue;
        const a = t - p.delay;
        p.y += p.vy * dt;
        p.x += Math.cos(a * p.swf + p.ph) * p.sway * dt;
        p.rot += p.vr * dt;
      }
    },
    draw(ctx, t) {
      const fade = t > 2.2 ? clamp(1 - (t - 2.2) / 0.8, 0, 1) : 1;
      for (const p of ps) {
        if (t < p.delay) continue;
        const tumble = 0.55 + 0.45 * Math.abs(Math.cos((t - p.delay) * p.swf * 1.3 + p.ph));
        ctx.globalAlpha = 0.92 * fade;
        ctx.fillStyle = p.col;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(tumble, 1);
        const z = p.size;
        ctx.beginPath();
        ctx.moveTo(0, -z);
        ctx.bezierCurveTo(z * 0.95, -z * 0.55, z * 0.9, z * 0.5, 0, z);
        ctx.bezierCurveTo(-z * 0.9, z * 0.5, -z * 0.95, -z * 0.55, 0, -z);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
  };
}

function sysSparklers(w: number, h: number, c: readonly string[], s: number, rect?: CelebrationRect | null): System {
  const R = rect ?? { x: w * 0.3, y: h * 0.3, w: w * 0.4, h: h * 0.14 };
  const pad = 6 * s;
  type Spark = { x: number; y: number; vx: number; vy: number; life: number; born: number; col: string; r: number; star: boolean };
  const ps: Spark[] = [];
  let acc = 0;
  const EMIT = 1.7;
  const perim = (): [number, number] => {
    const x0 = R.x - pad;
    const y0 = R.y - pad;
    const x1 = R.x + R.w + pad;
    const y1 = R.y + R.h + pad;
    const side = Math.random();
    if (side < 0.4) return [rnd(x0, x1), y0];
    if (side < 0.8) return [rnd(x0, x1), y1];
    if (side < 0.9) return [x0, rnd(y0, y1)];
    return [x1, rnd(y0, y1)];
  };
  return {
    duration: CELEBRATION_SECONDS.sparklers,
    step(t, dt) {
      const rate = t < EMIT ? 300 * Math.max(s, 0.5) * (1 - t / EMIT) : 0;
      acc += rate * dt;
      while (acc >= 1) {
        acc--;
        const [x, y] = perim();
        ps.push({ x, y, vx: rnd(-1, 1) * 70 * s, vy: rnd(-1, 0.6) * 70 * s, life: rnd(0.22, 0.55), born: t, col: pick(c), r: rnd(0.9, 2.1) * s, star: Math.random() < 0.28 });
      }
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i]!;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 55 * s * dt;
        if (t - p.born > p.life) ps.splice(i, 1);
      }
    },
    draw(ctx, t) {
      for (const p of ps) {
        const a = clamp(1 - (t - p.born) / p.life, 0, 1);
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.col;
        ctx.fillStyle = p.col;
        if (p.star) {
          const L = p.r * 4.5 * a + 1;
          ctx.lineWidth = Math.max(0.6, p.r * 0.5);
          ctx.beginPath();
          ctx.moveTo(p.x - L, p.y);
          ctx.lineTo(p.x + L, p.y);
          ctx.moveTo(p.x, p.y - L);
          ctx.lineTo(p.x, p.y + L);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, TAU);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    },
  };
}

/**
 * Reduced motion: one soft wash, in and out. The gradient is painted ONCE on a
 * small offscreen canvas and stretched each frame — a full-size radial fill
 * per frame cost ~500 ms in a software-rasterised tab (the prototype's check).
 * Drawn OVER the page (the door's card is opaque), so it peaks lower than the
 * prototype's behind-the-words wash: the words never lose their contrast.
 */
function sysCalm(w: number, h: number, c: readonly string[]): System {
  const W = 96;
  const H = Math.max(8, Math.round((96 * h) / w));
  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
  const o = off.getContext('2d');
  if (o) {
    const g = o.createRadialGradient(W * 0.5, H * 0.3, 0, W * 0.5, H * 0.3, Math.max(W, H) * 0.7);
    g.addColorStop(0, c[c.length - 1] ?? '#f2c8c2');
    g.addColorStop(0.55, c[Math.min(2, c.length - 1)] ?? '#b8893f');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    o.fillStyle = g;
    o.fillRect(0, 0, W, H);
  }
  return {
    duration: CALM_SECONDS,
    step() {},
    draw(ctx, t) {
      ctx.globalAlpha = Math.sin(Math.PI * clamp(t / CALM_SECONDS, 0, 1)) * 0.22;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 0, 0, w, h);
      ctx.globalAlpha = 1;
    },
  };
}

export type CelebrationOptions = {
  colours: readonly string[];
  /** prefers-reduced-motion (or a simulation of it): the calm wash instead. */
  reduced?: boolean;
  /** The sparklers' target (the guest's name), in canvas CSS pixels. */
  rect?: CelebrationRect | null;
  /** Particle size/speed scale — default the canvas width over a 375 phone, capped. */
  scale?: number;
  /** A preview that plays again after a short rest (the Maker's dropdown rows). */
  loop?: boolean;
  /**
   * 📸 One still frame at this second, for a screenshot (the prototype's
   * `freezeAt`): the effect is stepped to it, drawn once and left on the canvas.
   * Only the dev labs pass it — a guest's play never does.
   */
  freezeAt?: number;
};

export type CelebrationResult = {
  kind: RsvpCelebration;
  frames: number;
  seconds: number;
  /** The clock ended it — frames had stopped. */
  watchdog?: boolean;
};

/**
 * One canvas's player. `play` resolves when the effect has ENDED AND CLEARED
 * (by its own clock, or the watchdog's). A new `play` stops the last one.
 */
export class CelebrationPlayer {
  private ctx: CanvasRenderingContext2D | null;
  private raf = 0;
  private wd: ReturnType<typeof setTimeout> | null = null;
  private again: ReturnType<typeof setTimeout> | null = null;
  private sys: System | null = null;
  private w = 1;
  private h = 1;
  private loop = false;
  private settle: ((r: CelebrationResult) => void) | null = null;
  playing = false;
  frames = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d');
    canvas.dataset.celebrateState = 'idle';
  }

  private fit() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private build(kind: RsvpCelebration, o: CelebrationOptions): System | null {
    if (kind === 'none') return null;
    const cols = o.colours.length > 0 ? o.colours : ['#c24e25', '#b8893f'];
    if (o.reduced) return sysCalm(this.w, this.h, cols);
    const s = o.scale ?? clamp(this.w / 375, 0.35, 1.8);
    if (kind === 'confetti') return sysConfetti(this.w, this.h, cols, s);
    if (kind === 'fireworks') return sysFireworks(this.w, this.h, cols, s);
    if (kind === 'petals') return sysPetals(this.w, this.h, cols, s);
    return sysSparklers(this.w, this.h, cols, s, o.rect);
  }

  play(kind: RsvpCelebration, o: CelebrationOptions): Promise<CelebrationResult> {
    this.stop();
    this.fit();
    this.frames = 0;
    this.loop = Boolean(o.loop);
    const sys = this.build(kind, o);
    this.sys = sys;
    const ctx = this.ctx;
    if (!sys || !ctx) {
      this.canvas.dataset.celebrateState = 'idle';
      return Promise.resolve({ kind, frames: 0, seconds: 0 });
    }
    if (o.freezeAt != null) {
      const dt = 1 / 60;
      let t = 0;
      while (t < o.freezeAt) {
        sys.step(t, dt);
        t += dt;
      }
      ctx.clearRect(0, 0, this.w, this.h);
      sys.draw(ctx, t);
      this.frames = 1;
      this.canvas.dataset.celebrateState = 'frozen';
      return Promise.resolve({ kind, frames: 1, seconds: t });
    }
    this.playing = true;
    this.canvas.dataset.celebrateState = 'playing';
    return new Promise<CelebrationResult>((resolve) => {
      this.settle = resolve;
      /* The clock starts at the FIRST frame, so a late first frame (a busy
         page) starts the effect from its beginning rather than mid-way. */
      let t0 = -1;
      let last = 0;
      const begun = performance.now();
      /* ⏱ The watchdog: the effect ENDS on the clock even if frames stop. */
      this.wd = setTimeout(() => {
        if (this.playing && this.sys === sys) this.finish({ kind, frames: this.frames, seconds: (performance.now() - begun) / 1000, watchdog: true });
      }, (sys.duration + WATCHDOG_GRACE_SECONDS) * 1000);
      const tick = (now: number) => {
        if (!this.playing || this.sys !== sys) return;
        if (t0 < 0) {
          t0 = now;
          last = now;
        }
        const t = (now - t0) / 1000;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        sys.step(t, dt);
        ctx.clearRect(0, 0, this.w, this.h);
        sys.draw(ctx, t);
        this.frames++;
        if (t >= sys.duration) {
          const result = { kind, frames: this.frames, seconds: t };
          const loop = this.loop;
          this.finish(result);
          if (loop) {
            this.loop = true;
            this.again = setTimeout(() => {
              if (this.loop) void this.play(kind, o);
            }, 350);
          }
          return;
        }
        this.raf = requestAnimationFrame(tick);
      };
      this.raf = requestAnimationFrame(tick);
    });
  }

  private finish(result?: CelebrationResult) {
    cancelAnimationFrame(this.raf);
    if (this.wd) clearTimeout(this.wd);
    this.wd = null;
    this.playing = false;
    this.ctx?.clearRect(0, 0, this.w, this.h);
    this.canvas.dataset.celebrateState = 'idle';
    const settle = this.settle;
    this.settle = null;
    if (settle) settle(result ?? { kind: 'none', frames: this.frames, seconds: 0 });
  }

  /** Stop now, clear every pixel, end any loop. */
  stop() {
    this.loop = false;
    if (this.again) clearTimeout(this.again);
    this.again = null;
    this.finish();
  }

  /** Every pixel's alpha is 0 — what "cleared" means in the checks. */
  cleared(): boolean {
    const ctx = this.ctx;
    if (!ctx || this.canvas.width === 0 || this.canvas.height === 0) return true;
    const d = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i]) return false;
    return true;
  }
}
