'use client';
/**
 * 🎗 THE SERVICE-CARD BADGE CONGRATULATIONS (owner 15 Nov: *"Service Card Badge: gets a congratulations, your X service
 * card achieved a X badge?"*; ported from `badge-milestones_v86.html` `.scz`). The shop's Today line ("Congratulations,
 * your [card] service card earned [badge]") opens this on a tap — nothing opens by itself. The badge's own colour on a
 * dark stage, slow rays, gold motes, its medal, then the words verbatim: "Congratulations!" · "Your {card} service card
 * earned {badge}." · the badge tag · its rule · "It stays on the card for as long as the card keeps passing." ·
 * "Tap anywhere to close".
 *
 * The ✕ is the ONE shared close (`AwardClose`); a tap anywhere closes; Esc / back close (modal <dialog>).
 * The badge's icon, tag, rule and colour are the caller's data (J3 owns the card-badge rules) — nothing is decided here.
 * Client-only, on the device. Mount it to open; `onClose` unmounts it.
 */
import { useRef, type CSSProperties, type ReactNode } from 'react';
import s from './card-badge.module.css';
import { AwardClose } from './award-close';
import { useModalDialog } from './shared';

export const CARD_CONGRATS_COPY = {
  hi: 'Congratulations!',
  keeps: 'It stays on the card for as long as the card keeps passing.',
  tap: 'Tap anywhere to close',
} as const;

/** The Today line that opens it — one copy, in a plain module the server sweep can call too. */
export { cardCongratsTodayLine } from './card-congrats-words';

export type CardBadgeCongratsProps = {
  /** The service card's name ("Full-day photo & video"). */
  cardName: string;
  /** The card badge's name ("Hot Booking"). */
  badgeName: string;
  /** Its short tag ("HOT"), drawn in the pill under the words. */
  tag: string;
  /** Its rule, one sentence (J3's data); shown with a closing full stop. */
  rule: string;
  /** The badge's colour, as a CSS colour from the caller's data (never typed here). */
  color: string;
  /** The badge's icon (an SVG element, drawn in currentColor). */
  icon: ReactNode;
  onClose: () => void;
};

const MOTES = Array.from({ length: 16 }, (_, i) => ({ left: (i * 37) % 100, top: (i * 53 + 11) % 100, delay: -(i * 0.7) }));

export function CardBadgeCongrats({ cardName, badgeName, tag, rule, color, icon, onClose }: CardBadgeCongratsProps) {
  const closed = useRef(false);
  const close = () => {
    if (closed.current) return;
    closed.current = true;
    onClose();
  };
  const dlg = useModalDialog(close);
  const ruleLine = rule.trim().replace(/\.*$/, '.');
  return (
    <dialog
      ref={dlg}
      className={s.scz}
      style={{ '--c': color } as CSSProperties}
      aria-label={`Congratulations, ${badgeName}`}
      data-card-badge-congrats=""
      onClick={close}
    >
      <i className={s.sczRays} aria-hidden="true" />
      {MOTES.map((m, i) => (
        <i key={i} className={s.sczMo} aria-hidden="true" style={{ left: `${m.left}%`, top: `${m.top}%`, animationDelay: `${m.delay.toFixed(1)}s` }} />
      ))}
      <AwardClose onClose={close} />
      <div className={s.sczMedal} aria-hidden="true">
        {icon}
      </div>
      <p className={s.sczHi}>{CARD_CONGRATS_COPY.hi}</p>
      <p className={s.sczWt}>
        Your <b>{cardName}</b> service card earned <b>{badgeName}</b>.
      </p>
      <p className={s.sczAw}>{tag}</p>
      <p className={s.sczRl}>{ruleLine}</p>
      <p className={s.sczKp}>{CARD_CONGRATS_COPY.keeps}</p>
      <p className={s.sczTap}>{CARD_CONGRATS_COPY.tap}</p>
    </dialog>
  );
}
