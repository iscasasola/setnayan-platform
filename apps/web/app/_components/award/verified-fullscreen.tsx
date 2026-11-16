'use client';
/**
 * ✅ SETNAYAN VERIFIED — ITS OWN FULL SCREEN (owner 15 Nov: *"i do not see the locked badge for all and the popup for
 * setnayan verified"*; ported from `badge-milestones_v86.html` `.vfz`). Navy rays turning slowly, gold motes drifting,
 * the blue check, then the words verbatim: AWARDED TO · the shop · SETNAYAN Verified · AN EXCLUSIVE SETNAYAN SEAL ·
 * Awarded {date} · what it means · "Tap anywhere to close".
 *
 * Rulings held here:
 *   · NO PLAQUE — Verified stays plain (14 Nov), on its own navy screen (newest ruling: own full screen);
 *   · NO DAYS LINE — "You achieved this after N days" is for tiered badges only, so this screen has no such prop;
 *   · the ✕ is the ONE shared close (`AwardClose`), and a tap anywhere closes too; Esc / back close (modal <dialog>).
 *
 * Client-only, on the device. Mount it to open; `onClose` unmounts it.
 */
import { useMemo, useRef, type ReactNode } from 'react';
import s from './award.module.css';
import { AwardClose } from './award-close';
import { useModalDialog } from './shared';

export const VERIFIED_COPY = {
  to: 'AWARDED TO',
  word: 'Verified',
  mark: 'SETNAYAN',
  exclusive: 'AN EXCLUSIVE SETNAYAN SEAL',
  meaning: 'Setnayan checked the owner, the business papers and the work. A real business stands behind this name.',
  tap: 'Tap anywhere to close',
} as const;

export type VerifiedFullscreenProps = {
  /** The Setnayan Verified art (the shipped blue-check seal), as a React SVG element or trusted SVG markup. */
  art: ReactNode | string;
  shopName: string;
  /** Already-formatted award date ("12 Jan 2026"); shown as "Awarded 12 Jan 2026". */
  awardedOn?: string;
  onClose: () => void;
};

/** v86 lays 16 motes on a fixed scatter (i×37 % 100, i×53+11 % 100), each a little behind the last. */
const MOTES = Array.from({ length: 16 }, (_, i) => ({ left: (i * 37) % 100, top: (i * 53 + 11) % 100, delay: -(i * 0.7) }));

export function VerifiedFullscreen({ art, shopName, awardedOn, onClose }: VerifiedFullscreenProps) {
  const closed = useRef(false);
  const close = () => {
    if (closed.current) return;
    closed.current = true;
    onClose();
  };
  const dlg = useModalDialog(close);
  const html = useMemo(() => (typeof art === 'string' ? { __html: art } : null), [art]);
  return (
    <dialog ref={dlg} className={s.vfz} aria-label="Setnayan Verified" data-award-verified="" onClick={close}>
      <i className={s.vfzRays} aria-hidden="true" />
      {MOTES.map((m, i) => (
        <i key={i} className={s.vfzMo} aria-hidden="true" style={{ left: `${m.left}%`, top: `${m.top}%`, animationDelay: `${m.delay.toFixed(1)}s` }} />
      ))}
      <AwardClose onClose={close} />
      {html ? <div className={s.vfzArt} dangerouslySetInnerHTML={html} /> : <div className={s.vfzArt}>{art}</div>}
      <p className={s.vfzTo}>{VERIFIED_COPY.to}</p>
      <p className={s.vfzNm}>{shopName}</p>
      <p className={s.vfzWt}>
        <span>{VERIFIED_COPY.mark}</span> {VERIFIED_COPY.word}
      </p>
      <p className={s.vfzEx}>{VERIFIED_COPY.exclusive}</p>
      {awardedOn ? <p className={s.vfzOn}>Awarded {awardedOn}</p> : null}
      <p className={s.vfzMean}>{VERIFIED_COPY.meaning}</p>
      <p className={s.vfzTap}>{VERIFIED_COPY.tap}</p>
    </dialog>
  );
}
