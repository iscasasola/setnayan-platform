'use client';

/**
 * "MAKE IT YOURS" — THE PHOTO HALF (`10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md` step 4).
 *
 * PORTED FROM `prototypes/story_make_it_yours_2026-09-10.html` (owner-passed 2026-09-10), never
 * redrawn: the moments beside the page; the desk and the fixed 660 sheet scaled to fit; the tray of
 * UNPLACED Papic photos and snippets; a tap is the add; the × on every photo, always showing,
 * counter-scaled, no invisible halo; a drag that starts only past 4px (10px for a finger), brings
 * the photo to the front and grows the sheet downward; Automatic vs I choose; Put all back; Undo
 * for every removal; every change saved through step 3's one action; the keyboard.
 *
 * NOT HERE (step 6): writing words, their looks and toolbar, naming moments, named sets, adding or
 * removing or reordering moments. ⛔ No stickers at all (owner, for now). Words a page already
 * holds are DRAWN, exactly as kept, and saved back untouched.
 *
 * ── THE RULES THIS FILE KEEPS, EACH ONE A DEFECT A REAL BROWSER FOUND IN THE PROTOTYPE ─────────
 *  • NEVER REBUILD THE PAGE ON A PRESS. A drag moves the element it pressed, by hand, and commits
 *    once on release — so the element holding the pointer is never replaced mid-press.
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
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from 'react';

import {
  SHEET_BOTTOM_ROOM,
  SHEET_MIN_HEIGHT,
  SHEET_WIDTH,
  storedFromResolved,
  type ResolvedArrangement,
  type ResolvedMoment,
  type ResolvedObject,
  type ResolvedPhoto,
  type StoredWords,
} from '@/lib/story-arrangement';
import {
  clampPosition,
  isPhoto,
  moveObject,
  photoCount,
  placePhoto,
  placedRefs,
  putAllBack,
  removeObject,
  toAutomatic,
  toHand,
  type MakeItYoursWorld,
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

const WORD_INK: Record<StoredWords['color'], string> = {
  ink: 'var(--ink)',
  terracotta: 'var(--act)',
  blue: 'var(--link)',
  gold: 'var(--tgold)',
};

type SaveState = 'idle' | 'saving' | 'saved' | 'failed' | 'conflict';

type Toast = { msg: string; live: boolean; n: number; on: boolean };

export function MakeItYours({
  eventId,
  input,
}: {
  eventId: string;
  input: MakeItYoursInput;
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
  const [freshId, setFreshId] = useState<string | null>(null);
  const [backRef, setBackRef] = useState<string | null>(null);

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
  const layoutRef = useRef({ scale: 1, height: SHEET_MIN_HEIGHT });
  /** The photo a finished drag should hand the keyboard's focus back to, once React has re-drawn. */
  const refocus = useRef<string | null>(null);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  /* ══ THE SHEET, SCALED TO FIT ═══════════════════════════════════════════════════════════════
     Measured from the elements themselves, like the prototype's `fitStage`, so a drag in progress
     grows the sheet as it goes. A resize only changes how big the sheet is drawn: nothing is
     moved, nothing is re-dealt. */
  const fit = useCallback(() => {
    const st = stageRef.current;
    const cv = canvasRef.current;
    if (!st || !cv) return;
    const W = st.clientWidth;
    if (!W) return; // the panel is hidden — the observer calls again when it opens
    const scale = Math.min(1, (W - DESK_PAD) / SHEET_WIDTH);
    let bottom = 0;
    cv.querySelectorAll<HTMLElement>('[data-obj]').forEach((e) => {
      bottom = Math.max(bottom, e.offsetTop + e.offsetHeight);
    });
    const height = Math.max(SHEET_MIN_HEIGHT, Math.ceil(bottom) + SHEET_BOTTOM_ROOM);
    cv.style.height = `${height}px`;
    cv.style.transform = `scale(${scale})`;
    cv.style.left = `${Math.round((W - SHEET_WIDTH * scale) / 2)}px`;
    cv.style.setProperty('--inv', (1 / scale).toFixed(4));
    st.style.height = `${Math.ceil(height * scale + DESK_PAD)}px`;
    layoutRef.current = { scale, height };
  }, []);

  useLayoutEffect(() => {
    fit();
    // What you just dragged came to the front — React re-appended it, which drops focus. Give it
    // back, so Delete and the arrows still act on the photo the host is holding.
    const id = refocus.current;
    if (id) {
      refocus.current = null;
      canvasRef.current
        ?.querySelector<HTMLElement>(`[data-obj="${id}"]`)
        ?.focus({ preventScroll: true });
    }
  });

  useEffect(() => {
    const st = stageRef.current;
    if (!st || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(st);
    return () => ro.disconnect();
  }, [fit]);

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
      result = await saveArrangement(
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
  }, [eventId, unreadable]);

  const scheduleSave = useCallback(() => {
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flush(), SAVE_AFTER_MS);
  }, [flush]);

  // A tab put away with a change still waiting is saved now, not in 400ms that may never come.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && saveTimer.current) void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
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

  const doUndo = useCallback(() => {
    const u = undoRef.current;
    if (!u || busy.current || Date.now() >= u.until) return;
    undoRef.current = null;
    u.fn();
  }, []);

  const withUndo = useCallback(
    (msg: string, snapshot: ResolvedArrangement, snapSel: string | null) => {
      showHint(msg, () => {
        commit(snapshot, { keepUndo: true });
        if (snapSel && snapshot.moments.some((m) => m.id === snapSel)) setSel(snapSel);
        setSelObj(null);
        showHint('Undone');
      });
    },
    [commit, showHint],
  );

  /** Nothing may change: the reason, said where the person is looking. */
  const lockedReason = (): string | null => {
    if (unreadable) {
      return 'We couldn’t load everything on this story, so nothing here can change until you reload.';
    }
    if (conflictRef.current) return conflictRef.current;
    return null;
  };

  /* ══ THE MOVES ══════════════════════════════════════════════════════════════════════════════ */
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
    const move = placePhoto(cur, world, at, ref);
    if (!move.ok) return;
    const added = move.state.moments
      .find((m) => m.id === at)
      ?.objects.find((o) => isPhoto(o) && o.ref === ref);
    setFreshId(added?.id ?? null);
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

  const removeFromPage = (objectId: string, byKey: boolean) => {
    const cur = stateRef.current;
    const m = cur.moments.find((x) => x.id === selRef.current) ?? cur.moments[0];
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
    if (selObjRef.current === objectId) setSelObj(null);
    if (isPhoto(target)) setBackRef(target.ref);
    commit(move.state);
    withUndo('Back in the tray', cur, m.id);
    if (byKey) {
      requestAnimationFrame(() => {
        const after = move.state.moments.find((x) => x.id === m.id)?.objects ?? [];
        const next = after[idx] ?? after[idx - 1];
        const el = next && canvasRef.current?.querySelector<HTMLElement>(`[data-obj="${next.id}"]`);
        (el ?? canvasRef.current)?.focus({ preventScroll: true });
      });
    }
  };

  const onPutAllBack = () => {
    const cur = stateRef.current;
    const m = cur.moments.find((x) => x.id === selRef.current) ?? cur.moments[0];
    if (!m) return;
    const why = lockedReason();
    if (why) {
      showHint(why);
      return;
    }
    const n = photoCount(m);
    const move = putAllBack(cur, world, m.id);
    if (!move.ok) return;
    setSelObj(null);
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
    setSelObj(null);
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
    setSel(id);
    setSelObj(null);
  };

  /* ══ THE PRESS ON A PHOTO ═══════════════════════════════════════════════════════════════════
     A drag starts only once the pointer has really moved — a tap whose finger drifts 3px is still
     a tap, not a move (10a DW-08). The element is moved by hand and the change committed ONCE, on
     release; what was just moved comes to the front. */
  const onObjPointerDown = (e: ReactPointerEvent<HTMLDivElement>, obj: ResolvedObject) => {
    if (e.button > 0) return;
    if ((e.target as Element).closest('[data-x]')) return;
    const cur = stateRef.current;
    if (cur.mode === 'auto' || !isPhoto(obj)) return; // Automatic answers on the TAP (click)
    if (lockedReason()) return; // …and so does a locked page
    const el = e.currentTarget;
    setSelObj(obj.id);
    e.preventDefault();
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
      const at = clampPosition(
        x0 + (ev.clientX - sx) / scale,
        y0 + (ev.clientY - sy) / scale,
        obj.w,
      );
      nx = at.x;
      // It may go past the bottom — the sheet grows to meet it, a little at a time.
      ny = Math.min(at.y, height - 24);
      el.style.left = `${nx}px`;
      el.style.top = `${ny}px`;
      fit();
    };
    const up = () => {
      el.removeEventListener('pointermove', mv);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      if (!moving) return;
      busy.current = false;
      el.classList.remove(s.dragging!);
      const move = moveObject(stateRef.current, world, momentId, obj.id, { x: nx, y: ny });
      if (move.ok) {
        refocus.current = obj.id;
        commit(move.state);
      }
    };
    el.addEventListener('pointermove', mv);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  /* In Automatic the refusal is said on a TAP — a swipe that starts on a photo is scrolling the
     page, not asking to edit it. */
  const onObjClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('[data-x]')) return;
    if (stateRef.current.mode === 'auto') {
      showHint('Tap “I choose” to move or take off photos.');
      return;
    }
    const why = lockedReason();
    if (why) showHint(why);
  };

  /* ══ THE KEYBOARD — Tab, Enter, arrows move, Delete, Cmd/Ctrl+Z ═════════════════════════════ */
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
        if (stateRef.current.mode === 'auto') {
          showHint('Tap “I choose” to move or take off photos.');
          return;
        }
        const focused = onStage ? a?.closest<HTMLElement>('[data-obj]')?.dataset.obj : null;
        const target = focused ?? sid;
        if (!target) return;
        const cur = stateRef.current;
        const m = cur.moments.find((x) => x.id === selRef.current) ?? cur.moments[0];
        const obj = m?.objects.find((o) => o.id === target);
        if (obj && isPhoto(obj)) removeFromPage(target, true);
        return;
      }
      if (/^Arrow/.test(e.key) && (onStage || onBody) && sid && stateRef.current.mode === 'hand') {
        const cur = stateRef.current;
        const m = cur.moments.find((x) => x.id === selRef.current) ?? cur.moments[0];
        const obj = m?.objects.find((o) => o.id === sid);
        if (!m || !obj || !isPhoto(obj)) return;
        e.preventDefault();
        if (lockedReason()) {
          showHint(lockedReason()!);
          return;
        }
        const d = e.shiftKey ? 1 : 8;
        const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0;
        const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
        const move = moveObject(
          cur,
          world,
          m.id,
          obj.id,
          { x: obj.x + dx, y: obj.y + dy },
          { toFront: false },
        );
        if (move.ok) commit(move.state);
        return;
      }
      if (e.key === 'Escape' && sid && (inside || onBody)) setSelObj(null);
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

  const drawPhoto = (o: ResolvedPhoto) => {
    const m = media[o.ref];
    const label = photoLabel(o);
    return (
      <div
        key={o.id}
        data-obj={o.id}
        className={cx(s.obj, s.ph, selObj === o.id && !auto && s.sel, freshId === o.id && s.fresh)}
        style={{ left: o.x, top: o.y, width: o.w, height: o.h }}
        tabIndex={0}
        role="group"
        aria-label={label.charAt(0).toUpperCase() + label.slice(1)}
        onPointerDown={(e) => onObjPointerDown(e, o)}
        onClick={onObjClick}
        onFocus={() => {
          if (stateRef.current.mode === 'hand') setSelObj(o.id);
        }}
        onAnimationEnd={() => {
          if (freshId === o.id) setFreshId(null);
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
    <div
      key={o.id}
      data-obj={o.id}
      className={cx(s.obj, s.tx, o.backing && s.pillw)}
      style={
        {
          left: o.x,
          top: o.y,
          maxWidth: Math.round((400 * o.size) / 19),
          transform: o.turn ? `rotate(${o.turn}deg)` : undefined,
          '--tc': WORD_INK[o.color],
        } as CSSProperties
      }
    >
      <div className={s.ed} style={{ fontSize: o.size }}>
        {o.text}
      </div>
    </div>
  );

  const current = moment;
  const photosHere = current ? photoCount(current) : 0;
  const empty = !current || current.objects.length === 0;
  const emptyText = auto
    ? current?.source === 'host'
      ? 'Automatic leaves moments you added alone — tap I choose to put photos here.'
      : 'No photo from the day falls in this moment yet.'
    : 'Nothing here yet. Tap a photo below.';

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

  return (
    <section ref={rootRef} className={s.root} aria-labelledby="make-it-yours-title">
      <div className={s.head}>
        <h2 id="make-it-yours-title" className={s.title}>
          Make it yours
        </h2>
        <p className={s.lede}>
          <b>Automatic</b> sorts your photos by your run of show. In <b>I choose</b>, tap a photo to
          put it on the page and <b>×</b> to take it off.
        </p>
      </div>

      <div className={s.cols}>
        <div className={s.box}>
          <div className={s.bh}>
            <h3>Moments</h3>
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
          <div className={s.chaps} aria-label="Moments">
            {state.moments.map((m, i) => {
              const on = m.id === current?.id;
              const n = photoCount(m);
              const time = input.momentTimes[m.id] || (m.source === 'host' ? 'added by you' : '');
              return (
                <button
                  key={m.id}
                  type="button"
                  data-moment={m.id}
                  className={cx(s.chap, on && s.on)}
                  aria-current={on ? 'true' : undefined}
                  title={m.name ?? 'A moment'}
                  onClick={() => pickMoment(m.id)}
                  onKeyDown={(e) => {
                    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                    e.preventDefault();
                    const rows = e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[data-moment]');
                    rows?.[i + (e.key === 'ArrowUp' ? -1 : 1)]?.focus();
                  }}
                >
                  <span className={s.nm}>
                    <b>{m.name ?? 'A moment'}</b>
                    <small>{time || '\u00a0'}</small>
                  </span>
                  <span className={s.pill} aria-label={`${n} photo${n === 1 ? '' : 's'}`}>
                    {n}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={s.box}>
          <div className={s.bh}>
            <div className={s.sh}>
              <h3>{current?.name ?? 'A moment'}</h3>
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
                if (e.target === e.currentTarget) setSelObj(null);
              }}
            >
              {current?.objects.map((o) => (isPhoto(o) ? drawPhoto(o) : drawWords(o)))}
            </div>
            <p className={s.emptystage} hidden={!empty}>
              {emptyText}
            </p>
          </div>
          <div className={s.bar}>
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
