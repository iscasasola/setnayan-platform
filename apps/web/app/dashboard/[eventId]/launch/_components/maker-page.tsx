'use client';

import { useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { BufferedCanvasFrame } from '../../website/editor/_components/buffered-canvas-frame';
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
 *
 * ⛔ NO "BACK TO …" CLOSE (owner 2026-09-27: *"no need for this"*). The Maker
 * bar above already goes to every stage and every page; a second way back in
 * the page's own header was one more thing to read.
 * `lib/the-made-once-items-are-pages.test.ts` holds it.
 */
export function MakerPage({
  pageKey,
  page,
  controls = null,
}: {
  pageKey: MakerPageKey;
  /** The item's own page — the body. */
  page: ReactNode;
  /** Its controls, where a stage's inspector sits. Null = the page carries its
   *  own (the logo studio lays its panel beside its canvas). */
  controls?: ReactNode;
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
 *
 * 🪞 DOUBLE-BUFFERED, LIKE THE CANVAS (owner 2026-09-29: *"make sure 100% that
 * there is no slow response on the maker"*). `frameKey` moves on every Maker
 * render (every save, anywhere), and this frame used to be KEYED on it: each
 * save remounted it, and the page went white and loaded from the top while the
 * couple waited — on the Hero page, after every design pick. Now the new render
 * loads behind the page on screen and takes its place once ready
 * (`BufferedCanvasFrame`, the stage canvas's own mechanism — not a second one).
 * A different page (`src`) is a different group, so it still swaps at once.
 */
export function MakerPageFrame({
  src,
  title,
  device,
  frameKey,
  frameRef,
  onShown,
}: {
  src: string;
  title: string;
  device: 'desktop' | 'phone';
  frameKey: string;
  frameRef?: MutableRefObject<HTMLIFrameElement | null>;
  /** The frame now shown (the canvas guard re-attaches to it). */
  onShown?: (key: string) => void;
}) {
  const ownRef = useRef<HTMLIFrameElement | null>(null);
  const loadingRef = useRef<Window | null>(null);
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-[radial-gradient(120%_90%_at_50%_0%,rgba(203,167,102,.10),transparent_60%)] px-2 py-2 lg:px-6 lg:pb-5 lg:pt-4">
      <BufferedCanvasFrame
        frameKey={frameKey}
        group={src}
        src={src}
        title={title}
        pageFrame
        frameRef={frameRef ?? ownRef}
        loadingRef={loadingRef}
        anchorKey={() => null}
        onShown={(key) => onShown?.(key)}
        onSwapped={() => {}}
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

/** A two- or three-way switch at the top of a made-once page (not a tab bar:
 *  both sides are the same page, shown two ways). */
export function MakerPageSwitch({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 justify-center px-2 pt-2" data-maker-page-switch="">
      <div className="flex items-center rounded-full bg-ink/5 p-0.5">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={`sn-press inline-flex min-h-9 items-center whitespace-nowrap rounded-full px-3 text-[12.5px] font-semibold transition-colors duration-sn-control ease-sn ${
              value === v ? 'bg-white text-ink shadow-sm' : 'text-ink/60 hover:text-ink'
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * 🗳 THE RSVP PAGE'S CANVAS (owner 2026-09-27): "The questions" by default —
 * the page every switch beside it changes — or "After they reply", the ticket
 * and pass a guest sees once they have answered. The SAME two-position switch
 * Love Story uses ("Your story · As guests see it"); both frames wear the
 * couple's draft, so a switch shows before Apply.
 */
export function MakerRsvpCanvas({
  questionsSrc,
  repliedSrc,
  stamp,
}: {
  questionsSrc: string;
  repliedSrc: string;
  stamp: string;
}) {
  const [replied, setReplied] = useState(false);
  return (
    <div className="flex min-h-0 flex-1 flex-col" data-maker-rsvp-canvas={replied ? 'replied' : 'questions'}>
      <MakerPageSwitch
        label="Show the RSVP"
        value={replied ? 'replied' : 'questions'}
        onChange={(v) => setReplied(v === 'replied')}
        options={[
          ['questions', 'The questions'],
          ['replied', 'After they reply'],
        ]}
      />
      <MakerPageFrame
        src={replied ? repliedSrc : questionsSrc}
        title={replied ? 'After a guest replies' : 'Your RSVP questions'}
        device="phone"
        frameKey={`rsvp:${replied ? 'replied' : 'questions'}:${stamp}`}
      />
    </div>
  );
}
