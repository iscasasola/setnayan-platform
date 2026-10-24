'use client';

/**
 * 🌫 THE ONE BACKDROP BEHIND A POP-UP (owner 2026-10-25: *"the darken also moves and does not darken and blurr
 * background … will not be scrollable or tappable until pop up is gone via tapping the darkened space or closing the
 * popup. just implement it across all"*).
 *
 *   · `position: fixed; inset: 0` — pinned to the SCREEN, never to the page, so it cannot move or scroll with what is
 *     behind it; it covers the whole viewport, the bottom bar included (it sits on the pop-up's own layer).
 *   · dark AND blurred — the house popup rule `.sn-popup-dark` (light and dark mode, reduced-transparency fallback);
 *   · fades in on opacity only (`.sn-fade`);
 *   · `touch-action: none` + `overscroll-behavior: none` — a drag on the dimmed area moves nothing;
 *   · a tap on it closes the pop-up (it is a real <button>, so a keyboard reaches it too).
 * The page behind is held still and made inert by `useModalA11y` (`lib/overlay-lock.ts`), which every overlay calls.
 * 🔒 `lib/one-backdrop-everywhere.test.ts` — a hand-made `fixed inset-0` dimmer anywhere else fails it.
 */
export function OverlayBackdrop({
  onClose,
  label = 'Close',
  fade = true,
  className = '',
  style,
}: {
  onClose: () => void;
  label?: string;
  /** Fade in on opacity. Default on. */
  fade?: boolean;
  /** Layering only (`z-[75]`) — never a colour; the colour is the house rule's. */
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClose}
      data-overlay-backdrop=""
      className={`sn-popup-dark fixed inset-0 block min-h-0 w-full cursor-default touch-none overscroll-none p-0${fade ? ' sn-fade' : ''}${className ? ` ${className}` : ''}`}
      style={style}
    />
  );
}
