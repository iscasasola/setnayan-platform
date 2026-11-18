'use client';
/**
 * ✕ THE ONE CLOSE BUTTON (owner 15 Nov, contract `badge-milestones_v86.html`): *"on full screen with (X), (X) should be
 * consistent in all. Like for gifts or badge full screens."* A 44px round ✕, top LEFT inside the safe area, dark glass
 * with an ivory ring, one matching ivory focus ring. Every award full screen draws its ✕ through this — never its own.
 */
import { forwardRef } from 'react';
import { X } from 'lucide-react';
import s from './award.module.css';

export type AwardCloseProps = {
  onClose: () => void;
  /** Spoken name; the visible mark is the ✕. */
  label?: string;
};

export const AwardClose = forwardRef<HTMLButtonElement, AwardCloseProps>(function AwardClose({ onClose, label = 'Close' }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      className={s.xClose}
      data-award-close=""
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <X aria-hidden size={22} strokeWidth={2} />
    </button>
  );
});
