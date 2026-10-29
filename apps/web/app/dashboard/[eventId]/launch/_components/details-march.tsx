'use client';

import { GuestNick } from '@/app/_components/guest-nick';
import {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { reportCrash } from '@/lib/telemetry/report-crash';
import { isMarchOnlyGroup, isOwnMarchGroup } from '@/lib/entourage';
import {
  acrossTheAisle,
  keyTarget,
  leadOf,
  newOwnGroupKey,
  newOwnGroupLabel,
  planGroupAdd,
  planGroupName,
  planMove,
  planSectionOut,
  planSectionsDefault,
  readSource,
  sectionsMoved,
  readTarget,
  releaseIs,
  TAP_SLOP_MOUSE,
  TAP_SLOP_TOUCH,
  type MarchMove,
  type MarchOut,
  type MarchSection,
  type MarchSource,
} from '@/lib/march-drag';
import type { MarchResult } from '@/lib/march-result';
import type { HubDraftPatch } from '@/lib/hub-draft';
import { ChevronsDownUp, ChevronsUpDown, Play, RotateCcw } from 'lucide-react';
import { useGuestsLens } from '../../guests/_components/guests-lens';
import { guestsFilterMenu } from '../../guests/_components/guests-filter-menu';
import { SEARCH_WAIT_MS } from '@/lib/guest-roster-view';
import { ActionButton } from '@/components/action-button';
import { PeekToast } from '@/app/_components/toast/peek-toast';
import { plainRefusal } from '../../guests/_components/plain-refusal';
import { formatCount } from '@/lib/format-number';
import { MarchTray } from './details-march-tray';
/* 🗂 R4: the Guests summary row loads with Guests › March only — never with the Maker's march (`view-summary-lazy.tsx`). */
import { ViewCountRow } from './view-summary-lazy';
import { GuestCardSheet, SHIPPED_GUEST_CARD, type GuestCardPerson } from '../../guests/_components/guest-card-sheet';
import type { GuestCardResult } from '../../guests/_components/guest-card';

/**
 * THE WEDDING MARCH MAKER — drag the names (owner 2026-10-06, DECISION_LOG "THE
 * WEDDING MARCH ITEM IS A DRAG-AND-DROP MARCH MAKER — NOT A LIST OF NAMES";
 * prototype `prototypes/wedding_march_drag_maker_2026-10-06_fable.html`).
 *
 *   *"i don't need this to expand the names"* → the navigator shows ONE item;
 *   the lines are no longer its pieces. *"no need to the toolbar. we can just
 *   drag the names"* → no buttons, no ↑↓: every edit is a drag.
 *   *"the 2 columns that can drag names on both sides"* → two columns, the
 *   left and the right of the aisle; each walk one numbered row.
 *
 * What each drop means, and which SHIPPED action carries it, is
 * `lib/march-drag.ts` (pure, tested gesture by gesture). This file only lifts,
 * hit-tests, draws the drop at once, and DRAFTS the drop's steps through
 * `makerSave` — one refresh per burst. A draft save that does not land puts
 * the march back as the draft has it and says why.
 *
 * 📱 Touch: a long-press (~250 ms) lifts a name, so a plain swipe still
 * scrolls; the list auto-scrolls near its edges. Desktop: a 4 px drag lifts.
 * ⌨ Keyboard (no buttons are drawn for it): Space picks a name or a walk's
 * number up, Space on a name or an empty spot puts it there, ↑ / ↓ move it one
 * walk, Escape puts it back — every outcome said in a polite live region.
 *
 * ⚖ Pairs are NOT couples ("A WALK AND A COUPLE ARE INDEPENDENT"): nothing here
 * says one. The word is "walk alone", never "solo".
 *
 * ⏳ IT WAITS FOR APPLY (owner 2026-10-06, *"Wait for apply"* — reversing the
 * 2026-10-05 "keep instant"): a drop is a hub-draft `save` carrying the drop's
 * steps (`march`, added after the ones already drafted — `lib/march-draft.ts`).
 * Guests see nothing until ✓ Apply, which replays every drafted step through
 * the shipped march actions (`guests/march-step.ts`). The march drawn here is
 * the live one with the drafted moves laid on (`replayMarch`, in the loader).
 * Opening the march writes nothing. Undo on the toast takes the last drafted
 * move back off (`marchUndo`); the toolbar's ↺ Undo steps the draft back too.
 */

export type MarchSectionData = MarchSection;

/** The words for a step nobody could carry out (a thrown action says nothing a person can act on). */
const DID_NOT_GO = 'That did not go through — nothing was changed.';
// no-card-ok: a NAME you drag (a pressable chip), not a container — its edge is what the finger picks up.
const NAME_CHIP = 'flex min-h-11 cursor-grab touch-pan-y select-none flex-col justify-center rounded-lg border px-2.5 py-1.5 transition-[box-shadow,opacity] duration-150 [-webkit-touch-callout:none]'; // no-card-ok: a draggable name chip
const LAB_SAVED: MarchResult = { ok: true, written: 1 };
/** The lab's save: it lands — or, with `?refuse=1`, throws with the database's own words, so the toast can be seen saying its own sentence instead. */
const labStep = (): Promise<MarchResult> =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('refuse') === '1'
    ? Promise.reject(new Error('relation "events" does not exist'))
    : Promise.resolve(LAB_SAVED);
/* Stable empties: a fresh `[]` default every render would look like a new march from the server each time. */
const NO_NAMES: readonly string[] = [];
const NO_OUT: readonly MarchOut[] = [];
const LAB_NO_RENDER = () => {};
const LONG_PRESS_MS = 250;
/* Exported, unchanged: the RSVP stage's hold-to-move wears the same feel (`rsvp-canvas-drag.ts`) — one number, two drags. */
export const SETTLE_MS = 240;
export const EDGE_PX = 56;

/**
 * 🪪 A TAP ON A NAME OPENS THEIR GUEST CARD (owner 2026-10-14) — read through the shipped action, loaded at the first tap
 * (opening the march reaches for no server door). The lab hands in its own stand-in (`openCard`).
 */
const openCardShipped = SHIPPED_GUEST_CARD.march;
/** 🪪 A finger's tap is a pointerup and THEN a click, at the same spot. The card opens at the pointerup, so that click
 *  would land on the sheet's scrim and close the card the instant it opened (measured in the lab: dialog 1 → 0 in 15 ms).
 *  The click that belongs to this tap is swallowed — once, and only for half a second. */
function swallowTapClick(): void {
  const eat = (ev: Event) => {
    ev.stopPropagation();
    ev.preventDefault();
    window.removeEventListener('click', eat, true);
  };
  window.addEventListener('click', eat, true);
  setTimeout(() => window.removeEventListener('click', eat, true), 500);
}

/** The thumb row's ＋ ▾ pick that makes a group (never a guest id — those are UUIDs). */
const NEW_GROUP = 'new-group';

/** What one drop puts in the draft: its steps, after the drafted ones — or the last drafted move back off. */
type MarchDraftPatch = Pick<HubDraftPatch, 'march' | 'marchUndo'>;

/**
 * The ONE door to the server from this maker: the Event Hub draft's own save
 * (`hubDraftAction` intent=save). It never touches the march guests see — Apply
 * does, through the shipped march actions.
 */
async function draftStep(eventId: string, patch: MarchDraftPatch): Promise<MarchResult> {
  const fd = new FormData();
  fd.set('intent', 'save');
  fd.set('patch', JSON.stringify(patch));
  /* Loaded at the first drop, not with the march: opening the march draws it and
     reaches for no server door at all (and its render needs no server module). */
  const { hubDraftAction } = await import('../../website/hub-draft-actions');
  const r = await hubDraftAction(eventId, fd);
  /* The refusal is said in the page's own words unless the server wrote a plain sentence for a person (`plainRefusal`) — never database words. */
  return r.ok ? { ok: true, written: 1 } : { ok: false, reason: plainRefusal(r.error, DID_NOT_GO) };
}

type Drag = {
  source: MarchSource;
  key: string;
  ghost: HTMLElement;
  ox: number;
  oy: number;
  x: number;
  y: number;
  scroller: HTMLElement;
  dir: number;
  /** 🪪 The finger left the tap's slop at some point since the press — so a release is a drop, never a tap. */
  wandered: boolean;
};

/** What the maker shows: the walks, the printed sections' saved order (what a header drag steps through), the tray. */
type Shown = { sections: MarchSection[]; printed: string[]; out: MarchOut[] };
type Toast = { said: string; undo: boolean; before: Shown | null; refused?: boolean; /** Which toast this is — a new one restarts the toast's own life. */ id?: number };

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** The scroller's visible top and bottom — clamped to the screen (a tall box may run past it). */
function edgesOf(el: HTMLElement): [number, number] {
  const page = el === document.scrollingElement || el === document.documentElement;
  if (page) return [0, window.innerHeight];
  const r = el.getBoundingClientRect();
  return [Math.max(0, r.top), Math.min(window.innerHeight, r.bottom)];
}

/** The nearest box that scrolls the march — the body column, else the page. */
function scrollerOf(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

type MarchMakerProps = {
  eventId: string;
  sections: readonly MarchSection[];
  /** The printed sections with someone in them, in the saved order (`printedSectionOrder`). */
  printed?: readonly string[];
  /** 🚶 The "Not walking" tray (`marchTray`); null = it could not be read. */
  out?: readonly MarchOut[] | null;
  lab?: boolean;
  /** 🚶 The Event Hub draft could not be read — the drafted moves are unknown, so nothing may be dragged. */
  draftUnread?: boolean;
  /** 🪪 How a tapped name's guest card is read (the dev lab's stand-in); absent = the shipped `openGuestCard`. */
  openCard?: (eventId: string, guestId: string) => Promise<GuestCardResult>;
  /** 🪪 The lab's re-read after a card saved (the Maker's one refresh otherwise). */
  onCardSaved?: () => void;
  /**
   * 🗂 R4 · Guests › March (owner 2026-10-28: *"the label of 20 walks, 34 walking can be like the carousel row of
   * guests"*): the counts are the Guests summary row (`view-summary-cards.tsx`) instead of the one plain line, and the
   * columns use the width they are given (never a centred phone strip on a desk).
   */
  guests?: boolean;
};

/** The one line the march draws when it cannot be shown — with Retry, which draws it again from the server's copy. */
function CouldNotLoad({ onRetry }: { onRetry: () => void }) {
  return (
    <p role="alert" data-march-failed="" className="mx-auto max-w-md text-sm text-ink/70">
      The march couldn’t load —{' '}
      <span data-march-retry="" className="inline-flex align-middle">
        <ActionButton tone="neutral" quiet icon={RotateCcw} label="Retry" onClick={onRetry} />
      </span>
    </p>
  );
}

/**
 * 🧯 THE MARCH FAILS ALONE (controller 2026-10-06, after the owner's Maker went to
 * the root crash card on the march — "Something on our end didn't work"). A
 * throw inside the march draws ONE line in its own place — "The march couldn't
 * load — Retry" — and every other part of the Maker stays where it was. Retry
 * draws the march again from the server's copy (`requestMakerRefresh`). The
 * failure is still recorded (`reportCrash`, boundary "march"), so a quiet
 * fallback never becomes a silent one.
 */
export class MarchBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override componentDidCatch(error: Error): void {
    reportCrash(error, 'march');
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <CouldNotLoad
        onRetry={() => {
          this.setState({ failed: false });
          requestMakerRefresh();
        }}
      />
    );
  }
}

