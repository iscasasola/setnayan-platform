'use client';

/**
 * 🎁 THE GIFT BOX — the approved realistic box (owner 15 Nov: *"giftbox approved"*; corpus
 * `prototypes/supplier_badges_2026-11-15/gift-box_APPROVED_2026-11-15.html`, `buildBox`), ported face for face.
 *
 * A real box in CSS 3D (`gift-box-geometry.ts`): a base with four walls, a rim and a lining; a lid that is its own
 * hollow box with the double bow on it; satin ribbon that slips off the sides; the raised wax seal on the front.
 *   · paper: a gift FROM SETNAYAN is polished gold foil with the Setnayan mark embossed all over, a wine satin ribbon
 *     and a dark wine wax pressed in gold leaf (owner: "Setnayan box is gold" · "more premium and expensive"); a gift
 *     FROM A SUPPLIER is terracotta paper with a gold ribbon (owner: "Supplier box is terracotta").
 *   · the seal: the sender's mark — Setnayan's on Setnayan's box; the shop's OWN LOGO on a supplier's box (owner 15 Nov:
 *     "for gifts the supplier has their own logo and it will not be setnayan logo"); a shop with no logo gets its two
 *     initials, pressed the same way.
 *   · the ticket (optional): the reward they received, standing inside, hidden by the front wall until it rises out.
 *
 * A pure picture of the box at rest (`open` false) or opened (`open` true); `animate` plays the opening. No fetch.
 */

import { useId, type CSSProperties, type ReactNode } from 'react';
import { SetnayanMark } from '@/app/_components/setnayan-mark-icon';
import type { GiftSeal } from '@/lib/gift-moment';
import { SY_PATH } from '@/lib/photo-mark-geometry';
import {
  D,
  EX,
  EZ,
  H,
  LD,
  LH,
  LW,
  RW,
  SEAL,
  SPARKS,
  SY,
  T,
  TH,
  TL,
  TW,
  TX,
  W,
  WAX_BLOB,
  GAP,
  LID_END,
  LID_REST,
  TICKET_END,
  boxKeyframes,
  embossDataUri,
  n,
  tr,
} from './gift-box-geometry';
import { paperFor } from './gift-moment-rules';
import s from './gift-box.module.css';


const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

function Face({
  cls,
  w,
  h,
  transform,
  children,
  html,
  style,
}: {
  cls: string | undefined;
  w: number;
  h: number;
  transform: string;
  children?: ReactNode;
  html?: string;
  style?: CSSProperties;
}) {
  const st: CSSProperties = { width: `${n(w)}em`, height: `${n(h)}em`, margin: `${n(-h / 2)}em 0 0 ${n(-w / 2)}em`, transform, ...style };
  if (html) return <div className={cx(s.f, cls)} style={st} dangerouslySetInnerHTML={{ __html: html }} />;
  return (
    <div className={cx(s.f, cls)} style={st}>
      {children}
    </div>
  );
}

function Strip({ cls, l, t, w, h }: { cls?: string; l: number; t: number; w: number; h: number }) {
  return <i className={cx(s.rb, cls)} style={{ left: `${n(l)}em`, top: `${n(t)}em`, width: `${n(w)}em`, height: `${n(h)}em` }} />;
}

/** Two short ribbon ends pinned under the wax, V-cut — what is left on the box when the ribbon slips off. */
function tabsSvg(id: string): string {
  return (
    `<svg style="position:absolute;left:0;top:0;width:${W}em;height:${H}em;overflow:visible" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs>` +
    `<linearGradient id="tb${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style="stop-color:var(--gb-g-lo)"/><stop offset=".3" style="stop-color:var(--gb-g-hi)"/><stop offset=".45" style="stop-color:var(--gb-g-sp)"/><stop offset=".62" style="stop-color:var(--gb-gold)"/><stop offset="1" style="stop-color:var(--gb-g-dk)"/></linearGradient></defs>` +
    `<g transform="translate(${W / 2} ${SY})">` +
    `<path d="M-3.4 2 L-7.2 13.4 L-4.2 11.6 L-2.2 14.4 L1 2Z" style="fill:var(--gb-shade)" opacity=".3" transform="translate(.5 .5)"/>` +
    `<path d="M3.4 2 L7.6 12.6 L4.4 11.2 L2.8 14 L-1 2Z" style="fill:var(--gb-shade)" opacity=".3" transform="translate(.5 .5)"/>` +
    `<path d="M-3.4 2 L-7.2 13.4 L-4.2 11.6 L-2.2 14.4 L1 2Z" fill="url(#tb${id})"/>` +
    `<path d="M3.4 2 L7.6 12.6 L4.4 11.2 L2.8 14 L-1 2Z" fill="url(#tb${id})"/>` +
    `</g></svg>`
  );
}

