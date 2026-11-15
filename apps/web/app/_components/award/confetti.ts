/**
 * 🎊 BLACK AND GOLD CONFETTI — No. 1 ONLY. A port of `awConfetti` + `awConfettiEnd` from the owner-approved prototype
 * `badge-milestones_v86.html` (owner 15 Nov). Two cannons at the lower left and lower right blow it up; it falls with
 * air drag, swaying and flipping, and a piece that leaves the bottom comes back in from the top — UNTIL `end()`.
 * v86 (owner 15 Nov: "Let us end the confetti once the seal lands to the plaque"): from the landing on nothing new
 * falls — rain still above the top is dropped, the pieces in the air finish their fall, the ones resting on the plaque
 * slide off, and then the canvas is cleared and the loop stops by itself. (Supersedes v46 "never stops".) No fade.
 * v49: handed the No. 1 reveal's live pieces, it adopts them mid-air (no restart). v48: a 120-piece rain set falls
 * alongside the burst so no gap ever opens. Kept light for phones: 110 + 120 pieces, one colour table, setTransform
 * (no save/restore), dpr ≤ 1.5. Frame-rate independent (dt). Loaded only by a dynamic import.
 */
import type { RevealPiece } from './story-rig';

export const CONFETTI_PIECES = 110;
/** v48: the steady rain set alongside the burst, so the density stays even (no empty band). */
export const CONFETTI_RAIN = 120;

const ramp = (k: number) => {
  const a = [
    [104, 70, 10],
    [170, 122, 32],
    [222, 176, 72],
    [252, 224, 140],
  ] as const;
  const f = Math.min(0.999, k / 15) * 3;
  const i = Math.floor(f);
  const u = f - i;
  const p = a[i]!;
  const q = a[i + 1]!;
  return `rgb(${p.map((v, j) => Math.round(v + (q[j]! - v) * u)).join(',')})`;
};
const GOLD = Array.from({ length: 16 }, (_, k) => ramp(k));
const BLACK = Array.from({ length: 16 }, (_, k) => {
  const l = Math.round(10 + (k / 15) * (k / 15) * 70);
  return `rgb(${l},${l},${l + 6})`;
});

/** The reveal's pieces handed to the plaque: `P` in canvas px at 1080 wide, drawn at scale `k` from screen point (ox, oy). */
export type ConfettiSeed = { P: readonly RevealPiece[]; k: number; ox: number; oy: number };

export type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  delay: number;
  w: number;
  h: number;
  rot: number;
  vr: number;
  flip: number;
  vf: number;
  gold: boolean;
  strip: boolean;
  sway: number;
  sw: number;
  amp: number;
  rain: boolean;
  /** v49: adopted from the reveal — its sway comes in over 0.8 s, so nothing jumps on the hand-over. */
  sd?: boolean;
  /** v51: ledges this piece has already decided on (bit per ledge; cleared when it re-enters at the top). */
  done?: number;
  /** v86: out of the show for good (after `end()`). */
  gone?: boolean;
  /** v51: ms left resting on a ledge (> 0 = resting). */
  st?: number;
  /** v51: which ledge it rests on. */
  lg?: number;
  /** v51: its slow slide while resting (px per frame). */
  sl?: number;
  /** v51: the angle it settles to while resting (flat, face up or face down, a little askew). */
  r0?: number;
};

/** v51: the top edge of a plaque part the paper can land on, in canvas px. */
export type Ledge = { y: number; l: number; r: number };

/**
 * v51 — confetti meets the plaque. A piece falling across a ledge (crossing its top edge between its ends, once per
 * ledge) decides ONCE: about a third bounce off, a third land and rest a while, the rest fall past in front.
 * `u` is the roll in [0, 1). Returns what it decided.
 */
export function ledgeDecide(p: Piece, py: number, L: Ledge, li: number, u: number, dpr: number, rnd: (a: number, b: number) => number): 'bounce' | 'rest' | 'past' | null {
  if (!(p.vy > 0 && py <= L.y && p.y > L.y && p.x > L.l + 3 * dpr && p.x < L.r - 3 * dpr) || (p.done ?? 0) & (1 << li)) return null;
  p.done = (p.done ?? 0) | (1 << li);
  if (u < 0.33) {
    p.y = L.y - 1;
    p.vy = -p.vy * rnd(0.25, 0.5);
    p.vx += rnd(-1.6, 1.6) * dpr;
    p.vr = -p.vr * 1.4;
    p.vf *= 1.3;
    return 'bounce';
  }
  if (u < 0.66) {
    p.st = rnd(600, 2600);
    p.lg = li;
    p.y = L.y;
    p.vx = 0;
    p.vy = 0;
    p.sl = rnd(-0.06, 0.06) * dpr;
    p.r0 = Math.round(p.rot / Math.PI) * Math.PI + rnd(-0.35, 0.35);
    return 'rest';
  }
  return 'past';
}

