'use client';
/**
 * Small shared pieces of the award kit: the tier light colours, the reduced-motion read, the art serialiser, and the
 * top-layer dialog hook every full-screen view uses (a modal <dialog> gives Esc AND the phone's back gesture for
 * free — Chrome on Android routes "back" to an open modal dialog's `cancel`).
 */
import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Each tier's LIGHT colour — the burst, rays and halo of the full-screen badge and the glow of its story — by
 * POSITION (tier1 … tier7), from the approved prototype's `TC`. Positional on purpose: tier names are data
 * (`lib/badge-tiers.ts`) and may be renamed; a caller can always pass its own `tone`.
 */
export const AWARD_TONES = ['#c47c3f', '#cdd3db', '#f0c23b', '#e0223f', '#1fb36a', '#5fb2ff', '#a98bff'] as const;
/** The seals' gold light. */
export const SEAL_TONE = '#E8B84A';

/** The tone for a 1-based tier position, clamped. */
export function toneForTier(index: number): string {
  const i = Math.max(1, Math.min(AWARD_TONES.length, Math.round(index) || 1));
  return AWARD_TONES[i - 1]!;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * The award's drawn SVG as a standalone string — so whatever the caller drew (an `<ImageBadge>` React element or a
 * generator's markup) can be masked for the glint and painted into the story canvas. Read from the live DOM; nothing
 * leaves the device.
 */
export function serializeArt(host: Element | null): string {
  if (!host) return '';
  const svg = host.querySelector('svg');
  if (svg) {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (!clone.getAttribute('viewBox')) {
      const w = svg.clientWidth || 300;
      const h = svg.clientHeight || 300;
      clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
    }
    return new XMLSerializer().serializeToString(clone);
  }
  return '';
}

/** Opens a mounted <dialog> as a top-layer modal and closes it on unmount; `onCancel` gets Esc / back. */
export function useModalDialog(onCancel: () => void): RefObject<HTMLDialogElement | null> {
  const ref = useRef<HTMLDialogElement | null>(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  useLayoutEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) {
      try {
        d.showModal();
      } catch {
        d.setAttribute('open', '');
      }
    }
    const cancel = (e: Event) => {
      e.preventDefault();
      cancelRef.current();
    };
    d.addEventListener('cancel', cancel);
    return () => {
      d.removeEventListener('cancel', cancel);
      if (d.open) d.close();
    };
  }, []);
  return ref;
}
