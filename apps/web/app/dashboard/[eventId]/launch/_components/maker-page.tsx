'use client';

import { useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { BufferedCanvasFrame } from '../../website/editor/_components/buffered-canvas-frame';
import { MAKER_PAGE_TITLE, type MakerPageKey } from '@/lib/maker-made-once-pages';
import { MAKER_PHONE_PANEL_CAP } from '@/lib/maker-phone-room';
import { SheetGrip, SheetScrim } from './maker-sheet';
import { PickMenu } from '../../website/editor/_components/pick-menu';

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
 * the flow. The strip is capped so the bar + it take at most 45% of the screen
 * (`MAKER_PHONE_PANEL_CAP`, lib/maker-phone-room.ts — owner 2026-10-02: *"the
 * screen is too clumped"*); it no longer grows while typing — a focused field is
 * brought into view instead, and the Maker shell itself follows the on-screen
 * keyboard (`visualViewport`, `maker-shell.tsx`).
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
  initiallyOpen = false,
}: {
  /** 📱 Open the controls' sheet at once on a phone (a door that names them). */
  initiallyOpen?: boolean;
  pageKey: MakerPageKey;
  /** The item's own page — the body. */
  page: ReactNode;
  /** Its controls, where a stage's inspector sits. Null = the page carries its
   *  own (the logo studio lays its panel beside its canvas). */
  controls?: ReactNode;
}) {
  const title = MAKER_PAGE_TITLE[pageKey];
  /* 📱 On a phone the controls are a bottom sheet over the dimmed page (owner
     2026-10-02: "dim the negative space … pressing on the dimmed part will go
     back"); shut, one chip on the page opens them. The desktop keeps its column. */
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <div data-maker-page={pageKey} className="flex h-full min-h-0 w-full flex-1 flex-col lg:flex-row">
      <section
        aria-label={`${title} — your page`}
        data-maker-page-body=""
        className="relative order-1 flex min-h-0 flex-1 flex-col"
      >
        {page}
        {controls && !open ? (
          <button
            type="button"
            data-maker-page-edit=""
            onClick={() => setOpen(true)}
            className="sn-press absolute bottom-3 left-1/2 z-10 inline-flex min-h-11 -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-ink px-4 text-[14px] font-semibold text-cream shadow-lg lg:hidden"
          >
            Edit · {title}
          </button>
        ) : null}
      </section>
      {controls && open ? <SheetScrim onClose={() => setOpen(false)} /> : null}
      {controls ? (
        <aside
          aria-label={`${title} — controls`}
          data-maker-page-controls=""
          data-phone-chrome="panel"
          onFocusCapture={(e) => {
            const t = e.target as HTMLElement;
            if (!isTextField(t)) return;
            // After the keyboard has opened.
            window.setTimeout(() => t.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
          }}
          className={`order-2 flex min-h-0 shrink-0 flex-col border-ink/10 bg-cream lg:static lg:flex lg:max-h-none lg:w-[360px] lg:border-l ${
            open
              ? `max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-30 max-lg:rounded-t-3xl max-lg:shadow-[0_-18px_40px_-24px_rgba(30,26,18,.5)] ${MAKER_PHONE_PANEL_CAP}`
              : 'max-lg:hidden'
          }`}
        >
          <SheetGrip onClose={() => setOpen(false)} />
          <div className="flex items-center gap-2 px-4 pt-1 lg:pt-3">
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

/**
 * Which way a made-once page is shown ("The questions · After they reply",
 * "Your story · As guests see it") — ONE dropdown (owner 2026-10-02: *"any set
 * of choices is one dropdown, never a pill row"*; it was a two-pill switch).
 */
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
    <div className="flex shrink-0 justify-center px-2 pt-2" data-maker-page-switch="">
      <PickMenu label={label} value={value} options={options.map(([key, text]) => ({ key, label: text }))} onPick={onChange} />
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