/** The bow: two loops behind, two in front, each a folded band with its inside in shadow; the knot on top. */
function bowSvg(id: string): string {
  const g = (k: string, a: string, b: string, c: string, x1: number, y1: number, x2: number, y2: number) =>
    `<linearGradient id="${k}${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" style="stop-color:var(${a})"/><stop offset=".5" style="stop-color:var(${b})"/><stop offset="1" style="stop-color:var(${c})"/></linearGradient>`;
  const u = (k: string) => `url(#${k}${id})`;
  return (
    `<svg viewBox="0 0 160 92" aria-hidden="true"><defs>` +
    g('ba', '--gb-g-sp', '--gb-g-hi', '--gb-gold', 0.35, 0, 0.55, 1) +
    g('bb', '--gb-g-hi', '--gb-gold', '--gb-g-lo', 0.6, 0, 0.45, 1) +
    g('bi', '--gb-g-dk', '--gb-g-dk', '--gb-g-lo', 0, 0, 0, 1) +
    g('bk', '--gb-g-sp', '--gb-g-hi', '--gb-g-lo', 0, 0.1, 1, 0.9) +
    g('bc', '--gb-g-hi', '--gb-gold', '--gb-g-dk', 0, 0, 0, 1) +
    g('bl', '--gb-gold', '--gb-g-lo', '--gb-g-dk', 0, 0, 0, 1) +
    `</defs>` +
    `<path d="M78 70 C 70 48, 58 12, 42 11 C 28 13, 27 36, 41 54 C 52 66, 66 71, 78 74Z" fill="${u('bc')}"/>` +
    `<path d="M72 64 C 65 48, 55 30, 46 28 C 40 31, 42 44, 50 54 C 57 61, 65 63, 72 66Z" fill="${u('bi')}"/>` +
    `<path d="M73 60 C 66 42, 56 20, 44 17" fill="none" style="stroke:var(--gb-sheen2)" stroke-opacity=".5" stroke-width="1.8" stroke-linecap="round"/>` +
    `<path d="M82 70 C 90 48, 102 12, 118 11 C 132 13, 133 36, 119 54 C 108 66, 94 71, 82 74Z" fill="${u('bl')}"/>` +
    `<path d="M88 64 C 95 48, 105 30, 114 28 C 120 31, 118 44, 110 54 C 103 61, 95 63, 88 66Z" fill="${u('bi')}"/>` +
    `<path d="M87 60 C 94 42, 104 21, 115 17" fill="none" style="stroke:var(--gb-sheen2)" stroke-opacity=".3" stroke-width="1.6" stroke-linecap="round"/>` +
    `<path d="M76 69 C 63 44, 36 24, 16 31 C 0 38, -2 64, 11 78 C 26 91, 58 88, 78 80Z" fill="${u('ba')}"/>` +
    `<path d="M12 60 C 24 44, 46 44, 70 66 C 52 56, 30 54, 14 70Z" style="fill:var(--gb-tint)" opacity=".16"/>` +
    `<path d="M67 73 C 57 63, 41 56, 29 60 C 21 64, 22 72, 30 77 C 42 82, 57 80, 68 77Z" fill="${u('bi')}"/>` +
    `<path d="M30 77 C 42 82, 57 80, 68 77 C 56 77.5, 43 77, 33 73.5Z" style="fill:var(--gb-cream)" opacity=".3"/>` +
    `<path d="M70 60 C 57 41, 37 30, 20 36" fill="none" style="stroke:var(--gb-sheen)" stroke-opacity=".85" stroke-width="3" stroke-linecap="round" data-sheen=""/>` +
    `<path d="M66 62 C 54 47, 38 38, 24 42" fill="none" style="stroke:var(--gb-sheen)" stroke-opacity=".3" stroke-width="5" stroke-linecap="round" data-sheen=""/>` +
    `<path d="M8 46 C 1 56, 3 70, 14 80" fill="none" style="stroke:var(--gb-sheen2)" stroke-opacity=".35" stroke-width="1.6" stroke-linecap="round" data-sheen=""/>` +
    `<path d="M74 70 C 64 62, 55 58, 45 56M75 79 C 65 83, 54 85, 42 85M73 74.5 C 66 73, 60 72, 54 71.5" fill="none" style="stroke:var(--gb-tint)" stroke-opacity=".34" stroke-width=".9" stroke-linecap="round"/>` +
    `<path d="M84 69 C 97 44, 124 24, 144 31 C 160 38, 162 64, 149 78 C 134 91, 102 88, 82 80Z" fill="${u('bb')}"/>` +
    `<path d="M148 60 C 136 44, 114 44, 90 66 C 108 56, 130 54, 146 70Z" style="fill:var(--gb-tint)" opacity=".18"/>` +
    `<path d="M93 73 C 103 63, 119 56, 131 60 C 139 64, 138 72, 130 77 C 118 82, 103 80, 92 77Z" fill="${u('bi')}"/>` +
    `<path d="M130 77 C 118 82, 103 80, 92 77 C 104 77.5, 117 77, 127 73.5Z" style="fill:var(--gb-cream)" opacity=".18"/>` +
    `<path d="M90 60 C 103 42, 122 31, 138 35" fill="none" style="stroke:var(--gb-sheen)" stroke-opacity=".6" stroke-width="2.4" stroke-linecap="round" data-sheen=""/>` +
    `<path d="M94 62 C 106 47, 122 38, 136 42" fill="none" style="stroke:var(--gb-sheen)" stroke-opacity=".2" stroke-width="5" stroke-linecap="round" data-sheen=""/>` +
    `<path d="M86 70 C 96 62, 105 58, 115 56M85 79 C 95 83, 106 85, 118 85M87 74.5 C 94 73, 100 72, 106 71.5" fill="none" style="stroke:var(--gb-tint)" stroke-opacity=".36" stroke-width=".9" stroke-linecap="round"/>` +
    `<path d="M70 62 C 76 59, 84 59, 90 62 C 93.5 69, 93.5 81, 90 88 C 84 91, 76 91, 70 88 C 66.5 81, 66.5 69, 70 62Z" fill="${u('bk')}"/>` +
    `<path d="M73.5 64 C 71 72, 71 81, 73.5 87" fill="none" style="stroke:var(--gb-sheen)" stroke-opacity=".8" stroke-width="2" stroke-linecap="round" data-sheen=""/>` +
    `<path d="M85 62 C 87.5 71, 87.5 81, 85 89M79.5 61 C 80.5 70, 80.5 81, 79.5 90" fill="none" style="stroke:var(--gb-tint)" stroke-opacity=".3" stroke-width=".8"/>` +
    `</svg>`
  );
}