/**
 * The march maker — the Wedding March item's page (Details › Your event).
 * `lab` (the dev Maker lab only): the steps are not sent, so the gestures can be
 * walked on fixture data with no database. Inside its own boundary (`MarchBoundary`).
 */
export function MarchMaker(props: MarchMakerProps) {
  /* 🚶 An unread draft is said, never drawn as a march with no drafted moves:
     a drop planned on it would be laid after moves the couple cannot see. */
  if (props.draftUnread) return <CouldNotLoad onRetry={requestMakerRefresh} />;
  return (
    <MarchBoundary>
      <MarchMakerBody {...props} />
    </MarchBoundary>
  );
}

function MarchMakerBody({
  eventId,
  sections,
  printed = NO_NAMES,
  out = NO_OUT,
  lab = false,
  openCard = openCardShipped,
  onCardSaved,
  guests = false,
}: MarchMakerProps) {
  /* The drop, drawn before the server answers; null = the server's march. */
  const [mine, setMine] = useState<Shown | null>(null);
  const shown = mine?.sections ?? (sections as MarchSection[]);
  const shownPrinted = mine?.printed ?? (printed as string[]);
  const outUnread = out === null;
  const shownOut = useMemo(() => mine?.out ?? ((out ?? []) as MarchOut[]), [mine, out]);
  const anyone = shown.length > 0 || shownOut.length > 0;
  /* 🚶 THE TRAY LIVES IN THE EDITOR'S PLACE (owner 2026-10-06): the phone's lower
     third, the desk's right panel — `MarchTraySlot`, which the march's editor is.
     Drawn there through a portal, so it is still THIS maker: one state, one drag. */
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  /* The slot moves: the guided step's sheet and All items' panel are different
     parents, and a closed sheet drops it. Found again whenever the workspace's
     tree changes — never a portal into a detached node. */
  useEffect(() => {
    const find = () => {
      const el = document.querySelector<HTMLElement>('[data-march-tray-slot]');
      setSlot((was) => (was === el ? was : el));
    };
    find();
    const scope = root.current?.closest('[data-details-workspace]') ?? document.body;
    const mo = new MutationObserver(find);
    mo.observe(scope, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [anyone]);
  const [lifted, setLifted] = useState<string | null>(null);
  const [over, setOver] = useState<{ zone: string; ok: boolean } | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  /* ⌨ What the keyboard is holding, and what it last did (said aloud). */
  const [carried, setCarried] = useState<{ source: MarchSource; key: string; name: string } | null>(null);
  /* ⇅ R4 slice 1 — the Guests lens and the thumb row's own state (drawn below, as `marchThumb`); every hook here, above
     the empty march's early return. */
  const lens = useGuestsLens('march');
  const [folded, setFolded] = useState<ReadonlySet<string>>(() => new Set());
  /* 🏷 R4 slice 5 — the SELECTED walk group (owner 2026-10-29, prototype v13 `marchSel`): a tap on its header selects it,
     opens it and raises the toolbar (Rename · ＋ Walk · Delete); a tap on the SELECTED header folds it AND unselects it. */
  const [marchSel, setMarchSel] = useState<string | null>(null);
  /* 🏷 A group of the couple's own, just made (＋ Group): its toolbar opens with the name box up (prototype v13). */
  const [renameNow, setRenameNow] = useState<string | null>(null);
  const [marchQ, setMarchQ] = useState('');
  const marchQTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (marchQTimer.current) clearTimeout(marchQTimer.current);
  }, []);
  const marchFound = useMemo(() => (lens && marchQ ? lens.find(marchQ) : null), [lens, marchQ]);
  const [heard, setHeard] = useState('');
  /* 🪪 The person whose guest card is open over the march (a tap on their name). */
  const [card, setCard] = useState<GuestCardPerson | null>(null);
  const refocus = useRef<string | null>(null);

  const root = useRef<HTMLElement>(null);
  const chain = useRef<Promise<void>>(Promise.resolve());
  const inFlight = useRef(0);
  const era = useRef(0);
  const flip = useRef<Map<string, DOMRect> | null>(null);
  const landing = useRef<{ ghost: HTMLElement; key: string } | null>(null);

  /* The server's march came back (one refresh per burst): show it — unless
     more of this burst is still on its way. */
  useEffect(() => {
    if (inFlight.current === 0) setMine(null);
  }, [sections, printed, out]);

  /* The toast is the template's (`PeekToast`): it peeks from the top, leaves by itself and tells us (`onGone`); a new one has a new `id`, so it restarts. */
  const toastSeq = useRef(0);
  const say = useCallback((t: Toast | null) => {
    setToast(t ? { ...t, id: ++toastSeq.current } : null);
  }, []);

  /** Where every name and walk stands now — the start of the re-flow animation. */
  const measure = () => {
    const m = new Map<string, DOMRect>();
    root.current?.querySelectorAll<HTMLElement>('[data-march-flip]').forEach((el) => m.set(el.dataset.marchFlip!, el.getBoundingClientRect()));
    return m;
  };

  /**
   * Show `next` NOW, then put the drop in the DRAFT (`patch`) — one save per
   * drop, one after another, so the moves land in the order they were made. A
   * save that does not land ends the burst: what is still queued is dropped and
   * the march goes back to the draft's.
   */
  const commit = useCallback(
    (next: Shown, patch: MarchDraftPatch, said: Toast) => {
      flip.current = measure();
      setMine(next);
      say(said);
      const mineEra = era.current;
      inFlight.current += 1;
      chain.current = chain.current
        .then(async () => {
          try {
            if (era.current !== mineEra) return;
            // The lab draws the drop and drafts nothing; a thrown save is said in plain words.
            const r: MarchResult = await makerSave(
              () => (lab ? labStep() : draftStep(eventId, patch)).catch(() => ({ ok: false as const, reason: DID_NOT_GO })),
              // The lab has no server march to come back, so it asks for no render either.
              lab ? LAB_NO_RENDER : requestMakerRefresh,
            );
            if (!r.ok && era.current === mineEra) {
              era.current += 1;
              flip.current = measure();
              setMine(null);
              say({ said: r.reason, undo: false, before: null, refused: true });
            }
          } finally {
            inFlight.current -= 1;
          }
        })
        // A save that throws must never wedge the queue (every later drop would wait forever).
        .catch(() => {});
    },
    [eventId, lab, say],
  );

  const run = useCallback(
    (plan: MarchMove | null) => {
      if (!plan) return;
      if (!plan.ok) {
        say({ said: plan.reason, undo: false, before: null, refused: true });
        return;
      }
      commit({ sections: plan.sections, printed: plan.printed, out: plan.out ?? shownOut }, { march: [plan.steps] }, {
        said: plan.said,
        undo: true,
        before: { sections: shown, printed: shownPrinted, out: shownOut },
      });
    },
    [commit, say, shown, shownPrinted, shownOut],
  );

  /* Undo: the last drafted move comes back off the draft — nothing is sent to the
     march guests see, so there is nothing to reverse there. */
  const undo = () => {
    if (!toast?.undo || !toast.before) return;
    commit(toast.before, { marchUndo: true }, { said: 'Put back', undo: false, before: null });
  };

  /* ── the re-flow (FLIP) and the ghost's landing, after the drop is drawn ── */
  useLayoutEffect(() => {
    if (refocus.current) {
      root.current?.querySelector<HTMLElement>(`[data-march-key="${CSS.escape(refocus.current)}"]`)?.focus({ preventScroll: false });
      refocus.current = null;
    }
    const was = flip.current;
    flip.current = null;
    const quiet = reduced();
    // Where the ghost lands — measured BEFORE the re-flow animations shift the boxes.
    const land = landing.current;
    landing.current = null;
    const home = land
      ? root.current?.querySelector<HTMLElement>(`[data-march-flip="${CSS.escape(land.key)}"],[data-march-key="${CSS.escape(land.key)}"]`)
      : null;
    const homeAt = home?.getBoundingClientRect() ?? null;
    if (was && !quiet) {
      /* A name inside a walk that moved too travels WITH it: animate only its
         own share of the move, or it would slide twice as far. */
      const els = [...(root.current?.querySelectorAll<HTMLElement>('[data-march-flip]') ?? [])];
      const delta = new Map<HTMLElement, [number, number] | null>();
      for (const el of els) {
        const b = was.get(el.dataset.marchFlip!);
        const a = el.getBoundingClientRect();
        delta.set(el, b ? [b.left - a.left, b.top - a.top] : null);
      }
      for (const el of els) {
        const d = delta.get(el);
        if (!d) {
          el.animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: SETTLE_MS, easing: 'cubic-bezier(.16,1,.3,1)' });
          continue;
        }
        const up = el.parentElement?.closest<HTMLElement>('[data-march-flip]');
        const pd = (up && delta.get(up)) || [0, 0];
        const dx = d[0] - pd[0];
        const dy = d[1] - pd[1];
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
        el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: SETTLE_MS, easing: 'cubic-bezier(.16,1,.3,1)' });
      }
    }
    if (!land) return;
    let once = false;
    const done = () => {
      if (once) return;
      once = true;
      land.ghost.remove();
      // Only clear the dim if no newer drag has lifted something since.
      setLifted((k) => (k === land.key && !drag.current ? null : k));
    };
    if (!homeAt || quiet) return done();
    const anim = land.ghost.animate(
      [{ transform: land.ghost.style.transform, opacity: 1 }, { transform: `translate(${homeAt.left}px,${homeAt.top}px)`, opacity: 0.2 }],
      { duration: 220, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' },
    );
    anim.onfinish = done;
    // A hidden tab may never finish the animation.
    setTimeout(done, 320);
  });

  /* ── the drag ─────────────────────────────────────────────────────────── */
  const drag = useRef<Drag | null>(null);
  const pending = useRef<{ el: HTMLElement; source: MarchSource; key: string; x: number; y: number; touch: boolean; pid: number; timer: ReturnType<typeof setTimeout> | null } | null>(null);
  const raf = useRef(0);
  const target = useRef<string | null>(null);
  const [, redraw] = useState(0);
  /* The window listeners are stable wrappers around the latest handlers. */
  const onMoveRef = useRef<(e: PointerEvent) => void>(() => {});
  const onUpRef = useRef<(e?: PointerEvent) => void>(() => {});
  const onCancelRef = useRef<() => void>(() => {});
  const moveL = useRef((e: PointerEvent) => onMoveRef.current(e));
  const upL = useRef((e: PointerEvent) => onUpRef.current(e));
  const cancelL = useRef(() => onCancelRef.current());

  /** Is this element the maker's — the march, its tray, or the tray's full list? */
  const within = useCallback(
    (el: Element | null) =>
      Boolean(el && (root.current?.contains(el) || slot?.contains(el) || el.closest('[data-march-tray-sheet]'))),
    [slot],
  );

  /** What the finger is over: a drop zone (a name, an empty spot, a gap, the tray), or the nearest gap in its section. */
  const hit = useCallback(
    (d: Drag) => {
      const box = root.current;
      if (!box) return;
      let zone: string | null = null;
      for (const el of document.elementsFromPoint(d.x, d.y)) {
        if (!within(el)) continue;
        const z = (el as HTMLElement).closest<HTMLElement>('[data-march-drop]');
        // A walk lands only in a gap; a section only on a section's header; a name anywhere but a header;
        // a tray name anywhere in the march (its role decides where it lands).
        const kind = z?.dataset.marchDrop?.split('|')[0];
        const fits =
          d.source.kind === 'name'
            ? kind !== 'section'
            : d.source.kind === 'out'
              ? kind !== 'section' && kind !== 'tray'
              : d.source.kind === 'walk'
                ? kind === 'gap'
                : kind === 'section';
        if (z && within(z) && fits) {
          zone = z.dataset.marchDrop!;
          break;
        }
        // Over a walk or a heading but not on a zone: the nearest gap in that section.
        const sec = (el as HTMLElement).closest<HTMLElement>('[data-march-section]');
        if (sec && d.source.kind === 'section') {
          // A section dragged over another section takes its place.
          zone = `section|${sec.dataset.marchSection}`;
          break;
        }
        if (sec) {
          let best: string | null = null;
          let bd = d.source.kind === 'walk' ? 80 : 40;
          sec.querySelectorAll<HTMLElement>('[data-march-drop^="gap|"]').forEach((g) => {
            const r = g.getBoundingClientRect();
            const dy = Math.abs(d.y - (r.top + r.height / 2));
            if (dy < bd) {
              bd = dy;
              best = g.dataset.marchDrop!;
            }
          });
          zone = best;
          break;
        }
      }
      const to = zone ? readTarget(zone) : null;
      const plan = to ? planMove(shown, shownPrinted, d.source, to, shownOut) : null;
      const next = plan ? zone : null;
      if (next === target.current) return;
      target.current = next;
      setOver(next && plan ? { zone: next, ok: plan.ok } : null);
    },
    [shown, shownPrinted, shownOut, within],
  );

  const stopAll = useCallback(() => {
    const p = pending.current;
    if (p?.timer) clearTimeout(p.timer);
    pending.current = null;
    cancelAnimationFrame(raf.current);
    window.removeEventListener('pointermove', moveL.current);
    window.removeEventListener('pointerup', upL.current);
    window.removeEventListener('pointercancel', cancelL.current);
  }, []);

  /* The latest hit-test (it reads the march as drawn NOW, not as it was at the lift). */
  const hitRef = useRef(hit);
  hitRef.current = hit;
  const loop = useCallback(() => {
    const d = drag.current;
    if (!d) return;
    if (d.dir) {
      const [top, bottom] = edgesOf(d.scroller);
      const dist = d.dir < 0 ? top + EDGE_PX - d.y : d.y - (bottom - EDGE_PX);
      d.scroller.scrollTop += d.dir * Math.min(18, 4 + dist / 4);
      hitRef.current(d);
    }
    raf.current = requestAnimationFrame(loop);
  }, []);

  const lift = useCallback(
    (x: number, y: number) => {
      const p = pending.current;
      if (!p || drag.current) return;
      const r = p.el.getBoundingClientRect();
      const ghost = p.el.cloneNode(true) as HTMLElement;
      ghost.removeAttribute('data-march-flip');
      ghost.removeAttribute('data-march-drop');
      ghost.setAttribute('aria-hidden', 'true');
      Object.assign(ghost.style, {
        position: 'fixed',
        left: '0',
        top: '0',
        width: `${r.width}px`,
        height: `${r.height}px`,
        margin: '0',
        zIndex: '9999',
        pointerEvents: 'none',
        transform: `translate(${r.left}px,${r.top}px)`,
        boxShadow: '0 18px 34px -14px rgba(44,42,41,.55)',
        willChange: 'transform',
      });
      ghost.dataset.marchGhost = '';
      document.body.appendChild(ghost);
      // A tray name scrolls the MARCH near its edges (the tray itself never scrolls).
      const scroller = p.source.kind === 'out' && root.current ? scrollerOf(root.current) : scrollerOf(p.el);
      drag.current = { source: p.source, key: p.key, ghost, ox: x - r.left, oy: y - r.top, x, y, scroller, dir: 0, wandered: false };
      ghost.style.transform = `translate(${x - drag.current.ox}px,${y - drag.current.oy}px) scale(1.03)`;
      setLifted(p.key);
      try {
        navigator.vibrate?.(10);
      } catch {
        /* no haptics here */
      }
      raf.current = requestAnimationFrame(loop);
    },
    [loop],
  );

  const onMove = useCallback(
    (e: PointerEvent) => {
      const p = pending.current;
      // One finger drags; a second one is ignored.
      if (!p || e.pointerId !== p.pid) return;
      if (!drag.current) {
        const moved = Math.hypot(e.clientX - p.x, e.clientY - p.y);
        if (p.touch) {
          // Moving before the long-press ends is a scroll — let it be one.
          if (moved > TAP_SLOP_TOUCH) stopAll();
          return;
        }
        if (moved > TAP_SLOP_MOUSE) lift(e.clientX, e.clientY);
        if (!drag.current) return;
      }
      e.preventDefault();
      const d = drag.current;
      d.x = e.clientX;
      d.y = e.clientY;
      if (!d.wandered && Math.hypot(e.clientX - p.x, e.clientY - p.y) > (p.touch ? TAP_SLOP_TOUCH : TAP_SLOP_MOUSE)) d.wandered = true;
      d.ghost.style.transform = `translate(${d.x - d.ox}px,${d.y - d.oy}px) scale(1.03)`;
      hit(d);
      const [top, bottom] = edgesOf(d.scroller);
      d.dir = d.y < top + EDGE_PX && d.y > top - 40 ? -1 : d.y > bottom - EDGE_PX && d.y < bottom + 40 ? 1 : 0;
    },
    [hit, lift, stopAll],
  );

  const onUp = useCallback((e?: PointerEvent) => {
    if (e && pending.current && e.pointerId !== pending.current.pid) return;
    const d = drag.current;
    const press = pending.current;
    stopAll();
    /* 🪪 A TAP OR A DRAG (`releaseIs`, lib/march-drag.ts — one answer): a name let go where it was pressed, never having
       wandered, is a TAP and opens their guest card over the march — lifted by the long-press or not (a slow finger
       still taps). A press that left the slop at any moment is a drag, and a drag never opens the card. */
    const said =
      e && press
        ? releaseIs({ kind: press.source.kind, touch: press.touch, lifted: d !== null, wandered: d?.wandered ?? false, moved: Math.hypot(e.clientX - press.x, e.clientY - press.y) })
        : d
          ? 'drop'
          : 'nothing';
    if (said === 'card' && press && (press.source.kind === 'name' || press.source.kind === 'out')) {
      if (d) {
        // The lift is undone where it began: no ghost, no dim, no drop.
        drag.current = null;
        target.current = null;
        setOver(null);
        d.ghost.remove();
        setLifted(null);
      }
      setCard({ id: press.source.id, name: press.el.dataset.marchName ?? '' });
      swallowTapClick();
      return;
    }
    if (!d) return;
    drag.current = null;
    const zone = target.current;
    target.current = null;
    setOver(null);
    const to = zone ? readTarget(zone) : null;
    const plan = to ? planMove(shown, shownPrinted, d.source, to, shownOut) : null;
    landing.current = { ghost: d.ghost, key: d.key };
    if (plan) run(plan);
    // Nowhere to go: one more paint, and the ghost settles back where it came from.
    else redraw((n) => n + 1);
  }, [run, shown, shownPrinted, shownOut, stopAll]);

  const onCancel = useCallback(() => {
    const d = drag.current;
    stopAll();
    drag.current = null;
    target.current = null;
    setOver(null);
    if (d) {
      d.ghost.remove();
      setLifted(null);
    }
  }, [stopAll]);

  useEffect(() => {
    onMoveRef.current = onMove;
    onUpRef.current = onUp;
    onCancelRef.current = onCancel;
  });

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0 || drag.current || pending.current) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-march-drag]');
    if (!el || !within(el)) return;
    const source = readSource(el.dataset.marchDrag);
    if (!source) return;
    const key =
      source.kind === 'name' || source.kind === 'out' ? source.id : source.kind === 'walk' ? `walk:${source.lead}` : `section:${source.key}`;
    const touch = e.pointerType !== 'mouse';
    pending.current = { el, source, key, x: e.clientX, y: e.clientY, touch, pid: e.pointerId, timer: null };
    if (touch) pending.current.timer = setTimeout(() => lift(e.clientX, e.clientY), LONG_PRESS_MS);
    window.addEventListener('pointermove', moveL.current, { passive: false });
    window.addEventListener('pointerup', upL.current);
    window.addEventListener('pointercancel', cancelL.current);
  };
  /* 📱 While a name is lifted the page must not scroll under the finger (the
     edges auto-scroll instead). The listener is on the maker from the start,
     NOT added at the lift: a browser decides at touchstart whether anything may
     block its scroll, and a listener that arrives later is too late — the pan
     wins and the drag is cancelled. A touch keeps its first target, so every
     move of a drag that began here comes through here. */
  useEffect(() => {
    const box = root.current;
    const block = (e: TouchEvent) => {
      if (drag.current) e.preventDefault();
    };
    box?.addEventListener('touchmove', block, { passive: false });
    // The tray too: a drag that starts on a tray chip is a touch whose first target is in the slot.
    slot?.addEventListener('touchmove', block, { passive: false });
    const move = moveL.current;
    const up = upL.current;
    const cancel = cancelL.current;
    return () => {
      // Leaving mid-drag (a Skip, a navigation): no ghost left on the page, no loop left running.
      cancelAnimationFrame(raf.current);
      if (pending.current?.timer) clearTimeout(pending.current.timer);
      pending.current = null;
      drag.current?.ghost.remove();
      drag.current = null;
      box?.removeEventListener('touchmove', block);
      slot?.removeEventListener('touchmove', block);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
    };
    // Re-attached when the maker first has someone to draw (the empty state has no root), and when the tray's slot is found.
  }, [anyone, slot]);
  /** ⌨ The same drops, from the keyboard. */
  const onKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    const el = e.target as HTMLElement;
    if (el.closest('[data-peek-toast]')) return;
    if (e.key === 'Escape' && carried) {
      e.preventDefault();
      setCarried(null);
      setHeard(`${carried.name} put back — nothing moved.`);
      return;
    }
    /* 🪪 Enter on a name (nothing held) opens their guest card; Space picks the name up to move it. */
    if (e.key === 'Enter' && !carried) {
      const from = el.closest<HTMLElement>('[data-march-drag]');
      const source = readSource(from?.dataset.marchDrag);
      if (from && source && (source.kind === 'name' || source.kind === 'out')) {
        e.preventDefault();
        setCard({ id: source.id, name: from.dataset.marchName ?? '' });
        return;
      }
    }
    if (e.key === ' ' || e.key === 'Enter') {
      if (carried) {
        e.preventDefault();
        const zone = el.closest<HTMLElement>('[data-march-drop]')?.dataset.marchDrop;
        const to = zone ? readTarget(zone) : null;
        const plan = to ? planMove(shown, shownPrinted, carried.source, to, shownOut) : null;
        setCarried(null);
        refocus.current = carried.key;
        if (plan) run(plan);
        setHeard(plan ? (plan.ok ? plan.said : plan.reason) : `${carried.name} put back — nothing moved.`);
        return;
      }
      const from = el.closest<HTMLElement>('[data-march-drag]');
      const source = readSource(from?.dataset.marchDrag);
      if (!from || !source) return;
      e.preventDefault();
      const name = from.dataset.marchName ?? '';
      setCarried({ source, key: from.dataset.marchKey ?? '', name });
      setHeard(`${name} picked up. Space on a name or an empty spot puts them there; arrow keys move them a walk; Escape puts them back.`);
      return;
    }
    if (carried && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const to = keyTarget(shown, carried.source, e.key === 'ArrowUp' ? -1 : 1);
      const plan = to ? planMove(shown, shownPrinted, carried.source, to, shownOut) : null;
      refocus.current = carried.key;
      if (plan) run(plan);
      setHeard(plan ? (plan.ok ? plan.said : plan.reason) : `${carried.name} cannot go further.`);
      // Still carried: ↑ / ↓ again keeps moving it (a name keeps its id; a walk moved by ↑ / ↓ keeps its lead).
    }
  };

  if (!anyone) {
    return (
      <p className="mx-auto max-w-md text-sm text-ink/65" data-march-maker="">
        Nobody walks yet. Give a guest a role on their guest card — a sponsor, a bearer, the honour attendants — and
        they appear here in walking order.
      </p>
    );
  }

  const walks = shown.reduce((n, s) => n + s.rows.length, 0);
  const people = shown.reduce((n, s) => n + s.rows.reduce((k, r) => k + (r[0] ? 1 : 0) + (r[1] ? 1 : 0), 0), 0);
  const dragging = lifted !== null;
  /* ⇅ R4 slice 1 · GUESTS › MARCH'S THUMB ROW — THE shared `ThumbRow` (prototype v12 `renderThumb`), drawn into the
     Guests screen's seat while March is the view (`guests-lens.tsx`): ⇕ (every section folded to its header, or open) ·
     Search guests (dims who it leaves out; Enter goes to the first found) · ⇅ (the shared Show — a name it leaves out is
     drawn faint) · ＋ Add a walk ▾ — the "Not walking" names: one picked walks alone at the end of their own section,
     the SAME move as dragging them out of the tray (`planMove` → `run`), Undo and all. Nothing new is written. */
  const marchDim = (id: string): boolean => Boolean(lens) && Boolean(id) && (!lens!.shows(id) || (marchFound !== null && !marchFound.has(id)));
  const allOpen = shown.every((sec) => !folded.has(sec.key));
  const goToFoundWalker = (words: string) => {
    if (!lens) return;
    const hits = lens.find(words);
    const sec = shown.find((x) => x.rows.some((r) => r.some((p) => p && hits.has(p.id))));
    const p = sec?.rows.flat().find((x) => x && hits.has(x.id));
    if (!sec || !p) return;
    setFolded((f) => {
      if (!f.has(sec.key)) return f;
      const n = new Set(f);
      n.delete(sec.key);
      return n;
    });
    requestAnimationFrame(() => root.current?.querySelector(`[data-march-key="${CSS.escape(p.id)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  };
  const marchThumb =
    lens && lens.slot
      ? createPortal(
          <lens.ThumbRow
            name="guests-march"
            left={
              shown.length > 0
                ? [
                    {
                      icon: allOpen ? ChevronsDownUp : ChevronsUpDown,
                      label: allOpen ? 'Collapse all' : 'Expand all',
                      expanded: allOpen,
                      onClick: () => setFolded(allOpen ? new Set(shown.map((x) => x.key)) : new Set()),
                      testId: 'march-expand',
                    },
                  ]
                : []
            }
            field={{
              placeholder: 'Search guests',
              input: {
                defaultValue: marchQ,
                enterKeyHint: 'search',
                'data-march-search': '',
                onInput: (e) => {
                  const v = e.currentTarget.value.trim();
                  if (marchQTimer.current) clearTimeout(marchQTimer.current);
                  marchQTimer.current = setTimeout(() => setMarchQ(v), SEARCH_WAIT_MS);
                },
                onKeyDown: (e) => {
                  if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  const v = e.currentTarget.value.trim();
                  setMarchQ(v);
                  if (v) goToFoundWalker(v);
                },
              },
            }}
            right={[guestsFilterMenu({ view: 'march', filter: lens.filter, onFilter: lens.setFilter, hasSides: lens.hasSides, label: 'Show' })]}
            action={
              /* 🏷 ＋ ▾ = Add walk · New group (prototype v13 `thWalk`): a group of the couple's own, first; then the
                 "Not walking" names. A walk to add needs a name, so with nobody out the menu holds New group alone. */
              guests
                ? {
                    menu: [
                      { key: NEW_GROUP, label: 'New group', group: 'Groups' },
                      ...(outUnread ? [] : shownOut.map((o) => ({ key: o.id, label: o.name, group: o.sectionLabel }))),
                    ],
                    // The shipped words stay where the menu still adds a walk; only the ＋ that is new (nobody out) has its own.
                    label: outUnread || shownOut.length === 0 ? 'Add a group' : 'Add a walk — someone not walking',
                    value: null,
                    mark: 'data-march-add-walk',
                    onPick: (id) => {
                      if (id === NEW_GROUP) return addGroup(marchSel);
                      const o = shownOut.find((x) => x.id === id);
                      if (!o) return;
                      const sec = shown.find((x) => x.key === o.section);
                      run(planMove(shown, shownPrinted, { kind: 'out', id }, { kind: 'gap', section: o.section, index: sec ? sec.rows.length : 0 }, shownOut));
                    },
                  }
                : null
            }
          />,
          lens.slot,
        )
      : null;
  /* 🏷 The selected group's toolbar — THE List's toolbar (`lens.HeadToolbar`), drawn in the thumb row's seat above it. Its
     verbs are shipped moves only: Rename = the section's heading word (`lens.renameSection`, the List's door); ＋ Walk = a
     name from "Not walking" into THIS group's end (the same `planMove` as the thumb row's ＋ and the tray drag); Delete =
     everyone in it to "Not walking" (`planSectionOut` — the tray drag, for each, one Undo). The groom's and the bride's
     sides always walk: no Delete there. ＋ Group = a group of the couple's OWN right after this one (owner 2026-10-29,
     *"if they have a custom way of marching they can customize it"*; `march_groups`) — it is a section like these, so
     the same toolbar serves it: its Rename is its own heading (drafted, `group-name`), its ＋ Walk names anyone not
     walking, its Delete sends its walkers to "Not walking" and the group goes. */
  const headTools = guests && lens?.HeadToolbar ? lens.HeadToolbar : null;
  const tapHead = (key: string) => {
    if (marchSel === key) {
      setMarchSel(null);
      setFolded((f) => new Set([...f, key]));
      return;
    }
    setMarchSel(key);
    setFolded((f) => {
      if (!f.has(key)) return f;
      const n = new Set(f);
      n.delete(key);
      return n;
    });
    // The toolbar rises from the bottom: the selected header is brought to the middle, never left under it.
    requestAnimationFrame(() =>
      root.current?.querySelector(`[data-march-section="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }),
    );
  };
  const selSec = marchSel ? (shown.find((x) => x.key === marchSel) ?? null) : null;
  /** 🏷 ＋ Group: a new group of the couple's own after `after` (the selected group), else after the last section. */
  const addGroup = (after: string | null) => {
    const movable = shown.map((x) => x.key).filter((k) => !isMarchOnlyGroup(k));
    const at = after ?? movable[movable.length - 1] ?? null;
    const key = newOwnGroupKey();
    run(planGroupAdd(shown, shownPrinted, shownOut, key, newOwnGroupLabel(shown), at));
    setMarchSel(key);
    setRenameNow(key);
    requestAnimationFrame(() =>
      root.current?.querySelector(`[data-march-section="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }),
    );
  };
  const selOwn = selSec ? isOwnMarchGroup(selSec.key) : false;
  const HeadTools = headTools;
  const marchHeadTools =
    HeadTools && lens?.slot && selSec
      ? createPortal(
          <div className="order-first" data-march-head-tools={selSec.key}>
            <HeadTools
              label={selSec.label}
              count={selSec.rows.length}
              line={`${selSec.rows.length} walk${selSec.rows.length === 1 ? '' : 's'} · ${selSec.rows.reduce((k, r) => k + (r[0] ? 1 : 0) + (r[1] ? 1 : 0), 0)} walking`}
              rename={selOwn ? { current: selSec.label, usual: null } : (lens?.sectionWords?.(selSec.key) ?? null)}
              onRename={async (text) => {
                if (!selOwn) return lens?.renameSection ? lens.renameSection(selSec.key, text) : null;
                setRenameNow(null);
                const plan = planGroupName(shown, shownPrinted, selSec.key, text);
                if (plan && !plan.ok) return plan.reason;
                run(plan);
                return null;
              }}
              openRename={renameNow === selSec.key}
              addWord="Walk"
              addMenuAlways
              add={outUnread ? null : (() => {
                // An own group takes anyone not walking (the couple decide who walks in it); a role's group, its own.
                const here = shownOut
                  .filter((o) => selOwn || o.section === selSec.key)
                  .map((o) => ({ key: o.id, label: o.name, ...(selOwn ? { group: o.sectionLabel } : {}) }));
                return here.length ? here : null;
              })()}
              adding={false}
              onAdd={(id) => {
                if (!id) return;
                run(planMove(shown, shownPrinted, { kind: 'out', id }, { kind: 'gap', section: selSec.key, index: selSec.rows.length }, shownOut));
              }}
              onDelete={
                isMarchOnlyGroup(selSec.key)
                  ? undefined
                  : () => {
                      setMarchSel(null);
                      run(planSectionOut(shown, shownPrinted, shownOut, selSec.key));
                    }
              }
              onAddGroup={() => addGroup(selSec.key)}
              onClose={() => setMarchSel(null)}
            />
          </div>,
          lens.slot,
        )
      : null;
  const ring = (zone: string) =>
    over?.zone === zone ? (over.ok ? ' ring-2 ring-terracotta-700 ring-offset-1' : ' ring-2 ring-danger-500/60 ring-offset-1') : '';
  let step = 0;

  return (
    <>
    <section
      ref={root}
      data-march-maker=""
      aria-label="Wedding March — drag a name to move it"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      /* ♿ A screen reader's "activate" is a click with no pointer (detail 0):
         the same pick-up and drop as Space. A mouse drags instead. */
      onClick={(e) => {
        if (e.detail !== 0 || (e.target as HTMLElement).closest('[data-peek-toast]')) return;
        if (!(e.target as HTMLElement).closest('[data-march-drag],[data-march-drop]')) return;
        onKeyDown({ ...e, key: ' ', target: e.target, preventDefault: () => e.preventDefault() } as unknown as ReactKeyboardEvent<HTMLElement>);
      }}
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest('[data-march-drag]')) e.preventDefault();
      }}
      onDragStart={(e) => e.preventDefault()}
      className={`${guests ? 'min-w-0 ' : 'mx-auto max-w-2xl '}flex w-full select-none flex-col pb-6 ${dragging ? 'cursor-grabbing' : ''}`}
    >
      {guests ? (
        /* 🗂 R4 · the fixed count row (owner 2026-10-29): Walks · Walking · Not walking (opens the tray) · ▶ Preview. No
           walk preview ships yet — the tile is there, disabled, and says so, so the step is not lost. */
        <ViewCountRow
          view="march"
          tiles={[
            { key: 'walks', word: walks === 1 ? 'walk' : 'walks', value: walks },
            { key: 'walking', word: 'walking', value: people },
            {
              key: 'out',
              word: 'not walking',
              value: outUnread ? null : shownOut.length,
              onPress: () => document.querySelector('[data-march-tray-slot]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
            },
            { key: 'preview', word: 'Preview', main: true, icon: <Play aria-hidden strokeWidth={2} />, disabled: true, about: 'The walk preview is coming' },
          ]}
        />
      ) : (
        <p className="px-1 pb-1 text-xs text-ink/60" data-march-count="">
          {walks} walk{walks === 1 ? '' : 's'} · {people} walking
        </p>
      )}
      {/* No LEFT / RIGHT words in Guests (owner 2026-10-29, prototype v13 — the two pills ARE the two sides). */}
      {guests ? null : (
        <div aria-hidden className="grid grid-cols-[2rem_1fr_1fr] gap-1.5 px-1.5 pt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta-800">
          <span />
          <span className="text-center">Left</span>
          <span className="text-center">Right</span>
        </div>
      )}
      {shown.length === 0 ? (
        /* Nobody walks yet, but the tray holds people: the whole march is where they land. */
        <div
          data-march-drop="gap|*|0"
          className={`mt-3 flex min-h-24 items-center justify-center rounded-xl border-[1.5px] border-dashed px-4 text-center text-sm ${
            over?.zone === 'gap|*|0' ? 'border-terracotta-700 text-terracotta-800' : 'border-ink/15 text-ink/55'
          }`}
        >
          Drag a name here from Not walking.
        </div>
      ) : null}
      {shown.map((sec) => {
        /* 🚶 A section moves by dragging its HEADER — every one but the groom's
           side (always first) and the bride's (always last). */
        const fixed = isMarchOnlyGroup(sec.key);
        const sectionKey = `section:${sec.key}`;
        return (
        <div key={sec.key} data-march-section={sec.key} className={`flex flex-col transition-opacity ${lifted === sectionKey ? 'opacity-30' : ''}`}>
          <p
            data-march-drag={fixed ? undefined : `section|${sec.key}`}
            data-march-drop={fixed ? undefined : `section|${sec.key}`}
            data-march-key={fixed ? undefined : sectionKey}
            data-march-name={sec.label}
            tabIndex={fixed ? undefined : 0}
            role={fixed ? undefined : 'button'}
            aria-pressed={fixed ? undefined : carried?.key === sectionKey}
            aria-label={fixed ? undefined : `${sec.label} — drag to move the whole section`}
            data-march-head=""
            data-march-head-selected={marchSel === sec.key ? '' : undefined}
            onClick={headTools ? (e) => {
              // A pointer's tap (a keyboard's activate, detail 0, is the root's pick-up). A drag never ends in a click here.
              if (e.detail === 0) return;
              tapHead(sec.key);
            } : undefined}
            className={`${
              /* 📌 R4 slice 4 — in Guests, a walk group's header sticks under the pinned row while its walks pass (the
                 prototype's `.acc-h` sticky); the Maker's own march keeps its plain line. */
              guests ? 'sticky top-[calc(var(--gs-top,0px)+var(--gs-stick-h,60px))] z-[5] bg-[var(--gs-paper,rgb(var(--color-cream)))] ' : ''
            }${marchSel === sec.key ? 'text-terracotta-800 underline decoration-2 underline-offset-4' : 'text-ink/65'} mt-3 flex min-h-9 items-baseline gap-2 rounded-lg px-1 pt-1 font-mono text-[10.5px] uppercase tracking-[0.18em] ${
              fixed ? '' : 'cursor-grab touch-pan-y [-webkit-touch-callout:none]'
            }${carried?.key === sectionKey ? ' ring-2 ring-ink' : ''}${ring(`section|${sec.key}`)}`}
          >
            {sec.label}
            <small className="font-sans text-[11px] normal-case tracking-normal text-ink/50">
              {sec.rows.length} walk{sec.rows.length === 1 ? '' : 's'}
            </small>
          </p>
          {folded.has(sec.key) ? null : sec.rows.length === 0 ? (
            /* 🏷 A group of the couple's own with nobody in it yet: the whole box is where a name lands. */
            <div
              data-march-drop={`gap|${sec.key}|0`}
              data-march-own-empty=""
              className={`mt-1.5 flex min-h-16 items-center justify-center rounded-xl border-[1.5px] border-dashed px-4 text-center text-sm ${
                over?.zone === `gap|${sec.key}|0` ? (over.ok ? 'border-terracotta-700 text-terracotta-800' : 'border-danger-500/60 text-danger-700') : 'border-ink/15 text-ink/55'
              }`}
            >
              Hold a name and drag it here.
            </div>
          ) : (
            <Gap zone={`gap|${sec.key}|0`} on={over?.zone === `gap|${sec.key}|0`} ok={over?.ok ?? true} />
          )}
          {(folded.has(sec.key) ? [] : sec.rows).map((row, i) => {
            step += 1;
            const lead = leadOf(row);
            const walkKey = `walk:${lead}`;
            /* 🚶 Drawn across the aisle by role and side (owner 2026-10-06 — Ninong left,
               Ninang right; the groom's crew left, the bride's right): `acrossTheAisle`. */
            const laid = acrossTheAisle(row);
            /* 🚶 R4 slice 5 (owner 2026-10-29, prototype v13 `.m-pair.solo`): in Guests a lone walker's pill spans BOTH
               sides; the other side opens (grows back, animated) only while something is being moved, so a name can
               be dropped beside them — and closes again after. Both pills of a walk share one height (stretch). */
            const solo = guests && (laid[0] === null) !== (laid[1] === null);
            const hideEmpty = solo && !dragging && !carried;
            return (
              <div key={lead || i} className="flex flex-col">
                <div
                  data-march-flip={walkKey}
                  data-march-walk={step}
                  className={`grid ${guests ? 'grid-cols-[2rem_minmax(0,1fr)]' : 'grid-cols-[2rem_1fr_1fr]'} items-stretch gap-1.5 rounded-xl bg-white p-1.5 ring-1 dark:bg-raised ring-ink/10 transition-opacity ${lifted === walkKey ? 'opacity-30' : ''}`}
                >
                  <span
                    data-march-drag={`walk|${sec.key}|${lead}`}
                    data-march-key={walkKey}
                    data-march-name={row.filter((x) => x !== null).map((x) => x!.name).join(' and ')}
                    tabIndex={0}
                    role="button"
                    aria-pressed={carried?.key === walkKey}
                    aria-label={`Step ${step} — drag to move this walk`}
                    className="flex min-h-11 cursor-grab touch-pan-y select-none items-center justify-center font-serif text-xl text-terracotta-800 [-webkit-touch-callout:none]"
                  >
                    {step}
                  </span>
                  <PairBox guests={guests}>
                  {[0, 1].map((c) => {
                    const p = laid[c as 0 | 1];
                    /* In Guests each side is a flex slot: the second keeps a gap unless the empty side is closed. */
                    const slot = guests ? ` min-w-0 flex-1 basis-0${c === 1 && !hideEmpty ? ' ml-1.5' : ''}` : '';
                    if (p) {
                      const zone = `name|${p.id}`;
                      return (
                        <div
                          key={p.id || c}
                          data-march-flip={p.id}
                          data-march-drop={zone}
                          data-march-drag={p.id ? `name|${p.id}` : undefined}
                          data-march-key={p.id}
                          data-march-name={p.name}
                          tabIndex={p.id ? 0 : undefined}
                          role="button"
                          aria-pressed={carried?.key === p.id}
                          data-march-side={c === 0 ? 'left' : 'right'}
                          aria-label={`${p.name}${p.tag ? `, ${p.tag}` : ''} — step ${step}, ${c === 0 ? 'left' : 'right'}. Enter opens their guest card; Space moves them.`}
                          data-march-card-open={card?.id === p.id && p.id ? '' : undefined}
                          data-march-dim={marchDim(p.id) ? '' : undefined}
                          className={`${NAME_CHIP}${slot} ${
                            p.tag ? 'border-terracotta-700/60 bg-white dark:bg-raised' : 'border-terracotta-700/20 bg-terracotta-700/[0.06]'
                          } ${lifted === p.id ? 'border-dashed opacity-30' : marchDim(p.id) ? 'opacity-25' : ''}${carried?.key === p.id ? ' ring-2 ring-ink ring-offset-1' : ''}${card?.id === p.id && p.id ? ' ring-2 ring-terracotta-700 ring-offset-1' : ''}${ring(zone)}`}
                        >
                          <span className="font-serif text-[15.5px] leading-tight text-ink [overflow-wrap:anywhere]">
                            {p.name}
                            {guests ? <GuestNick nick={p.nick} /> : null}
                          </span>
                          {p.tag ? (
                            <span className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-terracotta-800">{p.tag}</span>
                          ) : null}
                        </div>
                      );
                    }
                    const anchor = laid[c === 0 ? 1 : 0];
                    const zone = `beside|${anchor?.id ?? ''}`;
                    return (
                      <div
                        key={`empty-${c}`}
                        data-march-drop={anchor?.id ? zone : undefined}
                        tabIndex={anchor?.id && carried ? 0 : undefined}
                        role={anchor?.id ? 'button' : undefined}
                        aria-label={anchor ? `Walk beside ${anchor.name}` : undefined}
                        aria-hidden={hideEmpty || undefined}
                        data-march-empty-side={guests ? (hideEmpty ? 'closed' : 'open') : undefined}
                        className={`flex min-h-11 items-center justify-center rounded-lg border-[1.5px] border-dashed px-2 text-center text-[11px] leading-tight transition-colors ${
                          dragging ? 'border-terracotta-700/40 text-terracotta-800' : 'border-ink/15 text-ink/50'
                        }${slot}${
                          guests
                            ? ` overflow-hidden transition-[flex-grow,opacity,margin,padding] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none${hideEmpty ? ' pointer-events-none !grow-0 !border-0 !px-0 opacity-0' : ''}`
                            : ''
                        }${ring(zone)}`}
                      >
                        {dragging || carried ? 'walk together' : 'walks alone'}
                      </div>
                    );
                  })}
                  </PairBox>
                </div>
                <Gap zone={`gap|${sec.key}|${i + 1}`} on={over?.zone === `gap|${sec.key}|${i + 1}`} ok={over?.ok ?? true} />
              </div>
            );
          })}
        </div>
        );
      })}
      {sectionsMoved(shownPrinted) ? (
        /* One line, not a toolbar: the built-in section order back (Undo puts yours back). */
        <span data-march-sections-default="" className="mt-3 inline-flex self-start">
          <ActionButton tone="neutral" quiet icon={RotateCcw} label="Put the sections back in their usual order" onClick={() => run(planSectionsDefault(shown, shownPrinted))} />
        </span>
      ) : null}
      {marchThumb}
      {marchHeadTools}
      {slot
        ? createPortal(
            <MarchTray
              out={shownOut}
              unread={outUnread && !mine}
              lifted={lifted}
              over={over?.zone === 'tray' ? over.ok : null}
              carried={carried?.key ?? null}
              carded={card !== null}
            />,
            slot,
          )
        : null}
      <p aria-live="polite" className="sr-only" data-march-heard="">
        {heard}
      </p>
      {toast ? (
        <PeekToast
          key={toast.id}
          tone={toast.refused ? 'bad' : 'ok'}
          data={toast.refused ? 'march-refused' : 'march-done'}
          onGone={() => setToast((t) => (t && t.id === toast.id ? null : t))}
          action={toast.undo ? { label: 'Undo', onPress: undo } : undefined}
        >
          {toast.said}
        </PeekToast>
      ) : null}
    </section>
    {/* 🪪 The tapped person's own guest card — THE guest card (`GuestCard`), in its sheet over the march
        (`guest-card-sheet.tsx`) — OUTSIDE the march's
        section, so a key or a press inside the card never reaches the drag's handlers (a portal's events bubble through
        the React tree). */}
    {card && card.id ? (
      <GuestCardSheet eventId={eventId} person={card} open={openCard} onClose={() => setCard(null)} onSaved={onCardSaved} />
    ) : null}
    </>
  );
}

/** The gap between two walks — a gold line where the drop would land. */
/** 🚶 In Guests the walk's two sides sit in ONE flex row (so a lone walker can span both); in the Maker they stay grid cells. */
function PairBox({ guests, children }: { guests: boolean; children: ReactNode }) {
  return guests ? (
    <div className="flex min-w-0 items-stretch" data-march-pair="">
      {children}
    </div>
  ) : (
    <>{children}</>
  );
}

function Gap({ zone, on, ok }: { zone: string; on: boolean; ok: boolean }) {
  return (
    <div data-march-drop={zone} aria-hidden className={`relative mx-1 transition-[height] duration-200 ${on ? 'h-5' : 'h-2.5'}`}>
      <span
        className={`absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 rounded-full transition-opacity duration-150 ${
          on ? (ok ? 'bg-terracotta-700 opacity-100' : 'bg-danger-500/60 opacity-100') : 'opacity-0'
        }`}
      />
    </div>
  );
}
