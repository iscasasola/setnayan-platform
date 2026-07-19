'use client';

/**
 * The universal confirm-on-drop bubble (owner 2026-07-17 · Seat_Plan_2D3D
 * _Alignment_Directive → "Confirm-on-drop + universal draggability"). Shown at
 * the drop point on release, in BOTH the 2D editor and the 3D lab, for every
 * draggable element (tables, stage, dance floor, entrance, …). ONE component,
 * both projections.
 *
 * - `confirm` → "Drop here?" with ✓ (persist) and ✗ (snap back to drag-start).
 * - `reject`  → the named refusal ("This area intersects with {name} — please
 *   choose a different area", or the walkway variant) with ✗ only. The element
 *   has already snapped back; the bubble explains why.
 *
 * Esc cancels either state. Anchored BESIDE the drop point (offset right, or
 * left near the right edge; above, or below near the top edge) so it never
 * occludes the element it's asking about — the Context Dock's occlusion-flip
 * thinking. Not a modal: the canvas stays live behind it. ≥44px touch targets;
 * appearance respects `prefers-reduced-motion` (motion-safe only).
 *
 * Positioned by client coords RELATIVE to its projection container, which must
 * be `position: relative`. The caller passes `flipX` / `flipY` when the point is
 * near the right / top edge so the bubble stays in view.
 */

import { useEffect } from 'react';
import { Check, X } from 'lucide-react';

export type DropConfirmState =
  | { kind: 'confirm'; x: number; y: number; flipX?: boolean; flipY?: boolean }
  | { kind: 'reject'; x: number; y: number; message: string; flipX?: boolean; flipY?: boolean };

export function DropConfirmBubble({
  state,
  onConfirm,
  onCancel,
}: {
  state: DropConfirmState | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, onCancel]);

  if (!state) return null;
  const reject = state.kind === 'reject';
  // Anchor beside the point: default up-and-right; flip toward the interior near
  // the container's right / top edges so the bubble is never clipped and never
  // sits on top of the element.
  const tx = state.flipX ? 'translate-x-[calc(-100%-0.75rem)]' : 'translate-x-3';
  const ty = state.flipY ? 'translate-y-3' : 'translate-y-[calc(-100%-0.75rem)]';
  return (
    <div
      className="pointer-events-none absolute z-50"
      style={{ left: state.x, top: state.y }}
      role="dialog"
      aria-live="assertive"
    >
      <div
        // Keep taps on the bubble from starting a canvas pan / raycast beneath it
        // (it renders inside the 2D canvas container).
        onPointerDown={(e) => e.stopPropagation()}
        className={`pointer-events-auto ${tx} ${ty} flex w-[max-content] max-w-[240px] flex-col gap-2 rounded-xl border border-ink/15 bg-cream px-3 py-2.5 text-ink shadow-xl motion-safe:transition-opacity`}
      >
        <p className="text-xs font-medium leading-snug">
          {reject ? state.message : 'Drop here?'}
        </p>
        <div className="flex items-center gap-2">
          {!reject ? (
            <button
              type="button"
              onClick={onConfirm}
              aria-label="Confirm drop"
              className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg bg-mulberry px-3 text-sm font-semibold text-white transition-colors hover:bg-mulberry-600"
            >
              <Check className="h-4 w-4" strokeWidth={2} aria-hidden /> Drop here
            </button>
          ) : null}
          <button
            type="button"
            onClick={onCancel}
            aria-label={reject ? 'Dismiss' : 'Cancel drop'}
            className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-ink/20 bg-white px-3 text-sm font-medium text-ink/80 transition-colors hover:border-ink/35 ${
              reject ? 'flex-1' : 'min-w-11'
            }`}
          >
            <X className="h-4 w-4" strokeWidth={2} aria-hidden /> {reject ? 'OK' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
}
