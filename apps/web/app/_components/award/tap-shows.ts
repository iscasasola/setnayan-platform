'use client';
/**
 * 🏅 TAP SHOWS — a faithful port of the owner-approved prototype's landing shows
 * (`Setnayan/prototypes/supplier_badges_2026-11-15/badge-milestones_v86.html`: `gunFire` · `gunTick` · `gunClear` ·
 * `fxN` · `GIFT_TK` · `giftShow` · `calShow` · `starShow` · `trustShow`). 560 ms after the badge lands, each tiered
 * badge family plays its own show:
 *
 *   · Invites (`invite`)              — invitation cards shoot out of the envelope's slot and tumble down like paper;
 *   · Gifts given (`giftbox`)         — the lid opens (its full 3.6 s) and tickets cut in the badge's OWN METAL throw out;
 *   · Completed bookings (`calendar`) — the badge's own pages tear off the rings one at a time and glide away;
 *   · Five-star reviews (`bubble`)    — the five row stars fly out of the bubble into their places; nothing is thrown;
 *   · Trusted by (`shield`)           — the shield pulses once per tier step, one soundwave ripple per pulse.
 *
 * Owner rulings held here (15 Nov — the last of each wins):
 *   · Gifts given and Invites throw 5, 10, 15, 20, 25, 30, 35 pieces from Bronze to Black Diamond (memory stays low);
 *   · NO time limit: nothing is sped up or cut short, nothing fades, nothing is pulled down early — a thrown piece
 *     flies until it is off the screen;
 *   · each tier's calendar counts up from the tier below in fixed steps and the LAST page stays;
 *   · reduced motion: no tap show at all.
 *
 * Client-only, on the device: no fetch, no write. Reached ONLY through `import()` from `badge-fullscreen.tsx`, so it is
 * never part of a page's first load.
 */
import s from './tap-shows.module.css';

export type TapFamily = 'calendar' | 'bubble' | 'giftbox' | 'shield' | 'invite';
export const TAP_FAMILIES: readonly TapFamily[] = ['calendar', 'bubble', 'giftbox', 'shield', 'invite'];
/** The badge each family key names (the owner's exact badge names). */
export const TAP_FAMILY_NAMES: Record<TapFamily, string> = {
  calendar: 'Completed bookings',
  bubble: 'Five-star reviews',
  giftbox: 'Gifts given',
  shield: 'Trusted by',
  invite: 'Invites',
};

const clampTier = (tier: number) => Math.max(1, Math.min(7, Math.round(tier) || 1));

/** v86 `FX_N` — owner 15 Nov: "5,10,15,20,25,30,35 For gifts, invites" (Bronze … Black Diamond). */
export const THROW_COUNTS = [5, 10, 15, 20, 25, 30, 35] as const;
/** v86 `fxN()` — the pieces thrown for a 1-based tier. */
export function throwCount(tier: number): number {
  return THROW_COUNTS[clampTier(tier) - 1]!;
}
/** Trusted by: one pulse (and one ripple) per tier step, Bronze 1 … Black Diamond 7. */
export function trustPulses(tier: number): number {
  return clampTier(tier);
}

/**
 * Completed bookings — owner 15 Nov: each tier counts up from the tier below in its own steps and the last page stays.
 * `[from, to, step]` per tier (v86 `calShow`'s `SEQ`).
 */
export const CALENDAR_STEPS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 5, 1],
  [5, 25, 5],
  [25, 50, 5],
  [50, 100, 10],
  [100, 250, 50],
  [250, 500, 50],
  [500, 1000, 100],
];
/** Every number the calendar shows for a tier, first to last; the last one stays on the badge. */
export function calendarPages(tier: number): number[] {
  const [from, to, step] = CALENDAR_STEPS[clampTier(tier) - 1]!;
  const vals: number[] = [];
  for (let v = from; v <= to; v += step) vals.push(v);
  return vals;
}
/** v86 `fmt`: 1000 reads "1k". */
export function calendarLabel(v: number): string {
  return v >= 1000 ? `${v / 1000}k` : String(v);
}

