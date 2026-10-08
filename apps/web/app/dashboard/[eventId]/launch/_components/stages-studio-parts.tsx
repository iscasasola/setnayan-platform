'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { PILL_ON_CLASS } from '@/app/_components/pill-selector';
import { inertBehind, popupClearRect, popupHolePath } from '@/lib/popup-behind';
import { STUDIO_DONE_BUTTON, STUDIO_HEAD_ROW } from '@/lib/studio-skin';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { ISeg, ISegmented } from '../../website/editor/_components/inspector-kit';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import type { PickOption } from '../../website/editor/_components/pick-menu-types';
import { MAKER_LT_SIZE_KEY, MAKER_LT_TAP_PX, makerLtClampPx, makerLtStoredPx, makerLtTapPx } from '@/lib/maker-lt-size';
import type { StudioTileKey, StudioTileModel } from '@/lib/studio-tiles';
import { MAKER_SIDE_LABEL, type MakerSide } from './maker-bar';
import { StudioHome, TILE_ICON } from './studio-home';

/**
 * 🧭 THE NEW MAKER'S PARTS — "Stages | Studio" (owner 2026-10-06; plan
 * `EVENT_HUB_MAKER_STAGES_STUDIO_BUILD_PLAN_2026-10-06.md` §3 PR 1; prototype
 * `maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html`). Every piece of
 * chrome only the new Maker draws lives HERE, loaded through `details-lazy.tsx`
 * (the `maker-details` chunk, warmed at idle) — so the shipped Maker's first
 * load carries none of it (`scripts/check-maker-js-budget.mjs`). The shell
 * keeps the state; these only draw it. 🔒 Nothing here writes to the event.
 */

/**
 * Stages | Studio — ONE segmented control in the top nav (sections = one `ISegmented`, INTERACTION_RULES §8).
 *
 * 🧭 INSIDE A STUDIO PAGE THE STUDIO HALF IS "STUDIO ▾" — THE WAY TO ANOTHER PAGE (owner 2026-10-08, on the
 * "INFO ▾" pill row that sat under the top bar: *"we will not have these."* · *"Tapping studio will open a popup
 * instead for us to choose which one?"*). The row is gone; its eleven destinations are HERE:
 *   · coming from Stages, a tap on Studio lands on the Studio home (the cards), as it always did;
 *   · at the Studio home there is no ▾ (a tap on Studio does nothing new — it is where you are);
 *   · inside a page (`at`), the Studio half shows a small ▾ and a tap OPENS THE CHOICES — the house dropdown
 *     (`PickMenu`): a sheet from the bottom on a phone (the Maker's one sheet — dark, blurred, nothing behind works),
 *     a list under the pill on a computer. The pages this event draws — exactly the Studio home's, in its order —
 *     each with its mark, its name and Ready / Missing, the current one ticked. NO "All pages" row (owner
 *     2026-10-08, on the first build: *"pop up looks good. remove the all pages."*): the home is one tap on Stages
 *     and one on Studio away. A ▾ never cycles, and the thumb does not move on that tap (it is already on Studio).
 * A pick is the SAME call the row's Tool ▾ made (`onOpen` → the shell's `openStudio`): state on the phone, no
 * request, no render of the Maker.
 */
