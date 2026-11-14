'use client';
/**
 * 🏆 SEAL PLAQUE — a faithful port of `sealIntro` / `openSealPlaque` / `awFit` / `openSeal` from the owner-approved
 * prototype `Setnayan/prototypes/supplier_badges_2026-11-15/badge-milestones_v35.html`, its plaque replaced by
 * the final GRAND PLAQUE of `badge-milestones_v39.html` → v44 (red velvet niche v41, sparkle + shine v42, iPhone-safe
 * gradient-only lights + black-and-gold confetti on landing v43, niche stays visible while the seal flies in v44,
 * gold vs diamond plaques v45, the No. 1 reveal + No. 1-only endless confetti v46):
 *
 *   1 · the entrance (owner 15 Nov: *"for the seal. it shows the video you created then the medal goes to the
 *       placque"*) — the story scene of `story-rig.ts` plays full screen; a tap skips it;
 *   2 · the medal flies off the stage (WAAPI) and lands in its slot on the plaque;
 *   3 · THE GRAND PLAQUE (v39, final — owner: *"black and gold and diamond studded"*, ONE plaque for every seal):
 *       piano-black lacquer in a gilded frame studded with diamonds all round, diamond-star corners, the seal mounted
 *       still in a black velvet arch with only light moving over it, a champagne-gold plate engraved in Cinzel with
 *       "Awarded on {date}" and Setnayan's mark ("AN EXCLUSIVE SETNAYAN SEAL"), diamond screws.
 *
 * Owner rulings held here: the share button sits UNDER the plaque, plain glass, never colourful · no necklace ribbon ·
 * the plaque keeps its shadow with no dark block · the plaque scales to fit the screen with a transform
 * (not `zoom` — zoom failed on iPhone) while the share button stays full size under it (owner 15 Nov, "Stay full
 * size") · prefers-reduced-motion goes straight to the plaque · nothing opens by itself.
 *
 * Client-only, on the device: no fetch, no write. Mount it on a tap; `onClose` unmounts it.
 */
