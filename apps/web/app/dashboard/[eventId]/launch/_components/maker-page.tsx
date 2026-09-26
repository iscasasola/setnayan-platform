'use client';

import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { MAKER_PAGE_TITLE, type MakerPageKey } from '@/lib/maker-made-once-pages';

/**
 * A MADE-ONCE ITEM AS A PAGE IN THE MAKER'S BODY (owner 2026-09-25: *"we do not
 * want a pop up for details, logo, hero, reveal and love story. we want their
 * actual page to be on the body of the editor similar to the different
 * stages"*). `lib/maker-made-once-pages.ts` says what each page draws.
 *
 * Two regions, the stage's own geometry:
 *
 *   · the PAGE — where a stage's canvas sits; it fills the body;
 *   · the CONTROLS — where a stage's inspector sits: the side on a wide screen,
 *     a strip under the page on a phone and a folded foldable (in the flow of
 *     the page, never `fixed` over it — a strip, not a sheet).
 *
 * 📱 PHONE FIRST (owner 2026-09-25: *"99% of the viewers will use the phone"*).
 * On a phone the page sits on top and the controls in a strip under it, both in
 * the flow. While a field in the strip has focus the strip grows (the page
 * keeps a slice), and the field is brought into view — the Maker shell itself
 * follows the on-screen keyboard (`visualViewport`, `maker-shell.tsx`), so the
 * keyboard never covers the field being typed in.
 *
 * ⛔ NOT A DIALOG. No `role="dialog"`, no portal, no backdrop, no focus trap:
 * the bar stays live above it, and picking a stage puts the stage back.
 * `lib/the-made-once-items-are-pages.test.ts` holds it.
 */
export function MakerPage({
  pageKey,
  page,
  controls = null,
  onClose,
  closeLabel,
}: {
  pageKey: MakerPageKey;
  /** The item's own page — the body. */
  page: ReactNode;
  /** Its controls, where a stage's inspector sits. Null = the page carries its
   *  own (the logo studio lays its panel beside its canvas). */
  controls?: ReactNode;
  onClose: () => void;
  /** "Back to the Invitation" — where closing lands. */
  closeLabel: string;
}) {
  const title = MAKER_PAGE_TITLE[pageKey];
  /* A field in the strip is being typed in — the strip grows on a phone. */
  const [typing, setTyping] = useState(false);
  return (
    <div data-maker-page={pageKey} className="flex h-full min-h-0 w-full flex-1 flex-col lg:flex-row">
      <section
        aria-label={`${title} — your page`}
        data-maker-page-body=""
        className="relative order-1 flex min-h-0 flex-1 flex-col"
      >
        {page}
      </section>
      {controls ? (
        <aside
          aria-label={`${title} — controls`}
          data-maker-page-controls=""
          data-typing={typing ? '' : undefined}
          onFocusCapture={(e) => {
            const t = e.target as HTMLElement;
            if (!isTextField(t)) return;
            setTyping(true);
            // After the keyboard has opened and the strip has grown.
            window.setTimeout(() => t.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
          }}
          onBlurCapture={(e) => {
            if (isTextField(e.target as HTMLElement)) setTyping(false);
          }}
          className={`order-2 flex min-h-0 shrink-0 flex-col border-t border-ink/10 bg-cream lg:max-h-none lg:w-[360px] lg:border-l lg:border-t-0 ${
            typing ? 'max-h-[78%]' : 'max-h-[46%]'
          }`}
        >
          <div className="flex items-center gap-2 px-4 pt-2.5 lg:pt-3">
            <p className="min-w-0 flex-1 truncate font-serif text-lg text-ink">{title}</p>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              title={closeLabel}
              className="sn-press inline-flex h-11 w-11 items-center justify-center rounded-full bg-ink/5 text-ink/70 hover:bg-ink/10 hover:text-ink"
            >
              <X aria-hidden className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-3 pb-6 pt-2">
            {controls}
          </div>
        </aside>
      ) : null}
    </div>
  );
}

/**
 * The guest page drawn as an item's page (Hero · Reveal · Love Story as guests
 * see it) — the same frame a stage's canvas uses, at the toolbar's device width.
 */
export function MakerPageFrame({
  src,
  title,
  device,
  frameKey,
  frameRef,
}: {
  src: string;
  title: string;
  device: 'desktop' | 'phone';
  frameKey: string;
  frameRef?: React.Ref<HTMLIFrameElement>;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-[radial-gradient(120%_90%_at_50%_0%,rgba(203,167,102,.10),transparent_60%)] px-2 py-2 lg:px-6 lg:pb-5 lg:pt-4">
      <iframe
        ref={frameRef}
        key={frameKey}
        src={src}
        title={title}
        data-maker-page-frame=""
        className={`min-h-0 w-full flex-1 rounded-md bg-white shadow-[0_1px_2px_rgba(40,34,24,.06),0_28px_54px_-30px_rgba(30,26,18,.5)] transition-[max-width] duration-sn-elem ease-sn ${
          device === 'phone' ? 'max-w-[430px]' : 'max-w-none'
        }`}
      />
    </div>
  );
}

/** A control the on-screen keyboard opens for. */
function isTextField(el: HTMLElement): boolean {
  if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  if (el.tagName !== 'INPUT') return false;
  const type = (el as HTMLInputElement).type;
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color', 'hidden'].includes(type);
}