/** What lies flat on the lid: the bow's shadow and its two tails, each cut to a V. */
function topSvg(id: string): string {
  const cxx = LW / 2;
  const cy = LD / 2;
  const g = (k: string, x1: number, y1: number, x2: number, y2: number) =>
    `<linearGradient id="${k}${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" style="stop-color:var(--gb-g-lo)"/><stop offset=".3" style="stop-color:var(--gb-g-hi)"/><stop offset=".46" style="stop-color:var(--gb-g-sp)"/><stop offset=".64" style="stop-color:var(--gb-gold)"/><stop offset="1" style="stop-color:var(--gb-g-dk)"/></linearGradient>`;
  const a = 'M-2.2 -1.2 Q -9.4 3.6, -15.9 12.5 L -11.7 11.9 L -12.3 16.1 Q -5.4 8.1, 1.4 2.4Z';
  const b = 'M2.2 -1.4 Q 9.6 2.1, 17 10.2 L 12.9 10.2 L 13.8 14.3 Q 6.6 7.6, -1 2.6Z';
  return (
    `<svg style="position:absolute;left:0;top:0;width:${n(LW)}em;height:${n(LD)}em;overflow:visible" viewBox="0 0 ${n(LW)} ${n(LD)}" aria-hidden="true"><defs>` +
    `<radialGradient id="ts${id}"><stop offset="0" style="stop-color:var(--gb-shade)" stop-opacity=".6"/><stop offset="1" style="stop-color:var(--gb-shade)" stop-opacity="0"/></radialGradient>` +
    g('ta', -9.2, 5.4, -5.5, 9.1) +
    g('tc', 9.2, 3.6, 6, 7.7) +
    `</defs><g transform="translate(${n(cxx)} ${n(cy)})">` +
    `<ellipse cx="1.4" cy="1.6" rx="15" ry="6.5" fill="url(#ts${id})"/>` +
    `<path d="${a}" style="fill:var(--gb-shade)" opacity=".34" transform="translate(.55 .65)"/><path d="${b}" style="fill:var(--gb-shade)" opacity=".34" transform="translate(.55 .65)"/>` +
    `<path d="${a}" fill="url(#ta${id})"/><path d="${b}" fill="url(#tc${id})"/>` +
    `<path d="M-1 .4 Q -8 5.6, -13.4 13" fill="none" style="stroke:var(--gb-crease)" stroke-opacity=".22" stroke-width=".28"/>` +
    `<path d="M.8 .4 Q 8 4.6, 14.6 11.6" fill="none" style="stroke:var(--gb-crease)" stroke-opacity=".22" stroke-width=".28"/>` +
    `</g></svg>`
  );
}