/** How much each family's show puts on screen for a tier (the memory budget, in one place). */
export function tapShowPieces(family: TapFamily, tier: number): { thrown: number; pulses: number; pages: number } {
  const t = clampTier(tier);
  if (family === 'invite' || family === 'giftbox') return { thrown: throwCount(t), pulses: 0, pages: 0 };
  if (family === 'shield') return { thrown: 0, pulses: trustPulses(t), pages: 0 };
  // a torn page per step; the first number is printed before the show and the last page stays
  if (family === 'calendar') return { thrown: 0, pulses: 0, pages: calendarPages(t).length - 1 };
  // owner 15 Nov: "star reviews. not getting more anymore. the 5 stars going to its position is enough"
  return { thrown: 0, pulses: 0, pages: 0 };
}

/**
 * v86 `TK_METAL` — owner 15 Nov: "gift tickets should follow the color of the badge". Each tier's metal as
 * [light, mid, dark]: bronze, silver, gold, ruby, emerald, diamond, black diamond.
 */
export const TICKET_METALS: ReadonlyArray<readonly [string, string, string]> = [
  ['#e9b07a', '#b8743a', '#5e3412'],
  ['#f4f6f9', '#bcc4ce', '#6c7581'],
  ['#fbe7a1', '#e2b33f', '#8a600c'],
  ['#ff8a9b', '#d22a45', '#6b0a1c'],
  ['#8be8b8', '#22a865', '#0b4d2c'],
  ['#e3f3ff', '#86c3f5', '#2f6fae'],
  ['#8a8f98', '#2b2e33', '#050506'],
];
/** v86 `GIFT_TK` — a gift ticket cut in the tier's metal, with a torn stub, a gift mark and POINTS (the unit). */
export function giftTicketSvg(tier: number): string {
  const t = clampTier(tier);
  const [a, b, c] = TICKET_METALS[t - 1]!;
  const ink = t === 2 || t === 6 ? '#1f2a3a' : '#fff';
  return `<svg viewBox="0 0 120 60" aria-hidden="true"><defs><linearGradient id="gtk${t}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs>
<path d="M6,1H114a5,5 0 0 1 5,5V22a8,8 0 0 0 0,16V54a5,5 0 0 1-5,5H6a5,5 0 0 1-5-5V38a8,8 0 0 0 0-16V6a5,5 0 0 1 5-5Z" fill="url(#gtk${t})" stroke="${c}" stroke-width="1.2"/>
<path d="M8,6H112V54H8Z" fill="none" stroke="${a}" stroke-opacity=".7" stroke-width=".8"/><path d="M38,4V56" stroke="${ink}" stroke-opacity=".5" stroke-width="1.2" stroke-dasharray="3 3"/>
<g transform="translate(20 30)" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="-8" y="-3" width="16" height="11" rx="1"/><path d="M-9,-3h18v-4h-18zM0,-7V8M0,-7c-2-4-7-4-6-1s4 1 6 1zm0 0c2-4 7-4 6-1s-4 1-6 1z"/></g>
<text x="79" y="37" text-anchor="middle" fill="${ink}" style="font:700 15px 'Cinzel',serif;letter-spacing:1.5px">POINTS</text></svg>`;
}

/** v86 `CARD_SVG` — the person mark on each invitation card. */
const CARD_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4.2a3.7 3.7 0 1 1 0 7.4 3.7 3.7 0 0 1 0-7.4zM1.8 20.5c0-4.2 3.2-7 7.2-7s7.2 2.8 7.2 7zM18.1 6.5h2v3h3v2h-3v3h-2v-3h-3v-2h3z"/></svg>';

/** The calendar art reads 1 / 5 / 25 / … at OPEN (v86 `bzOpen`), so its first page is the tier below's number. */
export function primeTapShow(family: TapFamily | undefined, tier: number, sv: SVGSVGElement | null | undefined, reducedMotion: boolean): void {
  if (family !== 'calendar' || reducedMotion || !sv) return;
  const first = calendarLabel(calendarPages(tier)[0]!);
  sv.querySelectorAll('text[y="174"]').forEach((t) => {
    t.textContent = first;
  });
}

