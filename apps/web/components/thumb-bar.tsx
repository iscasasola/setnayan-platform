'use client';

/**
 * ThumbBar — the page's tools, in the lower third (owner 2026-10-05, "tools
 * live in the lower third"), as the glass floating row of the button rule
 * (corpus `BUTTON_RULE_2026-10-07_fable.md`, rules 5 and 7):
 *
 *   • Rule 5 — it SLIDES UP once the page has rendered, and slides down
 *     before the couple leaves through one of its own doors. Never pops.
 *   • Rule 7 — the row has NO background; only the neutral buttons are
 *     frosted (translucent paper over a blur, clipped to the pill, no
 *     shadow). Toned buttons keep their full colour.
 *   • Rule 3a — the row is one `useFitRow` row, so its buttons change state
 *     as one (icon + word → word → icon) when the phone is narrow.
 *
 * It pins above the bottom dock through `--sn-bottomdock-h`, the height
 * `bottom-nav.tsx` publishes — the same measure the Guests row uses — so it
 * never sits under the nav bar. `ThumbBarSpacer` is the in-flow gap a page
 * puts at its end so its last row can scroll clear of the bar.
 *
 * Children are `ActionButton`s (and, where a set of choices lives in the
 * thumb zone, one PickMenu). The More-menu pages are its first callers
 * (corpus `MORE_MENU_PAGES_AUDIT_2026-10-07_fable.md` §3).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useFitRow } from '@/components/action-button';

export function ThumbBar({
  children,
  label,
}: {
  children: ReactNode;
  /** Accessible name of the toolbar ("Live stream tools"). */
  label: string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useFitRow(rowRef);

  useEffect(() => {
    // One frame after paint, so the slide is seen (rule 5: never pops in).
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="sn-thumbbar" data-on={on ? 'true' : 'false'}>
      <div
        ref={rowRef}
        role="toolbar"
        aria-label={label}
        className="sn-thumbbar-row"
        // A door in the bar leaves the page: slide down first (rule 5).
        onClickCapture={(e) => {
          const a = (e.target as HTMLElement).closest('a[href]');
          if (a) setOn(false);
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** The in-flow space under a page's last row, so nothing hides behind the bar. */
export function ThumbBarSpacer() {
  return <div aria-hidden className="sn-thumbbar-spacer" />;
}