/**
 * v51: one frame of a resting piece — it slides a touch, stops flipping, settles flat on the ledge's top. It lets go
 * (falls on, slowly, with a fresh flip) when its time is up, when its ledge is gone, or when it slides off an end.
 * Returns true when it was released this frame.
 */
export function ledgeRest(p: Piece, L: Ledge | undefined, dt: number, dpr: number, rnd: (a: number, b: number) => number): boolean {
  p.st = (p.st ?? 0) - dt * 16.67;
  p.x += (p.sl ?? 0) * dt;
  p.flip *= Math.pow(0.9, dt);
  p.rot += ((p.r0 ?? p.rot) - p.rot) * 0.1 * dt;
  if (L) p.y = L.y - p.h * 0.18;
  if (!L || p.st <= 0 || p.x < L.l - 4 || p.x > L.r + 4) {
    p.st = 0;
    p.vy = 0.6 * dpr;
    p.vx = (p.sl ?? 0) * 3;
    p.vf = (Math.random() < 0.5 ? -1 : 1) * rnd(0.12, 0.24);
    return true;
  }
  return false;
}

/**
 * v49: when the reveal hands over, these ARE its pieces — same place, same speed, same turn, same size, mid-air.
 * Nothing restarts. Seconds become frames (÷60), the 1080-wide canvas becomes the screen (× k × dpr). One piece in, one out.
 */
export function adoptRevealPieces(seed: ConfettiSeed, dpr: number, rnd: (a: number, b: number) => number = (a, b) => a + Math.random() * (b - a)): Piece[] {
  const sc = seed.k * dpr;
  return seed.P.map((q) => {
    const vf = (q.w + q.spin) / 60;
    return {
      rain: !!q.rain || q.vy > 0,
      x: (seed.ox + q.x * seed.k) * dpr,
      y: (seed.oy + q.y * seed.k) * dpr,
      vx: (q.vx * sc) / 60,
      vy: (q.vy * sc) / 60,
      delay: 0,
      w: q.sw * sc,
      h: q.sh * sc,
      rot: q.r,
      vr: q.vr / 60,
      flip: q.f,
      vf: (vf < 0 ? -1 : 1) * Math.max(0.1, Math.abs(vf)),
      gold: q.gold,
      strip: false,
      sway: rnd(0, 6.28),
      sw: rnd(0.04, 0.08),
      amp: rnd(1, 2.4) * dpr,
      sd: true,
    };
  });
}

/**
 * Rains confetti on `c` while `alive()` holds. With a `seed` (the No. 1 reveal handing over) it adopts the reveal's live
 * pieces instead of firing the cannons; unseeded (Reduce Motion) it fires them. `end()` (the seal has landed) lets the
 * last pieces finish and then stops; `stop()` clears at once (the plaque closed).
 */
