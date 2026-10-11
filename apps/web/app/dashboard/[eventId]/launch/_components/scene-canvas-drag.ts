'use client';

/**
 * ✋ HOLD A SCENE ON THE PAGE TO MOVE IT — the drag's hands, on the canvas (owner 2026-10-11: *"what if we drag the
 * scene on the preview"* · *"just like instagram"* · *"our build is the drag by scene"*; approved prototype
 * `prototypes/maker_drag_scenes_2026-10-11.html`, its `lift()` · `place()` · `tick()` · `endDrag()`).
 *
 * 🖼 IT RUNS FROM THE MAKER, ON THE FRAME'S DOCUMENT — where the RSVP stage's line drag runs (`rsvp-canvas-drag.ts`),
 * and for its reasons. The canvas is the guest's own page in a same-origin frame: a tap there already reaches the
 * Maker as a message (the bridge's `edit`), and the Maker already reads and measures that document directly for the
 * picked part's frame and its ＋ (`add-part-sheet.tsx` `partBox`). A drag has to keep a scene under a finger for
 * every frame of a gesture, so it lives where the finger is: the press, the hold, the lifted scene and the gap are
 * all in the frame's document — and the bin and the lower third, which are the Maker's, are told (`SceneDragHost`).
 * Nothing of this is in a guest's page, nothing is in the Maker's first load (the lazy Stages chunk), and the
 * guest page's own files are not touched.
 *
 * 🧱 NOTHING IS MOVED IN THE PAGE'S OWN TREE. The prototype lifted the scene out of the page and stood a dashed box
 * in its place; here the page is React's and is thrown away at the next reload, so nothing is inserted, removed or
 * re-parented: the held scene and the others are SLID (a transform each), the gap and the scene's name tag are
 * drawn over the page, and a drop leaves the scenes slid into their new places until the reload the save brings
 * draws that same order for real. A refused save slides them back.
 *
 * The rules — the hold, the scroll slop, where it lands, the bin's reach, the edge scroll — are `lib/maker-scene-drag.ts`.
 */
import {
  SCENE_BIN_MS,
  SCENE_GLIDE_MS,
  SCENE_HOLD_MS,
  SCENE_MOUSE_LIFT_PX,
  SCENE_SCROLL_PX,
  SCENE_SWALLOW_MS,
  sceneDropSlot,
  sceneDropTarget,
  sceneEdgeScroll,
  sceneOrderAfter,
  sceneOverBin,
  sceneReflow,
  type SceneBox,
  type SceneLiftVerdict,
  type SceneRow,
} from '@/lib/maker-scene-drag';

/* 🎨 COLOUR AND SHAPE TOKENS ONLY — each is the app's own, read on the page (no white, black or hex typed here):
   the lifted scene's ground (the page's paper, where the scene has none of its own), its ring and its name tag (the
   one accent), its shadow (the app's large shadow), its corners, and the dashed gap (the page's ink, faint). */
const PAPER = 'rgb(var(--color-cream))';
const ACCENT = 'rgb(var(--sn-accent))';
const LIFT_SHADOW = `0 0 0 2px ${ACCENT}, var(--m-shadow-lg)`;
const ROUND = 'var(--m-r-md)';
const GAP_LINE = '1.5px dashed rgb(var(--color-ink) / 0.28)';
/** The lifted scene's name tag — the picked part's own (`add-part-sheet.tsx` draws the same face over the page). */
export const SCENE_TAG_FACE = 'rounded-sm bg-sn-accent text-sn-on-accent px-[7px] py-[3px] font-sans text-[9px] font-bold uppercase leading-[1.2] tracking-[0.14em]';
/** The prototype's `.scene.lifted{transform:scale(1.03)}` and `.tobin{transform:scale(.62);opacity:.55}`. */
const LIFT_SCALE = 1.03;
/**
 * …and the room a lifted scene keeps from the PAGE'S edge — THE PROTOTYPE'S OWN. Its scenes stand inside the page's
 * margin (a 375 px page, scenes 355 px wide): lifted by 1.03 they are 365.65 px wide and keep 4.675 px on each side.
 * A guest's scene runs from edge to edge of its page, and the page is a frame of its own — whatever leaves the frame
 * is cut off. Lifted by 1.03 such a scene would lose its ring on both sides, and a ring cut off is no ring. So a
 * scene is lifted by 1.03 WHERE THAT FITS, and otherwise as large as it can be with the prototype's own 4.675 px kept
 * on each side (its ring, 2 px outside it, whole).
 * MEASURED in the lab at 375 × 812 (2026-10-12): the page's frame is 359 px wide and so is a scene; lifted it is
 * 349.65 px (scale 0.974), 4.68 px from each edge of the page. The prototype's own picture is 365.65 px on a page as
 * wide as the phone — the Maker's page stands 8 px inside the phone, which this file does not change.
 */