import { useCallback, useId, useLayoutEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { SetnayanMark } from '../setnayan-mark-icon';
import s from './award.module.css';
import { plaqueLayout } from './fit';
import { SEAL_TONE, prefersReducedMotion, serializeArt } from './shared';

export type SealPlaqueProps = {
  /** The seal picture: a React SVG element or an SVG markup string from a trusted generator. */
  seal: ReactNode | string;
  /** Small line over the title ("Setnayan · 2026"). */
  eyebrow?: string;
  /** The seal's name ("Setnayan Verified"). */
  title: string;
  shopName: string;
  /** The line under the title; default "Awarded to {shopName}". */
  shopLine?: string;
  /** Already-formatted date; shown as "Awarded on {date}". */
  awardedOn?: string;
  /** What it means, in the shop's honour. */
  body?: string;
  /** "How it is earned" bullet lines. */
  how?: readonly string[];
  /** The record row: [number, label] pairs. */
  record?: ReadonlyArray<readonly [string, string]>;
  /**
   * Which plaque (owner 15 Nov, DECISION_LOG "SEAL PLAQUE — NO. 1 IS SEPARATE": *"We separate no1"*).
   * `'gold'` (default, every seal): gold bead studs, gold rosette corners, gold screws, warm glints.
   * `'no1'`: diamond studs, diamond corner stars, diamond screws, and the seal fills the arch (372×414, ray tips
   * touching the gold rim — pass `no1Seal(year, 'arch')`). No. 1 is an OPTION only until the owner rules what earns it.
   * v46 (DECISION_LOG "NO. 1 — THE REVEAL"): `'no1'` alone opens on the 15 s velvet-curtain reveal and rains the
   * black-and-gold confetti, which never stops until the plaque closes. `'gold'` gets neither: 4.6 s entrance, no confetti.
   */
  variant?: 'gold' | 'no1';
  /** Play the entrance first (default true). Reduced motion always skips it. */
  intro?: boolean;
  /** Shows "Share to story" under the plaque; called with the seal's SVG markup (feed it to `<StoryVideo>`). */
  onShare?: (sealSvg: string) => void;
  onClose: () => void;
};

/** The sparkles that catch and fade on the mounted seal: [left %, top %, size px, duration s, delay s]. */
const SPARKS: ReadonlyArray<readonly [number, number, number, number, number]> = [
  [31, 24, 26, 2.9, 0],
  [70, 29, 20, 3.4, 1.1],
  [50, 47, 30, 3.1, 0.5],
  [21, 60, 16, 2.6, 1.9],
  [79, 62, 22, 3.7, 2.4],
  [60, 80, 15, 2.8, 1.5],
  [41, 13, 17, 3.3, 2.9],
  [65, 13, 13, 3.9, 0.9],
];
/** The plate's glints: [left %, top %, delay s]. */
const GLINTS: ReadonlyArray<readonly [number, number, number]> = [
  [7, 4, 0.2],
  [93, 4, 1.3],
  [50, 1, 2.2],
  [96, 58, 0.8],
  [4, 72, 1.8],
  [70, 98, 2.7],
];

/** v42 (owner: *"we want the diamonds to sparkle and the gold to shine"*): the 12 four-point flares on the frame's studs. */
const STUD_GLINTS: ReadonlyArray<readonly [CSSProperties, number]> = [
  [{ top: -6, left: '14%' }, 0],
  [{ top: -6, left: '41%' }, 1.1],
  [{ top: -6, left: '72%' }, 2.3],
  [{ bottom: -6, left: '24%' }, 0.6],
  [{ bottom: -6, left: '57%' }, 1.8],
  [{ bottom: -6, left: '88%' }, 2.9],
  [{ left: -6, top: '22%' }, 1.4],
  [{ left: -6, top: '55%' }, 2.6],
  [{ left: -6, top: '83%' }, 0.3],
  [{ right: -6, top: '16%' }, 2.0],
  [{ right: -6, top: '46%' }, 0.9],
  [{ right: -6, top: '76%' }, 3.2],
];

export function SealPlaque({
  seal,
  eyebrow,
  title,
  shopName,
  shopLine,
  awardedOn,
  body,
  how,
  record,
  variant = 'gold',
  intro = true,
  onShare,
  onClose,
}: SealPlaqueProps) {
  const plaque = useRef<HTMLDialogElement>(null);
  const sin = useRef<HTMLDialogElement>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  const cf = useRef<HTMLCanvasElement>(null);
  const fit = useRef<HTMLDivElement>(null);
  const share = useRef<HTMLButtonElement>(null);
  const mount = useRef<HTMLSpanElement>(null);
  const art = useRef<HTMLDivElement>(null);
  const skip = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closed = useRef(false);
  const titleId = useId();

  const close = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    onCloseRef.current();
  }, []);

  // awFit: the PLAQUE scales down until it fits; the share button stays full size under it (owner 15 Nov, "Stay full
  // size") — its full height + gap is reserved first, and it lives outside the scaled box
  const refit = useCallback(() => {
    const d = plaque.current;
    const w = fit.current;
    if (!d || !w || !d.open) return;
    const b = share.current;
    const L = plaqueLayout(d.clientWidth, d.clientHeight, w.offsetWidth, w.offsetHeight, b ? b.offsetHeight : null);
    w.style.top = `${L.top}px`;
    w.style.transformOrigin = '50% 0';
    w.style.transform = `translate(-50%,0) scale(${L.k})`;
    if (b && L.shareTop != null) {
      b.style.top = `${L.shareTop}px`;
      b.style.visibility = 'visible';
    }
  }, []);

  useLayoutEffect(() => {
    let dead = false;
    let raf = 0;
    let confettiT = 0;
    const d = plaque.current;
    const si = sin.current;
    if (!d || !si) return;
    const urls: string[] = [];
    let stopConfetti: (() => void) | null = null;
    // v46: black and gold confetti is No. 1's ONLY, and it never stops until the plaque closes (own small lazy chunk)
    const confetti = () => {
      const c = cf.current;
      if (!c || dead || variant !== 'no1') return;
      import(/* webpackChunkName: "award-story" */ './confetti')
        .then(({ awConfetti }) => {
          if (!dead && d.open) stopConfetti = awConfetti(c, () => !dead && d.open);
        })
        .catch(() => {});
    };

    // mounted: the seal is held still on the board; only light moves over it
    const sv = art.current?.querySelector('svg');
    sv?.querySelectorAll('animate,animateTransform,animateMotion,set').forEach((x) => {
      if (!x.hasAttribute('data-flow')) x.remove();
    });
    const svg = serializeArt(art.current);
    if (svg && mount.current) {
      const u = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      urls.push(u);
      mount.current.style.setProperty('--m', `url(${u})`);
    }

    const openPlaque = () => {
      if (!d.open) {
        try {
          d.showModal();
        } catch {
          d.setAttribute('open', '');
        }
      }
      refit();
    };
    const onCancelPlaque = (e: Event) => {
      e.preventDefault();
      close();
    };
    const onCancelIntro = (e: Event) => {
      e.preventDefault();
      skip.current = true;
    };
    d.addEventListener('cancel', onCancelPlaque);
    si.addEventListener('cancel', onCancelIntro);
    window.addEventListener('resize', refit);
    window.visualViewport?.addEventListener('resize', refit);

    if (!intro || prefersReducedMotion() || !svg) {
      openPlaque();
      confettiT = window.setTimeout(confetti, 250);
    } else {
      try {
        si.showModal();
      } catch {
        si.setAttribute('open', '');
      }
      (async () => {
        try {
          const { storyRig, asImageSvg, INTRO_END, REVEAL_S, STORY_MY, STORY_W } = await import(/* webpackChunkName: "award-story" */ './story-rig');
          if (dead) return;
          const rig = await storyRig({
            // v46: No. 1 opens on the velvet-curtain reveal (15 s); every other seal on the 4.6 s entrance
            reveal: variant === 'no1',
            svg,
            word: 'SEAL',
            tone: SEAL_TONE,
            shopName,
            line1: title,
            line2: awardedOn ? `Awarded on ${awardedOn}` : undefined,
          });
          if (dead) return;
          const END = rig.dur === REVEAL_S ? REVEAL_S : INTRO_END;
          canvasHost.current?.replaceChildren(rig.canvas);
          let t0 = performance.now();
          await new Promise<void>((res) => {
            const tk = () => {
              if (dead) return res();
              let t = (performance.now() - t0) / 1000;
              if (skip.current && t < END) {
                t0 -= (END - t) * 1000;
                t = END;
              }
              rig.frame(Math.min(t, END));
              if (t >= END) res();
              else raf = requestAnimationFrame(tk);
            };
            raf = requestAnimationFrame(tk);
          });
          if (dead) return;
          // the medal leaves the stage and lands in its slot on the plaque
          const r = rig.canvas.getBoundingClientRect();
          const k = r.width / STORY_W;
          const cx = r.left + (STORY_W / 2) * k;
          const cy = r.top + STORY_MY * k;
          const w = rig.dw * k;
          const h = rig.dh * k;
          rig.hide = true;
          rig.frame(END);
          d.classList.add(s.arriving!);
          openPlaque();
          // v44: the flyer is the exact seal mounted on the plaque (same crop), and it lands on that seal, not on the
          // whole niche — so nothing jumps on landing, No. 1 included
          const tgt: Element = art.current?.querySelector('svg') ?? mount.current ?? d;
          const fly = document.createElement('img');
          fly.className = s.sinFly!;
          fly.alt = '';
          const fu = URL.createObjectURL(new Blob([asImageSvg(svg)], { type: 'image/svg+xml' }));
          urls.push(fu);
          fly.src = fu;
          fly.style.cssText = `left:${cx - w / 2}px;top:${cy - h / 2}px;width:${w}px;height:${h}px`;
          d.appendChild(fly);
          const tb = tgt.getBoundingClientRect();
          si.classList.add(s.sinOut!);
          const dx = tb.left + tb.width / 2 - cx;
          const dy = tb.top + tb.height / 2 - cy;
          const sc = tb.width / (w || 1);
          const an = fly.animate(
            [
              { transform: 'translate(0,0) scale(1) rotate(0)' },
              { transform: `translate(${dx * 0.55}px,${dy * 0.45 - 60}px) scale(${((1 + sc) / 2) * 1.08}) rotate(-6deg)`, offset: 0.6 },
              { transform: `translate(${dx}px,${dy}px) scale(${sc}) rotate(0)` },
            ],
            { duration: 950, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' },
          );
          await an.finished.catch(() => {});
          if (dead) return;
          d.classList.remove(s.arriving!);
          d.classList.add(s.landed!);
          window.setTimeout(() => d.classList.remove(s.landed!), 700);
          fly.remove();
          if (si.open) si.close();
          confetti();
        } catch {
          // the entrance could not be drawn here: show the plaque itself
          if (dead) return;
          d.classList.remove(s.arriving!);
          openPlaque();
          if (si.open) si.close();
        }
      })();
    }

    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(confettiT);
      stopConfetti?.();
      d.removeEventListener('cancel', onCancelPlaque);
      si.removeEventListener('cancel', onCancelIntro);
      window.removeEventListener('resize', refit);
      window.visualViewport?.removeEventListener('resize', refit);
      if (si.open) si.close();
      if (d.open) d.close();
      d.classList.remove(s.arriving!, s.landed!);
      si.classList.remove(s.sinOut!);
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
    // played once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const html = useMemo(() => (typeof seal === 'string' ? { __html: seal } : null), [seal]);

  return (
    <>
      <dialog ref={sin} className={s.sin} aria-label="Seal awarded" data-award-seal-intro="" onClick={() => (skip.current = true)}>
        <div ref={canvasHost} style={{ display: 'contents' }} />
        <small>Tap to continue</small>
      </dialog>
      <dialog
        ref={plaque}
        className={s.awDlg}
        aria-labelledby={titleId}
        data-award-plaque=""
        data-k={variant}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        <canvas ref={cf} className={s.awCf} aria-hidden="true" />
        <div ref={fit} className={s.awFit}>
          <div className={s.awCard}>
            <button type="button" className={s.awX} aria-label="Close" onClick={close}>
              ×
            </button>
            <i className={`${s.awOr} ${s.orTl}`} />
            <i className={`${s.awOr} ${s.orTr}`} />
            <i className={`${s.awOr} ${s.orBl}`} />
            <i className={`${s.awOr} ${s.orBr}`} />
            <i className={s.awGl} />
            <i className={s.awSt} />
            <i className={s.awGf} />
            <i className={`${s.awGf} ${s.awGf2}`} />
            {STUD_GLINTS.map(([pos, delay], i) => (
              <i
                key={i}
                className={`${s.awDg} ${'bottom' in pos ? s.dgB : ''} ${'right' in pos ? s.dgR : ''}`}
                style={{ ...pos, animationDelay: `${delay}s` }}
              />
            ))}
            <div className={s.awSeal}>
              <span ref={mount} className={s.awMnt}>
                {html ? (
                  <div ref={art} className={s.awArt} dangerouslySetInnerHTML={html} />
                ) : (
                  <div ref={art} className={s.awArt}>
                    {seal}
                  </div>
                )}
                <i className={`${s.awHl} ${s.awHlSp}`} />
                <i className={`${s.awHl} ${s.awHlSw}`} />
                {SPARKS.map(([x, y, z, dd, l], i) => (
                  <i key={i} className={s.awSp} style={{ left: `${x}%`, top: `${y}%`, '--s': `${z}px`, '--d': `${dd}s`, '--l': `${l}s` } as CSSProperties} />
                ))}
              </span>
            </div>
            <div className={s.awPlate}>
              <i className={s.awSh} />
              <i className={`${s.awSh} ${s.awShB}`} />
              {GLINTS.map(([x, y, l], i) => (
                <i key={i} className={s.awTw} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${l}s` }} />
              ))}
              <i className={s.awSc} style={{ left: 10, top: 10 }} />
              <i className={`${s.awSc} ${s.sc2}`} style={{ right: 10, top: 10 }} />
              <i className={`${s.awSc} ${s.sc3}`} style={{ left: 10, bottom: 10 }} />
              <i className={`${s.awSc} ${s.sc4}`} style={{ right: 10, bottom: 10 }} />
              {eyebrow ? <p className={s.awEye}>{eyebrow}</p> : null}
              <h3 className={s.awTitle} id={titleId}>
                {title}
              </h3>
              <i className={s.awDiv} aria-hidden="true" />
              <p className={s.awShop}>{shopLine ?? `Awarded to ${shopName}`}</p>
              {awardedOn ? <p className={s.awOn}>Awarded on {awardedOn}</p> : null}
              {body ? <p className={s.awBody}>{body}</p> : null}
              {how && how.length ? (
                <div className={s.awHow}>
                  <b>How it is earned</b>
                  <ul>
                    {how.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {record && record.length ? (
                <div className={s.awRec}>
                  {record.map(([n, l], i) => (
                    <span key={i}>
                      <strong>{n}</strong>
                      {l}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className={s.awHm} aria-label="An exclusive Setnayan seal" role="img">
                <SetnayanMark className={s.mark} aria-hidden="true" role="presentation" aria-label={undefined} />
                <span>AN EXCLUSIVE SETNAYAN SEAL</span>
              </div>
            </div>
          </div>
        </div>
        {onShare ? (
          // outside the scaled plaque: it never shrinks (owner, "Stay full size"); placed under it by refit
          <button ref={share} type="button" className={s.awShare} onClick={() => onShare(serializeArt(art.current))}>
            ↗ Share to story
          </button>
        ) : null}
      </dialog>
    </>
  );
}
