'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import { inertBehind, popupClearRect, popupHolePath } from '@/lib/popup-behind';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { ISegmented, iSegClass } from '../../website/editor/_components/inspector-kit';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import type { PickOption } from '../../website/editor/_components/pick-menu-types';
import { MAKER_LT_SIZE_KEY, MAKER_LT_TAP_PX, makerLtClampPx, makerLtStoredPx, makerLtTapPx } from '@/lib/maker-lt-size';
import type { StudioTileKey, StudioTileModel } from '@/lib/studio-tiles';
import { MAKER_STAGE_KEYS, type MakerStageKey } from '@/lib/maker-parts';
import { MAKER_SIDE_LABEL, makerStageLabel, type MakerSide } from './maker-bar';
import { StageItemMenu, type StagePageOption } from './stage-item-menu';
import { GuestsSeeSheet } from './guests-see-sheet';
import { MAKER_OPEN_GUESTS_SEE_EVENT, useMaker } from './maker-context';
import { MakerDesk } from './maker-desk';
import { useChromeAway } from '@/app/_components/nav/use-chrome-away';

/**
 * 🖨 THE PRINTS PAGE'S DESKTOP (R8, 2026-10-27): the Prints page draws no stage pill — the one thing that mounts
 * the Maker's desktop columns (`MakerDesk`, below in `MakerStageSwitch`). So it mounts them HERE, on the same terms (the one
 * Maker, a desktop width): Studio › Prints on a desktop looked like this, and the Prints page must too. Lazy, as the switch is.
 */
export function PrintsPageDesk() {
  const wide = useIsDesktop('lg');
  return useMaker()?.stagesStudio === true && wide ? <MakerDesk /> : null;
}
import { useIsDesktop } from '@/lib/use-responsive';

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
 * What the pill writes, in the order it tries them until its words fit: its name → the same, tighter → (a page with
 * one) its short name → the same, tighter → the plain word. Never a cut name, never two lines. A stage has no short
 * name; the plain word is the last resort of a screen narrower than any phone the bar is drawn for.
 */
export type StudioHalfStep = { words: string; tight: boolean };
export function studioHalfSteps(name: string, short: string | undefined, word: string): readonly StudioHalfStep[] {
  const said: string[] = [];
  for (const w of [name, short, word]) if (w && !said.includes(w)) said.push(w);
  /* The plain word is as short as a half gets: it is written once, at its own size. */
  return said.flatMap((words) => (words === word ? [{ words, tight: false }] : [{ words, tight: false }, { words, tight: true }]));
}

/**
 * The pill's accessible name: where you are, and what a tap does. Inside an editor a scene opened (the Logo Maker from
 * the ring, a Look section from the ⚙) the pill names that editor, and a tap is still the list of stages — the way back.
 */
export function stagePillLabel(kind: 'stage' | 'page', name: string | null): string {
  if (kind === 'stage') return name ? `Stage: ${name} — choose a stage` : 'Stages — choose a stage';
  return name ? `${name} — choose a stage to go back` : 'Stages — choose a stage';
}

/** The stage on screen, when the shell's pick is one of the five (it is, on the Stages side). */
function stageOf(pick: string | undefined): MakerStageKey | null {
  return pick !== undefined && (MAKER_STAGE_KEYS as readonly string[]).includes(pick) ? (pick as MakerStageKey) : null;
}

/**
 * ● INVITATION ▾ — THE MAKER'S ONE SELECTOR (Build 6 Lane F, owner 2026-11-10: *"Studio technically is gone since the
 * pages there will be inside the different scenes it covers"*; frame 8 pick B — the Studio half of the switch goes and
 * the bar's selector is the stage picker alone; approved prototype `event_hub_stages_scenes_2026-11-10` M1).
 *
 *   on a stage                 [ ● Invitation ▾ ]      (● only while that stage is the one guests meet — Page ▾'s dot)
 *   in an editor a scene opened [ Logo ▾ ]              (a tap is the list of stages: the way back to the page)
 *
 *   · ONE TRACK, ONE THUMB — the segment's own look (`ISegmented` / `iSegClass`), filling its place edge to edge; the
 *     name never truncates and never wraps: it tightens, then (an editor) writes its short name (`studioHalfSteps`).
 *   · A TAP OPENS THE LIST OF STAGES (`StageItemMenu`'s own sheet). A pick there goes to that stage — from an editor too.
 *   · NO STUDIO ▾: Logo is the cover's ring, Palette + Dress Code the Dress code scene, Love Story its scene; Look ·
 *     the address · QR · who can view · E-Gifts · Prints are the ⚙'s (`hub-settings.tsx`). Nothing is orphaned.
 *   🔒 `lib/studio-is-gone-from-the-maker-bar.test.ts`.
 */
