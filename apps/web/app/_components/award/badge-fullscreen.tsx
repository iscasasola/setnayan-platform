'use client';
/**
 * 🏅 BADGE FULL SCREEN — a faithful port of `bzOpen` / `bzLayout` / `bzClose` / `bzWings` from the owner-approved
 * prototype `Setnayan/prototypes/supplier_badges_2026-11-15/badge-milestones_v35.html` (owner 15 Nov: *"a badge has no
 * plaque. Pressed, it lifts out of the row, flies to the middle, lands with a burst, then floats and turns in the
 * light"*).
 *
 * Owner rulings held here:
 *   · badge → caption (with Share) → hallmark is a STACK that never overlaps (`badgeStack` in `fit.ts`);
 *   · everything sizes from the screen (`min(92vw, 520px, 60vh, room left)`);
 *   · the share button is plain glass, never colourful;
 *   · Setnayan's mark signs every full-screen badge ("AN EXCLUSIVE SETNAYAN BADGE");
 *   · nothing opens by itself — the caller mounts this on a tap; Esc / back / the × / a tap anywhere puts it back.
 *
 * Client-only, on the device: no fetch, no write. Mount it to open it; `onClose` unmounts it.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { SetnayanMark } from '../setnayan-mark-icon';
import s from './award.module.css';
import { badgeStack } from './fit';
import { prefersReducedMotion, serializeArt, toneForTier, useModalDialog } from './shared';

export type AwardTier = {
  /** 1-based position on the ladder (tier1 = 1 … tier7 = 7): drives the burst's size. */
  index: number;
  /** The tier's display name, from `lib/badge-tiers.ts` — never hard-coded here. */
  name: string;
  /** Light colour override; default is the position's tone (`AWARD_TONES`). */
  tone?: string;
};

export type BadgeFullscreenProps = {
  /** The badge picture: a React SVG element (e.g. `<ImageBadge>`) or an SVG markup string from a trusted generator. */
  art: ReactNode | string;
  tier: AwardTier;
  /** The badge family ("Completed bookings"). */
  title: string;
  /** Extra caption lines under the main one. */
  lines?: readonly string[];
  shopName: string;
  /** Already-formatted award date ("12 Jan 2026"); shown as "Awarded 12 Jan 2026". */
  awardedOn?: string;
  /** Shows "Share to story"; called with the badge's SVG markup (feed it to `<StoryVideo>`). Omit to hide sharing. */
  onShare?: (artSvg: string) => void;
  /** Called once the badge is put back (after the return flight). */
  onClose: () => void;
  /** The element the badge flies out of and back into (it is hidden while the badge is out). */
  origin?: HTMLElement | null;
};

type Live = {
  on: boolean;
  sz: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  vx: number;
  vy: number;
  tx: number | null;
  ty: number | null;
  t0: number;
  raf: number;
  land: number;
  drag: boolean;
  px: number;
  py: number;
};

