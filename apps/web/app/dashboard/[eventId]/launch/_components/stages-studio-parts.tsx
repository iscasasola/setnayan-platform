'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { createPortal } from 'react-dom';
import { inertBehind, popupClearRect, popupHolePath } from '@/lib/popup-behind';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { MAKER_LT_SIZE_KEY, MAKER_LT_TAP_PX, makerLtClampPx, makerLtStoredPx, makerLtTapPx } from '@/lib/maker-lt-size';
import { MAKER_STAGE_KEYS, type MakerStageKey } from '@/lib/maker-parts';
import { MAKER_SIDE_LABEL, makerStageLabel, type MakerSide } from './maker-bar';
import { StageItemMenu, type StagePageOption } from './stage-item-menu';
import { GuestsSeeSheet } from './guests-see-sheet';
import { MAKER_OPEN_GUESTS_SEE_EVENT, useMaker } from './maker-context';
import { MakerDesk } from './maker-desk';
import { riseEditorIn, riseEditorOut } from '@/lib/maker-editor-rise';

/**
 * 🖨 THE PRINTS PAGE'S DESKTOP (R8, 2026-10-27): the Prints page draws no stage pill — the one thing that mounts the
 * Maker's desktop columns (`MakerDesk`, below in `StageSwitch`). So it mounts them HERE, on the same terms (the one
 * Maker, a desktop width). Lazy, as the pill is.
 */
export function PrintsPageDesk() {
  const wide = useIsDesktop('lg');
  return useMaker()?.stagesStudio === true && wide ? <MakerDesk /> : null;
}
import { useIsDesktop } from '@/lib/use-responsive';

/**
 * 🧭 THE MAKER'S OWN CHROME (owner 2026-10-06; the Studio half retired 2026-11-10 — Build 6 Lane F). Every piece of
 * chrome only the new Maker draws lives HERE, loaded through `details-lazy.tsx`
 * (the `maker-details` chunk, warmed at idle) — so the shipped Maker's first
 * load carries none of it (`scripts/check-maker-js-budget.mjs`). The shell
 * keeps the state; these only draw it. 🔒 Nothing here writes to the event.
 */

/**
 * 🧭 THE STAGE PILL — the Maker bar's ONE selector (Build 6 Lane F, owner 2026-11-10: *"Studio technically is gone
 * since the pages there will be inside the different scenes it covers"*; DECISION_LOG 2026-11-10 "EVENT HUB = PURELY
 * STAGES, BUILT FOR SPEED"; prototype `prototypes/event_hub_stages_scenes_2026-11-10/` frames M1 and M2–M8).
 *
 *   on a stage                ● Invitation ▾  · ↺ · ✓ · ⚙        the five stages' one list (`StageItemMenu`'s sheet)
 *   a scene's editor risen    ✕  Dress code   · ↺ · ✓            ✕ reverses into the scene it rose from
 *
 * The Studio half, its list of pages, its home of cards and its "n of N ready" are gone: each page is the editor of the
 * scene it covers (a tap on the scene rises it — `makerPartRisesEditor`), Prints and Look are rows of the ⚙.
 * Held by `lib/no-door-leads-to-the-removed-studio.test.ts`.
 */
/** The stage on screen, when the shell's pick is one of the five (it is, on a stage). */
function stageOf(pick: string | undefined): MakerStageKey | null {
  return pick !== undefined && (MAKER_STAGE_KEYS as readonly string[]).includes(pick) ? (pick as MakerStageKey) : null;
}

export function stagePillLabel(name: string | null): string {
  return name ? `Stage: ${name} — choose a stage` : 'Stages — choose a stage';
}

