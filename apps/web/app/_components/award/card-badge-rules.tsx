'use client';
/**
 * 🎗 THE SERVICE-CARD BADGE RULES POP-UP — the SHELL J3 fills (owner 15 Nov: the full card no longer lists each badge's
 * rule, *"we don't need the explanation for each"*; tapping the badge row opens this; ported from
 * `badge-milestones_v86.html` `#cbDlg` / `.vrp.cbp`). Styled like the Setnayan Verified pop-up, in gold:
 *   · title "This card's badges" — or the badge's own name when the card holds one;
 *   · the card name · shop;
 *   · per badge: its medal, name, "Held {time} · since {date}", and its rule;
 *   · "Each badge is checked every day. It comes off the day the card stops passing, and its time starts again when it
 *     earns it back."
 *   · "Got it" closes. Opens ONLY on a tap — nothing pops up by itself (the caller mounts it on a tap).
 *
 * A pop-up, not a full screen: its small ✕ sits top right as drawn (the one-✕ rule covers full screens). Everything in
 * it is the caller's data — the badges, their held time and rules are J3's (`lib/card-badges*`); this only draws.
 */
import { useRef, type CSSProperties, type ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import s from './card-badge.module.css';
import { useModalDialog } from './shared';

export const CARD_RULES_COPY = {
  many: 'This card’s badges',
  note: 'Each badge is checked every day. It comes off the day the card stops passing, and its time starts again when it earns it back.',
  ok: 'Got it',
} as const;

export type CardBadgeRuleRow = {
  key: string;
  name: string;
  /** "Held 4 mos · since 10 Jul 2026" — J3's words from its held-time helper. */
  held: string;
  rule: string;
  /** CSS colour from the caller's data. */
  color: string;
  icon: ReactNode;
};

export type CardBadgeRulesProps = {
  /** "Full-day photo & video · Liwanag Studio". */
  cardLine: string;
  badges: readonly CardBadgeRuleRow[];
  onClose: () => void;
};

export function CardBadgeRules({ cardLine, badges, onClose }: CardBadgeRulesProps) {
  const closed = useRef(false);
  const close = () => {
    if (closed.current) return;
    closed.current = true;
    onClose();
  };
  const dlg = useModalDialog(close);
  const title = badges.length === 1 ? badges[0]!.name : CARD_RULES_COPY.many;
  return (
    <dialog
      ref={dlg}
      className={s.cbp}
      aria-label={title}
      data-card-badge-rules=""
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className={s.cbpCard}>
        <button type="button" className={s.cbpX} aria-label="Close" onClick={close}>
          <X aria-hidden size={20} strokeWidth={2} />
        </button>
        <h3>{title}</h3>
        <p className={s.cbpSh}>{cardLine}</p>
        <ul className={s.cbpList}>
          {badges.map((b) => (
            <li key={b.key} style={{ '--c': b.color } as CSSProperties}>
              <i aria-hidden="true">{b.icon}</i>
              <span>
                <b>{b.name}</b>
                <em>{b.held}</em>
                {b.rule}
              </span>
            </li>
          ))}
        </ul>
        <p className={s.cbpNote}>{CARD_RULES_COPY.note}</p>
        <div className={s.cbpOk}>
          <ActionButton tone="info" main icon={Check} label={CARD_RULES_COPY.ok} onClick={close} />
        </div>
      </div>
    </dialog>
  );
}