export function BadgeFullscreen({ art, tier, title, lines, shopName, awardedOn, onShare, onClose, origin }: BadgeFullscreenProps) {
  const tone = tier.tone ?? toneForTier(tier.index);
  const live = useRef<Live>({ on: false, sz: 0, cx: 0, cy: 0, rx: 0, ry: 0, vx: 0, vy: 0, tx: null, ty: null, t0: 0, raf: 0, land: 0, drag: false, px: 0, py: 0 });
  const closing = useRef(false);
  const stage = useRef<HTMLDivElement>(null);
  const float = useRef<HTMLDivElement>(null);
  const tilt = useRef<HTMLDivElement>(null);
  const artHost = useRef<HTMLDivElement>(null);
  const shadow = useRef<HTMLDivElement>(null);
  const cap = useRef<HTMLDivElement>(null);
  const hm = useRef<HTMLDivElement>(null);
  const fx = useRef<HTMLDivElement>(null);
  const xBtn = useRef<HTMLButtonElement>(null);
  const rm = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const home = useCallback(() => {
    const b = live.current;
    return `translate(${b.cx - b.sz / 2}px,${b.cy - b.sz / 2}px)`;
  }, []);
  const fromOrigin = useCallback(() => {
    const b = live.current;
    if (!origin || !origin.isConnected) return home();
    const r = origin.getBoundingClientRect();
    const sc = r.width / (b.sz || 1);
    return `translate(${r.left}px,${r.top + (r.height - r.width) / 2}px) scale(${sc})`;
  }, [origin, home]);

  const close = useCallback(() => {
    const b = live.current;
    if (closing.current) return;
    closing.current = true;
    b.on = false;
    cancelAnimationFrame(b.raf);
    window.clearTimeout(b.land);
    dlg.current?.classList.remove(s.on!);
    const done = () => onCloseRef.current();
    if (rm.current || !origin || !stage.current) {
      done();
      return;
    }
    if (tilt.current) tilt.current.style.transform = 'none';
    if (float.current) float.current.style.transform = 'none';
    stage.current.style.transition = 'transform .45s cubic-bezier(.5,0,.75,.4)';
    stage.current.style.transform = fromOrigin();
    window.setTimeout(done, 450);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, fromOrigin]);

  const dlg = useModalDialog(close);

  const layout = useCallback(() => {
    const d = dlg.current;
    const hmEl = hm.current;
    const capEl = cap.current;
    if (!d || !hmEl || !capEl) return;
    const hb = hmEl.offsetHeight + (parseFloat(getComputedStyle(hmEl).bottom) || 18);
    const st = badgeStack(window.innerWidth, window.innerHeight, hb, capEl.offsetHeight || 150);
    const b = live.current;
    b.sz = st.size;
    b.cx = st.cx;
    b.cy = st.cy;
    d.style.setProperty('--sz', st.size + 'px');
    d.style.setProperty('--cy', st.cy + 'px');
    if (shadow.current) shadow.current.style.top = st.shadowTop + 'px';
    capEl.style.top = st.capTop + 'px';
  }, [dlg]);

  const burst = useCallback(() => {
    const host = fx.current;
    const b = live.current;
    if (!host) return;
    const t = Math.max(1, Math.min(7, Math.round(tier.index)));
    const n = 10 + t * 6;
    const R = b.sz * (0.55 + t * 0.06);
    dlg.current?.querySelectorAll<HTMLElement>('[data-bz-go]').forEach((e) => {
      e.classList.remove(s.go!);
      void e.offsetWidth;
      e.classList.add(s.go!);
    });
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      const a = Math.random() * Math.PI * 2;
      const d = R * (0.45 + Math.random() * 0.7);
      const w = 3 + Math.random() * (4 + t);
      p.className = s.bzP!;
      p.style.cssText = `left:50%;top:${b.cy}px;--w:${w.toFixed(1)}px;--c:${Math.random() < 0.35 ? '#fff' : tone};--x:${(Math.cos(a) * d).toFixed(0)}px;--y:${(Math.sin(a) * d * 0.85 + 40).toFixed(0)}px;--r:${(Math.random() * 540 - 270).toFixed(0)}deg;--d:${(0.8 + Math.random() * 0.7).toFixed(2)}s;${Math.random() < 0.5 ? '--br:2px;' : ''}`;
      host.appendChild(p);
      window.setTimeout(() => p.remove(), 1700);
    }
    try {
      navigator.vibrate?.(12 + t * 3);
    } catch {
      /* no haptics here */
    }
  }, [dlg, tier.index, tone]);

  // the idle turn: when nobody is touching it, it turns slowly by itself; a finger or pointer takes over
  const frame = useCallback((now: number) => {
    const b = live.current;
    if (!b.on) return;
    const k = (now - b.t0) / 1000;
    const RM = rm.current;
    const ix = b.tx ?? Math.sin(k * 0.9) * 7;
    const iy = b.ty ?? Math.sin(k * 0.55) * 16 + Math.sin(k * 1.3) * 4;
    b.vx += (ix - b.rx) * 0.09;
    b.vy += (iy - b.ry) * 0.09;
    b.vx *= 0.82;
    b.vy *= 0.82;
    b.rx += b.vx;
    b.ry += b.vy;
    const fy = RM ? 0 : Math.sin(k * 1.6) * b.sz * 0.03;
    const fr = RM ? 0 : Math.sin(k * 1.1) * 1.2;
    if (float.current) float.current.style.transform = `translateY(${fy.toFixed(2)}px) rotate(${fr.toFixed(2)}deg)`;
    if (tilt.current) {
      tilt.current.style.transform = RM ? 'none' : `perspective(${b.sz * 2.4}px) rotateX(${b.rx.toFixed(2)}deg) rotateY(${b.ry.toFixed(2)}deg)`;
      const gx = Number((50 - b.ry * 3.2 - b.rx * 1.2).toFixed(1));
      tilt.current.querySelectorAll<HTMLElement>('[data-bz-glint]').forEach((g, i) => {
        g.style.backgroundPosition = `${i ? 100 - gx : gx}% 0`;
      });
    }
    if (shadow.current) {
      const up = (fy / (b.sz * 0.03 || 1) + 1) / 2;
      shadow.current.style.transform = `translateX(${(-b.ry * 1.4).toFixed(1)}px) scale(${(1 - 0.12 * (1 - up)).toFixed(3)},1)`;
      shadow.current.style.opacity = (0.65 + 0.35 * up).toFixed(2);
    }
    b.raf = requestAnimationFrame(frame);
  }, []);

  // open: measure, fly out of the row with a half spin, land with a burst
  useLayoutEffect(() => {
    const b = live.current;
    rm.current = prefersReducedMotion();
    layout();
    const st = stage.current;
    const d = dlg.current;
    if (!st || !d) return;
    d.style.setProperty('--tc', tone);
    d.style.setProperty('--ro', (0.16 + Math.max(1, Math.min(7, tier.index)) * 0.04).toFixed(2));
    st.style.transition = 'none';
    st.style.transform = origin ? fromOrigin() : home();
    const prevVis = origin?.style.visibility ?? '';
    if (origin) origin.style.visibility = 'hidden';
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    b.on = true;
    void st.offsetWidth;
    d.classList.add(s.on!);
    if (wingsRef.current) wingsRef.current();
    if (rm.current) {
      st.style.transform = home();
    } else {
      st.style.transition = 'transform .72s cubic-bezier(.18,1.32,.32,1)';
      st.style.transform = home();
      const p = b.sz * 2.4;
      tilt.current?.animate(
        [
          { transform: `perspective(${p}px) rotateY(-200deg) scale(.9)` },
          { transform: `perspective(${p}px) rotateY(12deg) scale(1.04)`, offset: 0.75 },
          { transform: `perspective(${p}px) rotateY(0) scale(1)` },
        ],
        { duration: 720, easing: 'cubic-bezier(.2,.8,.3,1)' },
      );
      b.land = window.setTimeout(burst, 560);
    }
    b.t0 = performance.now();
    b.raf = requestAnimationFrame(frame);
    const focusT = window.setTimeout(() => xBtn.current?.focus({ preventScroll: true }), 60);
    const onResize = () => {
      if (!b.on || !stage.current) return;
      layout();
      stage.current.style.transition = 'none';
      stage.current.style.transform = home();
    };
    window.addEventListener('resize', onResize);
    return () => {
      b.on = false;
      cancelAnimationFrame(b.raf);
      window.clearTimeout(b.land);
      window.clearTimeout(focusT);
      window.removeEventListener('resize', onResize);
      document.documentElement.style.overflow = prevOverflow;
      if (origin) {
        origin.style.visibility = prevVis;
        const back = origin.closest<HTMLElement>('button,a,[tabindex]') ?? origin;
        back.focus?.({ preventScroll: true });
      }
    };
    // opened once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the glint is masked to the badge's own outline: the drawn SVG, as an image, on the device
  useEffect(() => {
    const svg = serializeArt(artHost.current);
    if (!svg || !tilt.current) return;
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    tilt.current.style.setProperty('--m', `url(${url})`);
    return () => URL.revokeObjectURL(url);
  }, [art]);

  // owner 15 Nov: the wings arrive folded behind the badge and spread open as it lands (only art that has wings)
  const wingsRef = useRef<(() => void) | null>(null);
  wingsRef.current = () => {
    const sv = artHost.current?.querySelector('svg');
    if (sv && !rm.current) spreadWings(sv, () => live.current.on);
  };

  const turn = (cx: number, cy: number) => {
    const b = live.current;
    if (!b.on) return;
    const dx = (cx - b.cx) / (b.sz * 0.7);
    const dy = (cy - b.cy) / (b.sz * 0.7);
    b.ty = Math.max(-1, Math.min(1, dx)) * 26;
    b.tx = -Math.max(-1, Math.min(1, dy)) * 18;
  };

  const html = useMemo(() => (typeof art === 'string' ? { __html: art } : null), [art]);
  const mainLine = `${tier.name} · ${title}${awardedOn ? ` · Awarded ${awardedOn}` : ''}`;

  return (
    <dialog
      ref={dlg}
      className={s.bz}
      aria-label={`${title}, ${tier.name}, awarded to ${shopName}`}
      style={{ '--tc': tone } as CSSProperties}
      data-award-fullscreen=""
      onClick={(e) => {
        if ((e.target as Element).closest('[data-bz-share]')) return;
        if (live.current.drag) return;
        close();
      }}
      onPointerDown={(e) => {
        const b = live.current;
        b.drag = false;
        b.px = e.clientX;
        b.py = e.clientY;
      }}
      onPointerMove={(e) => {
        const b = live.current;
        if (e.pointerType === 'mouse' || e.buttons) turn(e.clientX, e.clientY);
        if (e.buttons && Math.hypot(e.clientX - b.px, e.clientY - b.py) > 10) b.drag = true;
      }}
      onPointerLeave={() => {
        live.current.tx = live.current.ty = null;
      }}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (t) turn(t.clientX, t.clientY);
      }}
      onTouchEnd={() => {
        window.setTimeout(() => {
          live.current.tx = live.current.ty = null;
        }, 900);
      }}
    >
      <div className={s.bzBg} />
      <div className={s.bzRays} style={{ top: 'var(--cy, 44%)' }} />
      <div className={s.bzHalo} style={{ top: 'var(--cy, 44%)' }} />
      <div ref={shadow} className={s.bzShadow} />
      <div className={s.bzFlash} data-bz-go="" style={{ top: 'var(--cy, 44%)' }} />
      <div className={s.bzRing} data-bz-go="" style={{ top: 'var(--cy, 44%)' }} />
      <div className={`${s.bzRing} ${s.r2 ?? ''}`} data-bz-go="" style={{ top: 'var(--cy, 44%)' }} />
      <div ref={stage} className={s.bzStage}>
        <div ref={float} className={s.bzFloat}>
          <div ref={tilt} className={s.bzTilt}>
            {html ? (
              <div ref={artHost} className={s.bzArt} dangerouslySetInnerHTML={html} />
            ) : (
              <div ref={artHost} className={s.bzArt}>
                {art}
              </div>
            )}
            <i className={s.bzGlint} data-bz-glint="" />
            <i className={`${s.bzGlint} ${s.bzGlintB}`} data-bz-glint="" />
          </div>
        </div>
      </div>
      <div ref={fx} aria-hidden="true" />
      <div ref={cap} className={s.bzCap}>
        <em>Awarded to</em>
        <b>{shopName}</b>
        <span>{mainLine}</span>
        {lines?.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
        {onShare ? (
          <button
            type="button"
            className={s.bzShare}
            data-bz-share=""
            aria-label="Share to your story"
            onClick={(e) => {
              e.stopPropagation();
              onShare(serializeArt(artHost.current));
            }}
          >
            ↗ Share to story
          </button>
        ) : null}
        <small>Tap anywhere to put it back</small>
      </div>
      <div ref={hm} className={s.bzHm} aria-label="An exclusive Setnayan badge" role="img">
        <div className={s.bzHmRow}>
          <SetnayanMark className={s.mark} aria-hidden="true" role="presentation" aria-label={undefined} />
          <span className={s.bzHmWord}>SETNAYAN</span>
        </div>
        <small>An exclusive Setnayan badge</small>
      </div>
      <button ref={xBtn} type="button" className={s.bzX} aria-label="Close" onClick={(e) => (e.stopPropagation(), close())}>
        <X aria-hidden size={22} strokeWidth={2} />
      </button>
    </dialog>
  );
}