/** The wax itself: an irregular, raised puddle with its rim lit from the upper left. */
function waxSvg(id: string): string {
  return (
    `<svg class="${s.wx}" viewBox="-12 -12 124 124" aria-hidden="true"><defs>` +
    `<radialGradient id="ws${id}" cx=".5" cy=".5" r=".5"><stop offset=".62" style="stop-color:var(--gb-shade)" stop-opacity=".55"/><stop offset="1" style="stop-color:var(--gb-shade)" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="wf${id}" cx=".34" cy=".28" r=".85"><stop offset="0" style="stop-color:var(--gb-wax-hi)"/><stop offset=".42" style="stop-color:var(--gb-wax)"/><stop offset="1" style="stop-color:var(--gb-wax-dk)"/></radialGradient>` +
    `<linearGradient id="wr${id}" x1=".12" y1=".1" x2=".62" y2=".66"><stop offset="0" style="stop-color:var(--gb-peach)" stop-opacity=".75"/><stop offset="1" style="stop-color:var(--gb-peach)" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="wd${id}" x1=".9" y1=".92" x2=".4" y2=".4"><stop offset="0" style="stop-color:var(--gb-shade)" stop-opacity=".6"/><stop offset="1" style="stop-color:var(--gb-shade)" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="ww${id}" x1=".15" y1=".1" x2=".85" y2=".9"><stop offset="0" style="stop-color:var(--gb-shade)" stop-opacity=".34"/><stop offset=".55" style="stop-color:var(--gb-shade)" stop-opacity=".08"/><stop offset="1" style="stop-color:var(--gb-blush)" stop-opacity=".14"/></linearGradient>` +
    `<linearGradient id="wl${id}" x1=".2" y1=".15" x2=".85" y2=".9"><stop offset=".35" style="stop-color:var(--gb-blush)" stop-opacity="0"/><stop offset="1" style="stop-color:var(--gb-blush)" stop-opacity=".7"/></linearGradient>` +
    `</defs>` +
    `<ellipse cx="53.5" cy="55" rx="55" ry="54" fill="url(#ws${id})"/>` +
    `<path d="${WAX_BLOB}" fill="url(#wf${id})"/>` +
    `<path d="${WAX_BLOB}" fill="none" stroke="url(#wd${id})" stroke-width="3.2" transform="translate(50 50) scale(.955) translate(-50 -50)"/>` +
    `<path d="${WAX_BLOB}" fill="none" stroke="url(#wr${id})" stroke-width="2.6" transform="translate(50 50) scale(.945) translate(-50 -50)"/>` +
    `<circle cx="50" cy="50" r="33" fill="url(#ww${id})"/>` +
    `<circle cx="50" cy="50" r="33" fill="none" style="stroke:var(--gb-shade)" stroke-opacity=".5" stroke-width="1.5"/>` +
    `<circle cx="50.6" cy="50.7" r="33.6" fill="none" stroke="url(#wl${id})" stroke-width="1.1"/>` +
    `<ellipse cx="27" cy="19.5" rx="9.5" ry="3.6" transform="rotate(-36 27 19.5)" style="fill:var(--gb-pearl)" opacity=".55"/>` +
    `<circle cx="16.5" cy="33" r="1.7" style="fill:var(--gb-pearl)" opacity=".5"/>` +
    `</svg>`
  );
}