export function StageSwitch({
  side,
  stage,
  options = [],
  onStage,
  editor = null,
  onClose,
}: {
  side: MakerSide;
  /** The shell's pick: on a stage, the stage on screen. */
  stage?: string;
  /** Every stage's pages, as the shell's Page ▾ lists them — what the list of stages counts and opens. */
  options?: readonly StagePageOption[];
  /** A stage's page picked — the shell's own Page ▾ door (`pickPage`). */
  onStage?: (key: string) => void;
  /** The editor risen over its scene (which, the name it says in the bar, whether it is full screen) — null on a stage. */
  editor?: { key: string; label: string; full: boolean } | null;
  /** ✕ — back to the scene the editor rose from (called once the reverse has played). */
  onClose?: () => void;
}) {
  /* ⤴ A full-screen editor rises from the scene it was opened on, 0.7 s (`--sn-pill-dur`); ✕ plays the exact reverse,
     then closes (`lib/maker-editor-rise.ts`). */
  const risen = editor?.full ? editor.key : null;
  useEffect(() => {
    if (risen) riseEditorIn();
  }, [risen]);
  const close = () => {
    if (editor?.full) void riseEditorOut().then(() => onClose?.());
    else onClose?.();
  };
  const [list, setList] = useState(false);
  /* 🗂 "What guests see" (owner 2026-10-10) — a sheet, opened from the Hub's ⚙ Event Hub settings with an event; this
     pill — always mounted — draws it. */
  const [guestsSee, setGuestsSee] = useState(false);
  useEffect(() => {
    const open = () => setGuestsSee(true);
    window.addEventListener(MAKER_OPEN_GUESTS_SEE_EVENT, open);
    return () => window.removeEventListener(MAKER_OPEN_GUESTS_SEE_EVENT, open);
  }, []);
  const onStages = side === 'stages';
  const stageKey = stageOf(stage);
  const name = stageKey ? makerStageLabel(stageKey as never) : null;
  /* 🖥 A desktop's three columns (`maker-desk.tsx`) — mounted by this pill, which every width of the Maker draws and
     which is lazy: so the desk layout costs the Maker's first load nothing and never reaches a phone. */
  const wide = useIsDesktop('lg');
  const desk = useMaker()?.stagesStudio === true && wide;
  return (
    <>
      {desk ? <MakerDesk /> : null}
      {onStages || !editor ? (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={list}
          aria-label={stagePillLabel(name)}
          data-stage-pill=""
          onClick={() => setList((l) => !l)}
          /* The prototype's one picked half (frame M1): the accent pill, its ink, a dot of the same ink before the name. */
          className="sn-press inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-sn-accent px-3 text-[14px] font-semibold text-sn-on-accent"
        >
          <span aria-hidden data-stage-pill-dot="" className="h-[7px] w-[7px] shrink-0 rounded-full bg-sn-on-accent" />
          <span className="min-w-0 truncate">{name ?? MAKER_SIDE_LABEL.stages}</span>
          <ChevronDown aria-hidden className={`h-3 w-3 shrink-0 transition-transform duration-sn-elem motion-reduce:transition-none ${list ? 'rotate-180' : ''}`} strokeWidth={2.4} />
        </button>
      ) : (
        <span data-stage-editor-head="" className="flex min-w-0 flex-1 items-center gap-2">
          <ActionButton tone="neutral" iconOnly icon={X} label={`Close ${editor.label}`} onClick={close} data-stage-editor-close="" className="shrink-0" />
          <h1 data-stage-editor-title="" className="min-w-0 truncate text-[16px] font-semibold text-ink">
            {editor.label}
          </h1>
        </span>
      )}
      {/* THE FIVE STAGES — the Stages panel's own list and sheet, with no button of its own here. */}
      <StageItemMenu
        bar={{ open: list, onClose: () => setList(false), here: onStages }}
        options={options}
        stage={stageKey ?? MAKER_STAGE_KEYS[0]!}
        page={null}
        rsvpScreen="form"
        onPick={(key) => onStage?.(key)}
        onRsvpScreen={() => {}}
      />
      {guestsSee && typeof document !== 'undefined' ? createPortal(<GuestsSeeSheet onClose={() => setGuestsSee(false)} />, document.body) : null}
    </>
  );
}

