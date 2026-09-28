'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { sampleHubTileSrc } from '@/lib/theme-sample-stills';
import type { ThemeTile } from '@/lib/maker-theme-tiles';

/**
 * ONE THEME, FULL SCREEN — over the Details theme gallery, never instead of it.
 *
 * Owner 2026-09-28, verbatim: *"when they pick a theme. and we pressed on an
 * icon. it then goes to that preview in full screen. when we go there, there is
 * no way of getting back to choosing there theme."* · *"or a simple exit
 * preview"* (DECISION_LOG "CORRECTION — THE BACK THE OWNER MEANT…").
 *
 *   · An OVERLAY, not a navigation: the gallery stays mounted underneath, so
 *     leaving returns to it exactly where it was scrolled.
 *   · Three ways out, all the same: the labelled "Exit preview" (top-left, a
 *     thumb tall, clear of the notch), Escape (`useModalA11y`), and the phone's
 *     back gesture — opening pushes ONE history entry, so Android's back and
 *     iOS's swipe close the preview instead of leaving the Maker. Next's router
 *     copies its own state into that entry (its `pushState` patch), so going
 *     back restores the same page without a reload.
 *   · "Use this theme" is the same draft pick as tapping the entry; the preview
 *     itself never sets anything.
 *
 * What it shows is the SAMPLE Event Hub in that theme (`/maria-and-jose?theme=`,
 * honoured on the `is_sample` row only), whole and scrollable — never the
 * couple's page, and never the Maker's canvas.
 */
export function ThemePreviewOverlay({
  theme,
  mark,
  picked,
  onUse,
  onClose,
}: {
  theme: ThemeTile;
  /** ◆ PRO / the diamond, as the gallery draws it. */
  mark: ReactNode;
  /** It is already the couple's pick. */
  picked: boolean;
  onUse: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const exitRef = useRef<HTMLButtonElement>(null);
  const pushed = useRef(false);

  /* ← The phone's back closes the preview: one history entry of our own. */
  useEffect(() => {
    window.history.pushState({ themePreview: theme.id }, '');
    pushed.current = true;
    const onPop = () => {
      pushed.current = false;
      onClose();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening
  }, []);

  /** Every way out goes through history, so the entry we pushed is taken back off. */
  const exit = () => {
    if (pushed.current) window.history.back();
    else onClose();
  };

  useModalA11y({ open: true, onClose: exit, containerRef: ref, initialFocusRef: exitRef });

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={`${theme.name} — preview`}
      data-theme-preview={theme.id}
      className="fixed inset-0 z-[70] flex flex-col bg-cream"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-ink/10 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button
          ref={exitRef}
          type="button"
          onClick={exit}
          data-theme-preview-exit=""
          className="sn-press inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink/5 px-4 text-sm font-semibold text-ink hover:bg-ink/10"
        >
          <X aria-hidden className="h-4 w-4" strokeWidth={2} />
          Exit preview
        </button>
        <p className="flex min-w-0 flex-1 items-center justify-end gap-1.5 pr-1 text-sm font-semibold text-ink">
          <span className="truncate">{theme.name}</span>
          {mark}
        </p>
      </div>
      <div className="flex min-h-0 flex-1 justify-center bg-ink/[0.03]">
        <iframe
          src={sampleHubTileSrc(theme.id)}
          title={`${theme.name} — the sample Event Hub`}
          /* The sample page, scrollable; no top navigation, no pop-ups, no forms. */
          sandbox="allow-scripts allow-same-origin"
          data-theme-preview-frame=""
          className="h-full w-full max-w-[430px] border-0 bg-white md:my-3 md:rounded-2xl md:shadow-[0_30px_60px_-34px_rgba(30,26,18,.5)]"
        />
      </div>
      {/* The one action, where a thumb is — clear of the home indicator. */}
      <div className="flex shrink-0 justify-center border-t border-ink/10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onClick={() => {
            onUse();
            exit();
          }}
          disabled={picked}
          data-theme-preview-use=""
          className="button-primary inline-flex min-h-11 w-full max-w-[430px] items-center justify-center gap-1.5 text-sm disabled:opacity-60"
        >
          {picked ? (
            <>
              <Check aria-hidden className="h-4 w-4" strokeWidth={2.25} /> Your theme
            </>
          ) : (
            'Use this theme'
          )}
        </button>
      </div>
    </div>
  );
}