/** The wax seal on the front: the puddle, and the sender's mark pressed into it. */
function Seal({ seal, label, id }: { seal: GiftSeal; label: string; id: string }) {
  return (
    <span
      className={s.seal}
      role="img"
      aria-label={label}
      data-gift-seal={seal.kind}
      style={{ left: `${n(W / 2)}em`, top: `${n(SY)}em`, width: `${SEAL}em`, height: `${SEAL}em` }}
    >
      <span aria-hidden dangerouslySetInnerHTML={{ __html: waxSvg(id) }} className={s.wxHost} />
      {seal.kind === 'setnayan' ? (
        <span className={s.mk} aria-hidden>
          <SetnayanMark className={s.lo} />
          <SetnayanMark className={s.dk} />
        </span>
      ) : seal.kind === 'logo' ? (
        // eslint-disable-next-line @next/next/no-img-element -- the shop's presigned logo, pressed into the wax; no optimiser hop
        <img src={seal.src} alt="" className={s.logo} data-gift-seal-logo="" />
      ) : (
        <b className={s.ini} aria-hidden>
          {seal.initials}
        </b>
      )}
    </span>
  );
}

export type GiftBoxProps = {
  seal: GiftSeal;
  /** The seal's spoken name ("A gift from Liwanag Lights & Bar"). */
  label: string;
  /** false = wrapped; true = opened (lid off, ribbon slipped, light from the lining). */
  open: boolean;
  /** Play the opening (the lid's flight, the sparks, the flash). false shows the opened picture at rest. */
  animate?: boolean;
  /** The shake that comes before the opening. */
  shaking?: boolean;
  /** The reward ticket's picture (a data URI or URL), standing inside the box until it rises out. */
  ticketSrc?: string | null;
  className?: string;
};

/** The box's keyframes that depend on its own sizes — written once per page, by the first box drawn. */
const KEYFRAMES = boxKeyframes();
/** The poses the stylesheet reads, and the gold foil's emboss — computed once, from the one geometry. */
const BOX_VARS = { '--gb-lid-rest': LID_REST, '--gb-lid-end': LID_END, '--gb-tk-end': TICKET_END } as CSSProperties;
const SN_VARS = { ...BOX_VARS, '--gb-emb': embossDataUri(SY_PATH) } as CSSProperties;

