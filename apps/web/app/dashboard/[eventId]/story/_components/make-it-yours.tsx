'use client';

/**
 * "MAKE IT YOURS" — THE STORY MAKER'S "THE STORY" STEP (`10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md`
 * steps 4 and 6).
 *
 * PORTED FROM `prototypes/story_make_it_yours_2026-09-10.html` (owner-passed 2026-09-10), never
 * redrawn: the moments beside the page; the desk and the fixed 660 sheet scaled to fit; the tray of
 * UNPLACED Papic photos and snippets; a tap is the add; the × on every photo, always showing,
 * counter-scaled, no invisible halo; a drag that starts only past 4px (10px for a finger), brings
 * the thing to the front and grows the sheet downward; Automatic vs I choose; Put all back; Undo
 * for every removal; every change saved through step 3's one action; the keyboard (step 4).
 *
 * STEP 6 ADDS: + Words (an empty box with a placeholder, below everything); THE WORDS TOOLBAR,
 * exactly as the prototype draws it — one floating bar, square icon buttons, groups split by
 * hairlines: [ − size + ] | [ A colour ▾ ] [ A background ] | [ turn left · turn right ] | [ remove ];
 * the round handle on a computer (resize + turn, straight within 5°, kept on the sheet by its
 * TURNED box) — on a phone the handle and the words' × give way to the toolbar, which is also the
 * keyboard's route; moments: + New and ✎ as an inline field, row × with Undo, the grip with a
 * mouse or a finger, Alt+Arrow; named sets. ⛔ NO STICKERS (owner, for now).
 *
 * ── THE RULES THIS FILE KEEPS, EACH ONE A DEFECT A REAL BROWSER FOUND IN THE PROTOTYPE ─────────
 *  • NEVER REBUILD THE PAGE ON A PRESS. A drag moves the element it pressed, by hand, and commits
 *    once on release — so the element holding the pointer is never replaced mid-press.
 *  • THE PRESS THAT ENDS THE TYPING STILL LANDS. Leaving an empty box, or an empty new moment's
 *    name, removes something in the middle of the press that left it. The layout is FROZEN for a
 *    moment (`freezeLayout`) so nothing below slides under the finger before it lifts.
 *  • EVERY RULE ABOUT WHAT IS WHERE LIVES IN `lib/make-it-yours.ts`, which ends every move in the
 *    server's own `resolveArrangement`. The tray is recomputed, never patched.
 *  • NO POP-UPS. prompt/confirm return nothing in a frame that forbids them; every removal is
 *    instant and offers Undo instead.
 *  • THE UNDO BELONGS TO THE ACTION, NOT TO THE MESSAGE. A later message keeps a live Undo alive to
 *    its own deadline; only a later CHANGE retires it (Undo restores a whole snapshot, so honouring
 *    it after more work would silently throw that work away).
 *  • aria-disabled, NEVER `disabled` — a disabled button swallows the press, so it can never say why.
 *  • 🔒 NOTHING IS SAVED WHILE ANY SOURCE WAS UNREADABLE, OR AFTER ANOTHER TAB WON. An unreadable
 *    pool looks exactly like a day with no photos; saving it would take every photo off every page.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from 'react';

import {
  MOMENT_NAME_MAX,
  SET_NAME_MAX,
  SHEET_BOTTOM_ROOM,
  SHEET_MIN_HEIGHT,
  SHEET_WIDTH,
  WORD_COLORS,
  WORD_SIZE,
  storedFromResolved,
  turnedBox,
  wordsMaxWidth,
  type ResolvedArrangement,
  type ResolvedMoment,
  type ResolvedObject,
  type ResolvedPhoto,
  type StoredWords,
  type WordColor,
} from '@/lib/story-arrangement';
import {
  WORD_SIZE_STEP,
  WORD_TURN_STEP,
  addMoment,
  addWords,
  clampPosition,
  clampWords,
  editWords,
  forgetSet,
  measureWords,
  isPhoto,
  isWords,
  moveMoment,
  moveObject,
  nameSet,
  photoCount,
  placePhoto,
  placeSet,
  placedRefs,
  putAllBack,
  removeMoment,
  removeObject,
  renameMoment,
  reorderMoments,
  setFree,
  snapTurn,
  styleWords,
  toAutomatic,
  toHand,
  type MakeItYoursWorld,
  type Measured,
  type WordsLook,
} from '@/lib/make-it-yours';
import { saveArrangement } from '../arrangement-actions';
import type { MakeItYoursInput } from '../_lib/load-make-it-yours';
import s from './make-it-yours.module.css';

const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

/** Sheet-unit gap left inside the desk around the sheet (the prototype's 16px + 16px). */
const DESK_PAD = 32;
/** How long a removal can be undone. */
const UNDO_MS = 7_000;
/** A double tap must not add the NEXT photo, which slides under the finger (10a G1). */
const TRAY_QUIET_MS = 220;
const SAVE_AFTER_MS = 400;
/**
 * How long the layout holds still after something vanished in the middle of a press — the
 * prototype's `setTimeout(fitStage,400)`. Long enough for a tap to lift.
 */
const FREEZE_MS = 400;
/** The words toolbar sits this far from the words it acts on. */
const BAR_GAP = 18;

const WORD_INK: Record<WordColor, string> = {
  ink: 'var(--ink)',
  terracotta: 'var(--act)',
  blue: 'var(--link)',
  gold: 'var(--tgold)',
};
const WORD_COLOR_NAME: Record<WordColor, string> = {
  ink: 'Ink',
  terracotta: 'Terracotta',
  blue: 'Blue',
  gold: 'Gold',
};

type SaveState = 'idle' | 'saving' | 'saved' | 'failed' | 'conflict';

type Toast = { msg: string; live: boolean; n: number; on: boolean };

/** The moment whose name is being typed in the page's header, and whether it was just made. */
type Naming = { id: string; isNew: boolean; back: string | null };

/* ══ WORDS IN THE DOM ═══════════════════════════════════════════════════════════════════════
   The text of a box is the browser's while the host types in it. React draws it ONCE (so the
   server's page carries it) and never again: re-drawing the text under a caret moves the caret. */

/** What the host typed. A contenteditable ends a trailing line break with one extra newline. */
const readText = (ed: HTMLElement) => ed.innerText.replace(/\n$/, '');
const escapeHtml = (t: string) =>
  t.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const toHtml = (t: string) => escapeHtml(t).replace(/\n/g, '<br>');

/** Everything the keyboard can reach, in the order it reaches it. */
function tabbables(): HTMLElement[] {
  return [
    ...document.querySelectorAll<HTMLElement>(
      'a[href],button,input,select,textarea,[tabindex],[contenteditable="true"],[contenteditable="plaintext-only"]',
    ),
  ].filter(
    (el) =>
      el.tabIndex >= 0 &&
      !el.hasAttribute('disabled') &&
      !el.closest('[hidden],[inert]') &&
      el.getClientRects().length > 0,
  );
}

/**
 * Tab OUT of something that is about to vanish. The browser's own Tab from an empty new box went
 * to the box's own ×, which then left with the box — and the keyboard's place went with it, to
 * the top of the page (the prototype's open item: "Tab out of a still-empty new box").
 */
function focusBeside(el: HTMLElement, back: boolean, skip: HTMLElement | null) {
  // Its own toolbar belongs to it: Tab out of the box leaves the toolbar too.
  const all = tabbables().filter((x) => !el.contains(x) && !skip?.contains(x));
  const after = all.filter((x) => el.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING);
  const before = all.filter((x) => el.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_PRECEDING);
  const target = back ? before[before.length - 1] : after[0];
  target?.focus();
}