export function MakerStageSwitch({
  side,
  onPick,
  stage,
  live = false,
  options = [],
  onStage,
  page = null,
}: {
  side: MakerSide;
  /** Change side — the shell's `pickSide`. Called with `stages` when a stage is picked from inside an editor. */
  onPick: (side: MakerSide) => void;
  /** The shell's pick: on the Stages side, the stage on screen. */
  stage?: string;
  /** The stage on screen is the one guests meet today — the pill wears Page ▾'s dot. */
  live?: boolean;
  /** Every stage's pages, as the shell's Page ▾ lists them — what the list of stages counts and opens. */
  options?: readonly StagePageOption[];
  /** A stage's page picked — the shell's own Page ▾ door (`pickPage`). */
  onStage?: (key: string) => void;
  /** The editor a scene (or the ⚙) opened — null on a stage. */
  page?: StudioTileModel | null;
}) {
  const [list, setList] = useState(false);
  /* 🗂 "What guests see" (owner 2026-10-10) — a sheet, never a page. Its row is in the Hub's ⚙ Event Hub settings (owner
     2026-10-30); the ⚙ asks for it with an event, and this pill — always mounted — draws it. */
  const [guestsSee, setGuestsSee] = useState(false);
  useEffect(() => {
    const open = () => setGuestsSee(true);
    window.addEventListener(MAKER_OPEN_GUESTS_SEE_EVENT, open);
    return () => window.removeEventListener(MAKER_OPEN_GUESTS_SEE_EVENT, open);
  }, []);
  const onStages = side === 'stages';
  const stageKey = stageOf(stage);
  const here = !onStages && page ? page : null;
  /* 🖥 A desktop's three columns (`maker-desk.tsx`) — mounted by this pill, which every width of the Maker draws and
     which is lazy: so the desk layout costs the Maker's first load nothing and never reaches a phone. */
  const wide = useIsDesktop('lg');
  const desk = useMaker()?.stagesStudio === true && wide;
  return (
    <>
      {desk ? <MakerDesk /> : null}
      <ISegmented label="Stage">
        <StudioHalf
          kind={here ? 'page' : 'stage'}
          name={here ? here.label : onStages && stageKey ? makerStageLabel(stageKey as never) : null}
          short={here?.short}
          dot={!here && live}
          expanded={list}
          onPress={() => setList((l) => !l)}
        />
      </ISegmented>
      {/* THE STAGES — the Stages panel's own list and sheet, with no button of its own here. */}
      <StageItemMenu
        bar={{ open: list, onClose: () => setList(false), here: onStages }}
        options={options}
        /* From an editor no stage is on screen: every row is then a pick that goes through `onPick` below. */
        stage={onStages && stageKey ? stageKey : MAKER_STAGE_KEYS[0]!}
        page={null}
        rsvpScreen="form"
        onPick={(key) => {
          /* A pick from inside an editor goes back to the stages, at that stage. */
          if (!onStages) onPick('stages');
          onStage?.(key);
        }}
        onRsvpScreen={() => {}}
      />
      {guestsSee && typeof document !== 'undefined' ? createPortal(<GuestsSeeSheet onClose={() => setGuestsSee(false)} />, document.body) : null}
    </>
  );
}

/**
 * 🫥 AN EDITOR A SCENE OPENED IS FULL SCREEN — THE APP'S BARS STEP AWAY (Build 6 Lane F; owner 2026-11-09: *"full screen
 * always loses the bottom nav"*). Mounted by the shell only while an editor covers the page on a phone (never on the Prints
 * page, whose way out is the app's own nav): the shipped `useChromeAway` slides the top bar up and the bottom nav down
 * (0.32 s, the exact reverse on the way back), and the shell's measured room (`useTheAppsRoom`) follows them to the screen's
 * edges. Lazy, so the Maker's first load carries none of it. 🔒 `lib/studio-is-gone-from-the-maker-bar.test.ts`.
 */
export function EditorChromeAway() {
  useChromeAway(true);
  return null;
}

/**
 * The pill's room: it fills its place (the segment's own `flex-1`, and `min-w-0` so words never widen it), with 3 px each
 * side of words · ▾. When the name needs more room it tightens: 2 px each side, and the words half a pixel smaller.
 */
const HALF_ROOM =
  'min-w-0 !gap-0.5 !px-[3px] group-has-[[data-studio-half-tight]]/seg:!px-0.5 group-has-[[data-studio-half-tight]]/seg:!text-[12px]';