export function GiftBox({ seal, label, open, animate = false, shaking = false, ticketSrc, className }: GiftBoxProps) {
  const rawId = useId();
  const id = rawId.replace(/[^a-zA-Z0-9]/g, '');
  const rl = (W - RW) / 2;
  const rd = (D - RW) / 2;
  const cover = LH - GAP;
  const ll = (LW - RW) / 2;
  const ld = (LD - RW) / 2;
  const glw = <i className={s.glw} />;
  const ao = <i className={s.ao} style={{ ['--gb-cover' as string]: `${n(cover)}em` } as CSSProperties} />;
  return (
    <span
      className={cx(s.gbox, open && s.open, open && animate && s.anim, shaking && s.shake, paperFor(seal) === 'setnayan' && s.fromSn, className)}
      style={paperFor(seal) === 'setnayan' ? SN_VARS : BOX_VARS}
      data-gift-box={paperFor(seal)}
      data-gift-box-state={open ? 'open' : 'wrapped'}
    >
      <style>{KEYFRAMES}</style>
      <div className={s.pool} />
      <div className={s.scene}>
        <div className={s.world}>
          <Face cls={cx(s.sh, s.far)} w={W * 1.1} h={D * 1.1} transform={tr(6, -0.02, 5, 'rotateX(90deg)')} />
          <Face cls={s.sh} w={W * 0.94} h={D * 0.94} transform={tr(2.6, -0.04, 2, 'rotateX(90deg)')} />
          <Face cls={cx(s.sh, s.shLid)} w={LH + 10} h={LD * 0.9} transform={tr(EX + 3, -0.06, EZ + 1.5, 'rotateX(90deg)')} />
          <div className={cx(s.g3, s.base)}>
            {/* inside first (painted under on engines that sort by order) */}
            <Face cls={cx(s.in, s.flr)} w={W - 2 * T} h={D - 2 * T} transform={tr(0, -T, 0, 'rotateX(90deg)')}>
              {glw}
            </Face>
            <Face cls={cx(s.in, s.inb)} w={W - 2 * T} h={H - T} transform={tr(0, -(H + T) / 2, -D / 2 + T)}>
              {glw}
            </Face>
            <Face cls={cx(s.in, s.inl)} w={D - 2 * T} h={H - T} transform={tr(-W / 2 + T, -(H + T) / 2, 0, 'rotateY(90deg)')}>
              {glw}
            </Face>
            <Face cls={s.in} w={D - 2 * T} h={H - T} transform={tr(W / 2 - T, -(H + T) / 2, 0, 'rotateY(-90deg)')} />
            <Face cls={s.in} w={W - 2 * T} h={H - T} transform={tr(0, -(H + T) / 2, D / 2 - T, 'rotateY(180deg)')} />
            {ticketSrc ? (
              <Face cls={s.tkt} w={TW * TX} h={TH * TX} transform="">
                {/* eslint-disable-next-line @next/next/no-img-element -- the ticket is one drawn picture (a data URI) */}
                <img src={ticketSrc} alt="" aria-hidden className={s.tktImg} data-gift-ticket-in-box="" />
              </Face>
            ) : null}
            {/* outside */}
            <Face cls={cx(s.pf, s.back)} w={W} h={H} transform={tr(0, -H / 2, -D / 2, 'rotateY(180deg)')} />
            <Face cls={cx(s.pf, s.left)} w={D} h={H} transform={tr(-W / 2, -H / 2, 0, 'rotateY(-90deg)')} />
            <Face cls={cx(s.pf, s.right)} w={D} h={H} transform={tr(W / 2, -H / 2, 0, 'rotateY(90deg)')}>
              <Strip cls={cx(s.dn, s.shade)} l={rd} t={0} w={RW} h={H} />
              {ao}
            </Face>
            <Face cls={cx(s.pf, s.front)} w={W} h={H} transform={tr(0, -H / 2, D / 2)}>
              <i className={s.foil} />
              <Strip cls={s.up} l={rl} t={0} w={RW} h={SY} />
              <Strip cls={s.dn} l={rl} t={SY} w={RW} h={H - SY} />
              {ao}
              <span aria-hidden dangerouslySetInnerHTML={{ __html: tabsSvg(id) }} />
              <Seal seal={seal} label={label} id={id} />
            </Face>
            {/* the rim: the wall has a thickness */}
            <Face cls={cx(s.pf, s.rim)} w={W} h={T} transform={tr(0, -H, D / 2 - T / 2, 'rotateX(90deg)')} />
            <Face cls={cx(s.pf, s.rim)} w={W} h={T} transform={tr(0, -H, -D / 2 + T / 2, 'rotateX(90deg)')} />
            <Face cls={cx(s.pf, s.rim, s.rimSh)} w={T} h={D} transform={tr(-W / 2 + T / 2, -H, 0, 'rotateX(90deg)')} />
            <Face cls={cx(s.pf, s.rim, s.rimSh)} w={T} h={D} transform={tr(W / 2 - T / 2, -H, 0, 'rotateX(90deg)')} />
          </div>
          {/* the lid: its own little hollow box, the bow standing on it */}
          <div className={cx(s.g3, s.lid)}>
            <Face cls={cx(s.in, s.lin)} w={LW - 2 * TL} h={LD - 2 * TL} transform={tr(0, TL, 0, 'rotateX(-90deg)')} />
            <Face cls={cx(s.in, s.lin)} w={LW - 2 * TL} h={LH - TL} transform={tr(0, (LH + TL) / 2, -LD / 2 + TL)} />
            <Face cls={cx(s.in, s.lin)} w={LD - 2 * TL} h={LH - TL} transform={tr(-LW / 2 + TL, (LH + TL) / 2, 0, 'rotateY(90deg)')} />
            <Face cls={cx(s.in, s.lin)} w={LD - 2 * TL} h={LH - TL} transform={tr(LW / 2 - TL, (LH + TL) / 2, 0, 'rotateY(-90deg)')} />
            <Face cls={cx(s.in, s.lin)} w={LW - 2 * TL} h={LH - TL} transform={tr(0, (LH + TL) / 2, LD / 2 - TL, 'rotateY(180deg)')} />
            <Face cls={cx(s.pf, s.lrim)} w={LW} h={TL} transform={tr(0, LH, LD / 2 - TL / 2, 'rotateX(-90deg)')} />
            <Face cls={cx(s.pf, s.lrim)} w={LW} h={TL} transform={tr(0, LH, -LD / 2 + TL / 2, 'rotateX(-90deg)')} />
            <Face cls={cx(s.pf, s.lrim)} w={TL} h={LD} transform={tr(-LW / 2 + TL / 2, LH, 0, 'rotateX(-90deg)')} />
            <Face cls={cx(s.pf, s.lrim)} w={TL} h={LD} transform={tr(LW / 2 - TL / 2, LH, 0, 'rotateX(-90deg)')} />
            <Face cls={cx(s.pf, s.lback)} w={LW} h={LH} transform={tr(0, LH / 2, -LD / 2, 'rotateY(180deg)')}>
              <Strip cls={s.shade} l={ll} t={0} w={RW} h={LH} />
            </Face>
            <Face cls={cx(s.pf, s.lleft)} w={LD} h={LH} transform={tr(-LW / 2, LH / 2, 0, 'rotateY(-90deg)')}>
              <Strip cls={s.shade} l={ld} t={0} w={RW} h={LH} />
            </Face>
            <Face cls={cx(s.pf, s.lright)} w={LD} h={LH} transform={tr(LW / 2, LH / 2, 0, 'rotateY(90deg)')}>
              <Strip cls={cx(s.fold, s.shade)} l={ld} t={0} w={RW} h={LH} />
            </Face>
            <Face cls={cx(s.pf, s.lfront)} w={LW} h={LH} transform={tr(0, LH / 2, LD / 2)}>
              <Strip cls={s.fold} l={ll} t={0} w={RW} h={LH} />
            </Face>
            <Face cls={cx(s.pf, s.ltop)} w={LW} h={LD} transform="rotateX(90deg)">
              <i className={s.foil} />
              <Strip cls={s.h} l={0} t={ld} w={LW} h={RW} />
              <Strip l={ll} t={0} w={RW} h={LD} />
              <span aria-hidden dangerouslySetInnerHTML={{ __html: topSvg(id) }} />
              <i className={s.dim} />
            </Face>
            <Face cls={s.bow} w={36} h={20.7} transform={tr(0, -20.7 / 2 + 1, 0.6, 'rotateX(9deg)')} html={bowSvg(id)} />
          </div>
        </div>
        {/* light, flash, sparks: flat, over the box */}
        <div className={s.spill} />
        {SPARKS.map((k, i) => (
          <i
            key={i}
            className={cx(s.spk, k.shape === 'streak' && s.s2, k.shape === 'square' && s.s3)}
            style={{ ['--gb-dx' as string]: k.dx, ['--gb-dy' as string]: k.dy, ['--gb-rt' as string]: k.rt } as CSSProperties}
          />
        ))}
        <div className={s.flash} />
      </div>
    </span>
  );
}
