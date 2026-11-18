'use client';

/**
 * 🎁 GiftMoment — THE ONE TAP-TO-OPEN GIFT POPUP, now with the APPROVED realistic box (owner 14 Nov "THE GIFT MOMENT —
 * A POPUP, TAP TO OPEN" · "ONE PIECE, USED THREE WAYS" · "PRESSING REDEEM IS THE CLAIM"; owner 15 Nov "THE GIFT HAS NO
 * BUTTONS — A TAP MOVES ON" · "THE GIFT SITS ON ITS BADGE'S BACKGROUND, AND A SUPPLIER'S GIFT BOX IS SEALED WITH THE
 * SUPPLIER'S OWN LOGO" · "ONE CLOSE BUTTON FOR EVERY FULL SCREEN" · "GIFT PAGE APPROVED" · "Gift box · APPROVED
 * (confirmed)" · e5ec685d (2); contract: corpus prototypes/supplier_badges_2026-11-15/gift-box_APPROVED_2026-11-15.html).
 *
 * LOADED LAZILY — `gift-moments.tsx` imports it with `next/dynamic` only when a moment is about to show, so no page
 * carries it (or the box's art) in its first load.
 *
 * ── WHAT IT DOES ──────────────────────────────────────────────────────────────────────────────────────────────
 *   · A TAP MOVES ON, ANYWHERE: on the wrapped box it opens it; once the card is up it closes. Nothing moves on by
 *     itself. The one ✕ (44px round, top left, dark glass, ivory ring — `FullscreenClose`) is Later at every moment.
 *   · The box (`gift-box.tsx`): Setnayan's is polished gold with the Setnayan mark on the wax; a supplier's is
 *     terracotta pressed with the SHOP'S OWN LOGO (its two initials when it has none). Tap → shake → the lid lifts and
 *     tips off, the ribbon slips, light from the lining, gold sparks + the shipped flash + confetti → the ticket rises
 *     out, goes up and over and lands big in the middle while the box steps back → the card rises.
 *   · A gift that came with a badge sits on that BADGE'S BACKGROUND (navy rays for Verified, gold rays for a tier up),
 *     never a grey stage between; a supplier's gift to a couple sits on the shipped blurred backdrop over their page.
 *   · CLAIMING (e5ec685d point 2): a badge or seal reward is claimed AUTOMATICALLY the moment the popup shows (owner:
 *     "once the pop up shows, that is already claimed") — no button, the card says "✓ In your gifts". A couple's gift
 *     from a supplier KEEPS its press: Redeem is the claim, "Claiming…" while out, "No connection — your gift is
 *     safe" + Try again (the SAME claim), "✓ Claimed" once in. Either way the database key makes it count once.
 *   · Reduce motion: one short cross-fade from wrapped to opened; the ticket appears in place; nothing flies.
 *   · No counter: "1 of 2" is gone (owner 15 Nov: "Why does it say 1 of 2 on the gift"); gifts still play one after
 *     another, each its own moment.
 *
 * ── PROPS (G3 reuses this piece for Setnayan → shop gifts) ───────────────────────────────────────────────────────
 *   view        GiftMomentView (lib/gift-moment.ts) — every word composed; the seal; `claimedAt` (null = waiting).
 *   startOpen   this person already opened it once: it comes back OPEN (no wrapping, no tap).
 *   claimMode   'auto' (claimed on show, no button) · 'press' (the choices below are the claim). Default: a badge
 *               reward is 'auto'; anything else 'press'.
 *   choices     the buttons that claim, in 'press' mode. Default ONE: Redeem. A plan gift passes two (e.g. "Upgrade
 *               now" main + "Start it when my plan ends"); every choice is the same claim.
 *   claim       (choiceId) => Promise<unknown> — sends THE claim; resolves to the server's answer. Default:
 *               POST /api/unwrap {source, ref}. In 'auto' mode it is called once with 'auto'.
 *   stage       'verified' | 'tier' | null — the badge background the box sits on. Default: from the view (a badge
 *               reward → Verified's navy when the new badge is Verified, else a tier's gold); null for anything else.
 *   ticket      { src, label } — the reward ticket's picture (the award kit's ticket, as a data URI) and its words.
 *               Without one, the box opens on its lit lining and the card says what came.
 *   arrive      the box drops in (after a badge's own full screen).
 *   onOpened    the person tapped it open (the host remembers it, so it comes back open).
 *   onClaimed   (choiceId) => void — the claim is in ('auto' for an automatic one).
 *   onLater     ✕ / Esc / a tap once the card is up — shuts the moment; an unclaimed gift keeps its waiting line.
 */

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { ShieldAlert } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { OverlayBackdrop } from '@/app/_components/overlay-backdrop';
import { ShopBadgePill } from '@/app/_components/shop-badge-pill';
import { StdTouchGlow } from '@/app/[slug]/_components/reveal/std-touch-glow';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { CLAIM_WORDS, claimStateFrom, type ClaimState } from '@/lib/gift-moment-queue';
import type { GiftMomentView } from '@/lib/gift-moment';
import { CONFETTI } from './gift-art';
import { GiftBox } from './gift-box';
import { FullscreenClose } from './close-x';
import { GIFT_WORDS, claimModeFor, stageFor, type GiftClaimMode, type GiftStage } from './gift-moment-rules';
import box from './gift-box.module.css';
import s from './gift-moment.module.css';

