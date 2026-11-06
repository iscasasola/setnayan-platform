'use client';

import { useLayoutEffect, useRef } from 'react';

/** The least of an element this needs — so the rule below can be run on a stand-in. */
type Scope = { removeAttribute(name: string): void; setAttribute(name: string, value: string): void };

/**
 * Take Candlelight off the scope that wears it ABOVE `from`; returns the undo
 * (it is put back exactly as it was), or null when nothing above wears it.
 */
export function takeCandlelightOff(from: { closest(selector: string): Scope | null } | null): (() => void) | null {
  const scope = from?.closest("[data-art='candlelight']") ?? null;
  if (!scope) return null;
  scope.removeAttribute('data-art');
  return () => scope.setAttribute('data-art', 'candlelight');
}

/**
 * 🌗 A DRAFT CAN TAKE A LIVE CANDLELIGHT OFF — ON THE HOST'S CANVAS (owner
 * 2026-10-08, the Look restudy § 3.1: Candlelight is Background › Shade ▾'s
 * darkest step, and *"a live Candlelight must be removable by a draft, or the
 * row is a lie"*).
 *
 * Candlelight is worn as an ATTRIBUTE by the layout's look scope
 * (`[slug]/layout.tsx` → `GuestLookScope`, `data-art="candlelight"`), and a
 * layout cannot see `?editor=1` — so a draft that turned it OFF could not take
 * the layout's attribute away, and the canvas stayed dark until Apply
 * (`host-draft-look.tsx`'s old "known limit"). Custom properties inherit, so no
 * inner scope can undo it in CSS without restating every token of every theme.
 * Instead the host's drafted scope mounts this: on the canvas it lifts the
 * attribute off the scope above, and puts it back if it ever leaves.
 *
 * ⛔ NEVER FOR A GUEST. `HostDraftLook` is built only from a `hostDraft`
 * (a verified host on `?editor=1`), and renders this only while that draft's
 * look is NOT Candlelight. Guest HTML carries none of it.
 */
export function CandlelightOffOnCanvas() {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => takeCandlelightOff(ref.current) ?? undefined, []);
  return <span ref={ref} hidden data-candlelight-off-on-canvas="" />;
}