export type TapShowOptions = {
  family: TapFamily;
  /** 1-based tier (Bronze 1 … Black Diamond 7). */
  tier: number;
  /** The badge's live SVG (the lid, the row stars and the calendar pages are parts of it). */
  svg: SVGSVGElement | null;
  /** Where thrown pieces and torn pages go (a full-screen layer, in front of the badge). */
  host: HTMLElement;
  /** The ripples go in front of this element (behind the badge); default: into `host`. */
  under?: Element | null;
  /** The element that swells on each Trusted-by pulse (the badge's float layer). */
  pulse?: HTMLElement | null;
  /** The badge's on-screen size and centre (v86 `bz.sz` · `bz.cx` · `bz.cy`). */
  sz: number;
  cx: number;
  cy: number;
  /** False once the badge is put back; the show stops starting new pieces. */
  alive: () => boolean;
  reducedMotion: boolean;
};

type Piece = {
  el: HTMLElement;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rz: number;
  vz: number;
  rx: number;
  vrx: number;
  ry: number;
  vry: number;
  ph: number;
  k: number;
};

/** Plays one family's show; returns `stop`, which clears every timer, frame, animation and piece it made. */
export function playTapShow(o: TapShowOptions): () => void {
  if (o.reducedMotion || !TAP_FAMILIES.includes(o.family)) return () => {};
  const tier = clampTier(o.tier);
  const tm: number[] = [];
  const anims: Animation[] = [];
  const made = new Set<Element>();
  let gun: Piece[] = [];
  let raf = 0;
  let last = 0;
  let stopped = false;
  const on = () => !stopped && o.alive();
  const later = (fn: () => void, ms: number) => {
    tm.push(window.setTimeout(fn, ms));
  };

  // v86 `gunTick` — paper: heavy drag once it slows, a sideways flutter, slow fall; gone only once off the screen
  const tick = (t: number) => {
    const dt = Math.min(0.033, (t - last) / 1000);
    last = t;
    const W = window.innerWidth;
    const H = window.innerHeight;
    gun = gun.filter((c) => {
      c.ph += dt * 7;
      c.vy += 1500 * c.k * dt;
      c.vx *= Math.pow(0.32, dt);
      c.vy *= Math.pow(c.vy > 0 ? 0.12 : 0.5, dt);
      c.vx += Math.sin(c.ph) * 260 * c.k * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rz += c.vz * dt;
      c.rx += c.vrx * dt;
      c.ry += c.vry * dt;
      c.vrx *= Math.pow(0.6, dt);
      c.el.classList.toggle(s.bk!, Math.cos((c.rx * Math.PI) / 180) < 0);
      c.el.style.transform = `translate3d(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px,0) rotateZ(${c.rz.toFixed(1)}deg) rotateX(${c.rx.toFixed(1)}deg) rotateY(${c.ry.toFixed(1)}deg)`;
      if (c.y > H + 80 || c.x < -W || c.x > W * 2) {
        c.el.remove();
        made.delete(c.el);
        return false;
      }
      return true;
    });
    raf = gun.length ? requestAnimationFrame(tick) : 0;
  };

  // v86 `gunFire` — owner 15 Nov: "don't speed them up remove the seconds limit"
  const fire = (num: number, g: { cls?: string; html?: string; oy?: number; cw?: number } = {}) => {
    const n = Math.max(1, num);
    const k = o.sz / 420;
    const gap = Math.max(6, Math.min(140, 1600 / n));
    const x0 = o.cx;
    const y0 = o.cy - o.sz / 2 + (o.sz * (g.oy ?? 144)) / 304;
    const cw = Math.round((g.cw ?? 46) * k);
    for (let i = 0; i < n; i++)
      later(
        () => {
          if (!on()) return;
          const el = document.createElement('i');
          el.className = g.cls ?? s.card!;
          el.setAttribute('aria-hidden', 'true');
          el.style.setProperty('--cw', `${cw}px`);
          el.innerHTML = g.html ?? CARD_SVG;
          o.host.appendChild(el);
          made.add(el);
          const a = ((-90 + (Math.random() * 2 - 1) * (28 + Math.min(n, 40) * 0.4)) * Math.PI) / 180;
          const sp = (950 + Math.random() * 650) * k;
          gun.push({
            el,
            x: x0 + (Math.random() * 2 - 1) * 14 * k,
            y: y0,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            rz: Math.random() * 360,
            vz: (Math.random() * 2 - 1) * 540,
            rx: 0,
            vrx: (360 + Math.random() * 540) * (Math.random() < 0.5 ? -1 : 1),
            ry: 0,
            vry: (Math.random() * 2 - 1) * 420,
            ph: Math.random() * 6.3,
            k,
          });
          if (!raf) {
            last = performance.now();
            raf = requestAnimationFrame(tick);
          }
        },
        i * gap + Math.random() * gap * 0.4,
      );
  };

  const sv = o.svg;
  if (o.family === 'invite') fire(throwCount(tier));
  else if (o.family === 'giftbox') giftShow();
  else if (o.family === 'calendar') calShow();
  else if (o.family === 'bubble') starShow();
  else if (o.family === 'shield') trustShow();

  // v86 `giftShow` — the lid swings open on its back edge (its full 3.6 s), the tickets throw out, the lid drops shut
  function giftShow() {
    const lid = sv?.querySelector<SVGGElement>('.gift-lid');
    if (lid) {
      lid.style.transformBox = 'view-box';
      lid.style.transformOrigin = '212px 137px';
      anims.push(
        lid.animate(
          [
            { transform: 'none' },
            { transform: 'translate(4px,-26px) rotate(38deg)', offset: 0.12 },
            { transform: 'translate(4px,-24px) rotate(34deg)', offset: 0.2 },
            { transform: 'translate(4px,-24px) rotate(34deg)', offset: 0.82 },
            { transform: 'translate(0,-3px) rotate(-2deg)', offset: 0.93 },
            { transform: 'none' },
          ],
          { duration: 3600, easing: 'cubic-bezier(.3,.7,.3,1)' },
        ),
      );
    }
    const html = giftTicketSvg(tier);
    later(() => fire(throwCount(tier), { cls: `${s.card} ${s.tk}`, html, oy: 120, cw: 64 }), 200);
  }

  // v86 `calShow` — each torn page is cut from the badge's own page and tossed away, one at a time, unhurried
  function calShow() {
    if (!sv) return;
    const T = [...sv.querySelectorAll('text')].filter((t) => +(t.getAttribute('y') ?? '') === 174);
    if (!T.length) return;
    const vals = calendarPages(tier);
    T.forEach((t) => (t.textContent = calendarLabel(vals[0]!)));
    const parts = [
      sv.querySelector('path[fill*="_pap)"]'),
      sv.querySelector('path[d="M110,133H190"]'),
      T[0],
      T[1] ? (T[1].closest('g[filter]') ?? T[1]) : null,
      sv.querySelector('rect[y="181.1"]'),
      [...sv.querySelectorAll('text')].find((t) => +(t.getAttribute('y') ?? '') === 193) ?? null,
    ].filter((e): e is Element => !!e);
    const STEP = 420;
    vals.slice(1).forEach((v, i) => {
      const prev = vals[i]!;
      later(() => {
        if (!on()) return;
        const vb = sv.viewBox.baseVal;
        const r = sv.getBoundingClientRect();
        const kx = r.width / (vb?.width || 1);
        const ky = r.height / (vb?.height || 1);
        const x = r.left + (104 - (vb?.x ?? 0)) * kx;
        const y = r.top + (122 - (vb?.y ?? 0)) * ky;
        const w = 92 * kx;
        const h = 96 * ky;
        const pg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        pg.setAttribute('class', s.page!);
        pg.setAttribute('aria-hidden', 'true');
        pg.setAttribute('viewBox', '104 122 92 96');
        pg.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px`;
        pg.innerHTML = parts.map((e) => e.outerHTML).join('');
        pg.querySelectorAll('text').forEach((t) => {
          if (+(t.getAttribute('y') ?? '') === 174) t.textContent = calendarLabel(prev);
        });
        o.host.appendChild(pg);
        made.add(pg);
        T.forEach((t) => (t.textContent = calendarLabel(v)));
        // owner 15 Nov: the page rips off the rings (a twist at the top), is tossed up and to the side, then glides and
        // flutters away off the screen — alternating left and right
        const dir = i % 2 ? 1 : -1;
        const X = dir * (window.innerWidth * 0.62 + Math.random() * window.innerWidth * 0.25);
        const U = h * (0.7 + Math.random() * 0.4);
        const a = pg.animate(
          [
            { transform: 'none' },
            { transform: `translate(${dir * w * 0.06}px,${-h * 0.08}px) rotate(${dir * -7}deg) rotateX(18deg)`, offset: 0.12 },
            { transform: `translate(${X * 0.32}px,${-U}px) rotate(${dir * 22}deg) rotateY(${dir * 25}deg)`, offset: 0.38 },
            { transform: `translate(${X * 0.62}px,${-U * 0.75}px) rotate(${dir * -6}deg) rotateY(${dir * 55}deg) rotateX(15deg)`, offset: 0.62 },
            { transform: `translate(${X * 0.85}px,${-U * 0.45}px) rotate(${dir * 14}deg) rotateY(${dir * 20}deg)`, offset: 0.82 },
            { transform: `translate(${X * 1.15}px,${-U * 0.1}px) rotate(${dir * 28}deg) rotateY(${dir * 60}deg)` },
          ],
          { duration: 1600, easing: 'cubic-bezier(.25,.6,.45,1)' },
        );
        anims.push(a);
        a.onfinish = () => {
          pg.remove();
          made.delete(pg);
        };
      }, (i + 1) * STEP);
    });
  }

  // v86 `starShow` — the five row stars pop out of the bubble one by one and drop into their places (no stars thrown)
  function starShow() {
    const st = sv ? [...sv.querySelectorAll<SVGGElement>('.rv-st')] : [];
    st.forEach((g, i) => {
      const cx = +(g.dataset.cx ?? 0);
      const cy = +(g.dataset.cy ?? 0);
      g.style.transformBox = 'view-box';
      g.style.transformOrigin = `${cx}px ${cy}px`;
      anims.push(
        g.animate(
          [
            { transform: `translate(${150 - cx}px,${112 - cy}px) scale(.5)`, opacity: 0 },
            { transform: `translate(${150 - cx}px,${112 - cy}px) scale(1.6)`, opacity: 1, offset: 0.15 },
            { transform: `translate(${(150 - cx) * 0.55}px,${112 - cy - 46}px) scale(2.4)`, offset: 0.5 },
            { transform: 'translate(0,-8px) scale(.8)', offset: 0.84 },
            { transform: 'none', opacity: 1 },
          ],
          { duration: 1000, delay: i * 240, easing: 'cubic-bezier(.35,.6,.4,1)', fill: 'backwards' },
        ),
      );
    });
  }

  // v86 `trustShow` — owner 15 Nov: "1 ripple of a soundwave when the shield pulses — 1,2,3,4,5,6,7 pulses"
  function trustShow() {
    const n = trustPulses(tier);
    const gap = Math.min(300, 1400 / n);
    const S = o.sz;
    for (let i = 0; i < n; i++)
      later(() => {
        if (!on()) return;
        if (o.pulse)
          anims.push(
            o.pulse.animate(
              [
                { scale: '1', filter: 'brightness(1)' },
                { scale: '1.06', filter: 'brightness(1.25) drop-shadow(0 0 18px var(--tc))', offset: 0.35 },
                { scale: '1', filter: 'brightness(1)' },
              ],
              { duration: 420, easing: 'cubic-bezier(.3,.6,.4,1)' },
            ),
          );
        const w = document.createElement('i');
        w.className = s.wave!;
        w.setAttribute('aria-hidden', 'true');
        w.style.cssText = `left:${o.cx}px;top:${o.cy + S * 0.04}px;--s:${S * 0.56}px`;
        const under = o.under;
        if (under?.parentNode) under.parentNode.insertBefore(w, under);
        else o.host.appendChild(w);
        made.add(w);
        later(() => {
          w.remove();
          made.delete(w);
        }, 1300);
      }, 120 + i * gap);
  }

  // v86 `gunClear`
  return () => {
    stopped = true;
    tm.forEach((t) => window.clearTimeout(t));
    tm.length = 0;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    anims.forEach((a) => {
      try {
        a.cancel();
      } catch {
        /* already gone */
      }
    });
    anims.length = 0;
    made.forEach((e) => e.remove());
    made.clear();
    gun = [];
  };
}