/**
 * `bzWings`: wings arrive folded behind the badge and spread open as it lands, feather by feather, a little past fully
 * open, then settle — and give one strong beat. Applies only to art drawn with the generator's wing groups; any other
 * art is untouched.
 */
function spreadWings(sv: SVGSVGElement, alive: () => boolean) {
  const groups = [...sv.querySelectorAll('g[transform="translate(98 150)"],g[transform="translate(202 150) scale(-1 1)"]')];
  const W = groups.map((o) => {
    const w = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    while (o.firstChild) w.appendChild(o.firstChild);
    o.appendChild(w);
    const F = [...w.querySelectorAll('g[transform]')]
      .map((g) => {
        const m = /^translate\(([^)]*)\) rotate\((-?[\d.]+)\)$/.exec(g.getAttribute('transform') || '');
        return m ? { g, t: m[1]!, a: +m[2]! } : null;
      })
      .filter((f): f is { g: Element; t: string; a: number } => !!f);
    return { w, F };
  });
  if (!W.length) return;
  const put = (p: number, beat: number) =>
    W.forEach(({ w, F }) => {
      w.setAttribute('transform', `rotate(${(58 * (1 - p) + beat).toFixed(2)}) scale(${(0.5 + 0.5 * p).toFixed(3)})`);
      F.forEach((f) => {
        const a0 = -104 + (f.a + 104) * 0.12;
        f.g.setAttribute('transform', `translate(${f.t}) rotate(${(a0 + (f.a - a0) * p).toFixed(2)})`);
      });
    });
  put(0, 0);
  const t0 = performance.now() + 430;
  const step = (now: number) => {
    if (!alive()) return;
    const t = Math.max(0, (now - t0) / 1000);
    const p = 1 - Math.exp(-5.2 * t) * Math.cos(8.5 * t);
    const bt = t - 0.55;
    const beat = bt > 0 && bt < 0.9 ? -16 * Math.sin((bt / 0.9) * Math.PI * 2) * Math.exp(-2.4 * bt) : 0;
    put(Math.max(0, p), beat);
    if (t < 2.2) requestAnimationFrame(step);
    else put(1, 0);
  };
  requestAnimationFrame(step);
}
