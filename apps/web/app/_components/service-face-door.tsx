'use client';

/**
 * The service face's door when the caller has a callback, not an address (the shop page's in-page grown card, Find's
 * sheet). Its own client file so the face itself stays a server-safe component: an inline `onClick` on a host
 * `<button>` in a server file crashes the whole route (`lib/rsc-function-props.test.ts`).
 *
 * Stretched over the face as its LAST child; the face's shop line and footer sit above it (z-10). It hands the card's
 * own box (its parent) to `onOpen`, so the Service card grown rises from the card that was tapped.
 */
export function ServiceFaceDoorButton({
  label,
  hasPopup,
  onOpen,
}: {
  label: string;
  hasPopup?: boolean;
  onOpen: (from: HTMLElement | null) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      data-service-face-door=""
      aria-haspopup={hasPopup ? 'dialog' : undefined}
      onClick={(e) => onOpen(e.currentTarget.parentElement)}
      className="absolute inset-0 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
    />
  );
}