export function StudioSideSwitch({
  side,
  onPick,
  at = null,
  tiles = [],
  onOpen,
}: {
  side: MakerSide;
  onPick: (side: MakerSide) => void;
  /** The Studio page that is open — null at the Studio home, on Look's own bar… and on the Stages side. */
  at?: StudioTileModel | null;
  /** The pages this event draws (`lib/studio-tiles.ts`) — the home's own list, in its order. */
  tiles?: readonly StudioTileModel[];
  /** Open a page — the shell's `openStudio`. */
  onOpen?: (key: StudioTileKey) => void;
}) {
  const choose = side === 'studio' && at !== null && onOpen !== undefined;
  return (
    <ISegmented label="Stages or Studio">
      <ISeg tone="wine" on={side === 'stages'} data="stages" onClick={() => onPick('stages')}>
        {MAKER_SIDE_LABEL.stages}
      </ISeg>
      {choose ? (
        /* The picked half of the pill (`aria-current` is how the thumb finds it) — and inside it, the dropdown. */
        <span aria-current="page" data-seg="studio" data-studio-chooser="" className={STUDIO_CHOOSER_SEG}>
          <PickMenu
            label="Studio pages"
            dataAttr="data-studio-chooser-pick"
            value={at.key}
            buttonText={MAKER_SIDE_LABEL.studio}
            options={studioChooserOptions(tiles)}
            onPick={(k) => onOpen(k as StudioTileKey)}
            className={STUDIO_CHOOSER_PICK}
          />
        </span>
      ) : (
        <ISeg tone="wine" on={side === 'studio'} data="studio" onClick={() => onPick('studio')}>
          {MAKER_SIDE_LABEL.studio}
        </ISeg>
      )}
    </ISegmented>
  );
}

/** The picked half of the pill while it holds the chooser: the pill's own "on" look until the thumb has measured, then the thumb's. */
const STUDIO_CHOOSER_SEG = `relative z-[1] inline-flex min-h-[38px] flex-1 items-stretch justify-center rounded-full ${PILL_ON_CLASS} group-data-[seg-thumb]/seg:bg-transparent lg:min-h-8`;
/** The dropdown's button worn as that half: no fill of its own, the label ink, its ▾ in the same ink. */
const STUDIO_CHOOSER_PICK =
  'w-full justify-center !min-h-0 !bg-transparent hover:!bg-transparent !px-2.5 !text-[12.5px] !text-sn-on-accent [&>svg]:!text-sn-on-accent';

/** A page's rows in a list of pages: its line, and ✓ Ready / Missing as the home's card says it. */
function tileOption(t: StudioTileModel, withIcon: boolean): PickOption {
  const Icon = TILE_ICON[t.key];
  return {
    key: t.key,
    label: t.label,
    hint: t.status,
    ...(withIcon ? { icon: <Icon aria-hidden className="h-[18px] w-[18px] text-sn-accent" strokeWidth={1.9} /> } : {}),
    ...(t.done === true ? { trail: { text: '✓', tone: 'ok' as const, label: 'Ready' } } : t.done === false ? { trail: { text: 'Missing', tone: 'left' as const } } : {}),
  };
}

/**
 * What "Studio ▾" lists: the pages this event draws — the SAME list, in the SAME order, as the Studio home's cards
 * and the row it replaces (one source: `tiles`). Nothing else: no "All pages" row (owner 2026-10-08).
 */
export function studioChooserOptions(tiles: readonly StudioTileModel[]): PickOption[] {
  return tiles.map((t) => tileOption(t, true));
}

/** The eleven tools as ONE dropdown (Studio › Look's lower third), each with its line and ✓ / Missing. */
export function StudioToolMenu({
  tiles,
  value,
  onOpen,
  dataAttr,
  className = '!min-h-11 shrink-0 ring-1 ring-ink/10',
}: {
  tiles: readonly StudioTileModel[];
  value: StudioTileKey;
  onOpen: (key: StudioTileKey) => void;
  dataAttr: string;
  className?: string;
}) {
  return (
    <PickMenu
      label="Studio tool"
      dataAttr={dataAttr}
      value={value}
      buttonText={tiles.find((t) => t.key === value)?.short ?? 'Studio'}
      options={tiles.map((t) => tileOption(t, false))}
      onPick={(k) => onOpen(k as StudioTileKey)}
      className={className}
    />
  );
}

/**
 * ✓ DONE — the way out of the two Studio pages that take the whole screen (Wedding March, Seat plan: the top nav is
 * hidden there, owner 2026-10-06 "yes for those 2"). It is ALL that is left of the slim row that sat under the top
 * bar: the row's "INFO ▾" pill is gone from every Studio page (owner 2026-10-08, *"we will not have these."*) — the
 * way to another page is "Studio ▾" in the top nav. On these two pages there is no top nav to hold it, so ✓ Done
 * stays, on the same band, and returns to the Studio home.
 */