const LIFT_INSET_PX = (375 - 355 * LIFT_SCALE) / 2;
/** The dashed gap stands where the prototype's does: inside its page's margin (`.page{padding:8px 10px 24px}`), so its
 *  line is whole on a page whose scenes run edge to edge. */
const GAP_INSET_PX = 10;
const BIN_SCALE = 0.62;
const BIN_DIM = 0.55;
/** The lifted scene's own look eases in (the prototype's `.16s`). */
const LOOK_MS = 160;

export type SceneDragSubject = {
  /** The part's canvas key (`w:countdown`, `f:hero`, the Reveal's stub). */
  key: string;
  /** Its box on the page. */
  el: HTMLElement;
  /** What the finger is on, inside it — a tap there is what picks a part that keeps its place. */
  target: Element;
  /** Its name, as the Maker says it — the lifted scene's tag. */
  label: string;
  /** A scene that moves. False: it keeps its place — it nudges, and the host says why. */
  movable: boolean;
  /** The held scene and the parts it may land among, in page order (itself among them). Empty when it does not move. */
  beside: Array<{ key: string; el: HTMLElement }>;
};

export type SceneDrop =
  /** It landed beside `target`. `revert` slides everything back (a refused save). */
  | { kind: 'move'; target: string; where: 'above' | 'below'; order: string[]; revert: () => void }
  /** It was dropped on the bin and is out of sight. `restore` puts it back where it was. `gone` ends the wait once
   *  the page itself no longer draws it (the others close up). */
  | { kind: 'bin'; restore: () => void; gone: () => void }
  /** Let go where it was, or the gesture was cancelled: nothing changed. */
  | { kind: 'none' };

export type SceneDragHost = {
  /** What a press on this element would hold — null: not a part of the page (its ground). */
  subject(target: Element): SceneDragSubject | null;
  /** May a scene be lifted right now? (`sceneLiftAllowed`) */
  verdict(): SceneLiftVerdict;
  /** A part that does not move was held ('fixed'), or the page is still catching up ('busy'). */
  onRefuse(subject: SceneDragSubject, why: 'fixed' | 'busy'): void;
  /** Lifted: the lower third slides away, the bin comes up, the other tabs dim. */
  onLift(subject: SceneDragSubject): void;
  /** The finger came onto / left the bin. */
  onBin(over: boolean): void;
  /** Let go (or the gesture was cancelled): the lower third starts back NOW, while the scene settles. */
  onRelease(): void;
  /** The bin's box in THIS page's own coordinates (the frame's viewport) — null: no bin up. */
  binBox(): SceneBox | null;
  /** The page's visible band in this page's own coordinates: its top, and where the guests' bar begins. */
  band(): { top: number; bottom: number };
  /** …and once it has settled: what the drop was. */
  onDrop(subject: SceneDragSubject, drop: SceneDrop): void;
};

type Pending = { subject: SceneDragSubject; x: number; y: number; /** where the finger is by now */ lx: number; ly: number; touch: boolean; pid: number; timer: number | null };

