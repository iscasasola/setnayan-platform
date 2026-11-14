'use client';

/**
 * 🎁 GiftMoment — THE ONE TAP-TO-OPEN GIFT POPUP (owner 2026-11-14, corpus DECISION_LOG "THE GIFT MOMENT — A POPUP,
 * TAP TO OPEN" · "ONE PIECE, USED THREE WAYS" · "PRESSING REDEEM IS THE CLAIM" · "GIFT DESIGN APPROVED — WITH FABLE'S
 * EIGHT PICKS"; drawing artifact QSMD9BaefarMRNQAnMFiND §6).
 *
 * LOADED LAZILY — `gift-moments.tsx` imports it with `next/dynamic` only when a moment is about to show, so no page
 * carries it in its first load.
 *
 * ── PROPS (G3 reuses this piece for Setnayan → shop gifts: build a `GiftMomentView`, pass your choices) ──────────
 *   view        GiftMomentView (lib/gift-moment.ts) — every word composed; the seal; `claimedAt` (null = waiting).
 *   counter     "1 of 2" when gifts play back to back, else null.
 *   startOpen   true = this person already tapped it open once: it comes back OPEN (no wrapping, no tap). A host
 *               who never saw it gets the whole moment even when the other host already claimed it (each host
 *               once) — it then ends on "✓ Claimed" with Close.
 *   choices     the buttons that claim. Default ONE: Redeem. A plan gift passes two (e.g. "Upgrade now" main +
 *               "Start it when my plan ends"). EVERY choice is the claim: the same pressed / no-connection / claimed
 *               states, and one press disables all of them.
 *   claim       (choiceId) => Promise<unknown> — sends THE claim; resolves to the server's answer
 *               ({status:'claimed'|'already'|'refused'}); anything else (a throw, a 5xx) reads as "No connection" and
 *               Try again sends the SAME claim again (safe: the database key makes a repeat land on the same claim).
 *               Default: POST /api/unwrap {source, ref}.
 *   onOpened    the person tapped it open (the host remembers it, so it comes back open).
 *   onClaimed   (choiceId) => void — the claim is in: go where the gift landed (Redeem's destination).
 *   onLater     Later / ✕ / Esc / a tap on the dark — shuts the moment; the gift keeps waiting as its notice line.
 *
 * ── WHAT IT DOES ──────────────────────────────────────────────────────────────────────────────────────────────
 *   wrapped → tap → shake (640) → burst + gold flash + confetti → the opened box springs in → the words rise →
 *   Redeem. Reduce motion: the tap fades straight to the opened box and the words (120 ms). No video.
 *   The press sinks and says "Claiming…", and cannot be pressed again while out. No connection → "No connection —
 *   your gift is safe" + Try again. Already claimed → "✓ Claimed", no button, just Close.
 *
 * The backdrop is THE one backdrop (`OverlayBackdrop`, blurred + darkened); the press uses the shipped touch glow
 * (`StdTouchGlow`, scoped to the gift); every motion is a token (`gift-moment.module.css`). Buttons are ≥ 44 px.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { OverlayBackdrop } from '@/app/_components/overlay-backdrop';
import { ShopBadgePill } from '@/app/_components/shop-badge-pill';
import { StdTouchGlow } from '@/app/[slug]/_components/reveal/std-touch-glow';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { CLAIM_WORDS, claimStateFrom, type ClaimState } from '@/lib/gift-moment-queue';
import type { GiftMomentView } from '@/lib/gift-moment';
import { CONFETTI, GiftSealMark, OpenedGiftSvg, SHARDS, WrappedGiftSvg } from './gift-art';
import s from './gift-moment.module.css';

export type GiftChoice = { id: string; label: string; main?: boolean };

export type GiftMomentProps = {
  view: GiftMomentView;
  counter?: string | null;
  startOpen?: boolean;
  choices?: readonly GiftChoice[];
  claim?: (choiceId: string) => Promise<unknown>;
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

export default function GiftMoment({ view, counter = null, startOpen = false, choices = REDEEM, claim, onOpened, onClaimed, onLater }: GiftMomentProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const giftButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>(startOpen ? 'open' : 'wrapped');
  // `burst` = the open happened by a tap THIS time (pieces + flash + confetti); a moment that starts open has none.
  const [burst, setBurst] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [state, setState] = useState<ClaimState>(view.claimedAt ? 'claimed' : 'idle');
  const inFlight = useRef(false);

  useEffect(() => {
    setMounted(true);
    setReduced(prefersReducedMotion());
  }, []);

  useModalA11y({ open: true, onClose: onLater, containerRef: dialogRef, initialFocusRef: phase === 'wrapped' ? giftButtonRef : undefined });

  const tap = useCallback(() => {
    if (phase !== 'wrapped') return;
    onOpened?.();
    if (prefersReducedMotion()) {
      setPhase('open');
      return;
    }
    setPhase('shaking');
  }, [phase, onOpened]);

  const press = useCallback(
    async (choiceId: string) => {
      // Pressed = claimed-in-flight: a second tap, on this or another choice, does nothing.
      if (inFlight.current || state === 'claimed') return;
      inFlight.current = true;
      setState('pressed');
      let answer: unknown = null;
      try {
        answer = await (claim ? claim(choiceId) : postGiftClaim(view));
      } catch {
        answer = null;
      }
      const next = claimStateFrom(answer);
      inFlight.current = false;
      setState(next);
      if (next === 'claimed') onClaimed?.(choiceId);
    },
    [claim, onClaimed, state, view],
  );

  if (!mounted) return null;

  const busy = state === 'pressed';
  const open = phase === 'open';
  const claimed = state === 'claimed';

  return createPortal(
    <div className="fixed inset-0 z-sn-modal" data-gift-moment={view.source} data-gift-phase={phase}>
      <OverlayBackdrop onClose={onLater} label={CLAIM_WORDS.later} />
      {/* Confetti falls across the whole window, behind the card (never on a reduced-motion phone). */}
      {open && burst && !reduced ? (
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
                } as React.CSSProperties
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
        className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] outline-none"
      >
        <div className="pointer-events-auto flex w-full max-w-sm items-center justify-between">
          <span className="min-h-11 py-3 text-[13px] font-semibold text-cream/90" data-gift-counter={counter ?? undefined}>
            {counter}
          </span>
          <button
            type="button"
            onClick={onLater}
            aria-label={CLAIM_WORDS.later}
            className="sn-press inline-flex h-11 w-11 items-center justify-center rounded-full bg-cream/85 text-ink"
          >
            <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <p className="pointer-events-auto mt-1 flex flex-col items-center rounded-2xl bg-cream/90 px-4 py-1.5 text-center text-ink">
          <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink/70">{view.eyebrow}</span>
          <span className="text-[14px] font-medium">{view.fromLine}</span>
        </p>

        {/* The gift. Wrapped, it is ONE button ("Tap to open" — Enter or Space too). */}
        <div ref={stageRef} className={`pointer-events-auto mt-3 text-ink ${s.stage}`} data-gift-stage="">
          <StdTouchGlow containerRef={stageRef} enabled={phase !== 'open'} />
          {phase !== 'open' ? (
            <button
              ref={giftButtonRef}
              type="button"
              onClick={tap}
              aria-label={`${CLAIM_WORDS.tapToOpen} — ${view.fromLine}`}
              className={`${s.layer} block min-h-11 cursor-pointer rounded-3xl`}
              disabled={phase === 'shaking'}
            >
              <span
                className={`${s.layer} ${phase === 'shaking' ? s.shake : ''}`}
                onAnimationEnd={(e) => {
                  if (e.target !== e.currentTarget) return;
                  setBurst(true);
                  setPhase('open');
                }}
              >
                <WrappedGiftSvg className="h-full w-full" />
                <GiftSealMark seal={view.seal} label={view.fromLine} />
              </span>
            </button>
          ) : (
            <>
              {burst && !reduced ? (
                <>
                  {SHARDS.map((p, i) => (
                    <span
                      key={i}
                      aria-hidden
                      className={`${s.layer} ${s.shard}`}
                      style={{ clipPath: p.clip, '--gm-dx': p.dx, '--gm-dy': p.dy, '--gm-rot': p.rot } as React.CSSProperties}
                    >
                      <WrappedGiftSvg className="h-full w-full" />
                    </span>
                  ))}
                  <span aria-hidden className={s.flash} />
                </>
              ) : null}
              <span className={`${s.layer} ${burst || startOpen ? s.opened : s.fade}`} data-gift-opened="">
                <OpenedGiftSvg className="h-full w-full" />
                <GiftSealMark seal={view.seal} label={view.fromLine} top="70%" />
              </span>
            </>
          )}
        </div>

        {phase !== 'open' ? (
          <p className="pointer-events-none mt-2 text-[14px] font-semibold text-cream" aria-hidden>
            {CLAIM_WORDS.tapToOpen}
          </p>
        ) : (
          <section
            className={`pointer-events-auto mt-3 w-full max-w-sm rounded-2xl bg-cream p-5 text-ink shadow-2xl ${burst ? s.rise : s.fade}`}
            data-gift-words=""
          >
            <h2 id={titleId} className="text-[22px] font-semibold leading-tight">
              {view.headline}
            </h2>
            <p className="mt-1.5 text-[16px] leading-snug" data-gift-received="">
              {view.received}
            </p>
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

            <div className="mt-3 flex flex-col gap-2">
              {claimed ? null : state === 'offline' ? (
                <button
                  type="button"
                  onClick={() => void press(choices.find((c) => c.main)?.id ?? choices[0]!.id)}
                  className="sn-press inline-flex min-h-12 w-full items-center justify-center rounded-full bg-mulberry px-5 text-[15px] font-semibold text-cream"
                  data-gift-retry=""
                >
                  {CLAIM_WORDS.retry}
                </button>
              ) : state === 'refused' ? null : (
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
              <button
                type="button"
                onClick={onLater}
                className="sn-press inline-flex min-h-11 w-full items-center justify-center rounded-full px-4 text-[14px] font-semibold text-ink/70"
                data-gift-later=""
              >
                {claimed || state === 'refused' ? CLAIM_WORDS.close : CLAIM_WORDS.later}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>,
    document.body,
  );
}
