'use client';
/**
 * 🎟 REWARD TICKET — the realistic voucher a tier earns (owner 15 Nov ladder: Papic 150 · Papic 150 · Papic 1000 ·
 * Papic 3000 · Event Plus · Event Pro · Event Ultra), ported from the approved prototype
 * `badge-milestones_v35.html`: the `.rw` card, the `tkSvg` picture (`ticket-svg.ts`), and `rwClaim`'s confetti burst.
 *
 * Three states, all said in words (copy verbatim from the build map):
 *   · locked  — "Reward · gift for a customer", the ticket greyed;
 *   · ready   — "New reward" + "Tap to claim", pulsing; a tap (or Enter / Space) claims it, once;
 *   · claimed — "✓ Claimed · in your gifts".
 * Footnote on every ticket: "A gift from Setnayan, for you to give."
 *
 * The claim itself is the caller's (`onClaim`); this only shows it. Pressing twice never claims twice: the ticket is
 * busy from the first press until the caller settles. Client-only; no fetch here.
 */
import { useRef, useState, type CSSProperties } from 'react';
import s from './award.module.css';
import { TICKET_BURST, TICKET_H, TICKET_SPECS, TICKET_W, ticketDataUri, type TicketKind, type TicketSpec } from './ticket-svg';
import { prefersReducedMotion } from './shared';

export type RewardTicketState = 'locked' | 'ready' | 'claimed';

export type RewardTicketProps = {
  /** Which voucher to print (`TICKET_SPECS`); or pass `spec` for a kind added later. */
  kind: TicketKind | (string & {});
  /** A custom print spec; wins over `kind`'s. */
  spec?: TicketSpec;
  /** What the reward is, in words ("Papic 150"). */
  label: string;
  state: RewardTicketState;
  /** Claim it. May return a promise; a rejection puts the ticket back to "Tap to claim". */
  onClaim?: () => void | Promise<unknown>;
  className?: string;
};

export const TICKET_COPY = {
  locked: 'Reward · gift for a customer',
  ready: 'New reward',
  tap: 'Tap to claim',
  claimed: '✓ Claimed · in your gifts',
  foot: 'A gift from Setnayan, for you to give.',
} as const;


export function RewardTicket({ kind, spec, label, state, onClaim, className }: RewardTicketProps) {
  const print = spec ?? (TICKET_SPECS as Record<string, TicketSpec>)[kind];
  const [phase, setPhase] = useState<'idle' | 'claiming' | 'just'>('idle');
  const [burst, setBurst] = useState(0);
  const busy = useRef(false);
  const shown: RewardTicketState = phase === 'just' ? 'claimed' : state;

  const claim = () => {
    if (shown !== 'ready' || busy.current) return;
    busy.current = true;
    setBurst((n) => n + 1);
    setPhase('claiming');
    try {
      navigator.vibrate?.(18);
    } catch {
      /* no haptics here */
    }
    let result: void | Promise<unknown> = undefined;
    try {
      result = onClaim?.();
    } catch {
      busy.current = false;
      setPhase('idle');
      return;
    }
    const settle = () => window.setTimeout(() => setPhase('just'), prefersReducedMotion() ? 0 : 650);
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      (result as Promise<unknown>).then(settle, () => {
        busy.current = false;
        setPhase('idle');
      });
    } else settle();
  };

  const cls = [
    s.rw,
    shown === 'locked' ? s.rwLocked : '',
    shown === 'claimed' ? s.rwGot : '',
    shown === 'ready' ? s.rwClaim : '',
    phase === 'claiming' ? s.rwClaiming : '',
    phase === 'just' ? s.rwJust : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const picture = print ? (
    // a generated data: URI drawn on the device — next/image has nothing to optimise here
    // eslint-disable-next-line @next/next/no-img-element
    <img src={ticketDataUri(String(kind), print)} alt="" width={TICKET_W} height={TICKET_H} decoding="async" draggable={false} />
  ) : null;
  const eyebrow = shown === 'ready' ? TICKET_COPY.ready : shown === 'claimed' ? TICKET_COPY.claimed : TICKET_COPY.locked;
  const fx =
    phase === 'claiming' ? (
      <span key={burst} className={s.rwFx} style={{ left: '50%', top: '42%' }} aria-hidden="true">
        {Array.from({ length: 16 }, (_, k) => (
          <i key={k} style={{ '--a': `${k * 22.5}deg`, '--d': `${40 + (k % 3) * 18}px`, background: TICKET_BURST[k % 4] } as CSSProperties} />
        ))}
      </span>
    ) : null;

  if (shown === 'ready') {
    return (
      <button
        type="button"
        className={cls}
        data-reward-ticket="ready"
        aria-label={`Claim your reward: ${label}`}
        onClick={(e) => {
          e.stopPropagation();
          claim();
        }}
      >
        {fx}
        <em>{eyebrow}</em>
        {picture}
        <b>{label}</b>
        <i className={s.rwTap}>{TICKET_COPY.tap}</i>
        <small className={s.rwFoot}>{TICKET_COPY.foot}</small>
      </button>
    );
  }
  return (
    <span
      className={cls}
      data-reward-ticket={shown}
      aria-label={shown === 'claimed' ? `Claimed: ${label}, in your gifts` : `Reward, ${label}: a gift for a customer`}
      role="group"
      aria-live={phase === 'just' ? 'polite' : undefined}
    >
      {fx}
      <em>{eyebrow}</em>
      {picture}
      <b>{label}</b>
      <small className={s.rwFoot}>{TICKET_COPY.foot}</small>
    </span>
  );
}