export type GiftChoice = { id: string; label: string; main?: boolean };
export type GiftTicket = { src: string; label: string };

export type GiftMomentProps = {
  view: GiftMomentView;
  /** Kept so older callers compile; no longer drawn (owner 15 Nov). */
  counter?: string | null;
  startOpen?: boolean;
  claimMode?: GiftClaimMode;
  choices?: readonly GiftChoice[];
  claim?: (choiceId: string) => Promise<unknown>;
  stage?: GiftStage;
  ticket?: GiftTicket | null;
  arrive?: boolean;
  onOpened?: () => void;
  onClaimed?: (choiceId: string) => void;
  onLater: () => void;
};

const REDEEM: readonly GiftChoice[] = [{ id: 'redeem', label: CLAIM_WORDS.redeem, main: true }];

/** The default claim: the one door, POST /api/unwrap. A non-2xx that is not a refusal reads as "no answer". */
export async function postGiftClaim(view: Pick<GiftMomentView, 'source' | 'ref'>): Promise<unknown> {
  const r = await fetch('/api/unwrap', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ source: view.source, ref: view.ref }),
  });
  if (r.ok || r.status === 403) return r.json();
  return null;
}

type Phase = 'wrapped' | 'shaking' | 'open';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

/** A motion token, in ms, read from the page (so a change to the token changes the flight too). */
function tokenMs(name: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
function tokenCurve(name: string): string {
  if (typeof window === 'undefined') return 'ease';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || 'ease';
}

/** The badge's drifting lights, in a fixed pattern (a share of one "enter" each, so they read the token). */
const MOTES = Array.from({ length: 16 }, (_, i) => ({
  left: `${((i * 61) % 96) + 2}%`,
  d: `calc(var(--sn-dur-enter) * ${(9.4 + ((i * 37) % 40) / 6.4).toFixed(2)})`,
  dl: `calc(var(--sn-dur-enter) * ${(((i * 53) % 50) / 6.4).toFixed(2)})`,
  x: `${((i * 29) % 41) - 20}px`,
}));

export default function GiftMoment({
  view,
  startOpen = false,
  claimMode,
  choices = REDEEM,
  claim,
  stage,
  ticket = null,
  arrive = false,
  onOpened,
  onClaimed,
  onLater,
}: GiftMomentProps) {
  const mode = claimMode ?? claimModeFor(view);
  const backdrop = stage === undefined ? stageFor(view) : stage;
  const dialogRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const giftButtonRef = useRef<HTMLButtonElement>(null);
  const heroRef = useRef<HTMLSpanElement>(null);
  const haloRef = useRef<HTMLSpanElement>(null);
  const boxHostRef = useRef<HTMLSpanElement>(null);
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>(startOpen ? 'open' : 'wrapped');
  // `burst` = the open happened by a tap THIS time (lid flight, sparks, confetti); a moment that starts open has none.
  const [burst, setBurst] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [cardUp, setCardUp] = useState(startOpen);
  const [cardDelay, setCardDelay] = useState<string | null>(null);
  const [state, setState] = useState<ClaimState>(view.claimedAt ? 'claimed' : 'idle');
  const inFlight = useRef(false);
  const autoSent = useRef(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    setMounted(true);
    setReduced(prefersReducedMotion());
    const t = timers.current;
    return () => t.forEach((id) => window.clearTimeout(id));
  }, []);

  useModalA11y({ open: true, onClose: onLater, containerRef: dialogRef, initialFocusRef: phase === 'wrapped' ? giftButtonRef : undefined });

  const send = useCallback(
    async (choiceId: string): Promise<ClaimState> => {
      let answer: unknown = null;
      try {
        answer = await (claim ? claim(choiceId) : postGiftClaim(view));
      } catch {
        answer = null;
      }
      return claimStateFrom(answer);
    },
    [claim, view],
  );

  // 🔑 AUTOMATIC CLAIM (a badge or seal reward): once, the moment it shows. The card says "✓ In your gifts" ONLY once
  // the claim is confirmed (or `view.claimedAt` already says so): while it is out it reads "Claiming…", and a claim
  // that does not reach us shows its failure — "No connection — your gift is safe. It stays here until it goes
  // through." or the refusal — never a success tick over a failed claim (controller audit 16 Nov). The waiting line
  // stays up, and the next showing sends the same claim again.
  useEffect(() => {
    if (mode !== 'auto' || view.claimedAt || autoSent.current) return;
    autoSent.current = true;
    inFlight.current = true;
    setState('pressed');
    void send('auto').then((next) => {
      inFlight.current = false;
      setState(next);
      if (next === 'claimed') onClaimed?.('auto');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per showing
  }, []);

  const press = useCallback(
    async (choiceId: string) => {
      // Pressed = claimed-in-flight: a second tap, on this or another choice, does nothing.
      if (inFlight.current || state === 'claimed') return;
      inFlight.current = true;
      setState('pressed');
      const next = await send(choiceId);
      inFlight.current = false;
      setState(next);
      if (next === 'claimed') onClaimed?.(choiceId);
    },
    [onClaimed, send, state],
  );

  const tap = useCallback(() => {
    if (phase !== 'wrapped') return;
    onOpened?.();
    if (prefersReducedMotion()) {
      setPhase('open');
      setCardDelay('0ms');
      timers.current.push(window.setTimeout(() => setCardUp(true), tokenMs('--sn-dur-rise-reduced', 120)));
      return;
    }
    setPhase('shaking');
  }, [phase, onOpened]);

  // The ticket comes out to you — every move on one clock from the moment the lid lets go (the prototype's `present`).
  useEffect(() => {
    if (phase !== 'open') return;
    const E = tokenMs('--sn-dur-enter', 640);
    const hero = heroRef.current;
    const halo = haloRef.current;
    const stageEl = stageRef.current;
    const boxHost = boxHostRef.current;
    if (!burst || !ticket || !hero || !stageEl || !boxHost) {
      // Opened without the flight (reduce motion, a moment that starts open): the ticket sits in place, the box behind.
      if (ticket && hero) {
        hero.style.opacity = '1';
        if (boxHost) boxHost.style.opacity = '0';
        if (halo) halo.style.opacity = '1';
      }
      if (!startOpen && !cardUp) {
        const wait = burst ? tokenMs('--sn-dur-elem', 320) : tokenMs('--sn-dur-rise-reduced', 120);
        timers.current.push(window.setTimeout(() => setCardUp(true), wait + E));
      }
      return;
    }
    const HO = Math.round(E * 1.8 * 0.36 + E * 1.1);
    const FLY = Math.round(E * 1.5);
    const inBox = boxHost.querySelector('[data-gift-ticket-in-box]')?.parentElement ?? null;
    const sr = stageEl.getBoundingClientRect();
    const fw = hero.offsetWidth || 1;
    let dx = 0;
    let dy = -sr.height * 0.1;
    let s0 = 0.5;
    if (inBox) {
      // where the ticket stands once it has risen clear of the rim — the in-box plane's end pose, measured now
      const r = inBox.getBoundingClientRect();
      dx = r.left + r.width / 2 - (sr.left + sr.width / 2);
      dy = r.top + r.height / 2 - (sr.top + sr.height / 2) - sr.height * 0.12;
      s0 = Math.max(0.2, Math.min(1, r.width / fw));
    }
    const P = (x: number, y: number, rx: number, rz: number, sc: number) =>
      `translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px) perspective(900px) rotateX(${rx}deg) rotateZ(${rz}deg) scale(${sc.toFixed(3)})`;
    const ease = tokenCurve('--sn-ease');
    const easeOut = tokenCurve('--sn-ease-out');
    const anims: Animation[] = [];
    if (inBox) anims.push(inBox.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1, delay: HO, fill: 'both' }));
    anims.push(hero.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1, delay: HO, fill: 'both' }));
    anims.push(
      hero.animate(
        [
          { transform: P(dx, dy, 0, -3, s0), easing: ease },
          { transform: P(dx * 0.35, Math.min(dy, 0) - sr.height * 0.3, 24, 5, s0 * 1.6), offset: 0.42, easing: ease },
          { transform: P(0, 6, -9, -1, 1.05), offset: 0.8, easing: ease },
          { transform: P(0, 0, 0, 0, 1) },
        ],
        { duration: FLY, delay: HO, fill: 'both' },
      ),
    );
    anims.push(
      boxHost.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(10%) scale(.88)' }], {
        duration: Math.round(E * 0.8),
        delay: HO + 60,
        easing: ease,
        fill: 'both',
      }),
    );
    if (halo) {
      anims.push(
        halo.animate(
          [
            { opacity: 0, transform: 'translate(-50%,-50%) scale(.6)' },
            { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' },
          ],
          { duration: Math.round(E * 1.2), delay: HO + Math.round(FLY * 0.55), easing: easeOut, fill: 'both' },
        ),
      );
    }
    setCardDelay(`${HO + FLY + 120}ms`);
    timers.current.push(window.setTimeout(() => setCardUp(true), HO + FLY + 120 + E));
    return () => anims.forEach((a) => a.cancel());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when it opens
  }, [phase]);

  /** A tap anywhere moves on — except on the ✕ and the card's own buttons, which do their own thing. */
  const onSurface = (e: MouseEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-fullscreen-close],[data-gift-buttons]')) return;
    if (phase === 'wrapped') {
      tap();
      return;
    }
    if (phase === 'open' && cardUp && state !== 'pressed') onLater();
  };

  if (!mounted) return null;

  const busy = state === 'pressed';
  const open = phase === 'open';
  const claimed = state === 'claimed';
  const autoLine = view.landedLine ? `✓ ${view.landedLine}` : `✓ ${CLAIM_WORDS.claimed}`;
  const motion = burst && !reduced;

  return createPortal(
    <div className="fixed inset-0 z-sn-modal" data-gift-moment={view.source} data-gift-phase={phase} data-gift-claim-mode={mode}>
      <OverlayBackdrop onClose={onLater} label={CLAIM_WORDS.later} />
      {/* owner 15 Nov: "the gift should live on the same background as to whatever badge it is on" */}
      {backdrop ? (
        <div aria-hidden className={`${box.badgeStage} ${backdrop === 'tier' ? box.tier : ''}`} data-gift-stage-bg={backdrop}>
          <i className={box.rays} />
          {MOTES.map((m, i) => (
            <i
              key={i}
              className={box.mote}
              style={{ left: m.left, ['--gb-d' as string]: m.d, ['--gb-dl' as string]: m.dl, ['--gb-x' as string]: m.x } as CSSProperties}
            />
          ))}
        </div>
      ) : null}
      {/* Confetti falls across the whole window, behind the card (never on a reduced-motion phone). */}
      {open && motion ? (
        <div aria-hidden className={s.confetti} data-gift-confetti="">
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className={s.bit}
              style={
                {
                  left: c.left,
                  background: c.colour,
                  '--gm-delay': c.delay,
                  '--gm-drift': c.drift,
                  '--gm-spin': c.spin,
                } as CSSProperties
              }
            />
          ))}
        </div>
      ) : null}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={onSurface}
        className="absolute inset-0 flex cursor-pointer flex-col items-center overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(4rem,env(safe-area-inset-top))] outline-none before:flex-[1_0_0] before:content-[''] after:flex-[1_0_0] after:content-['']"
        data-gift-surface=""
      >
        <FullscreenClose onClose={onLater} label={CLAIM_WORDS.later} />

        <p className="mt-1 flex flex-col items-center rounded-2xl bg-cream/90 px-4 py-1.5 text-center text-ink" data-gift-who="">
          <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink/70">{view.eyebrow}</span>
          <span className="text-[14px] font-medium">{view.fromLine}</span>
        </p>

        {/* The gift. Wrapped, it is ONE button ("Tap to open" — Enter or Space too); a tap anywhere does the same. */}
        <div ref={stageRef} className={`${box.stage} ${arrive ? box.arrive : ''} text-ink`} data-gift-stage="">
          <StdTouchGlow containerRef={stageRef} enabled={phase !== 'open'} />
          <button
            ref={giftButtonRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              tap();
            }}
            disabled={phase !== 'wrapped'}
            aria-label={phase === 'open' ? `It is open — ${view.fromLine}` : `${CLAIM_WORDS.tapToOpen} — ${view.fromLine}`}
            className="absolute inset-0 block min-h-11 cursor-pointer rounded-3xl bg-transparent p-0 disabled:cursor-default"
          >
            <span
              ref={boxHostRef}
              className={`absolute inset-0 block ${open && !burst && !startOpen ? box.xfIn : ''}`}
              onAnimationEnd={(e) => {
                // the shake ends → the lid lets go
                if (phase !== 'shaking' || !(e.target as HTMLElement).hasAttribute('data-gift-box')) return;
                setBurst(true);
                setPhase('open');
              }}
            >
              <GiftBox
                seal={view.seal}
                label={view.fromLine}
                open={open}
                animate={open && motion}
                shaking={phase === 'shaking'}
                ticketSrc={ticket?.src ?? null}
              />
            </span>
          </button>
          <span ref={haloRef} aria-hidden className={box.tkhalo} />
          {ticket ? (
            <span ref={heroRef} className={box.tkhero} role="img" aria-label={ticket.label} data-gift-ticket="">
              {/* drawn as ONE picture: Safari drops SVG filters inside a layer moving in 3D; a picture moves whole */}
              {/* eslint-disable-next-line @next/next/no-img-element -- the ticket is one drawn picture (a data URI) */}
              <img src={ticket.src} alt="" decoding="sync" />
            </span>
          ) : null}
        </div>

        {!open ? (
          <p className={`pointer-events-none mt-2 text-[14px] font-semibold text-cream ${s.tapon}`} data-gift-tapon="open">
            {CLAIM_WORDS.tapToOpen}
          </p>
        ) : (
          <section
            className={`mt-3 w-full max-w-sm cursor-default rounded-2xl bg-cream p-5 text-ink shadow-2xl ${motion || (ticket && !reduced) ? s.rise : s.fade}`}
            style={cardDelay ? ({ '--gm-card': cardDelay } as CSSProperties) : undefined}
            data-gift-words=""
          >
            <h2 id={titleId} className="text-[22px] font-semibold leading-tight">
              {view.headline}
            </h2>
            <p className="mt-1.5 text-[16px] leading-snug" data-gift-received="">
              {view.received}
            </p>
            {view.unverified ? (
              // 🪪 The giving shop is not yet verified — the shipped line, never hidden, never blocking (16 Nov).
              <p className="mt-1.5 flex min-w-0 items-center gap-1 text-[13px] leading-tight text-warn-800" data-gift-not-yet-verified="">
                <ShieldAlert aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                <InfoTip label={view.unverified.line} labelClassName="text-[13px] text-warn-800" align="start">
                  {view.unverified.info}
                </InfoTip>
              </p>
            ) : null}
            {view.badge ? (
              <div className="mt-3 flex flex-wrap items-center gap-2" data-gift-badge-step="">
                {view.badge.from ? (
                  <ShopBadgePill badge={view.badge.from} size="sm" />
                ) : (
                  <span className="inline-flex min-h-7 items-center rounded-full border border-dashed border-ink/30 px-3 text-[12px] font-semibold text-ink/70">
                    {CLAIM_WORDS.noBadgeYet}
                  </span>
                )}
                <span aria-label="becomes" className="text-ink/60">
                  →
                </span>
                <ShopBadgePill badge={view.badge.to} size="sm" />
              </div>
            ) : null}
            {view.detail ? <p className="mt-2 text-[14px] text-ink/75">{view.detail}</p> : null}

            {mode === 'auto' ? (
              // No button while it goes through (owner 15 Nov: "We are just showing that they received something") — but
              // the tick is drawn only for a CONFIRMED claim; a failed one says so and offers the same claim again.
              claimed ? (
                <p
                  role="status"
                  className="mt-4 flex min-h-12 items-center justify-center rounded-full bg-success-50 text-[15px] font-semibold text-success-800"
                  data-gift-claimed=""
                >
                  {autoLine}
                </p>
              ) : state === 'offline' ? (
                // Still no button (owner 15 Nov): the words say it did not go through, the waiting line stays up, and
                // the next showing sends the SAME claim again.
                <p role="status" className="mt-4 text-[14px] text-warn-900" data-gift-offline="">
                  {CLAIM_WORDS.offline}
                </p>
              ) : state === 'refused' ? (
                <p role="status" className="mt-4 text-[14px] text-danger-800" data-gift-refused="">
                  {CLAIM_WORDS.refused}
                </p>
              ) : (
                <p role="status" className="mt-4 flex min-h-12 items-center justify-center text-[15px] font-semibold text-ink/70" data-gift-claiming="">
                  {CLAIM_WORDS.pressed}
                </p>
              )
            ) : (
              <>
                {view.landedLine ? (
                  <p className="mt-3 text-[14px] font-medium text-ink/80" data-gift-landed="">
                    {view.landedLine}
                  </p>
                ) : null}
                <div aria-live="polite" className="mt-2 text-[14px]">
                  {state === 'offline' ? (
                    <p className="text-warn-900" data-gift-offline="">
                      {CLAIM_WORDS.offline}
                    </p>
                  ) : state === 'refused' ? (
                    <p className="text-danger-800" data-gift-refused="">
                      {CLAIM_WORDS.refused}
                    </p>
                  ) : claimed ? (
                    <p className="font-semibold text-ink" data-gift-claimed="">
                      ✓ {CLAIM_WORDS.claimed}
                    </p>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-col gap-2" data-gift-buttons="">
                  {claimed || state === 'refused' ? null : state === 'offline' ? (
                    <button
                      type="button"
                      onClick={() => void press(choices.find((c) => c.main)?.id ?? choices[0]!.id)}
                      className="sn-press inline-flex min-h-12 w-full items-center justify-center rounded-full bg-mulberry px-5 text-[15px] font-semibold text-cream"
                      data-gift-retry=""
                    >
                      {CLAIM_WORDS.retry}
                    </button>
                  ) : (
                    choices.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        disabled={busy}
                        aria-disabled={busy}
                        onClick={() => void press(c.id)}
                        data-gift-claim={c.id}
                        className={`sn-press inline-flex min-h-12 w-full items-center justify-center rounded-full px-5 text-[15px] font-semibold ${
                          c.main ? 'bg-mulberry text-cream' : 'border border-ink/15 text-ink'
                        } ${busy ? s.pressed : ''}`}
                      >
                        {busy && c.main ? CLAIM_WORDS.pressed : c.label}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
            {cardUp ? (
              // The words, with no button look (owner 15 Nov: "we do not need a button") — but a real button, so a
              // keyboard and a screen reader can close it too; a tap anywhere else does the same.
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onLater();
                }}
                data-gift-tapon="close"
                className={`mt-3 flex min-h-11 w-full items-center justify-center bg-transparent text-[15px] font-semibold text-ink/70 ${s.tapon}`}
              >
                {GIFT_WORDS.tapToClose}
              </button>
            ) : null}
          </section>
        )}
      </div>
    </div>,
    document.body,
  );
}