function caretToEnd(ed: HTMLElement) {
  ed.focus({ preventScroll: true });
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(ed);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

export function MakeItYours({
  eventId,
  input,
  save = saveArrangement,
}: {
  eventId: string;
  input: MakeItYoursInput;
  /**
   * The one write. The Story Maker passes nothing and gets step 3's action; it is a prop only so a
   * real-browser drive can put the same component in front of a store it controls.
   */
  save?: typeof saveArrangement;
}): ReactElement {
  const world: MakeItYoursWorld = useMemo(
    () => ({ runOfShow: input.runOfShow, pool: input.pool }),
    [input.runOfShow, input.pool],
  );
  const hasSchedule = world.runOfShow.length > 0;
  const unreadable = input.unreadable.length > 0;

  const [state, setState] = useState<ResolvedArrangement>(input.initial);
  const [sel, setSel] = useState<string | null>(input.initial.moments[0]?.id ?? null);
  const [selObj, setSelObj] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>({ msg: '', live: false, n: 0, on: false });
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
  const [backRef, setBackRef] = useState<string | null>(null);
  const [naming, setNaming] = useState<Naming | null>(null);
  const [setNaming_, setSetNaming] = useState(false);
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const [draggingRow, setDraggingRow] = useState<string | null>(null);
  const [pop, setPop] = useState(false);
  /* The browsers that do not know `plaintext-only` would make the box not editable at all; they get
     `true`, and the paste filter below keeps pasted formatting out either way. */
  const [plainOnly, setPlainOnly] = useState(true);

  // The latest of everything, for handlers that outlive the render that made them.
  const stateRef = useRef(state);
  stateRef.current = state;
  const selRef = useRef(sel);
  selRef.current = sel;
  const selObjRef = useRef(selObj);
  selObjRef.current = selObj;
  const conflictRef = useRef(conflict);
  conflictRef.current = conflict;

  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const filmsRef = useRef<HTMLDivElement>(null);
  const chooseRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const colorBtnRef = useRef<HTMLButtonElement>(null);
  const renameRef = useRef<HTMLButtonElement>(null);
  const nameSetRef = useRef<HTMLButtonElement>(null);
  const setInputRef = useRef<HTMLInputElement>(null);
  const layoutRef = useRef({ scale: 1, height: SHEET_MIN_HEIGHT });
  /** The thing a finished drag should hand the keyboard's focus back to, once React has re-drawn. */
  const refocus = useRef<string | null>(null);
  /** Anything that must happen once the next render is on the page (a focus, a scroll). */
  const afterRender = useRef<Array<() => void>>([]);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The text words had when the host started this visit to them — a clear is a removal. */
  const textAtFocus = useRef<Map<string, string>>(new Map());
  const hold = useRef<{ until: number; height: number } | null>(null);
  const freezeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const versionRef = useRef(input.version);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const pending = useRef(false);
  const undoRef = useRef<{ fn: () => void; until: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trayQuietUntil = useRef(0);
  const busy = useRef(false);
  const toastN = useRef(0);

  const moment: ResolvedMoment | undefined =
    state.moments.find((m) => m.id === sel) ?? state.moments[0];
  const auto = state.mode === 'auto';
  const pool = world.pool;
  const placed = useMemo(() => new Set(placedRefs(state)), [state]);
  const tray = useMemo(() => pool.filter((p) => !placed.has(p.ref)), [pool, placed]);

  useEffect(() => {
    try {
      const probe = document.createElement('div');
      probe.contentEditable = 'plaintext-only';
      setPlainOnly(probe.contentEditable === 'plaintext-only');
    } catch {
      setPlainOnly(false);
    }
  }, []);

  /* ══ THE SHEET, SCALED TO FIT ═══════════════════════════════════════════════════════════════
     Measured from the elements themselves, like the prototype's `fitStage`, so a drag in progress
     grows the sheet as it goes — and a TURNED caption grows it by its turned corners. A resize only
     changes how big the sheet is drawn: nothing is moved, nothing is re-dealt. */
  const fit = useCallback(() => {
    const st = stageRef.current;
    const cv = canvasRef.current;
    if (!st || !cv) return;
    const W = st.clientWidth;
    if (!W) return; // the panel is hidden — the observer calls again when it opens
    const scale = Math.min(1, (W - DESK_PAD) / SHEET_WIDTH);
    let bottom = 0;
    cv.querySelectorAll<HTMLElement>('[data-obj]').forEach((e) => {
      const b = turnedBox(
        { x: e.offsetLeft, y: e.offsetTop, w: e.offsetWidth, h: e.offsetHeight },
        Number(e.dataset.turn) || 0,
      );
      bottom = Math.max(bottom, b.y + b.h);
    });
    const height = Math.max(SHEET_MIN_HEIGHT, Math.ceil(bottom) + SHEET_BOTTOM_ROOM);
    cv.style.height = `${height}px`;
    cv.style.transform = `scale(${scale})`;
    cv.style.left = `${Math.round((W - SHEET_WIDTH * scale) / 2)}px`;
    cv.style.setProperty('--inv', (1 / scale).toFixed(4));
    const held = hold.current && performance.now() < hold.current.until ? hold.current.height : null;
    st.style.height = `${held ?? Math.ceil(height * scale + DESK_PAD)}px`;
    layoutRef.current = { scale, height };
  }, []);

  /* ══ THE WORDS TOOLBAR'S PLACE ══════════════════════════════════════════════════════════════
     Just above the selected words — below them when there is no room above — and never off the
     screen's sides. Written straight to the element, so it follows a drag, a resize and a scroll
     without the page re-drawing. */
  const placeBar = useCallback(() => {
    const bar = barRef.current;
    const root = rootRef.current;
    const id = selObjRef.current;
    const el = id ? canvasRef.current?.querySelector<HTMLElement>(`[data-obj="${id}"]`) : null;
    if (!bar || !root || !el) return;
    const r = el.getBoundingClientRect();
    const rr = root.getBoundingClientRect();
    const bw = bar.offsetWidth;
    const bh = bar.offsetHeight;
    // Centred on the words, kept inside the PAGE's own box — centred on a caption at the page's
    // left edge, it spilled over the moments beside the page — and never off the screen's sides.
    const box = stageRef.current?.parentElement?.getBoundingClientRect();
    let x = r.left + r.width / 2 - bw / 2;
    if (box && box.width >= bw + 8) x = Math.max(box.left + 4, Math.min(box.right - bw - 4, x));
    x = Math.max(8, Math.min(window.innerWidth - bw - 8, x));
    /*
      "NO ROOM" INCLUDES "WOULD COVER SOMETHING". Found driving the editor: new words land just
      under the photos, so a bar above them sat ON the photo row — and a press on a photo's ×
      pressed "Turn left" instead (the family of 10a DW-21). Above is still first; below when
      above would cover another control; failing both, whichever covers fewer.
    */
    const controls = [
      ...root.querySelectorAll<HTMLElement>('button, a[href], [data-film], [data-grip]'),
    ]
      .filter((c) => !bar.contains(c) && !el.contains(c) && c.getClientRects().length > 0)
      .map((c) => c.getBoundingClientRect());
    const covers = (top: number) =>
      controls.filter((c) => c.left < x + bw && x < c.right && c.top < top + bh && top < c.bottom).length;
    const upY = r.top - bh - BAR_GAP;
    const downY = r.bottom + BAR_GAP;
    const upFits = upY > 8;
    const downFits = downY + bh < window.innerHeight - 8;
    const up = upFits ? covers(upY) : Number.POSITIVE_INFINITY;
    const down = downFits ? covers(downY) : Number.POSITIVE_INFINITY;
    const above = up === 0 || !(down < up) ? upFits || !downFits : false;
    const y = above ? upY : downY;
    bar.style.left = `${Math.round(x - rr.left)}px`;
    bar.style.top = `${Math.round(y - rr.top)}px`;
    // The colour menu opens AWAY from the words, never on top of them.
    bar.toggleAttribute('data-above', above);
    const menu = bar.querySelector<HTMLElement>('[role="radiogroup"]');
    const btn = colorBtnRef.current;
    if (menu && btn) menu.style.left = `${Math.max(0, btn.offsetLeft - 10)}px`;
  }, []);

  /**
   * Something vanished in the middle of a press. Hold the page's height and the moments list's
   * height still until the press can lift, or what is below slides up under the finger and the
   * press lands on something else (10a R7-lowest-empty-box-swallows-press · R8-new-empty-swallows-tap).
   */
  const freezeLayout = useCallback(() => {
    const st = stageRef.current;
    const list = listRef.current;
    if (st) hold.current = { until: performance.now() + FREEZE_MS, height: st.offsetHeight };
    if (list) list.style.minHeight = `${list.offsetHeight}px`;
    if (freezeTimer.current) clearTimeout(freezeTimer.current);
    freezeTimer.current = setTimeout(() => {
      hold.current = null;
      if (listRef.current) listRef.current.style.minHeight = '';
      fit();
      placeBar();
    }, FREEZE_MS);
  }, [fit, placeBar]);

  useLayoutEffect(() => {
    fit();
    placeBar();
    // What you just dragged came to the front — React re-appended it, which drops focus. Give it
    // back, so Delete and the arrows still act on the thing the host is holding.
    const id = refocus.current;
    if (id) {
      refocus.current = null;
      canvasRef.current
        ?.querySelector<HTMLElement>(`[data-obj="${id}"]`)
        ?.focus({ preventScroll: true });
    }
    const jobs = afterRender.current;
    afterRender.current = [];
    for (const job of jobs) job();
    remeasure();
  });

  useEffect(() => {
    // Web fonts arriving late change how big words are drawn, with no render to notice it.
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) remeasure();
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const st = stageRef.current;
    if (!st || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      fit();
      placeBar();
    });
    ro.observe(st);
    return () => ro.disconnect();
  }, [fit, placeBar]);

  useEffect(() => {
    const again = () => placeBar();
    window.addEventListener('scroll', again, { passive: true });
    window.addEventListener('resize', again);
    return () => {
      window.removeEventListener('scroll', again);
      window.removeEventListener('resize', again);
    };
  }, [placeBar]);

  /* ══ SAVING — every change, through step 3's one action ═════════════════════════════════════ */
  const flush = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (unreadable || conflictRef.current) return;
    if (inFlight.current) {
      pending.current = true;
      return;
    }
    inFlight.current = true;
    pending.current = false;
    setSaveState('saving');
    let result: Awaited<ReturnType<typeof saveArrangement>>;
    try {
      result = await save(
        eventId,
        storedFromResolved(stateRef.current),
        versionRef.current,
      );
    } catch {
      result = { ok: false, reason: 'failed', message: 'Could not save. Please try again.' };
    }
    inFlight.current = false;
    if (result.ok) {
      versionRef.current = result.version;
      if (pending.current) {
        void flush();
        return;
      }
      setSaveError(null);
      /*
        🔴 "SAVED" ONLY WHEN NOTHING NEWER IS WAITING. Found driving the editor at 390: a drag
        landed while the previous change's save was on the wire; that save came back and said
        "Saved" — for a page whose newest change was still sitting in its 400ms timer. A host who
        trusted it and reloaded lost the drag. The waiting change's own save will say "Saved".
      */
      if (saveTimer.current) return;
      setSaveState('saved');
      return;
    }
    if (result.reason === 'conflict') {
      setConflict(result.message);
      setSaveState('conflict');
      return;
    }
    setSaveError(result.message);
    setSaveState('failed');
    if (pending.current) void flush();
  }, [eventId, unreadable, save]);

  const scheduleSave = useCallback(() => {
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flush(), SAVE_AFTER_MS);
  }, [flush]);

  /*
    A tab put away — or left — with a change still waiting is saved NOW, not in 400ms that may
    never come. Never a "leave this page?" box: that is a pop-up, and the owner ruled them out.
  */
  useEffect(() => {
    const now = () => {
      if (saveTimer.current) void flush();
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') now();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', now);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', now);
    };
  }, [flush]);

  /* ══ THE MESSAGE, AND THE UNDO THAT BELONGS TO THE ACTION ═══════════════════════════════════ */
  const showHint = useCallback(
    (msg: string, undo?: () => void) => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (undo) undoRef.current = { fn: undo, until: Date.now() + UNDO_MS };
      const u = undoRef.current;
      const live = !!u && Date.now() < u.until;
      toastN.current += 1;
      // The count in the key re-mounts the text, so the same message twice is announced twice.
      setToast({ msg, live, n: toastN.current, on: true });
      const wait = live && u ? Math.max(2_600, u.until - Date.now()) : 2_600;
      toastTimer.current = setTimeout(() => {
        setToast((t) => ({ ...t, on: false, live: false }));
        if (undoRef.current && Date.now() >= undoRef.current.until) undoRef.current = null;
      }, wait);
      // In Automatic, every refusal also points at the way out: "I choose" shakes.
      const b = chooseRef.current;
      if (stateRef.current.mode === 'auto' && !undo && b) {
        b.classList.remove(s.nudge!);
        void b.offsetWidth; // restart the animation, so a second refusal shakes again
        b.classList.add(s.nudge!);
        if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
        nudgeTimer.current = setTimeout(() => b.classList.remove(s.nudge!), 1_100);
      }
    },
    [],
  );

  const retireUndo = useCallback(() => {
    if (!undoRef.current) return;
    undoRef.current = null;
    setToast((t) => ({ ...t, live: false }));
  }, []);

  /** Every change goes through here: it is kept, and it retires a pending Undo. */
  const commit = useCallback(
    (next: ResolvedArrangement, opts: { keepUndo?: boolean } = {}) => {
      if (!opts.keepUndo) retireUndo();
      stateRef.current = next;
      setState(next);
      scheduleSave();
    },
    [retireUndo, scheduleSave],
  );

  const selectMoment = useCallback((id: string | null) => {
    selRef.current = id;
    setSel(id);
  }, []);
  const selectObj = useCallback((id: string | null) => {
    selObjRef.current = id;
    setSelObj(id);
    if (!id) setPop(false);
  }, []);

  const doUndo = useCallback(() => {
    const u = undoRef.current;
    if (!u || busy.current || Date.now() >= u.until) return;
    undoRef.current = null;
    // After another tab won, an Undo would change a page that can no longer be saved.
    if (conflictRef.current) {
      showHint(conflictRef.current);
      return;
    }
    u.fn();
  }, [showHint]);

  const withUndo = useCallback(
    (msg: string, snapshot: ResolvedArrangement, snapSel: string | null) => {
      showHint(msg, () => {
        commit(snapshot, { keepUndo: true });
        if (snapSel && snapshot.moments.some((m) => m.id === snapSel)) selectMoment(snapSel);
        selectObj(null);
        setSetNaming(false);
        setNaming(null);
        showHint('Undone');
      });
    },
    [commit, showHint, selectMoment, selectObj],
  );

  /** Nothing may change: the reason, said where the person is looking. */
  const lockedReason = (): string | null => {
    if (unreadable) {
      return 'We couldn’t load everything on this story, so nothing here can change until you reload.';
    }
    if (conflictRef.current) return conflictRef.current;
    return null;
  };

  const currentMoment = (): ResolvedMoment | undefined => {
    const cur = stateRef.current;
    return cur.moments.find((x) => x.id === selRef.current) ?? cur.moments[0];
  };

  const objEl = (id: string) =>
    canvasRef.current?.querySelector<HTMLElement>(`[data-obj="${id}"]`) ?? null;

  /**
   * The words on this page as they are DRAWN, before a photo is dealt around them. Their saved
   * size may be an estimate from before they were ever drawn; a photo dealt by an estimate can
   * land under the real caption (the prototype drew twice for the same reason).
   */
  const measuredNow = (cur: ResolvedArrangement, momentId: string): ResolvedArrangement => {
    let changed = false;
    const moments = cur.moments.map((m) => {
      if (m.id !== momentId) return m;
      return {
        ...m,
        objects: m.objects.map((o) => {
          if (!isWords(o)) return o;
          const el = objEl(o.id);
          if (!el) return o;
          const w = el.offsetWidth;
          const h = el.offsetHeight;
          if (o.w === w && o.h === h) return o;
          changed = true;
          return { ...o, w, h };
        }),
      };
    });
    return changed ? { ...cur, moments } : cur;
  };

  /* ══ THE MOVES — PHOTOS (step 4) ════════════════════════════════════════════════════════════ */
  const addFromTray = (ref: string, index: number, byKey: boolean) => {
    const cur = stateRef.current;
    if (cur.mode === 'auto') {
      showHint('Tap “I choose” to pick your own.');
      return;
    }
    const why = lockedReason();
    if (why) {
      showHint(why);
      return;
    }
    // ONE PHOTOGRAPH, ONE PLACE — asked of the data, which a second Enter cannot fool.
    if (placedRefs(cur).includes(ref)) return;
    if (performance.now() < trayQuietUntil.current) return;
    trayQuietUntil.current = performance.now() + TRAY_QUIET_MS;
    const at = selRef.current ?? cur.moments[0]?.id;
    if (!at) return;
    const move = placePhoto(measuredNow(cur, at), world, at, ref);
    if (!move.ok) {
      if (move.refusal === 'full') showHint('This page is full. Take something off it first.');
      return;
    }
    const added = move.state.moments
      .find((m) => m.id === at)
      ?.objects.find((o) => isPhoto(o) && o.ref === ref);
    setFresh(new Set(added ? [added.id] : []));
    commit(move.state);
    if (byKey) {
      // The keyboard keeps its place: the film that slid into this one's spot, else the one before.
      requestAnimationFrame(() => {
        const films = filmsRef.current?.querySelectorAll<HTMLElement>('[data-film]');
        const target = films?.[index] ?? films?.[index - 1] ?? filmsRef.current;
        target?.focus({ preventScroll: true });
      });
    }
  };

  /** × or Delete — a photo goes back to the tray, words go; both with Undo. */
  const removeFromPage = (objectId: string, byKey: boolean) => {
    const cur = stateRef.current;
    const m = currentMoment();
    if (!m) return;
    const why = lockedReason();
    if (why) {
      showHint(why);
      return;
    }
    const idx = m.objects.findIndex((o) => o.id === objectId);
    const target = m.objects[idx];
    const move = removeObject(cur, world, m.id, objectId);
    if (!move.ok || !target) return;
    if (selObjRef.current === objectId) selectObj(null);
    if (isPhoto(target)) setBackRef(target.ref);
    commit(move.state);
    // An empty box has nothing to bring back; anything else can be.
    if (isPhoto(target)) withUndo('Back in the tray', cur, m.id);
    else if (target.text.trim()) withUndo('Words removed', cur, m.id);
    if (byKey) {
      requestAnimationFrame(() => {
        const after = move.state.moments.find((x) => x.id === m.id)?.objects ?? [];
        const next = after[idx] ?? after[idx - 1];
        const el = next && objEl(next.id);
        (el ?? canvasRef.current)?.focus({ preventScroll: true });
      });
    }
  };

  const onPutAllBack = () => {
    const cur = stateRef.current;
    const m = currentMoment();
    if (!m) return;
    const why = lockedReason();
    if (why) {
      showHint(why);
      return;
    }
    const n = photoCount(m);
    const move = putAllBack(cur, world, m.id);
    if (!move.ok) return;
    selectObj(null);
    commit(move.state);
    withUndo(`${n} back in the tray`, cur, m.id);
  };

  const onAutomatic = () => {
    if (!hasSchedule) {
      showHint('Add your run of show first, then Automatic can sort for you.');
      return;
    }
    const cur = stateRef.current;
    if (cur.mode === 'auto') return;
    const why = lockedReason();
    if (why) {
      showHint(why);
      return;
    }
    const r = toAutomatic(cur, world);
    if (r.refused) return;
    selectObj(null);
    setSetNaming(false);
    setNaming(null);
    commit(r.state);
    // Going back re-sorts everything, which would silently undo the host's own work. It never
    // asks first — it is instant, and offers the way back.
    if (r.lostHandWork) withUndo('Sorted by your run of show', cur, selRef.current);
  };

  const onChoose = () => {
    const cur = stateRef.current;
    if (cur.mode === 'hand') return;
    const why = lockedReason();
    if (why) {
      showHint(why);
      return;
    }
    commit(toHand(cur, world));
  };

  const pickMoment = (id: string) => {
    if (selRef.current === id) return;
    selectMoment(id);
    selectObj(null);
    setSetNaming(false);
  };

  /* ══ THE MOVES — WORDS (step 6) ═════════════════════════════════════════════════════════════ */
  const onAddWords = () => {
    const cur = stateRef.current;
    if (cur.mode === 'auto') {
      showHint('Tap “I choose” to add words.');
      return;
    }
    const why = lockedReason();
    if (why) {
      showHint(why);
      return;
    }
    const m = currentMoment();
    if (!m) return;
    const r = addWords(measuredNow(cur, m.id), world, m.id);
    if (!r.ok) {
      if (r.refusal === 'full') showHint('This page is full. Take something off it first.');
      return;
    }
    selectObj(r.id);
    commit(r.state);
    afterRender.current.push(() => {
      const el = objEl(r.id);
      const ed = el?.querySelector<HTMLElement>('[data-ed]');
      if (!el || !ed) return;
      ed.focus({ preventScroll: true });
      el.scrollIntoView({ block: 'nearest' });
    });
  };

  const findWords = (id: string): { m: ResolvedMoment; w: StoredWords } | null => {
    for (const m of stateRef.current.moments) {
      const w = m.objects.find((o) => o.id === id);
      if (w && isWords(w)) return { m, w };
    }
    return null;
  };

  /**
   * The host left a box. Empty, it goes: QUIETLY if it never had words (a box nobody typed in is
   * not a removal), WITH UNDO if it had some and they cleared it (round 3's critic, test 3).
   */
  const leaveWords = (id: string) => {
    const found = findWords(id);
    const had = textAtFocus.current.get(id);
    textAtFocus.current.delete(id);
    if (!found || found.w.text.trim() !== '') return;
    const cur = stateRef.current;
    const move = removeObject(cur, world, found.m.id, id);
    if (!move.ok) return;
    // 🔑 NO SHIFT UNDER THE FINGER: this runs inside the press that left the box.
    freezeLayout();
    if (selObjRef.current === id) selectObj(null);
    commit(move.state);
    if (had && had.trim()) {
      const snapshot: ResolvedArrangement = {
        ...cur,
        moments: cur.moments.map((m) =>
          m.id !== found.m.id
            ? m
            : { ...m, objects: m.objects.map((o) => (o.id === id && isWords(o) ? { ...o, text: had } : o)) },
        ),
      };
      withUndo('Words removed', snapshot, found.m.id);
    }
  };

  /** Focus left the words AND their toolbar — the toolbar belongs to the words. */
  const onWordsAreaBlur = (id: string, related: EventTarget | null) => {
    // A switch to another app blurs the field too — that is not the host leaving it.
    if (typeof document !== 'undefined' && !document.hasFocus()) return;
    const el = objEl(id);
    const r = related instanceof Node ? related : null;
    if (r && (el?.contains(r) || barRef.current?.contains(r))) return;
    leaveWords(id);
  };

  const onWordsFocus = (o: StoredWords) => {
    if (stateRef.current.mode !== 'hand') return;
    if (!textAtFocus.current.has(o.id)) textAtFocus.current.set(o.id, o.text);
    if (selObjRef.current !== o.id) selectObj(o.id);
  };

  const measure = (el: HTMLElement): Measured => ({ w: el.offsetWidth, h: el.offsetHeight });

  /**
   * Every caption on this page kept at the size it is DRAWN (see `measureWords`). Never in the
   * middle of a drag or a handle turn, never under a caret (typing measures as it goes), never
   * where nothing may be saved.
   */
  function remeasure() {
    const cur = stateRef.current;
    if (cur.mode !== 'hand' || busy.current || unreadable || conflictRef.current) return;
    const m = cur.moments.find((x) => x.id === selRef.current) ?? cur.moments[0];
    if (!m) return;
    const a = document.activeElement as HTMLElement | null;
    const sizes: Record<string, Measured> = {};
    for (const o of m.objects) {
      if (!isWords(o)) continue;
      const el = objEl(o.id);
      if (!el || (a?.isContentEditable && el.contains(a))) continue;
      sizes[o.id] = measure(el);
    }
    const move = measureWords(cur, world, m.id, sizes);
    if (move.ok) commit(move.state, { keepUndo: true });
  }

  const onWordsInput = (o: StoredWords, ed: HTMLElement) => {
    const el = objEl(o.id);
    if (!el) return;
    const found = findWords(o.id);
    if (!found) return;
    const text = readText(ed);
    ed.toggleAttribute('data-empty', text === '');
    const move = editWords(stateRef.current, world, found.m.id, o.id, text, measure(el));
    if (move.ok) commit(move.state);
  };

  /**
   * A look from the toolbar. It is put on the element FIRST and measured, then kept once — so what
   * is saved is the size the words really are, and the page re-clamps them by their turned box.
   */
  const applyLook = (id: string, look: WordsLook) => {
    const found = findWords(id);
    const el = objEl(id);
    if (!found || !el) return;
    const why = lockedReason();
    if (why) {
      showHint(why);
      return;
    }
    const ed = el.querySelector<HTMLElement>('[data-ed]');
    const size = look.size ?? found.w.size;
    if (ed) ed.style.fontSize = `${Math.min(WORD_SIZE.max, Math.max(WORD_SIZE.min, size))}px`;
    el.style.maxWidth = `${wordsMaxWidth(Math.min(WORD_SIZE.max, Math.max(WORD_SIZE.min, size)))}px`;
    if (look.backing !== undefined) el.classList.toggle(s.pillw!, look.backing);
    const move = styleWords(stateRef.current, world, found.m.id, id, look, measure(el));
    if (move.ok) commit(move.state);
  };

  const onToolbar = (kind: 'smaller' | 'bigger' | 'left' | 'right' | 'backing' | 'remove') => {
    const id = selObjRef.current;
    const found = id ? findWords(id) : null;
    if (!id || !found) return;
    const w = found.w;
    if (kind === 'remove') {
      removeFromPage(id, true);
      return;
    }
    if (kind === 'smaller') applyLook(id, { size: w.size - WORD_SIZE_STEP });
    if (kind === 'bigger') applyLook(id, { size: w.size + WORD_SIZE_STEP });
    if (kind === 'left') applyLook(id, { turn: w.turn - WORD_TURN_STEP });
    if (kind === 'right') applyLook(id, { turn: w.turn + WORD_TURN_STEP });
    if (kind === 'backing') applyLook(id, { backing: !w.backing });
    setPop(false);
  };

  const onPickColor = (c: WordColor) => {
    const id = selObjRef.current;
    if (!id) return;
    applyLook(id, { color: c });
    setPop(false);
  };

  /* ══ THE MOVES — MOMENTS (step 6) ═══════════════════════════════════════════════════════════ */
  const onNewMoment = () => {
    const cur = stateRef.current;
    if (cur.mode === 'auto') return;
    const why = lockedReason();
    if (why) {
      showHint(why);
      return;
    }
    const r = addMoment(cur, world);
    if (!r.ok) {
      if (r.refusal === 'full') showHint('A story holds up to 80 moments.');
      return;
    }
    const back = selRef.current;
    selectObj(null);
    setSetNaming(false);
    commit(r.state);
    selectMoment(r.id);
    setNaming({ id: r.id, isNew: true, back });
  };

  const onRename = () => {
    const m = currentMoment();
    if (!m || stateRef.current.mode === 'auto') return;
    const why = lockedReason();
    if (why) {
      showHint(why);
      return;
    }
    setNaming({ id: m.id, isNew: false, back: null });
  };

  /**
   * The name is typed straight into the page's own header. A new moment left nameless is a new
   * moment cancelled — quietly, it held nothing. The press that ended the typing still lands.
   */
  const finishNaming = (n: Naming, value: string, keep: boolean) => {
    setNaming(null);
    const v = value.trim();
    const cur = stateRef.current;
    if (n.isNew && (!keep || !v)) {
      const move = removeMoment(cur, world, n.id);
      if (move.ok) {
        freezeLayout();
        commit({ ...move.state, handTouched: cur.handTouched }, { keepUndo: true });
        const back = n.back && move.state.moments.some((m) => m.id === n.back) ? n.back : null;
        selectMoment(back ?? move.state.moments[move.state.moments.length - 1]?.id ?? null);
      }
      return;
    }
    if (keep && v) {
      const move = renameMoment(cur, world, n.id, v.slice(0, MOMENT_NAME_MAX));
      if (move.ok) commit(move.state);
    }
  };

  const onRemoveMoment = (id: string, byKey: boolean) => {
    const cur = stateRef.current;
    const why = lockedReason();
    if (why) {
      showHint(why);
      return;
    }
    const i = cur.moments.findIndex((m) => m.id === id);
    const m = cur.moments[i];
    if (!m) return;
    const move = removeMoment(cur, world, id);
    if (!move.ok) return;
    const n = photoCount(m);
    if (selRef.current === id) {
      const next = move.state.moments[i] ?? move.state.moments[i - 1];
      selectMoment(next?.id ?? null);
      selectObj(null);
    }
    setSetNaming(false);
    commit(move.state);
    withUndo(
      `“${m.name ?? 'This moment'}” removed${n ? ' · its photos are back in the tray' : ''}`,
      cur,
      selRef.current,
    );
    if (byKey) {
      afterRender.current.push(() => {
        listRef.current
          ?.querySelector<HTMLElement>(`[data-moment="${selRef.current}"]`)
          ?.focus({ preventScroll: true });
      });
    }
  };

  const onMomentKey = (e: ReactKeyboardEvent<HTMLButtonElement>, id: string) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const d = e.key === 'ArrowUp' ? -1 : 1;
    if (e.altKey) {
      // Alt+Arrow moves the moment — the keyboard's way to do what the grip does (10a H2).
      if (stateRef.current.mode !== 'hand') {
        showHint('Tap “I choose” to reorder moments.');
        return;
      }
      const why = lockedReason();
      if (why) {
        showHint(why);
        return;
      }
      const move = moveMoment(stateRef.current, world, id, d);
      if (!move.ok) return;
      commit(move.state);
      afterRender.current.push(() => {
        listRef.current?.querySelector<HTMLElement>(`[data-moment="${id}"]`)?.focus({ preventScroll: true });
      });
      return;
    }
    const rows = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-moment]') ?? [])];
    const at = rows.findIndex((r) => r.dataset.moment === id);
    rows[at + d]?.focus();
  };

  /* Reorder with a finger or a mouse by the ⋮⋮ grip — pointer events, not the browser's own
     drag-and-drop, which a phone does not start and which typed a moment's id into the words it
     was dropped on (10a critic-6). The captured pointer lives on the LIST, which never moves;
     capturing on a row would be lost the moment that row is moved. */
  const onGripDown = (e: ReactPointerEvent<HTMLSpanElement>, id: string) => {
    if (e.button > 0 || stateRef.current.mode !== 'hand' || lockedReason()) return;
    const list = listRef.current;
    if (!list) return;
    e.preventDefault();
    e.stopPropagation();
    const a = document.activeElement as HTMLElement | null;
    if (a?.isContentEditable) a.blur();
    let order = stateRef.current.moments.map((m) => m.id);
    const before = order.join();
    try {
      list.setPointerCapture(e.pointerId);
    } catch {
      /* a pointer already gone — the listeners below still end the press */
    }
    busy.current = true;
    setDraggingRow(id);
    setDragOrder(order);
    const mv = (ev: PointerEvent) => {
      const rows = [...list.querySelectorAll<HTMLElement>('[data-row]')];
      for (const r of rows) {
        if (r.dataset.row === id) continue;
        const b = r.getBoundingClientRect();
        if (ev.clientY < b.top || ev.clientY > b.bottom) continue;
        const rest = order.filter((x) => x !== id);
        const j = rest.indexOf(r.dataset.row!);
        rest.splice(ev.clientY < b.top + b.height / 2 ? j : j + 1, 0, id);
        if (rest.join() !== order.join()) {
          order = rest;
          setDragOrder(order);
        }
        break;
      }
    };
    const up = () => {
      list.removeEventListener('pointermove', mv);
      list.removeEventListener('pointerup', up);
      list.removeEventListener('pointercancel', up);
      busy.current = false;
      setDraggingRow(null);
      setDragOrder(null);
      if (order.join() === before) return;
      const move = reorderMoments(stateRef.current, world, order);
      if (move.ok) commit(move.state);
    };
    list.addEventListener('pointermove', mv);
    list.addEventListener('pointerup', up);
    list.addEventListener('pointercancel', up);
  };

  /* ══ THE MOVES — NAMED SETS (step 6) ════════════════════════════════════════════════════════ */
  const onNameSet = () => {
    if (stateRef.current.mode === 'auto') {
      showHint('Tap “I choose” to name photos.');
      return;
    }
    const why = lockedReason();
    if (why) {
      showHint(why);
      return;
    }
    const m = currentMoment();
    if (!m || photoCount(m) < 2) {
      showHint('Put 2 or more photos on this page to name them together.');
      return;
    }
    setSetNaming(true);
    afterRender.current.push(() => {
      const inp = setInputRef.current;
      if (!inp) return;
      inp.value = '';
      inp.focus();
    });
  };

  const closeSetNaming = () => {
    setSetNaming(false);
    afterRender.current.push(() => nameSetRef.current?.focus());
  };

  const saveSet = () => {
    const inp = setInputRef.current;
    const m = currentMoment();
    if (!inp || !m) return;
    const v = inp.value.trim();
    if (!v) {
      inp.focus();
      return;
    }
    const r = nameSet(stateRef.current, world, m.id, v);
    if (!r.ok) {
      if (r.refusal === 'too_few') showHint('Put 2 or more photos on this page to name them together.');
      return;
    }
    // Nothing stays selected — a Backspace after naming must not take a photo off (10a r3 R9).
    selectObj(null);
    commit(r.state);
    closeSetNaming();
    showHint(`Named “${r.id}”`);
  };

  const onUseSet = (name: string) => {
    if (stateRef.current.mode === 'auto') {
      showHint('Tap “I choose” to place a set.');
      return;
    }
    const why = lockedReason();
    if (why) {
      showHint(why);
      return;
    }
    const m = currentMoment();
    if (!m) return;
    const before = stateRef.current;
    const move = placeSet(measuredNow(before, m.id), world, m.id, name);
    if (!move.ok) {
      if (move.refusal === 'all_placed') showHint(`Every photo in “${name}” is already on a page.`);
      return;
    }
    const had = new Set(placedRefs(before));
    const landed = (move.state.moments.find((x) => x.id === m.id)?.objects ?? []).filter(
      (o) => isPhoto(o) && !had.has(o.ref),
    );
    setFresh(new Set(landed.map((o) => o.id)));
    commit(move.state);
  };

  const onForgetSet = (name: string) => {
    const why = lockedReason();
    if (why) {
      showHint(why);
      return;
    }
    const cur = stateRef.current;
    const move = forgetSet(cur, world, name);
    if (!move.ok) return;
    commit(move.state);
    withUndo(`Name “${name}” removed · the photos stay put`, cur, selRef.current);
  };

  /* ══ THE PRESS ON A PHOTO OR ON WORDS ═══════════════════════════════════════════════════════
     A drag starts only once the pointer has really moved — a tap whose finger drifts 3px is still
     a tap, not a move (10a DW-08). The element is moved by hand and the change committed ONCE, on
     release; what was just moved comes to the front. */
  const onObjPointerDown = (e: ReactPointerEvent<HTMLDivElement>, obj: ResolvedObject) => {
    if (e.button > 0) return;
    const t = e.target as Element;
    if (t.closest('[data-x]') || t.closest('[data-hdl]')) return;
    const cur = stateRef.current;
    if (cur.mode === 'auto') return; // Automatic answers on the TAP (click)
    if (lockedReason()) return; // …and so does a locked page
    const el = e.currentTarget;
    if (isWords(obj)) {
      let inText = !!t.closest('[data-ed]');
      /* A press on the grip is a drag even when a phone hands it to the text beside it — the
         prototype's round-3 fix for "the grip press becomes a caret" on a phone. */
      const grip = el.querySelector<HTMLElement>('[data-grip]');
      if (inText && grip && e.clientX <= grip.getBoundingClientRect().right + 4) inText = false;
      selectObj(obj.id);
      if (inText) return; // a press in the words is for the caret, not a drag
    } else {
      selectObj(obj.id);
    }
    e.preventDefault();
    // Taking focus here also takes the caret OUT of any words — so a Backspace after this acts on
    // what the host is holding, not on the letters of a caption (10a DW-22 · chaos-17).
    el.focus({ preventScroll: true });
    const sx = e.clientX;
    const sy = e.clientY;
    const x0 = obj.x;
    const y0 = obj.y;
    const TH = e.pointerType === 'touch' ? 10 : 4;
    let moving = false;
    let nx = x0;
    let ny = y0;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* a pointer already gone — the listeners below still end the press */
    }
    const momentId = selRef.current ?? cur.moments[0]?.id ?? '';
    const mv = (ev: PointerEvent) => {
      if (!moving) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < TH) return;
        moving = true;
        busy.current = true;
        el.classList.add(s.dragging!);
      }
      const { scale, height } = layoutRef.current;
      const want = { x: x0 + (ev.clientX - sx) / scale, y: y0 + (ev.clientY - sy) / scale };
      const at = isPhoto(obj)
        ? clampPosition(want.x, want.y, obj.w)
        : clampWords({ ...obj, ...want, w: el.offsetWidth, h: el.offsetHeight });
      nx = at.x;
      // It may go past the bottom — the sheet grows to meet it, a little at a time.
      ny = Math.min(at.y, height - 24);
      el.style.left = `${nx}px`;
      el.style.top = `${ny}px`;
      fit();
      placeBar();
    };
    const up = () => {
      el.removeEventListener('pointermove', mv);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      if (!moving) return;
      busy.current = false;
      el.classList.remove(s.dragging!);
      const move = moveObject(stateRef.current, world, momentId, obj.id, { x: nx, y: ny }, {
        measured: isWords(obj) ? measure(el) : undefined,
      });
      if (move.ok) {
        refocus.current = obj.id;
        commit(move.state);
      }
    };
    el.addEventListener('pointermove', mv);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  /* The round handle (a computer; a phone uses the toolbar): drag to resize AND turn about the
     words' centre. Straight within 5°. Kept on the sheet by the TURNED box, as it goes. */
  const onHandleDown = (e: ReactPointerEvent<HTMLSpanElement>, o: StoredWords) => {
    if (e.button > 0 || stateRef.current.mode !== 'hand' || lockedReason()) return;
    const el = objEl(o.id);
    const ed = el?.querySelector<HTMLElement>('[data-ed]');
    const found = findWords(o.id);
    if (!el || !ed || !found) return;
    e.preventDefault();
    e.stopPropagation();
    selectObj(o.id);
    el.focus({ preventScroll: true });
    const h = e.currentTarget;
    try {
      h.setPointerCapture(e.pointerId);
    } catch {
      /* the listeners below still end the press */
    }
    busy.current = true;
    const r = el.getBoundingClientRect();
    const cxp = r.left + r.width / 2;
    const cyp = r.top + r.height / 2;
    const d0 = Math.hypot(e.clientX - cxp, e.clientY - cyp) || 1;
    const a0 = Math.atan2(e.clientY - cyp, e.clientX - cxp);
    const z0 = o.size;
    const r0 = o.turn;
    let size = z0;
    let turn = r0;
    const mv = (ev: PointerEvent) => {
      const d = Math.hypot(ev.clientX - cxp, ev.clientY - cyp);
      const a = Math.atan2(ev.clientY - cyp, ev.clientX - cxp);
      size = Math.round(Math.max(WORD_SIZE.min, Math.min(WORD_SIZE.max, (z0 * d) / d0)));
      turn = snapTurn(r0 + ((a - a0) * 180) / Math.PI);
      ed.style.fontSize = `${size}px`;
      el.style.maxWidth = `${wordsMaxWidth(size)}px`;
      el.style.transform = turn ? `rotate(${turn}deg)` : '';
      el.style.setProperty('--rot', `${turn}deg`);
      el.dataset.turn = String(turn);
      const at = clampWords({ ...o, turn, w: el.offsetWidth, h: el.offsetHeight });
      el.style.left = `${at.x}px`;
      el.style.top = `${at.y}px`;
      fit();
      placeBar();
    };
    const up = () => {
      h.removeEventListener('pointermove', mv);
      h.removeEventListener('pointerup', up);
      h.removeEventListener('pointercancel', up);
      busy.current = false;
      const move = styleWords(stateRef.current, world, found.m.id, o.id, { size, turn }, measure(el));
      if (move.ok) commit(move.state);
    };
    h.addEventListener('pointermove', mv);
    h.addEventListener('pointerup', up);
    h.addEventListener('pointercancel', up);
  };

  /* In Automatic the refusal is said on a TAP — a swipe that starts on a photo is scrolling the
     page, not asking to edit it. */
  const onObjClick = (e: ReactMouseEvent<HTMLDivElement>, o: ResolvedObject) => {
    if ((e.target as Element).closest('[data-x]')) return;
    if (stateRef.current.mode === 'auto') {
      showHint(isWords(o) ? 'Tap “I choose” to change words.' : 'Tap “I choose” to move or take off photos.');
      return;
    }
    const why = lockedReason();
    if (why) showHint(why);
  };

  /* ══ THE KEYBOARD — Tab, Enter, arrows move, Delete, Cmd/Ctrl+Z, Escape ═════════════════════ */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const root = rootRef.current;
      // The Story Maker keeps its other steps in the DOM; a key pressed on the Theme step must
      // never take a photo off a page nobody can see.
      if (!root || root.offsetParent === null) return;
      const a = document.activeElement as HTMLElement | null;
      if (a && (a.isContentEditable || a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT')) {
        return;
      }
      const inside = !!a && root.contains(a);
      const onBody = !a || a === document.body;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        if ((inside || onBody) && undoRef.current) {
          e.preventDefault();
          doUndo();
        }
        return;
      }
      const onStage = !!a && !!canvasRef.current?.contains(a);
      const sid = selObjRef.current;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!(onStage || (onBody && sid))) return;
        e.preventDefault();
        if (e.repeat) return; // a held key removes one thing, not the whole page (10a F3)
        const focusedEl = onStage ? a?.closest<HTMLElement>('[data-obj]') : null;
        if (stateRef.current.mode === 'auto') {
          showHint(
            focusedEl?.dataset.kind === 'words'
              ? 'Tap “I choose” to change words.'
              : 'Tap “I choose” to move or take off photos.',
          );
          return;
        }
        const target = focusedEl?.dataset.obj ?? sid;
        if (!target) return;
        const obj = currentMoment()?.objects.find((o) => o.id === target);
        // Words go only when they are the thing selected — focus alone is not a choice to delete.
        if (obj && (isPhoto(obj) || sid === obj.id)) removeFromPage(target, true);
        return;
      }
      if (/^Arrow/.test(e.key) && (onStage || onBody) && sid && stateRef.current.mode === 'hand') {
        const m = currentMoment();
        const obj = m?.objects.find((o) => o.id === sid);
        if (!m || !obj) return;
        e.preventDefault();
        if (lockedReason()) {
          showHint(lockedReason()!);
          return;
        }
        // Words move by the keyboard too — the prototype's open item (critic-14).
        const d = e.shiftKey ? 1 : 8;
        const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0;
        const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
        const move = moveObject(
          stateRef.current,
          world,
          m.id,
          obj.id,
          { x: obj.x + dx, y: obj.y + dy },
          { toFront: false },
        );
        if (move.ok) commit(move.state);
        return;
      }
      if (e.key === 'Escape' && (inside || onBody)) {
        if (pop) {
          setPop(false);
          colorBtnRef.current?.focus();
          return;
        }
        if (sid) selectObj(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  /* ══ DRAWING ═══════════════════════════════════════════════════════════════════════════════ */
  const media = input.media;
  const photoLabel = (p: { ref: string; media: 'photo' | 'snippet' }) => {
    const t = media[p.ref]?.time;
    return `${p.media === 'snippet' ? 'snippet' : 'photo'}${t ? ` from ${t}` : ''}`;
  };
  const editable = !auto && !unreadable && !conflict;

  const drawPhoto = (o: ResolvedPhoto) => {
    const m = media[o.ref];
    const label = photoLabel(o);
    return (
      <div
        key={o.id}
        data-obj={o.id}
        data-kind="photo"
        className={cx(s.obj, s.ph, selObj === o.id && !auto && s.sel, fresh.has(o.id) && s.fresh)}
        style={{ left: o.x, top: o.y, width: o.w, height: o.h }}
        tabIndex={0}
        role="group"
        aria-label={label.charAt(0).toUpperCase() + label.slice(1)}
        onPointerDown={(e) => onObjPointerDown(e, o)}
        onClick={(e) => onObjClick(e, o)}
        onFocus={() => {
          if (stateRef.current.mode === 'hand') selectObj(o.id);
        }}
        onAnimationEnd={() => {
          if (fresh.has(o.id)) setFresh(new Set());
        }}
      >
        <div className={s.scene}>
          {m?.url ? (
            // Presigned address, plain <img> — never next/image on this surface (as the editor's
            // own chapter thumbnails).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.url} alt="" draggable={false} loading="lazy" decoding="async" />
          ) : null}
          {m?.time ? <span className={s.stamp}>{m.time}</span> : null}
        </div>
        {o.media === 'snippet' ? <span className={s.clipbig}>▶ Snippet</span> : null}
        <button
          type="button"
          data-x=""
          className={s.x}
          aria-label={`Take the ${label} off the page`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            removeFromPage(o.id, e.detail === 0);
          }}
        >
          ×
        </button>
      </div>
    );
  };

  const drawWords = (o: StoredWords) => (
    <WordsBox
      key={o.id}
      o={o}
      editable={editable}
      plainOnly={plainOnly}
      selected={selObj === o.id && !auto}
      onPointerDown={(e) => onObjPointerDown(e, o)}
      onClick={(e) => onObjClick(e, o)}
      onFocusWords={() => onWordsFocus(o)}
      onBlurArea={(related) => onWordsAreaBlur(o.id, related)}
      onInput={(ed) => onWordsInput(o, ed)}
      onEscape={() => {
        if (pop) {
          setPop(false);
          return;
        }
        // Escape stops typing AND lets go of the words — so a Backspace after it cannot delete
        // the caption the host only meant to stop editing (10a R12).
        selectObj(null);
        canvasRef.current?.focus({ preventScroll: true });
      }}
      onTabOutOfEmpty={(el, back) => focusBeside(el, back, barRef.current)}
      onHandleDown={(e) => onHandleDown(e, o)}
      onRemove={(byKey) => removeFromPage(o.id, byKey)}
    />
  );

  const current = moment;
  const photosHere = current ? photoCount(current) : 0;
  const empty = !current || current.objects.length === 0;
  const emptyText = auto
    ? current?.source === 'host'
      ? 'Automatic leaves moments you added alone — tap I choose to put photos here.'
      : 'No photo from the day falls in this moment yet.'
    : 'Nothing here yet. Tap a photo below, or add words.';

  const trayEmptyText =
    pool.length === 0
      ? 'No Papic photos or snippets from the day yet.'
      : auto
        ? 'Every photo is in a moment.'
        : 'Everything is on a page. Tap × on a photo to bring it back here.';

  const savedText =
    saveState === 'saving'
      ? 'Saving…'
      : saveState === 'saved'
        ? 'Saved'
        : saveState === 'failed'
          ? saveError ?? 'Could not save.'
          : saveState === 'conflict'
            ? 'Not saved'
            : '';

  const filmKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    // A held Enter or Space adds one photo, not a row of them (10a r3 R1-held-enter).
    if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault();
  };

  // While a grip is held the rows are drawn in the order under the finger — every moment the
  // state holds, once, whatever a key did in the meantime.
  const rows: ResolvedMoment[] = useMemo(() => {
    if (!dragOrder) return state.moments;
    const byId = new Map(state.moments.map((m) => [m.id, m] as const));
    const out = dragOrder.map((id) => byId.get(id)).filter((m): m is ResolvedMoment => !!m);
    for (const m of state.moments) if (!out.includes(m)) out.push(m);
    return out;
  }, [dragOrder, state.moments]);

  /** The newest name a photo carries — what its tray film shows. */
  const setNameOf = useMemo(() => {
    const out = new Map<string, string>();
    for (const g of state.sets) for (const r of g.refs) out.set(r, g.name);
    return out;
  }, [state.sets]);

  const selWords = !auto && selObj ? (current?.objects.find((o) => o.id === selObj) ?? null) : null;
  const barWords = selWords && isWords(selWords) && editable ? selWords : null;
  const namingHere = naming && current && naming.id === current.id ? naming : null;
  const setFieldOpen = setNaming_ && !auto && photosHere >= 2;
  const canRemoveMoment = !auto && state.moments.length > 1;

  return (
    <section ref={rootRef} className={s.root} aria-labelledby="make-it-yours-title">
      <div className={s.head}>
        <h2 id="make-it-yours-title" className={s.title}>
          Make it yours
        </h2>
        <p className={s.lede}>
          <b>Automatic</b> sorts photos by your run of show. In <b>I choose</b>, tap a photo to put
          it on the page and <b>×</b> to take it off. Drag the round handle to resize or turn words.
        </p>
      </div>

      <div className={s.cols}>
        <div className={s.box}>
          <div className={s.bh}>
            <h3>Moments</h3>
            <button type="button" className={s.mini} hidden={auto} onClick={onNewMoment}>
              + New
            </button>
          </div>
          <div className={s.modewrap}>
            <div className={s.seg} role="group" aria-label="How moments are made">
              <button
                type="button"
                className={cx(auto && s.on)}
                aria-pressed={auto}
                aria-disabled={!hasSchedule}
                onClick={onAutomatic}
              >
                {auto ? '✓ ' : ''}Automatic
              </button>
              <button
                ref={chooseRef}
                type="button"
                className={cx(!auto && s.on)}
                aria-pressed={!auto}
                aria-disabled={false}
                onClick={onChoose}
              >
                {!auto ? '✓ ' : ''}I choose
              </button>
            </div>
            <p className={s.modenote}>
              {!hasSchedule ? (
                <>
                  Automatic needs a run of show.{' '}
                  <a className={s.linkbtn} href={`/dashboard/${eventId}/schedule`}>
                    Add your schedule
                  </a>{' '}
                  and your photos sort themselves by it.
                </>
              ) : auto ? (
                'Photos sort themselves into your run of show, and keep sorting as more arrive.'
              ) : (
                'You choose what goes on each page.'
              )}
            </p>
          </div>
          {/* A LIST OF ROWS, each holding its own buttons side by side — never a row that is a
              button with another button inside it (the prototype's open accessibility item). */}
          <div ref={listRef} className={s.chaps} role="list" aria-label="Moments">
            {rows.map((m) => {
              const on = m.id === current?.id;
              const n = photoCount(m);
              const time = input.momentTimes[m.id] || (m.source === 'host' ? 'added by you' : '');
              const name = m.name ?? 'A moment';
              return (
                <div
                  key={m.id}
                  role="listitem"
                  data-row={m.id}
                  className={cx(s.chap, on && s.on, auto && s.locked, draggingRow === m.id && s.drag)}
                >
                  <span
                    className={s.grip}
                    aria-hidden="true"
                    title="Drag to reorder"
                    onPointerDown={(e) => onGripDown(e, m.id)}
                  >
                    ⋮⋮
                  </span>
                  <button
                    type="button"
                    data-moment={m.id}
                    className={s.pick}
                    aria-current={on ? 'true' : undefined}
                    title={name}
                    onClick={() => pickMoment(m.id)}
                    onKeyDown={(e) => onMomentKey(e, m.id)}
                  >
                    <span className={s.nm}>
                      <b>{name}</b>
                      <small>{time || ' '}</small>
                    </span>
                    <span className={s.pill} aria-label={`${n} photo${n === 1 ? '' : 's'}`}>
                      {n}
                    </span>
                  </button>
                  <button
                    type="button"
                    data-cx={m.id}
                    className={s.cx}
                    aria-label={`Remove ${name}`}
                    hidden={!canRemoveMoment}
                    onClick={(e) => onRemoveMoment(m.id, e.detail === 0)}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className={s.box}>
          <div className={s.bh}>
            <div className={s.sh}>
              {namingHere ? (
                <NameField
                  key={`${namingHere.id}:${namingHere.isNew}`}
                  initial={namingHere.isNew ? '' : (current?.name ?? '')}
                  onDone={(value, keep) => {
                    finishNaming(namingHere, value, keep);
                    afterRender.current.push(() => renameRef.current?.focus());
                  }}
                  onBlurKeep={(value) => finishNaming(namingHere, value, true)}
                />
              ) : (
                <h3>{current?.name ?? 'A moment'}</h3>
              )}
              <button
                ref={renameRef}
                type="button"
                className={s.mini}
                aria-label="Rename this moment"
                title="Rename"
                hidden={auto || !!namingHere}
                onClick={onRename}
              >
                ✎
              </button>
            </div>
            <div className={s.sh}>
              <span className={s.n}>{current ? input.momentTimes[current.id] ?? '' : ''}</span>
              <button
                type="button"
                className={s.mini}
                hidden={auto || photosHere === 0}
                onClick={onPutAllBack}
              >
                Put all back
              </button>
            </div>
          </div>
          {unreadable ? (
            <p className={s.alert} role="alert">
              <b>We couldn’t load {input.unreadable.join(' and ')}.</b> What you see may be missing
              photos because of that, not because they are gone — so nothing here is saved until you{' '}
              <button type="button" onClick={() => window.location.reload()}>
                reload
              </button>
              .
            </p>
          ) : null}
          {conflict ? (
            <p className={s.alert} role="alert">
              {conflict}
              <button type="button" onClick={() => window.location.reload()}>
                Reload
              </button>
            </p>
          ) : null}
          <div className={s.autolock} hidden={!auto}>
            <span aria-hidden="true">🕘</span>
            <span>
              <b>Sorted by your run of show.</b> Tap <i>I choose</i> to change it — you start from
              this.
            </span>
          </div>
          <div ref={stageRef} className={cx(s.stage, auto && s.locked)}>
            <div
              ref={canvasRef}
              className={s.canvas}
              tabIndex={-1}
              aria-label="This moment’s page"
              onPointerDown={(e) => {
                if (e.target !== e.currentTarget) return;
                const a = document.activeElement as HTMLElement | null;
                if (a?.isContentEditable) a.blur();
                selectObj(null);
              }}
            >
              {current?.objects.map((o) => (isPhoto(o) ? drawPhoto(o) : drawWords(o)))}
            </div>
            <p className={s.emptystage} hidden={!empty}>
              {emptyText}
            </p>
          </div>
          {barWords ? (
            <div
              ref={barRef}
              className={s.tbar}
              role="toolbar"
              aria-label="Words"
              // Nothing on the bar — not even its padding — takes the caret out of the words.
              onPointerDown={(e) => e.preventDefault()}
              onBlur={(e: ReactFocusEvent<HTMLDivElement>) => onWordsAreaBlur(barWords.id, e.relatedTarget)}
              style={{ '--tcol': WORD_INK[barWords.color] } as CSSProperties}
            >
              <div className={s.tg}>
                <button type="button" className={s.tb} aria-label="Smaller text" onClick={() => onToolbar('smaller')}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 12h14" />
                  </svg>
                </button>
                <span className={s.tsz} title="Text size">
                  <span className="sr-only">Text size </span>
                  {barWords.size}
                </span>
                <button type="button" className={s.tb} aria-label="Bigger text" onClick={() => onToolbar('bigger')}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>
              <span className={s.tdiv} aria-hidden="true" />
              <div className={s.tg}>
                <button
                  ref={colorBtnRef}
                  type="button"
                  className={s.tb}
                  aria-label="Text colour"
                  aria-haspopup="true"
                  aria-expanded={pop}
                  onClick={(e) => {
                    const open = !pop;
                    setPop(open);
                    if (open && e.detail === 0) {
                      afterRender.current.push(() => {
                        const bar = barRef.current;
                        (
                          bar?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ??
                          bar?.querySelector<HTMLElement>('[role="radio"]')
                        )?.focus();
                      });
                    }
                  }}
                >
                  <span className={s.tA} aria-hidden="true">
                    A
                  </span>
                  <span className={s.tline} />
                </button>
                <button
                  type="button"
                  className={s.tb}
                  aria-label="Background behind the words"
                  aria-pressed={barWords.backing}
                  onClick={() => onToolbar('backing')}
                >
                  <span className={s.tfill} aria-hidden="true">
                    A
                  </span>
                </button>
              </div>
              <span className={s.tdiv} aria-hidden="true" />
              <div className={s.tg}>
                <button type="button" className={s.tb} aria-label="Turn left" onClick={() => onToolbar('left')}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 4v5h5" />
                    <path d="M4.6 9A8 8 0 1 1 6 17" />
                  </svg>
                </button>
                <button type="button" className={s.tb} aria-label="Turn right" onClick={() => onToolbar('right')}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M20 4v5h-5" />
                    <path d="M19.4 9A8 8 0 1 0 18 17" />
                  </svg>
                </button>
              </div>
              <span className={s.tdiv} aria-hidden="true" />
              <button type="button" className={s.tb} aria-label="Remove these words" onClick={() => onToolbar('remove')}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
                </svg>
              </button>
              <div
                className={s.tpop}
                role="radiogroup"
                aria-label="Text colour"
                hidden={!pop}
              >
                {WORD_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    className={s.tsw}
                    aria-label={WORD_COLOR_NAME[c]}
                    aria-checked={barWords.color === c}
                    style={{ '--c': WORD_INK[c] } as CSSProperties}
                    onClick={() => onPickColor(c)}
                  />
                ))}
              </div>
            </div>
          ) : null}
          <div className={s.bar}>
            <button type="button" className={s.btn} aria-disabled={!editable} onClick={onAddWords}>
              + Words
            </button>
            <button
              ref={nameSetRef}
              type="button"
              className={s.btn}
              aria-disabled={!editable || photosHere < 2}
              onClick={onNameSet}
            >
              Name these photos
            </button>
            <button
              type="button"
              className={cx(s.btn, s.pri)}
              aria-disabled={unreadable || !!conflict}
              onClick={() => {
                const why = lockedReason();
                if (why) {
                  showHint(why);
                  return;
                }
                void flush();
              }}
            >
              Save
            </button>
            <span
              className={cx(s.saved, (saveState === 'failed' || saveState === 'conflict') && s.bad)}
              hidden={!savedText}
              role="status"
            >
              {savedText}
            </span>
          </div>
          <div className={s.setname} hidden={!setFieldOpen}>
            <input
              ref={setInputRef}
              className={s.nameInput}
              maxLength={SET_NAME_MAX}
              aria-label="A name for these photos"
              placeholder="A name, like The entourage"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveSet();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  closeSetNaming();
                }
              }}
            />
            <button type="button" className={cx(s.btn, s.pri)} onClick={saveSet}>
              Name them
            </button>
            <button type="button" className={s.btn} onClick={closeSetNaming}>
              Cancel
            </button>
          </div>
          <div className={s.tray}>
            <div className={s.tt}>
              <span>Not placed yet</span>
              <span className={s.n}>
                {auto
                  ? 'sorted by your run of show'
                  : tray.length
                    ? `${tray.length} left · tap to add`
                    : 'all placed'}
              </span>
            </div>
            <div ref={filmsRef} className={s.films} tabIndex={-1}>
              {tray.map((p, i) => {
                const m = media[p.ref];
                const g = setNameOf.get(p.ref);
                return (
                  <button
                    key={p.ref}
                    type="button"
                    data-film={p.ref}
                    className={cx(s.film, backRef === p.ref && s.returning)}
                    aria-label={`Put the ${photoLabel(p)} on this page`}
                    onKeyDown={filmKeyDown}
                    onAnimationEnd={() => {
                      if (backRef === p.ref) setBackRef(null);
                    }}
                    onClick={(e) => addFromTray(p.ref, i, e.detail === 0)}
                  >
                    <div className={s.scene}>
                      {m?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.url} alt="" draggable={false} loading="lazy" decoding="async" />
                      ) : null}
                      {m?.time ? <span className={s.stamp}>{m.time}</span> : null}
                    </div>
                    {p.media === 'snippet' ? <span className={s.clip}>▶</span> : null}
                    <span className={s.tick} aria-hidden="true">
                      +
                    </span>
                    {g ? <span className={s.gname}>{g}</span> : null}
                  </button>
                );
              })}
            </div>
            <p className={s.trayEmpty} hidden={tray.length > 0}>
              {trayEmptyText}
            </p>
            {input.poolTruncated ? (
              <p className={s.trayEmpty}>
                Showing the first 1,000 photos and snippets from the day.
              </p>
            ) : null}
            {state.sets.length ? (
              <div className={s.groups}>
                {state.sets.map((g) => {
                  const { free, total } = setFree(state, g);
                  // What is still FREE to place, not how many the name holds (10a critic-15).
                  const say =
                    free.length === total ? String(total) : free.length ? `${free.length} of ${total}` : 'all placed';
                  return (
                    <span key={g.name} className={s.grp} data-chip={g.name}>
                      <button
                        type="button"
                        className={s.grpUse}
                        title="Put these on this page"
                        onClick={() => onUseSet(g.name)}
                      >
                        {g.name} · {say}
                      </button>
                      <button
                        type="button"
                        className={s.grpX}
                        aria-label={`Forget the name ${g.name}`}
                        onClick={() => onForgetSet(g.name)}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div
        className={cx(s.hint, toast.on && s.on, toast.live && s.act)}
        role="status"
        aria-live="polite"
      >
        {toast.on ? (
          <span key={toast.n}>
            {toast.msg}
            {toast.live ? (
              <button type="button" className={s.undo} onClick={doUndo}>
                Undo
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
    </section>
  );
}

/* ══ ONE BOX OF WORDS ══════════════════════════════════════════════════════════════════════════
   Its text is drawn once and then belongs to the browser while the host types; a change from
   outside (an Undo) is written back only when the box is not being typed in. */
function WordsBox({
  o,
  editable,
  plainOnly,
  selected,
  onPointerDown,
  onClick,
  onFocusWords,
  onBlurArea,
  onInput,
  onEscape,
  onTabOutOfEmpty,
  onHandleDown,
  onRemove,
}: {
  o: StoredWords;
  editable: boolean;
  plainOnly: boolean;
  selected: boolean;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onClick: (e: ReactMouseEvent<HTMLDivElement>) => void;
  onFocusWords: () => void;
  onBlurArea: (related: EventTarget | null) => void;
  onInput: (ed: HTMLElement) => void;
  onEscape: () => void;
  onTabOutOfEmpty: (el: HTMLElement, back: boolean) => void;
  onHandleDown: (e: ReactPointerEvent<HTMLSpanElement>) => void;
  onRemove: (byKey: boolean) => void;
}): ReactElement {
  /*
    🔴 THE SAME OBJECT ON EVERY RENDER, NOT JUST THE SAME STRING. Found driving the editor: React 19
    re-applies `dangerouslySetInnerHTML` whenever the object is new, so a fresh `{ __html }` on each
    render wiped every letter the moment it was typed — the box stayed empty under the caret.
  */
  const [inner] = useState(() => ({ __html: toHtml(o.text) }));
  const boxRef = useRef<HTMLDivElement>(null);
  const edRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ed = edRef.current;
    if (!ed) return;
    if (document.activeElement !== ed && readText(ed) !== o.text) ed.innerText = o.text;
    ed.toggleAttribute('data-empty', (document.activeElement === ed ? readText(ed) : o.text) === '');
  });

  const preview = o.text.trim().split('\n')[0]?.slice(0, 40) ?? '';

  return (
    <div
      ref={boxRef}
      data-obj={o.id}
      data-kind="words"
      data-turn={o.turn || undefined}
      className={cx(s.obj, s.tx, o.backing && s.pillw, selected && s.sel)}
      style={
        {
          left: o.x,
          top: o.y,
          maxWidth: wordsMaxWidth(o.size),
          transform: o.turn ? `rotate(${o.turn}deg)` : undefined,
          '--tc': WORD_INK[o.color],
          '--rot': `${o.turn}deg`,
        } as CSSProperties
      }
      tabIndex={0}
      role="group"
      aria-label={preview ? `Words: ${preview}` : 'Words'}
      onPointerDown={onPointerDown}
      onClick={onClick}
      onFocus={(e) => {
        if (e.target === e.currentTarget || e.target === edRef.current) onFocusWords();
      }}
      onBlur={(e) => onBlurArea(e.relatedTarget)}
      onKeyDown={(e) => {
        // On the box (not in its text): Enter starts typing, at the end of what is there.
        if (e.target !== e.currentTarget || e.key !== 'Enter' || !editable) return;
        e.preventDefault();
        if (edRef.current) caretToEnd(edRef.current);
      }}
    >
      <span className={s.grip2} data-grip="" aria-hidden="true">
        ⋮⋮
      </span>
      <span className={s.hdl} data-hdl="" aria-hidden="true" onPointerDown={onHandleDown} />
      <div
        ref={edRef}
        data-ed=""
        className={s.ed}
        style={{ fontSize: o.size }}
        contentEditable={editable ? (plainOnly ? 'plaintext-only' : true) : false}
        suppressContentEditableWarning
        tabIndex={-1}
        data-ph="Type here"
        spellCheck={false}
        role="textbox"
        aria-multiline="true"
        aria-label="Words on this page"
        dangerouslySetInnerHTML={inner}
        onInput={(e) => onInput(e.currentTarget)}
        onPaste={(e) => {
          // Plain text only — pasted bold, links or pictures would show while typing and vanish
          // on the next read (10a critic-13).
          e.preventDefault();
          const t = e.clipboardData.getData('text/plain');
          if (t) document.execCommand('insertText', false, t);
        }}
        // Words are typed, never dropped — a dragged row's id once landed in a caption (critic-6).
        onDrop={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            onEscape();
            return;
          }
          if (e.key === 'Tab' && readText(e.currentTarget).trim() === '' && boxRef.current) {
            e.preventDefault();
            onTabOutOfEmpty(boxRef.current, e.shiftKey);
          }
        }}
      />
      <button
        type="button"
        data-x=""
        className={s.x}
        aria-label="Remove these words"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onRemove(e.detail === 0);
        }}
      >
        ×
      </button>
    </div>
  );
}

/* ══ THE NAME FIELD IN THE PAGE'S HEADER ═══════════════════════════════════════════════════════
   Enter keeps the name; Escape keeps the old one (and cancels a new moment); leaving it keeps
   what was typed — unless the whole window lost focus, which is not the host leaving it. */
function NameField({
  initial,
  onDone,
  onBlurKeep,
}: {
  initial: string;
  onDone: (value: string, keep: boolean) => void;
  onBlurKeep: (value: string) => void;
}): ReactElement {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useLayoutEffect(() => {
    const inp = ref.current;
    if (!inp) return;
    inp.focus({ preventScroll: true });
    inp.select();
  }, []);
  const finish = (value: string, keep: boolean, blur: boolean) => {
    if (done.current) return;
    done.current = true;
    if (blur) onBlurKeep(value);
    else onDone(value, keep);
  };
  return (
    <input
      ref={ref}
      className={s.nameInput}
      defaultValue={initial}
      maxLength={MOMENT_NAME_MAX}
      placeholder="Name this moment"
      aria-label="Name this moment"
      data-name-input=""
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(e.currentTarget.value, true, false);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          finish('', false, false);
        }
      }}
      onBlur={(e) => {
        if (!document.hasFocus()) return;
        finish(e.currentTarget.value, true, true);
      }}
    />
  );
}