export function StudioDoneBar({ onDone }: { onDone: () => void }) {
  return (
    <div data-maker-studio-done-bar="" className={`${STUDIO_HEAD_ROW} justify-end`}>
      <button type="button" data-maker-studio-done="" onClick={onDone} className={STUDIO_DONE_BUTTON}>
        <Check aria-hidden className="h-[15px] w-[15px]" strokeWidth={2.6} />
        Done
      </button>
    </div>
  );
}

/** Studio's home over the work area — its tiles, or a read that failed, SAID. */
export function StudioCover({ tiles, onOpen }: { tiles: readonly StudioTileModel[] | null; onOpen: (key: StudioTileKey) => void }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-cream" data-maker-studio-layer="">
      {tiles ? (
        <StudioHome tiles={tiles} onOpen={onOpen} />
      ) : (
        <p role="alert" className="m-auto max-w-sm px-4 text-center text-sm text-terracotta-700">
          Studio could not be loaded just now. Nothing was changed — please reopen this in a moment.
        </p>
      )}
    </div>
  );
}

/**
 * ▁ THE ONE BOTTOM SHEET — every pop-up of the new Maker on a phone (owner 2026-10-06: every pop-up
 * opens from the bottom; prototype `#pmenu .menu`): the stage ▾, Studio's Tool ▾ and every `PickMenu`
 * inside the Maker (`PickSheetContext`, handed down by the shell while the new Maker is on) — full
 * width at the foot of the screen, a grabber, its name in small capitals, rows that scroll inside it
 * (never past 62% of the screen). Fixed to the screen, so the shell portals it to <body> (inside a
 * glass panel a `fixed` box is held by the panel's backdrop filter). Phone only; a desktop keeps each
 * list where it opens.
 *
 * 🌑 THE POP-UP RULE (owner 2026-10-08, `INTERACTION_RULES.md` § 9: *"the rest of the screen darkens
 * (except for when there is preview) … The darkened area will be blurred and nothing behind it will
 * work. pressing on the dark part removes the pop up. the background will not be scrollable"*):
 *   · DARK AND BLURRED behind — one class, `.sn-popup-dark` (dark alone where blur is not supported, or
 *     the device asks for less transparency);
 *   · NOTHING BEHIND WORKS — every branch of the page but this one is `inert` (`inertBehind`); the page
 *     behind does not scroll, Escape closes and Tab stays inside (the app's one contract, `useModalA11y`);
 *   · A TAP OUTSIDE CLOSES — one button under the dark, the whole screen;
 *   · A LIVE PREVIEW STAYS CLEAR — where one is on screen (`[data-popup-clear]`, Studio › Look's sample)
 *     the dark is cut around it, so a pick in the sheet is seen at once. Measured at open and on a
 *     resize; never polled.
 */
