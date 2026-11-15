'use client';
/**
 * 🎟 REWARD TICKET — the realistic voucher a tier earns (owner 15 Nov ladder: Papic 150 · Papic 150 · Papic 1000 ·
 * Papic 3000 · Event Plus · Event Pro · Event Ultra), ported from the approved contract `badge-milestones_v86.html`:
 * the `.rw` card and the `tkSvg` picture (`ticket-svg.ts`).
 *
 * ✅ AUTO-CLAIMED (owner 15 Nov, the whole-flow ruling, pick (2)): a badge's reward is the shop's the moment it is
 * earned — nothing to tap, and the same once-only key means it can never count twice. So the ticket is never a button.
 * Three looks, copy verbatim from v86:
 *   · locked   — "Reward · gift for a customer", the ticket greyed;
 *   · new      — "✓ New · in your gifts" (the reward just earned);
 *   · in_gifts — "✓ In your gifts".
 * 🎟 NO RAINBOW (owner 15 Nov: "no rainbow design on the tickets" · "keep in all clean and premium"): every ticket keeps
 * its metal frame, security print, torn stub, raised numerals and serial; no holographic strip on any plan.
 *
 * ⚖ UNRULED, LEFT AS A NAMED GAP: the ticket FRAME METAL (open item "ticket frame metal", DECISION_LOG 15 Nov approval).
 * `frameMetal` is off by default — the ticket wears the frame drawn in v86 for its kind. Nothing is invented for it.
 *
 * Client-only; no fetch here.
 */
import s from './award.module.css';
import { TICKET_H, TICKET_SPECS, TICKET_W, ticketDataUri, type TicketKind, type TicketRim, type TicketSpec } from './ticket-svg';

export type RewardTicketState = 'locked' | 'new' | 'in_gifts';

export type RewardTicketProps = {
  /** Which voucher to print (`TICKET_SPECS`); or pass `spec` for a kind added later. */
  kind: TicketKind | (string & {});
  /** A custom print spec; wins over `kind`'s. */
  spec?: TicketSpec;
  /** What the reward is, in words ("Papic 150"). */
  label: string;
  state: RewardTicketState;
  /**
   * ⚖ GAP — "ticket frame metal" is not ruled. Off by default (undefined = the frame v86 draws for this kind). A value
   * here only takes effect once the owner rules on it; the kit never picks one on its own.
   */
  frameMetal?: TicketRim;
  className?: string;
};

export const TICKET_COPY = {
  locked: 'Reward · gift for a customer',
  new: '✓ New · in your gifts',
  inGifts: '✓ In your gifts',
} as const;

export function RewardTicket({ kind, spec, label, state, frameMetal, className }: RewardTicketProps) {
  const base = spec ?? (TICKET_SPECS as Record<string, TicketSpec>)[kind];
  const print = base && frameMetal ? { ...base, rim: frameMetal } : base;
  const got = state !== 'locked';
  const cls = [s.rw, got ? s.rwGot : s.rwLocked, className ?? ''].filter(Boolean).join(' ');
  const eyebrow = state === 'new' ? TICKET_COPY.new : state === 'in_gifts' ? TICKET_COPY.inGifts : TICKET_COPY.locked;
  return (
    <span
      className={cls}
      data-reward-ticket={state}
      role="group"
      aria-label={got ? `${label}, in your gifts` : `Reward, ${label}: a gift for a customer`}
    >
      <em>{eyebrow}</em>
      {print ? (
        // a generated data: URI drawn on the device — next/image has nothing to optimise here
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ticketDataUri(String(kind), print)} alt="" width={TICKET_W} height={TICKET_H} decoding="async" draggable={false} />
      ) : null}
      <b>{label}</b>
    </span>
  );
}