/**
 * ▁ THE ONE BOTTOM SHEET — every pop-up of the new Maker on a phone (owner 2026-10-06: every pop-up
 * opens from the bottom; prototype `#pmenu .menu`): the stage ▾ and every `PickMenu`
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
 *   · A LIVE PREVIEW STAYS CLEAR — where one is on screen (`[data-popup-clear]`, Look's sample)
 *     the dark is cut around it, so a pick in the sheet is seen at once. Measured at open and on a
 *     resize; never polled.
 */
export function MakerSheet({
  label,
  onClose,
  children,
  everyWidth = false,
  tall = false,
  aside = null,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  /** A quiet state at the heading's right. */
  aside?: ReactNode;
  /** A whole table, not a short list ("What guests see"): the sheet takes nearly the full height. */
  tall?: boolean;
  /** Shown on a desktop too — for a sheet every width needs ("What guests see"). Every other sheet stays a
   *  phone's: a desktop keeps each list where it opens. */
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
      {/* A tap anywhere outside the sheet closes it — the dark, and the clear preview too. The dark stays its own layer
          here (it carries the hole cut round the preview; the button must not), so the button wears
          `data-overlay-backdrop` — the mark the page lock (`isolateOverlay`) keeps live. Without it the button went
          `inert` and a tap outside closed nothing (owner, 2026-10-25: "I cannot tap out the screen"). */}
      <button type="button" aria-label="Close" data-overlay-backdrop="" data-maker-sheet-scrim="" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default touch-none" />
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
        className={`absolute inset-x-0 bottom-0 flex ${tall ? 'h-[92dvh]' : 'max-h-[62dvh]'} flex-col rounded-t-3xl bg-white px-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-1 shadow-sn-md ring-1 ring-ink/10 focus:outline-none lg:mx-auto lg:max-w-md`}
      >
        <span aria-hidden className="mx-auto mb-1.5 mt-1 h-1 w-10 shrink-0 rounded-full bg-ink/15" />
        <p className="flex shrink-0 items-baseline gap-2 px-3 pb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink/70">
          {label}
          {aside ? <span className="ml-auto" data-maker-sheet-aside="">{aside}</span> : null}
        </p>
        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain${tall ? ' bg-inherit' : ''}`}>{children}</div>
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
      <span aria-hidden className={`h-[5px] rounded-full transition-[width,background-color] duration-sn-micro ${dragging ? 'w-14 bg-gild' : 'w-11 bg-ink/20'}`} />
    </button>
  );
}

/**
 * 🎯 THE FIELD A RISEN EDITOR OPENS ON (owner 2026-10-07: *"opens to the exact place where to edit it"*). Mounted by the
 * shell only while an editor is open FROM a scene (`from`): the field is brought into view and focused once the editor
 * has drawn it. The way back is the bar's ✕ (Build 6 Lane F — it replaced "✓ Done · back to <part>"). Lazy: it exists
 * only after a scene was tapped.
 */
export function EditorFieldFocus({
  focus,
  at,
}: {
  /** The field's selector — null: the editor opens at its top. */
  focus: string | null;
  /** The editor on screen — the field is looked for again when it changes. */
  at: unknown;
}) {
  useEffect(() => {
    if (!focus) return;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      const el = document.querySelector<HTMLElement>(`[data-maker-shell] :is(${focus})`);
      /* A field inside a folded row (Info's "Event name · …") asks that row to open first. */
      if (el && el.offsetParent === null) el.closest('[data-studio-event-name]')?.setAttribute('data-focus-pending', '');
      if (el && el.offsetParent !== null) {
        window.clearInterval(id);
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.focus({ preventScroll: true });
      } else if (n > 40) window.clearInterval(id);
    }, 100);
    return () => window.clearInterval(id);
  }, [focus, at]);
  return null;
}
