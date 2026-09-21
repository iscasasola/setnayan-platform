'use client';

/**
 * THE HALF SHEET THE REPLY LIVES IN.
 *
 * Canvas board "2 · RSVP sheet" (owner-approved, 2026-09-20): the couple's mark
 * stays visible above, the sheet rises over the rest of the invitation, and the
 * details a guest is being asked for are rows inside it rather than a section
 * they had to scroll away to find.
 *
 * ── WHAT THIS COMPONENT IS NOT ──────────────────────────────────────────────
 * It is a container and a piece of state. It renders `children` — the ONE
 * `<RsvpWidget>` mount — and never looks inside them. It declares no field,
 * posts nothing, and imports no server action. The sheet posts exactly what the
 * section posted because it IS the section, in a different place on the screen.
 *
 * ── THE THREE THINGS THAT WOULD HAVE BROKEN IT ──────────────────────────────
 *
 * 1️⃣ A HALF-TYPED NOTE MUST SURVIVE A CLOSE. `children` are rendered
 *    UNCONDITIONALLY, always, in both states — open and closed. Closing hides
 *    the panel with CSS; it never unmounts it. Writing `{open ? children : null}`
 *    (or mounting the panel only when open, which is the shape most sheet
 *    components take) throws away every uncontrolled input's value, and the one
 *    a guest most resents retyping is the note to the couple. Pinned by
 *    `the-reply-is-a-sheet.test.ts`.
 *
 * 2️⃣ WITHOUT JAVASCRIPT THERE IS NO SHEET, AND THE FORM MUST STILL WORK. The
 *    panel's default CSS is plain flow — it renders as the section it has always
 *    been. Only `.sn-sheet-js`, added to <html> by the inline sync script below,
 *    turns it into a sheet. So a guest with a dead bundle gets the old page, not
 *    a page whose RSVP is `display:none` and unreachable. This is also why the
 *    flag is set by a script tag and not by an effect: an effect runs after
 *    paint, and the whole form would flash in the flow first.
 *
 * 3️⃣ ⛔ NOT A SECOND FIXED BOTTOM BAR. `GuestHubBar` was retired for covering
 *    the site menu whole (a `fixed bottom-0 z-40` over a `z-30` menu). This is
 *    NOT that: when closed there is no fixed element at all — `display:none`,
 *    no bar, nothing over the menu. It is fixed only while a guest has opened it
 *    and is looking at it, with a scrim, like any modal sheet.
 *
 * ── WHERE IT MOUNTS, AND WHY IT IS NOT WHERE THE SECTION WAS ────────────────
 * 🪤 `site-body.tsx` renders this OUTSIDE `<article data-pahina-chapters>`, as
 * its sibling. IT HAS TO, AND THIS WAS MEASURED IN A BROWSER, not reasoned from
 * the stylesheet. The §6 scroll choreography puts a `transform` on EVERY direct
 * child of that article (`.pahina-js .sn-editorial [data-pahina-chapters] > *`),
 * and a transform — even the identity matrix a reduced-motion guest resolves it
 * to — makes that element the containing block for any `position: fixed`
 * descendant. Same panel, same CSS, two placements, one 812px-tall viewport:
 *
 *     sibling of the article  →  bottom = 812   (flush to the viewport)
 *     inside the article      →  bottom = 853   (41px below the fold)
 *
 * The bottom 41px of a sheet is its Save button. Nothing throws, nothing logs,
 * and on a desk it is invisible — the panel looks placed, it is simply placed
 * against the wrong box.
 *
 * ⚠ AND THE SAME RULE SETS `opacity: 0` UNTIL THE OBSERVER ADDS `.pahina-in` —
 * that half is READ FROM `globals.css`, not observed here, because the browser
 * pane resolves `prefers-reduced-motion: reduce`, which the stylesheet's own
 * belt-and-braces block neutralises. For a guest who has not asked for reduced
 * motion it means a sheet opened from the hash before they ever scrolled to that
 * part of the page would rise perfectly and be invisible.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { hashOpensSheet, sheetOpensOnLoad, type RsvpSheetFlash } from './rsvp-sheet-state';

/**
 * Structure lives here rather than in Tailwind utilities for two reasons: the
 * flow ⇄ sheet switch is a whole-state change that no utility expresses, and an
 * UNLAYERED rule beats every Tailwind utility regardless of specificity, so a
 * stray `block` on the panel can never leave it open. Colour and type stay in
 * classes on the element, where the palette can still reskin them.
 */