export function MakerSheet({
  label,
  onClose,
  children,
  everyWidth = false,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  /** Shown on a desktop too — the Maker's ✕ sheet, which every width needs (`maker-exit-sheet.tsx`). Every other
   *  sheet stays a phone's: a desktop keeps each list where it opens. */
  everyWidth?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  /** What had the focus (the ▾ that opened this) — it goes back there when the sheet leaves. */
  const from = useRef<HTMLElement | null>(null);
  /** The dark layer's shape with the live preview cut out — null: there is none, the layer is whole. */
  const [hole, setHole] = useState<string | null>(null);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    from.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    /* The preview is measured BEFORE the page is put out of reach (an inert branch answers no hit test) — and, on a
       resize, with the page woken for the length of the measure. */
    const measure = () => setHole(popupHolePath(popupClearRect(document, el), { width: window.innerWidth, height: window.innerHeight }));
    measure();
    let undo = inertBehind(el);
    const again = () => {
      undo();
      measure();
      undo = inertBehind(el);
    };
    window.addEventListener('resize', again);
    return () => {
      window.removeEventListener('resize', again);
      undo();
    };
  }, []);
  /* The app's ONE modal contract (`lib/use-modal-a11y.ts`): Escape closes the sheet on top, Tab stays inside it, the
     page behind does not scroll. The focus comes INTO the sheet — unless its content already took it (a list focuses
     its picked row, and keeps it). */
  const kept = useRef({
    get current(): HTMLElement | null {
      const a = document.activeElement;
      return a instanceof HTMLElement && root.current?.contains(a) ? a : null;
    },
  }).current;
  useModalA11y({ open: true, onClose, containerRef: panel, initialFocusRef: kept });
  /* …and goes BACK to what opened it, once the sheet is gone (declared after the contract, so it runs after it). */
  useEffect(
    () => () => {
      const a = document.activeElement;
      const lost = !a || a === document.body || (a instanceof HTMLElement && a.matches('main, [role="main"]'));
      if (lost && from.current?.isConnected) from.current.focus({ preventScroll: true });
    },
    [],
  );
  return (
    <div ref={root} data-maker-sheet="" className={`fixed inset-0 z-[95]${everyWidth ? '' : ' lg:hidden'}`}>
      {/* A tap anywhere outside the sheet closes it — the dark, and the clear preview too. */}
      <button type="button" aria-label="Close" data-maker-sheet-scrim="" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default touch-none" />
      <span
        aria-hidden
        data-maker-sheet-dark={hole ? 'around-preview' : 'whole'}
        className="sn-popup-dark pointer-events-none absolute inset-0"
        style={hole ? { clipPath: hole } : undefined}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 flex max-h-[62dvh] flex-col rounded-t-3xl bg-white px-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-18px_40px_-18px_rgba(30,26,18,.45)] ring-1 ring-ink/10 focus:outline-none lg:mx-auto lg:max-w-md"
      >
        <span aria-hidden className="mx-auto mb-1.5 mt-1 h-1 w-10 shrink-0 rounded-full bg-ink/15" />
        <p className="shrink-0 px-3 pb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink/55">{label}</p>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  );
}

/**
 * ↕ THE GRAB HANDLE — the new Maker's lower third resizes (owner, live iPhone 2026-10-06: *"Also the
 * lower third screen can be resized up to lower half of the screen. Drag the edge to resize"*). Drag
 * its top edge between the default height and half the screen (`makerLtClampPx`); a tap toggles
 * default ↔ half (`makerLtTapPx`); the size is remembered on this device as a share of the screen
 * (a convenience — lost, it opens at the default, `makerLtStoredPx`). Arrow keys step it.
 */
