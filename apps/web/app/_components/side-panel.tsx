'use client';

/**
 * <SidePanel> — DEEP ACTIONS SLIDE IN FROM THE RIGHT, AT EVERY WIDTH (design
 * brief 2026-09-24 §1: "off-canvas slide-out panels for deep actions rather
 * than centered modal boxes"). Read build-sessions/DESIGN-FOUNDATION.md.
 *
 *     <SidePanel open={open} onClose={() => setOpen(false)} title="Add a guest">
 *       …
 *     </SidePanel>
 *
 * The geometry is the guest card's below-xl sheet (`.sn-inspector-sheet` /
 * `.sn-inspector-peek`, owner 2026-09-22: "peek from the left and … leave a
 * small space so when we tap on that space it returns"), reused — the same
 * keyframes, the same 3.5rem strip that is the way back — but it is NOT hidden
 * at ≥xl, and from 768px it stops being full-bleed and becomes a 30rem panel
 * (`size="wide"`: 44rem) over the page. Borderless glass, seated by shadow.
 *
 * vs `_components/sheet.tsx`: `Sheet` RISES from the bottom on a phone (a
 * single decision in thumb reach) and docks right from `lg`. `SidePanel` is
 * right-hand at every width (a workspace you move through). Nothing existing
 * is migrated to this; screens adopt it as they are redesigned.
 *
 * Focus (in, Tab trap, Esc, restore to the trigger) and the scroll lock are the
 * shared `useModalA11y` — `aria-modal="true"` is a promise, and
 * `lib/modal-a11y-adoption.test.ts` fails a file that makes it without the hook.
 *
 * Leaving is a TRANSITION on `data-closing`, then an unmount after
 * `--sn-dur-elem` — never an animation with `forwards`/`both`, because a held
 * transform makes this panel the containing block for every `position: fixed`
 * child (`scripts/lingering-transform.baseline.txt`). Reduced motion skips the
 * wait (`sidePanelExitMs`).
 */

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { InfoTip } from './info-tip';

/** Mirrors `--sn-dur-elem` in globals.css (the panel's enter/leave duration). */
export const SIDE_PANEL_EXIT_MS = 320;

/** How long a closing panel stays mounted: its transition, or none at all. */
export function sidePanelExitMs(reducedMotion: boolean): number {
  return reducedMotion ? 0 : SIDE_PANEL_EXIT_MS;
}

export type SidePanelProps = {
  open: boolean;
  onClose: () => void;
  /** One to three words. Rendered as the panel's heading and its accessible name. */
  title: string;
  /** Secondary explanation, behind an `(i)` beside the title. */
  info?: ReactNode;
  size?: 'default' | 'wide';
  /**
   * Below 768px: `'side'` (default) slides in from the right like every other
   * width; `'sheet'` rises from the bottom as a sheet instead — for a flow a
   * phone reaches with its thumb (the collection template's add flow, owner-
   * approved 2026-09-24). From 768px both are the same right-hand panel.
   */
  phone?: 'side' | 'sheet';
  children: ReactNode;
};

export function SidePanel({
  open,
  onClose,
  title,
  info,
  size = 'default',
  phone = 'side',
  children,
}: SidePanelProps) {
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  // `mounted` outlives `open` by the exit transition, so the panel can leave.
  const [mounted, setMounted] = useState(open);
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    setPortal(document.body);
  }, []);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = window.setTimeout(() => setMounted(false), sidePanelExitMs(reduce));
    return () => window.clearTimeout(t);
  }, [open]);

  // Gated on the portal: the hook binds once, on the render where `open` turns
  // true, and needs the dialog to EXIST then — before the portal target is set
  // there is nothing to focus, and it would never try again.
  useModalA11y({ open: open && portal !== null, onClose, containerRef: ref });

  // `open ||` so the render that opens the panel already has it in the DOM;
  // `mounted` only keeps it there while it leaves.
  if (!portal || !(open || mounted)) return null;
  const closing = open ? undefined : 'true';

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="sn-side-panel-scrim"
        data-closing={closing}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="sn-side-panel focus:outline-none"
        data-size={size === 'wide' ? 'wide' : undefined}
        data-phone={phone === 'sheet' ? 'sheet' : undefined}
        data-closing={closing}
      >
        <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
          {info ? (
            <InfoTip
              label={title}
              labelAs="h2"
              labelId={titleId}
              labelClassName="text-xl font-extrabold tracking-tight text-ink"
              align="start"
            >
              {info}
            </InfoTip>
          ) : (
            <h2 id={titleId} className="text-xl font-extrabold tracking-tight text-ink">
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="sn-press inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink/55 transition-all duration-sn-control ease-sn hover:bg-ink/5 hover:text-ink"
          >
            <X aria-hidden className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <div className="sn-side-panel-body">{children}</div>
      </div>
    </>,
    portal,
  );
}
