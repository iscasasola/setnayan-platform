'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Sheet } from '@/app/_components/sheet';

/**
 * ⭐ WAVE 8 · WHERE SETUP WENT
 * (owner-locked 2026-07-25 · Live_Studio_Unified_Spec_2026-07-25 § 4g.)
 *
 * § 4g says the operating loop fits ONE screen and the page never scrolls. Waves
 * 1–7 shipped the loop with ~700 lines of SETUP stacked underneath it — connect
 * YouTube, encoder credentials, the channel manager and its join QRs, the overlay
 * text + corner pickers, the moments list, the watch link. All of that is real and
 * none of it may be dropped, but none of it is the operating loop either: it is
 * typing, done before the day, not something a thumb reaches for mid-ceremony.
 *
 * So it moves off the fixed surface and into this sheet. The controller viewport
 * stays scroll-free; the sheet is an OVERLAY that scrolls its own body, which is
 * the same thing the prototype does with its "Add a camera" QR sheet.
 *
 * ── WHY IT IS HASH-DRIVEN ────────────────────────────────────────────────────
 * The controller already carried in-page anchors that only worked because the page
 * scrolled — `#connect` (the transport's honest "connect YouTube first" link) and
 * `#add-camera` (the grid's + tile). Under § 4g those anchors are dead links: there
 * is nothing to scroll. Rather than rewire every caller into a callback, this
 * listens to the hash. A plain server-rendered `<a href="#connect">` still works,
 * still deep-links, and now OPENS THE SHEET and scrolls its body to that section.
 *
 * On close the hash is cleared with replaceState, so tapping the same anchor twice
 * re-opens it (a repeat hash fires no `hashchange`).
 *
 * A11y, scroll-lock and focus handling are the shared <Sheet> primitive's
 * (lib/use-modal-a11y): role=dialog, aria-modal, ESC, focus trap, focus restored
 * to the trigger on close.
 */

/** The query parameter a server action uses to reopen the sheet (see `read`). */
export const SHEET_PARAM = 'sheet';

/**
 * Which anchor, if any, the URL asks the sheet to open at. A `#hash` wins over
 * `?sheet=`; anything not in SETUP_ANCHORS opens nothing. Pure, so it is tested.
 */
export function sheetAnchorFrom(hash: string, search: string): (typeof SETUP_ANCHORS)[number] | null {
  const fromHash = hash.replace(/^#/, '');
  const fromQuery = new URLSearchParams(search).get(SHEET_PARAM) ?? '';
  for (const raw of [fromHash, fromQuery]) {
    if ((SETUP_ANCHORS as readonly string[]).includes(raw)) return raw as (typeof SETUP_ANCHORS)[number];
  }
  return null;
}

/** Anchors that open the sheet. `#setup` is the generic "open it" entry. */
export const SETUP_ANCHORS = [
  'setup',
  'connect',
  'add-camera',
  'overlays',
  'moments',
  'watch',
  'screens',
] as const;

export function SetupSheet({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  // The anchor to scroll to once the body exists. Held in a ref, not state:
  // it is a one-shot side effect, not a rendered value.
  const pendingAnchor = useRef<string | null>(null);

  const openTo = useCallback((anchor: string) => {
    pendingAnchor.current = anchor;
    setOpen(true);
  }, []);

  useEffect(() => {
    const read = () => {
      const raw = sheetAnchorFrom(window.location.hash, window.location.search);
      if (raw) openTo(raw);
    };
    // Deep-link on first paint. ⚠ A SERVER ACTION'S redirect() DROPS THE #HASH —
    // measured in prod 2026-09-20: `redirect('…?screen_added=1#screens')` landed on
    // `…?screen_added=1`, so the sheet stayed shut and the new screen's pairing code
    // was hidden. Actions therefore say `?sheet=<anchor>`; a typed link may still
    // use `#<anchor>`.
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, [openTo]);

  // Scroll the sheet BODY (never the page) to the requested section.
  useEffect(() => {
    if (!open) return;
    const anchor = pendingAnchor.current;
    pendingAnchor.current = null;
    if (!anchor || anchor === 'setup') return;
    const id = window.requestAnimationFrame(() => {
      const target = bodyRef.current?.querySelector<HTMLElement>(`#${CSS.escape(anchor)}`);
      if (!target) return;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    // Drop the hash so the SAME anchor can be tapped again (a repeat hash fires
    // no hashchange event). replaceState, not pushState: re-opening the sheet is
    // not a history entry an operator should have to press Back through.
    const params = new URLSearchParams(window.location.search);
    const hadSheet = params.has(SHEET_PARAM);
    params.delete(SHEET_PARAM);
    if (window.location.hash || hadSheet) {
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, []);

  return (
    <Sheet open={open} onClose={close} labelledById="lsc-setup-heading" title="Setup" wide>
      {/* The accessible name is the <Sheet> header's own "Setup" label, which
          already carries `id="lsc-setup-heading"` — do NOT render a second
          element with that id here. */}
      <div ref={bodyRef} className="space-y-4 p-4">
        {children}
      </div>
    </Sheet>
  );
}
