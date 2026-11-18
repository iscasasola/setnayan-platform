import { X } from 'lucide-react';
import s from './close-x.module.css';

/**
 * ✖️ THE ONE CLOSE FOR A FULL SCREEN (owner 15 Nov, DECISION_LOG "ONE CLOSE BUTTON FOR EVERY FULL SCREEN"): a 44px round
 * ✕, top left inside the safe area, dark glass with an ivory ring, one matching ivory focus ring. The gift screens use
 * it; any other full screen (the badge, the seal plaque, a photo full screen) may import it rather than draw its own.
 *
 * It sits `position: absolute` in its full-screen host, so the host must be positioned (`fixed`/`absolute`). It is a real
 * <button>: Enter and Space press it; the host's Esc does the same thing.
 */
export function FullscreenClose({ onClose, label = 'Close' }: { onClose: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClose} aria-label={label} className={s.x} data-fullscreen-close="">
      <X aria-hidden strokeWidth={1.75} />
    </button>
  );
}