type Held = {
  subject: SceneDragSubject;
  rows: SceneRow[];
  names: string[];
  at: number;
  slot: number;
  /** What stands between slot j − 1 and slot j (a fixed part) — it shifts with the slots. */
  between: HTMLElement[][];
  gap: HTMLElement;
  tag: HTMLElement;
  /** The finger, in the frame's viewport; and where on the scene it took hold (from the scene's top). */
  x: number;
  y: number;
  grab: number;
  /** How large the lifted scene is drawn: the prototype's 1.03 — or what fits the screen with its ring in sight. */
  scale: number;
  overBin: boolean;
  was: Partial<Record<LookKey, string>>;
  /** Every other box that was slid, with what it wore before — given back when the slide is taken off. */
  wore: Map<HTMLElement, { transition: string; transform: string }>;
  pid: number;
};

const LOOK_KEYS = ['position', 'zIndex', 'transition', 'boxShadow', 'background', 'borderRadius', 'pointerEvents', 'willChange', 'opacity', 'translate', 'scale', 'transformOrigin'] as const;
type LookKey = (typeof LOOK_KEYS)[number];

/** The next element on the page after `n`, never going INTO `n` (document order; null at the page's end). */
function nextOnPage(n: Element | null): Element | null {
  for (let cur = n; cur && cur.tagName !== 'BODY'; cur = cur.parentElement) if (cur.nextElementSibling) return cur.nextElementSibling;
  return null;
}

/**
 * Everything that stands between `a` and `b` on the page (document order) — each as its outermost box, `b` and
 * whatever holds `b` left out. A fixed part between two scenes, a scene's own `<style>`, the next scene's marker.
 */
export function standingBetween(a: Element, b: Element): HTMLElement[] {
  const out: HTMLElement[] = [];
  let n = nextOnPage(a);
  for (let guard = 0; n && n !== b && guard < 600; guard++) {
    if (n.contains(b)) {
      n = n.firstElementChild;
      continue;
    }
    out.push(n as HTMLElement);
    n = nextOnPage(n);
  }
  return out;
}

/** Everything the page draws AFTER `el` (its later siblings, and its ancestors') — what closes up when it leaves. */
function standingAfter(el: Element): HTMLElement[] {
  const out: HTMLElement[] = [];
  let cur: Element | null = el;
  while (cur && cur.tagName !== 'BODY') {
    for (let sib = cur.nextElementSibling; sib; sib = sib.nextElementSibling) out.push(sib as HTMLElement);
    cur = cur.parentElement;
  }
  return out;
}

export type SceneDragWired = {
  /** The frame was replaced, or the stage left. */
  detach: () => void;
  /** A dropped order is still held by slides on this document — the page the save brings replaces it. */
  optimistic: () => boolean;
  /** Slide a scene to `slot` among the parts it may land among, without a drag; the slide-back, or null. */
  place: (subject: SceneDragSubject, slot: number) => (() => void) | null;
};