export function LowerThirdGrab({ px, onPx }: { px: number | null; onPx: (px: number | null) => void }) {
  const from = useRef<{ y: number; h: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const self = useRef<HTMLButtonElement>(null);
  /* The size this device remembers, put back once. */
  useEffect(() => {
    try {
      const kept = makerLtStoredPx(window.localStorage.getItem(MAKER_LT_SIZE_KEY), window.innerHeight);
      if (kept !== null) onPx(kept);
    } catch {
      /* private mode / blocked storage: the default height */
    }
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const vh = () => window.innerHeight;
  const now = () => px ?? self.current?.closest('[data-maker-lower-third]')?.getBoundingClientRect().height ?? null;
  const keep = (next: number) => {
    onPx(next);
    try {
      window.localStorage.setItem(MAKER_LT_SIZE_KEY, String(next / vh()));
    } catch {
      /* private mode / blocked storage: the size simply is not remembered */
    }
  };
  return (
    <button
      ref={self}
      type="button"
      aria-label="Resize the tools — drag, or tap for half the screen"
      data-lt-grab=""
      onPointerDown={(e) => {
        const h = now();
        if (h === null) return;
        from.current = { y: e.clientY, h };
        setDragging(true);
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        const f = from.current;
        if (f && Math.abs(e.clientY - f.y) >= MAKER_LT_TAP_PX) onPx(makerLtClampPx(f.h + (f.y - e.clientY), vh()));
      }}
      onPointerUp={(e) => {
        const f = from.current;
        from.current = null;
        setDragging(false);
        if (!f) return;
        keep(Math.abs(e.clientY - f.y) < MAKER_LT_TAP_PX ? makerLtTapPx(px, vh()) : makerLtClampPx(f.h + (f.y - e.clientY), vh()));
      }}
      onPointerCancel={() => {
        from.current = null;
        setDragging(false);
      }}
      onKeyDown={(e) => {
        const h = now();
        if (h === null || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
        e.preventDefault();
        keep(makerLtClampPx(h + (e.key === 'ArrowUp' ? 40 : -40), vh()));
      }}
      onClick={(e) => {
        // A keyboard press (no pointer): default ⇄ half.
        if (e.detail === 0) keep(makerLtTapPx(px, vh()));
      }}
      className="flex h-6 w-full shrink-0 touch-none items-center justify-center"
    >
      <span aria-hidden className={`h-[5px] rounded-full transition-[width,background-color] duration-150 ${dragging ? 'w-14 bg-gild' : 'w-11 bg-ink/20'}`} />
    </button>
  );
}

/**
 * 🎯 THE STYLE BAR'S JUMP, AND THE WAY BACK (owner 2026-10-07: *"opens to the exact place where to edit it"* · *"if we
 * did a jump, we need a way to apply and return to where we were editing"*). Mounted by the shell only while a Studio
 * tool is open FROM a part (`from`): the field is brought into view and focused once the editor has drawn it, and
 * "✓ Done · back to <part>" sits in the thumb's reach, just above the editor. Lazy: it exists only after a jump.
 */
export function StudioBackToPart({
  from,
  side,
  at,
  full,
  onBack,
}: {
  from: { label: string; focus: string | null };
  side: MakerSide;
  /** The Studio tool on screen — the field is looked for again when it changes. */
  at: unknown;
  /** The tool is drawn full screen (the button shows only then). */
  full: boolean;
  onBack: () => void;
}) {
  const focusSel = from.focus;
  useEffect(() => {
    if (!focusSel || side !== 'studio') return;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      const el = document.querySelector<HTMLElement>(`[data-maker-shell] :is(${focusSel})`);
      /* A field inside a folded row (Studio › Info's "Event name · …") asks that row to open first. */
      if (el && el.offsetParent === null) el.closest('[data-studio-event-name]')?.setAttribute('data-focus-pending', '');
      if (el && el.offsetParent !== null) {
        window.clearInterval(id);
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.focus({ preventScroll: true });
      } else if (n > 40) window.clearInterval(id);
    }, 100);
    return () => window.clearInterval(id);
  }, [focusSel, side, at]);
  const [hasFoot, setHasFoot] = useState(false);
  useEffect(() => {
    const look = () => setHasFoot(Boolean(document.querySelector('[data-maker-shell] :is([data-studio-day], [data-moment-order-cards])')));
    look();
    const id = window.setInterval(look, 500);
    return () => window.clearInterval(id);
  }, [from, at]);
  if (!full) return null;
  return (
    <button
      type="button"
      data-maker-studio-back=""
      onClick={onBack}
      /* Above an editor's own pinned foot (the Schedule's / Love Story's "Add a moment", ~64 px). */
      style={{ bottom: `calc(var(--maker-lt-h) + env(safe-area-inset-bottom) + ${hasFoot ? 76 : 8}px)` }}
      className="sn-press absolute left-1/2 z-[45] inline-flex h-11 -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-success-600 px-5 text-[14px] font-bold text-cream shadow-[0_10px_24px_-12px_rgba(0,0,0,.5)] hover:bg-success-700 lg:hidden"
    >
      <Check aria-hidden className="h-4 w-4" strokeWidth={2.6} />
      Done · back to {from.label}
    </button>
  );
}