const SHEET_CSS = `
.sn-rsvp-scrim{display:none}
.sn-sheet-js .sn-rsvp-sheet{display:none}
.sn-sheet-js .sn-rsvp-scrim[data-open="1"]{
  display:block;position:fixed;inset:0;z-index:40;width:100%;padding:0;border:0;
  background:rgba(30,34,41,0.45);
}
.sn-sheet-js .sn-rsvp-sheet[data-open="1"]{
  display:block;position:fixed;left:0;right:0;bottom:0;z-index:50;
  max-height:78vh;overflow-y:auto;overscroll-behavior:contain;
  border-top-left-radius:1rem;border-top-right-radius:1rem;
  box-shadow:0 -16px 44px rgba(30,34,41,0.28);
}
@media (prefers-reduced-motion:no-preference){
  .sn-sheet-js .sn-rsvp-sheet[data-open="1"]{animation:sn-rsvp-rise var(--sn-dur-elem) var(--sn-ease-out)}
}
@keyframes sn-rsvp-rise{from{transform:translateY(12%)}to{transform:none}}
`;

/** Runs before paint, so the form is never seen in the flow and then yanked. */
const JS_FLAG = `(function(){try{document.documentElement.classList.add('sn-sheet-js')}catch(e){}})()`;

export function RsvpSheet({
  heading,
  privacyLine,
  flash = null,
  children,
}: {
  /** From `rsvpSheetHeading()` — resolved server-side so this stays presentational. */
  heading: string;
  /** The canvas's closing line, in the event's own words. */
  privacyLine: string;
  /** `page.tsx`'s `?rsvp=` outcome. An error reopens the sheet — see the module. */
  flash?: RsvpSheetFlash;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const openRef = useRef(false);
  /** Where the guest was reading, given back when the sheet closes. */
  const returnTo = useRef<number | null>(null);
  const hadOpened = useRef(false);

  const openSheet = useCallback(() => {
    if (openRef.current) return;
    openRef.current = true;
    hadOpened.current = true;
    // Usually already captured by the click listener below; this is the arm for
    // an open that did not come from a tap (a pasted link, a refused save).
    if (returnTo.current === null) returnTo.current = window.scrollY;
    setOpen(true);
  }, []);

  const closeSheet = useCallback(() => {
    openRef.current = false;
    setOpen(false);
    // 🪤 TAPPING THE SAME ANCHOR TWICE FIRES NO `hashchange`. A sheet dismissed
    // while `#your-details` was still in the URL could never be reopened from
    // the chip that opened it — the control would simply stop working, with no
    // error anywhere. Clearing the fragment is what makes the second tap work.
    try {
      if (hashOpensSheet(window.location.hash)) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    } catch {
      // A blocked history is not a reason to leave a guest trapped under a sheet.
    }
  }, []);

  /**
   * 🔴 WHERE THE GUEST WAS READING IS CAPTURED ON THE TAP, NOT ON THE HASH —
   * MEASURED, NOT REASONED. The first build read `window.scrollY` inside the
   * `hashchange` handler, which looked obviously right and was obviously wrong
   * the moment it was opened in a browser. Probing one real tap, from 705px
   * down a 705px-tall page:
   *
   *     beforeClick=705 · click=705 · hashchange=0 · afterOpen=0
   *
   * The fragment's target is the panel itself, and a closed panel is
   * `display:none` — so the browser cannot scroll to it and falls back to the
   * TOP OF THE DOCUMENT, before any `hashchange` listener runs. By the time the
   * sheet knew it was opening, the place it promised to give back was already
   * gone, and it would have handed every guest a silent `0`. Nothing throws; it
   * simply returns them to the top and reads like a design choice.
   *
   * The click listener runs while the position is still true. Capture phase so
   * it cannot be skipped by anything that stops propagation on the way up.
   */
  useEffect(() => {
    const onTap = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a[href*="#"]');
      if (link && hashOpensSheet(link.getAttribute('href'))) returnTo.current = window.scrollY;
    };
    document.addEventListener('click', onTap, true);
    return () => document.removeEventListener('click', onTap, true);
  }, []);

  // The flag is already on from the inline script; this is the cleanup half, so
  // a page that unmounts the sheet does not leave a flag claiming it is there.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('sn-sheet-js');
    return () => root.classList.remove('sn-sheet-js');
  }, []);

  // BOTH DOORS ARRIVE HERE. The hub card's chip and the arrival action are both
  // plain fragment links, which is why they also work with JS off; with JS on,
  // the fragment is the signal.
  const reopenForFlash = sheetOpensOnLoad(flash);
  useEffect(() => {
    const check = () => {
      if (hashOpensSheet(window.location.hash)) openSheet();
    };
    check();
    if (reopenForFlash) openSheet();
    window.addEventListener('hashchange', check);
    window.addEventListener('popstate', check);
    return () => {
      window.removeEventListener('hashchange', check);
      window.removeEventListener('popstate', check);
    };
  }, [openSheet, reopenForFlash]);

  /**
   * 🔑 THE SHARED HOOK, NOT A HAND-ROLLED ONE — RULE 0, CAUGHT BY ITS OWN GUARD.
   * The first build of this sheet did its own body-scroll lock, its own Escape
   * listener and its own `panelRef.current?.focus()`, which LOOKS like modal
   * behaviour and is the half that does not matter: focus was never trapped, so
   * Tab wandered straight out of the sheet into the invitation behind it, and on
   * close it was never handed back to the control that opened it. A sheet
   * claiming `aria-modal="true"` while doing that is a keyboard and
   * screen-reader dead end — which is exactly the 2026-06-25 audit finding this
   * hook exists to close, and `lib/modal-a11y-adoption.test.ts` named this file
   * on the first full run.
   *
   * `useModalA11y` owns focus, Tab, Escape and the (reference-counted) body
   * lock. What stays below is the one thing it does not do: the page's own
   * scroll position.
   */
  useModalA11y({ open, onClose: closeSheet, containerRef: panelRef });

  useEffect(() => {
    if (!open) return;
    // THE MARK STAYS VISIBLE BEHIND IT (canvas board 2). The sheet covers the
    // lower three-quarters of the screen; what shows above it is whatever the
    // page is scrolled to, so the page goes to its top as the sheet rises —
    // which is where the monogram and the couple's names are. Their reading
    // position is handed back by the effect below when the sheet closes.
    window.scrollTo(0, 0);
  }, [open]);

  useEffect(() => {
    // `hadOpened` matters: a tap captures a position BEFORE the sheet opens, and
    // without this a re-render in that gap would scroll the guest somewhere on a
    // sheet that was never open.
    if (open || !hadOpened.current) return;
    hadOpened.current = false;
    const y = returnTo.current;
    returnTo.current = null;
    if (y !== null) window.scrollTo(0, y);
  }, [open]);

  return (
    <>
      <style>{SHEET_CSS}</style>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: inline sync flag, before paint */}
      <script dangerouslySetInnerHTML={{ __html: JS_FLAG }} />
      {/* 🛑 NO `#site-me` MARKER HERE. The first draft emitted one, reasoning
          that the guest arm of site-body.tsx never does — true of that file and
          false of the product: `guest-hub-bar.tsx` renders the real
          `<section id="site-me">` (the personal QR) from page.tsx, and
          `bottom-edge.test.ts` caught the duplicate id on the first run. Two
          elements with one id means the browser scrolls to whichever comes
          first, which is how the Me tab landed on an empty div once already.
          The sheet needs no element: it listens to the FRAGMENT. */}
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        data-open={open ? '1' : '0'}
        className="sn-rsvp-scrim"
        onClick={closeSheet}
      />
      <div
        id="your-details"
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal={open || undefined}
        aria-labelledby="rsvp-sheet-heading"
        data-open={open ? '1' : '0'}
        data-rsvp-sheet
        className="sn-rsvp-sheet scroll-mt-6 bg-paper px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] outline-none"
      >
        <div className="sticky top-0 z-10 -mx-5 border-b border-ink/10 bg-paper/95 px-5 pb-3 pt-2 backdrop-blur">
          <span aria-hidden className="mx-auto mb-3 block h-1 w-9 rounded-full bg-ink/20" />
          <div className="flex items-start justify-between gap-4">
            <h2
              id="rsvp-sheet-heading"
              className="font-pahina text-[1.7rem] font-light leading-tight text-ink"
            >
              {heading}
            </h2>
            <button
              type="button"
              onClick={closeSheet}
              className="-mr-2 inline-flex min-h-[44px] shrink-0 items-center px-2 text-sm text-ink/60 transition-colors hover:text-ink"
            >
              Done
            </button>
          </div>
        </div>
        {/* ⚠ UNCONDITIONAL. See 1️⃣ at the top of this file: gating these on
            `open` is what loses a half-typed note to a dismissed sheet. */}
        <div className="pt-5">{children}</div>
        <p className="pt-5 text-center text-xs text-ink/55">{privacyLine}</p>
      </div>
    </>
  );
}