export type ConfettiHandle = { stop: () => void; end: () => void };
export function awConfetti(c: HTMLCanvasElement, alive: () => boolean, seed?: ConfettiSeed, ledgeEls?: () => readonly (Element | null)[]): ConfettiHandle {
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  const W = (c.width = Math.round(window.innerWidth * dpr));
  const H = (c.height = Math.round(window.innerHeight * dpr));
  const x = c.getContext('2d');
  if (!x) return { stop: () => {}, end: () => {} };
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const g = 0.0009 * H;
  const N = CONFETTI_PIECES;
  const P: Piece[] = seed ? adoptRevealPieces(seed, dpr, rnd) : Array.from({ length: N }, (_, i) => {
    const L = i % 2 === 0;
    return {
      x: L ? rnd(-0.02, 0.05) * W : W - rnd(-0.02, 0.05) * W,
      y: H * rnd(0.98, 1.04),
      vx: (L ? 1 : -1) * rnd(0.006, 0.02) * W,
      vy: -rnd(0.042, 0.058) * H,
      delay: (i < N * 0.6 ? 0 : rnd(220, 380)) + rnd(0, 80),
      w: rnd(6, 11) * dpr,
      h: rnd(10, 18) * dpr,
      rot: rnd(0, 6.28),
      vr: rnd(-0.25, 0.25),
      flip: rnd(0, 6.28),
      vf: rnd(0.14, 0.3),
      gold: Math.random() < 0.62,
      strip: Math.random() < 0.18,
      sway: rnd(0, 6.28),
      sw: rnd(0.04, 0.08),
      amp: rnd(1, 2.4) * dpr,
      rain: false,
    };
  });
  // v48 (owner: no gaps): a steady rain that starts falling with the burst, spread evenly above the top, so no gap
  // ever opens behind the cloud
  for (let i = 0; i < CONFETTI_RAIN; i++)
    P.push({
      rain: true,
      x: rnd(0, W),
      y: -rnd(10, H * 1.05),
      vx: rnd(-1, 1) * dpr,
      vy: rnd(0.004, 0.007) * H,
      delay: 0,
      w: rnd(6, 11) * dpr,
      h: rnd(10, 18) * dpr,
      rot: rnd(0, 6.28),
      vr: rnd(-0.25, 0.25),
      flip: rnd(0, 6.28),
      vf: rnd(0.14, 0.3),
      gold: Math.random() < 0.62,
      strip: Math.random() < 0.18,
      sway: rnd(0, 6.28),
      sw: rnd(0.04, 0.08),
      amp: rnd(1, 2.4) * dpr,
    });
  const t0 = performance.now();
  let raf = 0;
  let stopped = false;
  // v86 awConfettiEnd: once the seal lands, nothing new falls
  let ended = false;
  let last = t0;
  // v51: ledges the paper can land on (canvas px), re-measured while the plaque rises
  let LG: Ledge[] = [];
  let lgAt = -1e9;
  const ledges = (now: number) => {
    if (!ledgeEls || now - lgAt < 250) return;
    lgAt = now;
    LG = [];
    for (const e of ledgeEls()) {
      if (!e) continue;
      const r = e.getBoundingClientRect();
      if (r.width > 0) LG.push({ y: r.top * dpr, l: r.left * dpr, r: r.right * dpr });
    }
  };
  const paint = (p: Piece) => {
    const k = Math.abs(Math.cos(p.flip));
    const ky = Math.max(0.08, k);
    const cr = Math.cos(p.rot);
    const sr = Math.sin(p.rot);
    x.setTransform(cr, sr, -sr * ky, cr * ky, p.x, p.y);
    x.fillStyle = (p.gold ? GOLD : BLACK)[Math.min(15, Math.round(k * 15))]!;
    if (p.strip) x.fillRect(-p.w * 0.22, -p.h * 0.9, p.w * 0.44, p.h * 1.8);
    else x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
  };
  const clear = () => {
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, W, H);
  };
  const step = (now: number) => {
    if (stopped || !alive()) return clear();
    const t = now - t0;
    const dt = Math.min(2.5, (now - last) / 16.67) || 1;
    last = now;
    clear();
    ledges(now);
    let live = 0;
    for (const p of P) {
      if (p.gone) continue;
      if (ended && p.rain && p.y < -4) {
        p.gone = true;
        continue;
      }
      live++;
      if (t < p.delay) continue;
      if ((p.st ?? 0) > 0) {
        ledgeRest(p, LG[p.lg ?? -1], dt, dpr, rnd);
        paint(p);
        continue;
      }
      const py = p.y;
      p.vy += g * dt;
      const fall = p.vy > 0;
      p.vy *= Math.pow(fall ? 0.9 : 0.982, dt);
      p.vx *= Math.pow(fall ? 0.95 : 0.982, dt);
      p.sway += p.sw * dt;
      p.x += (p.vx + (fall ? Math.sin(p.sway) * p.amp * (p.sd ? Math.min(1, t / 800) : 1) : 0)) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.flip += p.vf * dt;
      if (p.vy > 0)
        for (let li = 0; li < LG.length; li++) {
          if (ledgeDecide(p, py, LG[li]!, li, Math.random(), dpr, rnd)) break;
        }
      if (p.y > H + 30 && ended) {
        p.gone = true;
        continue;
      }
      if (p.y > H + 30) {
        p.done = 0;
        // rain re-enters just above the top; a burst piece re-enters anywhere across one screen above it (then rains)
        p.y = p.rain ? -rnd(10, 40) * dpr : -rnd(20, H);
        p.rain = true;
        p.x = rnd(0, W);
        p.vy = rnd(1, 4) * dpr;
        p.vx = rnd(-1, 1) * dpr;
      }
      if (p.x < -40) p.x = W + 30;
      else if (p.x > W + 40) p.x = -30;
      paint(p);
    }
    // ended and nothing left in the air or on the plaque: the confetti is over
    if (ended && !live) return clear();
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return {
    stop: () => {
      stopped = true;
      cancelAnimationFrame(raf);
      clear();
    },
    end: () => {
      ended = true;
    },
  };
}
