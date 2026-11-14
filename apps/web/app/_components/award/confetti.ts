/**
 * 🎊 BLACK AND GOLD CONFETTI — No. 1 ONLY. A port of `awConfetti` from the owner-approved prototype
 * `badge-milestones_v48.html` (owner 15 Nov). Two cannons at the lower left and lower right blow it up; it falls with
 * air drag, swaying and flipping, and it NEVER stops: a piece that leaves the bottom comes back in from the top. No
 * fade. v48: a 120-piece rain set falls alongside the burst so no gap ever opens. Kept light for phones: 110 + 120
 * pieces, one colour table, setTransform (no save/restore), dpr ≤ 1.5.
 * Frame-rate independent (dt). Runs until `alive()` turns false (the plaque closes). Loaded only by a dynamic import.
 */
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

/** Rains confetti on `c` while `alive()` holds; returns a stop function. */
export function awConfetti(c: HTMLCanvasElement, alive: () => boolean): () => void {
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  const W = (c.width = Math.round(window.innerWidth * dpr));
  const H = (c.height = Math.round(window.innerHeight * dpr));
  const x = c.getContext('2d');
  if (!x) return () => {};
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);
  const g = 0.0009 * H;
  const N = CONFETTI_PIECES;
  const P = Array.from({ length: N }, (_, i) => {
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
  let last = t0;
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
    for (const p of P) {
      if (t < p.delay) continue;
      p.vy += g * dt;
      const fall = p.vy > 0;
      p.vy *= Math.pow(fall ? 0.9 : 0.982, dt);
      p.vx *= Math.pow(fall ? 0.95 : 0.982, dt);
      p.sway += p.sw * dt;
      p.x += (p.vx + (fall ? Math.sin(p.sway) * p.amp : 0)) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.flip += p.vf * dt;
      if (p.y > H + 30) {
        // rain re-enters just above the top; a burst piece re-enters anywhere across one screen above it (then rains)
        p.y = p.rain ? -rnd(10, 40) * dpr : -rnd(20, H);
        p.rain = true;
        p.x = rnd(0, W);
        p.vy = rnd(1, 4) * dpr;
        p.vx = rnd(-1, 1) * dpr;
      }
      if (p.x < -40) p.x = W + 30;
      else if (p.x > W + 40) p.x = -30;
      const k = Math.abs(Math.cos(p.flip));
      const ky = Math.max(0.08, k);
      const cr = Math.cos(p.rot);
      const sr = Math.sin(p.rot);
      x.setTransform(cr, sr, -sr * ky, cr * ky, p.x, p.y);
      x.fillStyle = (p.gold ? GOLD : BLACK)[Math.min(15, Math.round(k * 15))]!;
      if (p.strip) x.fillRect(-p.w * 0.22, -p.h * 0.9, p.w * 0.44, p.h * 1.8);
      else x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
    clear();
  };
}