/**
 * THE PILL — the segment's own look, always the picked one (`iSegClass(true)`: the accent and its ink, the thumb's
 * cue), its words, and ▾ in the same ink. It measures its words before paint and steps down (`studioHalfSteps`) until
 * they fit; a new name, or a resize, starts from the full name again.
 */
function StudioHalf({
  kind,
  name,
  short,
  dot = false,
  expanded,
  onPress,
}: {
  kind: 'stage' | 'page';
  /** Where you are — null: it reads the plain word. */
  name: string | null;
  short?: string;
  /** ● the stage guests meet today. */
  dot?: boolean;
  expanded: boolean;
  onPress: () => void;
}) {
  const word = MAKER_SIDE_LABEL.stages;
  const steps = studioHalfSteps(name ?? word, name ? short : undefined, word);
  const of = steps[0]!.words;
  const [at, setAt] = useState({ of, step: 0, tried: 0 });
  /* Another name starts from its full name — decided while drawing, so no frame shows the old step. */
  const step = at.of === of ? Math.min(at.step, steps.length - 1) : 0;
  const now = steps[step]!;
  const words = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = words.current;
    if (!el || el.scrollWidth <= el.clientWidth || step >= steps.length - 1) return;
    setAt((a) => ({ of, step: step + 1, tried: a.tried }));
  }, [of, step, steps.length, at.tried]);
  useEffect(() => {
    const again = () => setAt((a) => ({ of: a.of, step: 0, tried: a.tried + 1 }));
    window.addEventListener('resize', again);
    /* …and once the app's own type has arrived (a name measured in the stand-in face is measured again). */
    void document.fonts?.ready.then(again);
    return () => window.removeEventListener('resize', again);
  }, []);
  return (
    <button
      type="button"
      aria-pressed
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-label={stagePillLabel(kind, name)}
      data-seg="stages"
      data-studio-half={kind}
      data-studio-half-tight={now.tight ? '' : undefined}
      onClick={onPress}
      className={`${iSegClass(true)} ${HALF_ROOM}`}
    >
      {dot ? <span aria-hidden data-stage-pill-live="" className="mr-1 inline-block h-[7px] w-[7px] shrink-0 rounded-full bg-current" /> : null}
      <span ref={words} data-studio-half-words="" className="min-w-0 overflow-hidden whitespace-nowrap">
        {now.words}
      </span>
      <ChevronDown aria-hidden className={`h-3 w-3 shrink-0 transition-transform duration-300 motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} strokeWidth={2.4} />
    </button>
  );
}

/** An editor's row in Look's tool ▾: its line, and ✓ Ready / Missing as its card says it. */
function tileOption(t: StudioTileModel): PickOption {
  return {
    key: t.key,
    label: t.label,
    hint: t.status,
    ...(t.done === true ? { trail: { text: '✓', tone: 'ok' as const, label: 'Ready' } } : t.done === false ? { trail: { text: 'Missing', tone: 'left' as const } } : {}),
  };
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
      options={tiles.map((t) => tileOption(t))}
      onPick={(k) => onOpen(k as StudioTileKey)}
      className={className}
    />
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
  tall = false,
  aside = null,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  /** A quiet state at the heading's right — Studio ▾'s "n of N ready" (LOCKED 2026-10-09 decision 6). */
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
        className={`absolute inset-x-0 bottom-0 flex ${tall ? 'h-[92dvh]' : 'max-h-[62dvh]'} flex-col rounded-t-3xl bg-white px-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-18px_40px_-18px_rgba(30,26,18,.45)] ring-1 ring-ink/10 focus:outline-none lg:mx-auto lg:max-w-md`}
      >
        <span aria-hidden className="mx-auto mb-1.5 mt-1 h-1 w-10 shrink-0 rounded-full bg-ink/15" />
        <p className="flex shrink-0 items-baseline gap-2 px-3 pb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink/55">
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
      style={{ bottom: `calc(var(--maker-lt-h) + var(--maker-safe-b, env(safe-area-inset-bottom)) + ${hasFoot ? 76 : 8}px)` }}
      className="sn-press absolute left-1/2 z-[45] inline-flex h-11 -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-success-600 px-5 text-[14px] font-bold text-cream shadow-[0_10px_24px_-12px_rgba(0,0,0,.5)] hover:bg-success-700 lg:hidden"
    >
      <Check aria-hidden className="h-4 w-4" strokeWidth={2.6} />
      Done · back to {from.label}
    </button>
  );
}