/** Wire one canvas's document. */
export function attachSceneDrag(doc: Document, host: SceneDragHost): SceneDragWired {
  const view = doc.defaultView;
  if (!view) return { detach: () => {}, optimistic: () => false, place: () => null };
  const win: Window & typeof globalThis = view;
  let pending: Pending | null = null;
  let held: Held | null = null;
  let raf = 0;
  /** A dropped order the page has not been redrawn for yet — no second lift on this document until it is. */
  let slid = false;
  const calm = () => win.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const glide = () => (calm() ? 'none' : `transform ${SCENE_GLIDE_MS}ms ease`);
  /* `translate` and `scale` are their own properties, so the scene follows the finger at once while its lift eases —
     and neither disturbs a `transform` the scene's own entrance may be running. */
  const twoProps = typeof win.CSS !== 'undefined' && win.CSS.supports('translate', '0px 1px') && win.CSS.supports('scale', '1');

  const stopPending = () => {
    if (pending?.timer != null) win.clearTimeout(pending.timer);
    pending = null;
  };

  /** The held scene's place: `dy` from where the page laid it out, at `scale`. */
  const put = (el: HTMLElement, dy: number, scale: number) => {
    if (twoProps) {
      el.style.translate = `0px ${dy}px`;
      el.style.scale = String(scale);
    } else el.style.transform = `translateY(${dy}px) scale(${scale})`;
  };

  const slide = (h: Held, el: HTMLElement, dy: number) => {
    if (!h.wore.has(el)) h.wore.set(el, { transition: el.style.transition, transform: el.style.transform });
    el.style.transition = glide();
    el.style.transform = Math.abs(dy) < 0.5 ? h.wore.get(el)!.transform : `translateY(${dy}px)`;
  };

  /** The others, the gap and whatever stands between them, drawn for the gap at `slot`. */
  const open = (h: Held) => {
    const now = sceneReflow(h.rows, h.at, h.slot);
    h.subject.beside.forEach(({ el }, i) => {
      if (i !== h.at) slide(h, el, now.tops[i]! - h.rows[i]!.top);
    });
    h.between.forEach((els, j) => els.forEach((el) => slide(h, el, now.between[j] ?? 0)));
    h.gap.style.transform = `translateY(${now.gap.top - h.rows[h.at]!.top}px)`;
    return now;
  };

  /** A scene's rows as the page lays them out now: where it stands among the parts it may land among. */
  const measure = (subject: SceneDragSubject) => {
    const at = subject.beside.findIndex((b) => b.el === subject.el);
    const rows = subject.beside.map(({ el }) => {
      const b = el.getBoundingClientRect();
      return { top: b.top + win.scrollY, height: b.height };
    });
    const between = subject.beside.map((b, j) => (j === 0 ? [] : standingBetween(subject.beside[j - 1]!.el, b.el)));
    return { at, rows, between };
  };

  /**
   * ▾ A STEP WITHOUT A DRAG (the tag's Move up · Move down): the scene and the others glide to the places the step
   * makes, at once — the prototype's `moveBy` — and stay there until the page the save brings draws that order.
   * Returns the slide-back (a refused save), or null when nothing can be slid now.
   */
  const placeNow = (subject: SceneDragSubject, slot: number): (() => void) | null => {
    if (held || slid || !subject.el.isConnected) return null;
    const { at, rows, between } = measure(subject);
    if (at < 0 || slot === at || slot < 0 || slot >= rows.length) return null;
    const now = sceneReflow(rows, at, slot);
    const wore = new Map<HTMLElement, { transition: string; transform: string }>();
    const go = (el: HTMLElement, dy: number) => {
      if (!wore.has(el)) wore.set(el, { transition: el.style.transition, transform: el.style.transform });
      el.style.transition = glide();
      el.style.transform = Math.abs(dy) < 0.5 ? wore.get(el)!.transform : `translateY(${dy}px)`;
    };
    subject.beside.forEach(({ el }, i) => go(el, now.tops[i]! - rows[i]!.top));
    between.forEach((els, j) => els.forEach((el) => go(el, now.between[j] ?? 0)));
    slid = true;
    return () => {
      if (!slid) return;
      slid = false;
      for (const [el, w] of wore) {
        el.style.transition = glide();
        el.style.transform = w.transform;
      }
      win.setTimeout(
        () => {
          for (const [el, w] of wore) el.style.transition = w.transition;
        },
        calm() ? 0 : SCENE_GLIDE_MS + 20,
      );
    };
  };

  const place = () => {
    const h = held;
    if (!h) return;
    const top = h.rows[h.at]!.top - win.scrollY;
    const dy = h.y - h.grab - top;
    const over = sceneOverBin(h.x, h.y, host.binBox());
    if (over !== h.overBin) {
      h.overBin = over;
      host.onBin(over);
      h.subject.el.style.opacity = over ? String(BIN_DIM) : '1';
      if (over) buzz();
    }
    put(h.subject.el, dy, over ? BIN_SCALE : h.scale);
    const r = h.subject.el.getBoundingClientRect();
    /* Its name rides its corner AT THE SCENE'S OWN SIZE — measured, so it eases as the scene does — and over the bin
       it shrinks and dims WITH the scene (the prototype's tag is the scene's own child:
       `.scene.lifted.tobin{transform:scale(.62);opacity:.55}` takes it along). */
    const k = h.subject.el.offsetWidth > 0 ? r.width / h.subject.el.offsetWidth : 1;
    h.tag.style.transform = `translate(${Math.max(2, r.left - 2 * k)}px,${r.top - 11 * k}px) scale(${k})`;
    h.tag.style.opacity = over ? String(BIN_DIM) : '1';
    if (over) return;
    const slot = sceneDropSlot(h.rows, h.at, h.slot, h.y + win.scrollY);
    if (slot === h.slot) return;
    h.slot = slot;
    open(h);
  };

  const loop = () => {
    const h = held;
    if (!h) return;
    const band = host.band();
    const v = sceneEdgeScroll(h.y, band.top, band.bottom, h.overBin);
    if (v) win.scrollBy(0, v);
    /* Every frame, not only when the finger moves: the page may have scrolled under a still finger, and the bin
       comes up (and is only then something to be over) after the lift. */
    place();
    raf = win.requestAnimationFrame(loop);
  };

  function buzz() {
    try {
      win.navigator.vibrate?.(12);
    } catch {
      /* no haptics here */
    }
  }

  /** A part that keeps its place: it nudges (the prototype's `nudge` keyframes), and the host says why. */
  const refuse = (subject: SceneDragSubject, why: 'fixed' | 'busy') => {
    if (why === 'fixed' && !calm() && subject.el.isConnected) {
      subject.el.animate(
        [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(0)' }],
        { duration: 360, easing: 'ease' },
      );
    }
    /* The host picks the part by the page's own tap — so it is told first, and only then is the tap the finger's
       release leaves behind swallowed. */
    host.onRefuse(subject, why);
    swallowTap();
  };

  const lift = (x: number, y: number) => {
    const p = pending;
    if (!p || held) return;
    const { subject } = p;
    pending = null;
    if (!subject.el.isConnected) return;
    const verdict = slid ? 'busy' : host.verdict();
    if (verdict === 'no') return;
    if (!subject.movable) return refuse(subject, 'fixed');
    if (verdict === 'busy') return refuse(subject, 'busy');
    const { at, rows, between } = measure(subject);
    if (at < 0) return;
    const r = subject.el.getBoundingClientRect();
    /* The gap — where it would land, drawn over the page (the prototype's `.gap`: dashed, the scene's own height). */
    const gap = doc.createElement('div');
    gap.setAttribute('aria-hidden', 'true');
    gap.setAttribute('data-scene-drag-gap', '');
    Object.assign(gap.style, {
      position: 'absolute',
      left: `${Math.max(r.left, GAP_INSET_PX) + win.scrollX}px`,
      top: `${rows[at]!.top}px`,
      width: `${Math.min(r.right, win.innerWidth - GAP_INSET_PX) - Math.max(r.left, GAP_INSET_PX)}px`,
      height: `${r.height}px`,
      boxSizing: 'border-box',
      border: GAP_LINE,
      borderRadius: ROUND,
      pointerEvents: 'none',
      zIndex: '9989',
      transition: glide(),
    });
    doc.body.appendChild(gap);
    /* The lifted scene's name, on its corner (the picked part's tag, as the Maker draws it). */
    const tag = doc.createElement('div');
    tag.setAttribute('aria-hidden', 'true');
    tag.setAttribute('data-scene-drag-tag', '');
    tag.textContent = subject.label;
    /* The page is this app's own, with this app's stylesheet: the tag wears the very classes the Maker's does. */
    tag.className = SCENE_TAG_FACE;
    Object.assign(tag.style, { position: 'fixed', left: '0', top: '0', zIndex: '9991', whiteSpace: 'nowrap', pointerEvents: 'none', transformOrigin: '0 0', transition: `opacity ${LOOK_MS}ms ease` });
    doc.body.appendChild(tag);
    const el = subject.el;
    const was: Held['was'] = {};
    for (const k of LOOK_KEYS) was[k] = el.style[k];
    const own = win.getComputedStyle(el);
    const bare = /transparent|,\s*0\)$/.test(own.backgroundColor) && own.backgroundImage === 'none';
    if (own.position === 'static') el.style.position = 'relative';
    el.style.zIndex = '9990';
    el.style.pointerEvents = 'none';
    el.style.willChange = 'translate, transform';
    el.style.transformOrigin = '50% 50%';
    el.style.transition = calm() ? 'none' : `scale ${LOOK_MS}ms ease, opacity ${LOOK_MS}ms ease, box-shadow ${LOOK_MS}ms ease`;
    if (bare) el.style.background = PAPER;
    el.style.borderRadius = ROUND;
    el.style.boxShadow = LIFT_SHADOW;
    doc.documentElement.setAttribute('data-scene-drag-held', '');
    const scale = r.width > 0 ? Math.min(LIFT_SCALE, (win.innerWidth - 2 * LIFT_INSET_PX) / r.width) : LIFT_SCALE;
    held = { subject, rows, names: subject.beside.map((b) => b.key), at, slot: at, between, gap, tag, x, y, grab: y - r.top, scale, overBin: false, was, wore: new Map(), pid: p.pid };
    /* A mouse press may have begun a selection: a held scene selects nothing. */
    try {
      win.getSelection()?.removeAllRanges();
    } catch {
      /* no selection to clear */
    }
    try {
      /* A mouse may leave the frame (the bin's reach runs to its edge): the drag keeps hearing it. */
      el.ownerDocument.documentElement.setPointerCapture(p.pid);
    } catch {
      /* a pointer that cannot be captured (a finger already is) */
    }
    buzz();
    host.onLift(subject);
    place();
    raf = win.requestAnimationFrame(loop);
  };

  /** The held scene's lifted look, taken off — its slide (`translate`) is left to the caller. */
  const unlook = (h: Held, keepSlide: boolean) => {
    const el = h.subject.el;
    for (const k of LOOK_KEYS) {
      if (keepSlide && (k === 'translate' || k === 'position' || k === 'willChange')) continue;
      el.style[k] = h.was[k] ?? '';
    }
    if (!twoProps && !keepSlide) el.style.transform = '';
    h.gap.remove();
    h.tag.remove();
    doc.documentElement.removeAttribute('data-scene-drag-held');
  };

  /** Everything back where the page laid it out — and wearing what it wore before it was slid. */
  const back = (h: Held, glides: boolean) => {
    const moving = glides && !calm();
    for (const [el, wore] of h.wore) {
      el.style.transition = moving ? glide() : 'none';
      el.style.transform = wore.transform;
    }
    const dress = () => {
      for (const [el, wore] of h.wore) el.style.transition = wore.transition;
    };
    if (moving) win.setTimeout(dress, SCENE_GLIDE_MS + 20);
    else win.requestAnimationFrame(dress);
  };

  const end = (cancel: boolean) => {
    const h = held;
    win.cancelAnimationFrame(raf);
    stopPending();
    if (!h) return;
    held = null;
    try {
      doc.documentElement.releasePointerCapture(h.pid);
    } catch {
      /* it was never captured */
    }
    swallowTap();
    host.onRelease();
    const el = h.subject.el;
    const ms = calm() ? 0 : SCENE_GLIDE_MS;
    if (!cancel && h.overBin) {
      /* INTO THE BIN: it shrinks into it and is out of sight; the others close up once the page stops drawing it. */
      host.onBin(false);
      const bin = host.binBox();
      const r = el.getBoundingClientRect();
      const home = h.rows[h.at]!.top - win.scrollY;
      const dy = bin ? (bin.top + bin.bottom) / 2 - r.height / 2 - home : h.y - h.grab - home;
      el.style.transition = calm() ? 'none' : `translate ${SCENE_BIN_MS}ms ease, scale ${SCENE_BIN_MS}ms ease, opacity ${SCENE_BIN_MS}ms ease, transform ${SCENE_BIN_MS}ms ease`;
      put(el, dy, 0.1);
      el.style.opacity = '0';
      h.tag.style.opacity = '0';
      h.gap.style.opacity = '0';
      win.setTimeout(
        () => {
          const after = standingAfter(el).filter((n) => n.isConnected && n.getBoundingClientRect().height > 0);
          const probe = after[0] ?? null;
          const before = probe ? probe.getBoundingClientRect().top : 0;
          back(h, false);
          unlook(h, false);
          if (!twoProps) el.style.transform = '';
          el.style.opacity = '0';
          let over = false;
          const restore = () => {
            if (over) return;
            over = true;
            el.style.transition = calm() ? 'none' : `opacity ${SCENE_GLIDE_MS}ms ease`;
            el.style.opacity = h.was.opacity ?? '';
          };
          /* The page takes the scene off a moment after the host asks (the bridge's `sceneShow`): once it has, the
             scene's own opacity is given back and whatever stood after it glides up into its room. */
          const gone = () => {
            if (over) return;
            let tries = 0;
            const look = () => {
              if (over) return;
              const off = !el.isConnected || win.getComputedStyle(el).display === 'none';
              if (!off && tries++ < 40) return void win.requestAnimationFrame(look);
              over = true;
              el.style.opacity = h.was.opacity ?? '';
              if (!off || calm() || !probe?.isConnected) return;
              const d = before - probe.getBoundingClientRect().top;
              if (Math.abs(d) < 1) return;
              for (const n of after) if (n.isConnected) n.animate([{ transform: `translateY(${d}px)` }, { transform: 'none' }], { duration: SCENE_GLIDE_MS, easing: 'ease' });
            };
            look();
          };
          host.onDrop(h.subject, { kind: 'bin', restore, gone });
        },
        calm() ? 0 : SCENE_BIN_MS,
      );
      return;
    }
    if (h.overBin) host.onBin(false);
    /* A DROP: it sits in its place at once — it settles into the gap, then the save runs. */
    const slot = cancel ? h.at : h.slot;
    if (slot !== h.slot) {
      h.slot = slot;
      open(h);
    }
    const now = sceneReflow(h.rows, h.at, slot);
    const drop = cancel ? null : sceneDropTarget(h.names, h.at, slot);
    el.style.transition = calm() ? 'none' : `translate ${ms}ms ease, scale ${ms}ms ease, box-shadow ${ms}ms ease, transform ${ms}ms ease`;
    put(el, now.tops[h.at]! - h.rows[h.at]!.top, 1);
    el.style.opacity = '1';
    h.tag.style.opacity = '0';
    const landed = () => {
      if (!drop) {
        back(h, false);
        unlook(h, false);
        host.onDrop(h.subject, { kind: 'none' });
        return;
      }
      /* The order is held by the slides until the page the save brings draws it for real. */
      unlook(h, true);
      slid = true;
      const revert = () => {
        if (!slid) return;
        slid = false;
        back(h, true);
        el.style.transition = calm() ? 'none' : `translate ${SCENE_GLIDE_MS}ms ease, transform ${SCENE_GLIDE_MS}ms ease`;
        put(el, 0, 1);
        win.setTimeout(
          () => {
            for (const k of ['translate', 'scale', 'position', 'willChange', 'transition'] as const) el.style[k] = h.was[k] ?? '';
            if (!twoProps) el.style.transform = '';
          },
          calm() ? 0 : SCENE_GLIDE_MS + 20,
        );
      };
      host.onDrop(h.subject, { kind: 'move', target: drop.target, where: drop.where, order: sceneOrderAfter(h.names, h.at, slot), revert });
    };
    if (ms === 0) landed();
    else win.setTimeout(landed, ms + 10);
  };

  /** The tap a drop (or a held part) leaves behind picks nothing — heard on the window, before the page. */
  function swallowTap() {
    const eat = (e: Event) => {
      /* Only the FINGER'S own tap: a tap the Maker makes on the page to pick a part (`add-part-sheet.tsx`) goes through. */
      if (!e.isTrusted) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    win.addEventListener('click', eat, true);
    win.setTimeout(() => win.removeEventListener('click', eat, true), SCENE_SWALLOW_MS);
  }

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || !e.isPrimary || held || pending) return;
    const target = (e.target as Element | null)?.nodeType === 1 ? (e.target as Element) : null;
    /* A field being typed in, or a control of the page's own, keeps its press. */
    if (!target || target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
    if (host.verdict() === 'no') return;
    const subject = host.subject(target);
    if (!subject) return;
    const { clientX: x, clientY: y } = e;
    const touch = e.pointerType !== 'mouse';
    pending = { subject, x, y, lx: x, ly: y, touch, pid: e.pointerId, timer: null };
    /* A finger HOLDS (the hold lifts where the finger is by then); a mouse lifts on its first real move. */
    if (touch) pending.timer = win.setTimeout(() => lift(pending?.lx ?? x, pending?.ly ?? y), SCENE_HOLD_MS);
  };

  const onMove = (e: PointerEvent) => {
    const p = pending;
    if (p && e.pointerId === p.pid) {
      const moved = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      if (p.touch) {
        /* Moving before the hold ends is a scroll — let it be one. */
        if (moved > SCENE_SCROLL_PX) stopPending();
        else {
          p.lx = e.clientX;
          p.ly = e.clientY;
        }
        return;
      }
      if (moved > SCENE_MOUSE_LIFT_PX) {
        e.preventDefault();
        lift(e.clientX, e.clientY);
      }
      if (!held) return;
    }
    const h = held;
    if (!h || e.pointerId !== h.pid) return;
    e.preventDefault();
    h.x = e.clientX;
    h.y = e.clientY;
    place();
  };

  const onUp = (e: PointerEvent) => {
    if (pending && e.pointerId === pending.pid) stopPending();
    if (held && e.pointerId === held.pid) end(false);
  };
  const onCancel = (e: PointerEvent) => {
    if (pending && e.pointerId === pending.pid) stopPending();
    if (held && e.pointerId === held.pid) end(true);
  };
  /* 📱 While a scene is held the finger moves the scene, never the page. On the document from the start, NOT added
     at the lift: a browser decides at touchstart whether anything may block its scroll. Until the hold has fired the
     page pans as it always does — a quick flick never lifts. */
  const onTouchMove = (e: TouchEvent) => {
    if (held) e.preventDefault();
  };
  /* A long press must not raise the browser's own menu, nor start a selection, under a hold. */
  const onMenu = (e: Event) => {
    if (pending?.touch || held) e.preventDefault();
  };
  const onSelect = (e: Event) => {
    if (held) e.preventDefault();
  };
  /* On a touch screen a press that rests on words would select them and raise the callout before the hold fires —
     the page's parts are picked by a tap here, never selected. A field being typed in keeps its selection. */
  const style = doc.createElement('style');
  style.setAttribute('data-scene-drag', '');
  style.textContent =
    '@media (hover:none) and (pointer:coarse){[data-maker-section]+*,[data-maker-reveal-part]{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}' +
    '[data-maker-section]+* :is(input,textarea,[contenteditable=""],[contenteditable="true"]){-webkit-user-select:text;user-select:text}}' +
    'html[data-scene-drag-held],html[data-scene-drag-held] *{-webkit-user-select:none!important;user-select:none!important;cursor:grabbing!important}';
  doc.head.appendChild(style);
  doc.addEventListener('pointerdown', onDown);
  doc.addEventListener('pointermove', onMove, { passive: false });
  doc.addEventListener('pointerup', onUp);
  doc.addEventListener('pointercancel', onCancel);
  doc.addEventListener('touchmove', onTouchMove, { passive: false });
  doc.addEventListener('contextmenu', onMenu);
  doc.addEventListener('selectstart', onSelect);
  return {
    optimistic: () => slid,
    place: placeNow,
    detach: () => {
      if (held) end(true);
      stopPending();
      style.remove();
      doc.removeEventListener('pointerdown', onDown);
      doc.removeEventListener('pointermove', onMove);
      doc.removeEventListener('pointerup', onUp);
      doc.removeEventListener('pointercancel', onCancel);
      doc.removeEventListener('touchmove', onTouchMove);
      doc.removeEventListener('contextmenu', onMenu);
      doc.removeEventListener('selectstart', onSelect);
    },
  };
}
