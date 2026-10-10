/**
 * ✋ HOLD A LINE TO MOVE IT — the RSVP stage's drag (owner 2026-10-09: *"can we drag and drop the element. similar to
 * the concept of wedding march"*; approved prototype `prototypes/maker_rsvp_add_drag_group_2026-10-09.html` § 2).
 *
 * The Wedding March's feel, on the lines of a reply screen: press and hold, the line lifts as a ghost with a shadow,
 * its own place dims, the place under the finger opens with a line in it, and on letting go everything settles while
 * the ghost flies home. A short tap still only picks. A plain swipe still scrolls; while a line is held the finger
 * does not move the page.
 *
 * 🔁 A SECOND SMALL DRAG, NOT THE MARCH'S (controller 2026-10-10). The march's is its own component, tied to its
 * names, walks and sections (`details-march.tsx` + `lib/march-drag.ts`); it cannot be pointed at another list. What
 * the two share is the FEEL, so the march's own numbers are IMPORTED, never copied: `SETTLE_MS`, `EDGE_PX`. The one
 * difference is the hold — `RSVP_HOLD_MS`, below.
 *
 * 🖼 IT RUNS FROM THE MAKER, ON THE FRAME'S DOCUMENT. The lines are the guest's own page inside the stage's frame
 * (same origin), so the press, the ghost and the opening are all in that document — and all of this is in the lazy
 * RSVP stage's chunk: nothing of it is in a guest's page, and nothing in the Maker's first load.
 *
 * 🧱 NOTHING IS INSERTED AMONG THE LINES. The prototype opened a real gap element between two lines; here the lines
 * below the opening are slid down (a transform) and the opening's line is drawn over the page — the reply's fieldset
 * and its legend are never given a child that is not theirs, and nothing has to be taken out again on a cancel.
 *
 * What MOVES is decided by the caller (`subject`): a line — or, for a line inside a group, the whole group unless
 * that very line is the picked one (the prototype's rule). Where it may LAND: among what stands beside it.
 */
import { rsvpDropBefore, rsvpDropSlot } from '@/lib/rsvp-layout-edit';
import { EDGE_PX, SETTLE_MS } from './details-march';

/**
 * ⏱ THE ONE DIFFERENCE FROM THE MARCH: 350 ms before a held line lifts (the march lifts a name at 250). The approved
 * prototype's own number (`HOLD_MS = 350`) — a reply page is read and scrolled with the same thumb that would lift a
 * line, so the hold is a little longer than on a list that only exists to be rearranged.
 */
export const RSVP_HOLD_MS = 350;
/** The room that opens where the held line would land, and how it is drawn — the prototype's `.gap.on`. */
const OPENING_PX = 20;
/** These are bare numbers inside the march's own code (not constants there): kept equal to it by eye, named here. */
const GHOST_SCALE = 1.03; // details-march.tsx — the ghost's `scale(1.03)`
const LIFTED_DIM = 0.3; // details-march.tsx — the place it left, `opacity-30`
const LAND_MS = 220; // details-march.tsx — the ghost's fly home
const MOUSE_LIFT_PX = 4; // details-march.tsx — "Desktop: a 4 px drag lifts"
const TOUCH_SCROLL_PX = 8; // a finger that moves this far before the hold ends is scrolling
const REACH_PX = 120; // how near an opening the finger must be (the prototype's `bd = 120`)
const SWALLOW_MS = 450; // the tap a drop leaves behind is not a pick (the prototype's `swallow`)
const EASE = 'cubic-bezier(.16,1,.3,1)';
/**
 * 🎨 COLOUR TOKENS ONLY (owner 2026-10-11: "dark mode should work" — no white, black or hex typed here). The
 * prototype drew these three with literals; here each is the app's own token, read on the guest's page:
 * the small card a line of plain words is carried on (the page's paper), the dashed mark round the place it left
 * (the page's ink), where it would land (the one accent), and the lift's shadow (the app's large shadow).
 */
const GHOST_PAPER = 'rgb(var(--color-cream))';
const GHOST_SHADOW = 'var(--m-shadow-lg)';
const LEFT_MARK = '1.5px dashed rgb(var(--color-ink) / 0.7)';
const OPENING_INK = 'rgb(var(--sn-accent))';

export type RsvpDragSubject = {
  /** The name of what moves: a line's (`eyebrow`, `a:1`) or a group's (`g:1`). */
  name: string;
  /** Its row on the page, and the rows that stand beside it — in page order, itself among them. */
  row: HTMLElement;
  beside: { name: string; row: HTMLElement }[];
};

export type RsvpDragHost<S extends RsvpDragSubject = RsvpDragSubject> = {
  /** What a press on this element would move — null: nothing (the card, the Hint, the masthead, picking for a group). */
  subject(target: Element): S | null;
  /** Lifted: the frame steps aside. */
  onLift(subject: S): void;
  /** Let go. `before`: the name it now stands before — null: last; undefined: back where it was (nothing changed). */
  onDrop(subject: S, before: string | null | undefined): void;
};

type Held<S extends RsvpDragSubject> = {
  subject: S;
  ghost: HTMLElement;
  mark: HTMLElement;
  /** Each row's top and bottom ON THE PAGE as laid out at the lift (a transform never changes these). */
  tops: number[];
  ends: number[];
  at: number;
  slot: number | null;
  ox: number;
  oy: number;
  x: number;
  y: number;
  dir: -1 | 0 | 1;
};

/**
 * Wire one frame's document. Returns the undo. The caller redraws the page INSIDE `onDrop` (the Maker's one save tells
 * the frame at once): every row is measured before and after it, so the others slide to where they now stand.
 */
export function attachRsvpDrag<S extends RsvpDragSubject>(doc: Document, host: RsvpDragHost<S>): () => void {
  const view = doc.defaultView;
  if (!view) return () => {};
  /* Typed, so the handlers declared below (hoisted) know it is there. */
  const win: Window & typeof globalThis = view;
  let pending: { subject: S; x: number; y: number; touch: boolean; pid: number; timer: number } | null = null;
  let held: Held<S> | null = null;
  let raf = 0;
  const calm = () => win.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stop = () => {
    if (pending) win.clearTimeout(pending.timer);
    pending = null;
    win.cancelAnimationFrame(raf);
    doc.removeEventListener('pointermove', onMove);
    doc.removeEventListener('pointerup', onUp);
    doc.removeEventListener('pointercancel', onCancel);
  };

  /** The opening nearest the finger — never its own two (it would settle back where it was). */
  const aim = () => {
    const h = held;
    if (!h) return;
    const slot = rsvpDropSlot(h.tops, h.ends, h.at, h.y + win.scrollY, REACH_PX);
    if (slot === h.slot) return;
    h.slot = slot;
    /* The others make room: every row from the opening down slides by its height. */
    h.subject.beside.forEach(({ row }, i) => {
      if (row === h.subject.row) return;
      row.style.transition = calm() ? '' : `transform 200ms ${EASE}`;
      row.style.transform = slot !== null && i >= slot ? `translateY(${OPENING_PX}px)` : '';
    });
    if (slot === null) h.mark.style.opacity = '0';
    else {
      const top = slot < h.tops.length ? h.tops[slot]! : h.ends[h.ends.length - 1]!;
      h.mark.style.top = `${top + OPENING_PX / 2 - 1}px`;
      h.mark.style.opacity = '1';
    }
  };

  const loop = () => {
    const h = held;
    if (!h) return;
    if (h.dir) {
      /* Near the page's top or bottom edge the page comes to the finger (the finger itself never scrolls it). */
      const dist = h.dir < 0 ? EDGE_PX - h.y : h.y - (win.innerHeight - EDGE_PX);
      win.scrollBy(0, h.dir * Math.min(18, 4 + dist / 4));
      aim();
    }
    raf = win.requestAnimationFrame(loop);
  };

  const place = (h: Held<S>) => {
    h.ghost.style.transform = `translate(${h.x - h.ox}px,${h.y - h.oy}px) scale(${GHOST_SCALE})`;
  };

  const lift = (x: number, y: number) => {
    const p = pending;
    if (!p || held || !p.subject.row.isConnected) return;
    const { subject } = p;
    const r = subject.row.getBoundingClientRect();
    /* A line of plain words is carried on a small white card of its own; an answer, a group with a ground of its own
       carries itself (the prototype's `.ghost.bare`). */
    const own = win.getComputedStyle(subject.row);
    const bare = /transparent|,\s*0\)$/.test(own.backgroundColor) && own.backdropFilter === 'none';
    const px = bare ? 10 : 0;
    const py = bare ? 8 : 0;
    const ghost = doc.createElement('div');
    const copy = subject.row.cloneNode(true) as HTMLElement;
    /* The copy is a PICTURE of the line as drawn: every piece wears what its original wears now (the couple's
       colour, type and size reach a line through its name on the card — a copy outside the card would lose them),
       and it names nothing, holds no live control and is nobody's part. */
    const from = [subject.row, ...Array.from(subject.row.querySelectorAll<HTMLElement>('*'))];
    const to = [copy, ...Array.from(copy.querySelectorAll<HTMLElement>('*'))];
    to.forEach((el, i) => {
      const worn = from[i] ? win.getComputedStyle(from[i]!) : null;
      if (worn) for (let n = 0; n < worn.length; n++) el.style.setProperty(worn[n]!, worn.getPropertyValue(worn[n]!));
      el.style.animation = 'none';
      el.style.transition = 'none';
      for (const a of Array.from(el.attributes)) if (a.name.startsWith('data-') || a.name === 'id' || a.name === 'name' || a.name === 'for') el.removeAttribute(a.name);
    });
    copy.style.margin = '0';
    copy.style.transform = 'none';
    copy.style.opacity = '1';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('data-rsvp-drag-ghost', '');
    ghost.setAttribute('inert', '');
    Object.assign(ghost.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      zIndex: '9999',
      margin: '0',
      boxSizing: 'border-box',
      pointerEvents: 'none',
      width: `${r.width + px * 2}px`,
      height: `${r.height + py * 2}px`,
      padding: bare ? `${py}px ${px}px` : '0',
      borderRadius: bare ? '12px' : own.borderRadius,
      background: bare ? GHOST_PAPER : 'transparent',
      boxShadow: GHOST_SHADOW,
      willChange: 'transform',
      textAlign: own.textAlign,
    });
    ghost.appendChild(copy);
    doc.body.appendChild(ghost);
    /* Where the held line would land — drawn over the page, never among the lines. */
    const mark = doc.createElement('div');
    mark.setAttribute('aria-hidden', 'true');
    mark.setAttribute('data-rsvp-drag-opening', '');
    Object.assign(mark.style, {
      position: 'absolute',
      left: `${r.left + win.scrollX + 24}px`,
      width: `${Math.max(0, r.width - 48)}px`,
      height: '2px',
      borderRadius: '2px',
      background: OPENING_INK,
      opacity: '0',
      transition: 'opacity 150ms',
      pointerEvents: 'none',
      zIndex: '9998',
    });
    doc.body.appendChild(mark);
    const rects = subject.beside.map(({ row }) => row.getBoundingClientRect());
    held = {
      subject,
      ghost,
      mark,
      tops: rects.map((b) => b.top + win.scrollY),
      ends: rects.map((b) => b.bottom + win.scrollY),
      at: subject.beside.findIndex((b) => b.row === subject.row),
      slot: null,
      ox: x - (r.left - px),
      oy: y - (r.top - py),
      x,
      y,
      dir: 0,
    };
    place(held);
    subject.row.style.opacity = String(LIFTED_DIM);
    subject.row.style.outline = LEFT_MARK;
    subject.row.style.outlineOffset = '4px';
    host.onLift(subject);
    try {
      win.navigator.vibrate?.(10);
    } catch {
      /* no haptics here */
    }
    raf = win.requestAnimationFrame(loop);
  };

  /** The rows as they stood before the drag: no slide, no dim. */
  const settle = (h: Held<S>) => {
    for (const { row } of h.subject.beside) {
      row.style.transition = '';
      row.style.transform = '';
    }
    h.mark.remove();
  };
  const undim = (h: Held<S>) => {
    h.subject.row.style.opacity = '';
    h.subject.row.style.outline = '';
    h.subject.row.style.outlineOffset = '';
  };

  function onMove(e: PointerEvent) {
    const p = pending;
    if (!p || e.pointerId !== p.pid) return; /* one finger moves it; a second one is ignored */
    if (!held) {
      const moved = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      if (p.touch) {
        if (moved > TOUCH_SCROLL_PX) stop(); /* moving before the hold ends is a scroll — let it be one */
        return;
      }
      if (moved > MOUSE_LIFT_PX) lift(e.clientX, e.clientY);
      if (!held) return;
    }
    e.preventDefault();
    const h: Held<S> = held;
    h.x = e.clientX;
    h.y = e.clientY;
    place(h);
    aim();
    h.dir = h.y < EDGE_PX && h.y > -40 ? -1 : h.y > win.innerHeight - EDGE_PX && h.y < win.innerHeight + 40 ? 1 : 0;
  }

  function onUp(e: PointerEvent) {
    if (pending && e.pointerId !== pending.pid) return;
    const h = held;
    stop();
    if (!h) return;
    held = null;
    const { subject } = h;
    const was = new Map(subject.beside.map(({ name, row }) => [name, row.getBoundingClientRect()] as const));
    settle(h);
    const before = rsvpDropBefore(subject.beside.map((b) => b.name), h.slot);
    swallowTap();
    /* The page is redrawn inside this call (the Maker's one save tells the frame at once). */
    host.onDrop(subject, before);
    const done = () => {
      h.ghost.remove();
      undim(h);
    };
    if (calm()) return done();
    /* The others slide from where they were to where they stand now (the march's re-flow)… */
    for (const { name, row } of subject.beside) {
      if (!row.isConnected) continue;
      const b = was.get(name);
      const a = row.getBoundingClientRect();
      if (!b || (Math.abs(b.left - a.left) < 1 && Math.abs(b.top - a.top) < 1)) continue;
      row.animate([{ transform: `translate(${b.left - a.left}px,${b.top - a.top}px)` }, { transform: 'none' }], { duration: SETTLE_MS, easing: EASE });
    }
    /* …and the ghost flies home, to where its line settled; its place stays dim until it lands. */
    const home = subject.row.isConnected ? subject.row.getBoundingClientRect() : null;
    if (!home) return done();
    const pad = (h.ghost.getBoundingClientRect().width / GHOST_SCALE - home.width) / 2;
    let once = false;
    const land = () => {
      if (once) return;
      once = true;
      done();
    };
    h.ghost.animate([{ transform: h.ghost.style.transform, opacity: 1 }, { transform: `translate(${home.left - pad}px,${home.top - (h.ghost.offsetHeight - home.height) / 2}px)`, opacity: 0.2 }], { duration: LAND_MS, easing: EASE, fill: 'forwards' }).onfinish = land;
    win.setTimeout(land, LAND_MS + 100); /* a hidden tab may never finish the animation */
  }

  /** The tap a drop leaves behind (a mouse's click, a finger's) picks nothing — heard on the window, before the page. */
  function swallowTap() {
    const eat = (e: Event) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    win.addEventListener('click', eat, true);
    win.setTimeout(() => win.removeEventListener('click', eat, true), SWALLOW_MS);
  }

  function onCancel() {
    const h = held;
    stop();
    held = null;
    if (!h) return;
    settle(h);
    h.ghost.remove();
    undim(h);
    host.onDrop(h.subject, undefined);
  }

  const onDown = (e: PointerEvent) => {
    if (e.button !== 0 || !e.isPrimary || held || pending) return;
    const target = e.target instanceof win.Element || (e.target as Element | null)?.nodeType === 1 ? (e.target as Element) : null;
    const subject = target ? host.subject(target) : null;
    if (!subject || subject.beside.length < 2) return;
    const { clientX: x, clientY: y } = e;
    pending = { subject, x, y, touch: e.pointerType !== 'mouse', pid: e.pointerId, timer: win.setTimeout(() => lift(x, y), RSVP_HOLD_MS) };
    doc.addEventListener('pointermove', onMove, { passive: false });
    doc.addEventListener('pointerup', onUp);
    doc.addEventListener('pointercancel', onCancel);
  };
  /* 📱 While a line is held the page must not scroll under the finger. On the document from the start, NOT added at
     the lift: a browser decides at touchstart whether anything may block its scroll (the march's own note). */
  const onTouchMove = (e: TouchEvent) => {
    if (held) e.preventDefault();
  };
  /* A long press must not raise the browser's own menu or select the words under the finger. */
  const onMenu = (e: Event) => e.preventDefault();
  const style = doc.createElement('style');
  style.setAttribute('data-rsvp-drag', '');
  style.textContent = '[data-rsvp-line],[data-rsvp-group]{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}[data-rsvp-line][contenteditable]{-webkit-user-select:text;user-select:text}';
  doc.head.appendChild(style);
  doc.addEventListener('pointerdown', onDown);
  doc.addEventListener('touchmove', onTouchMove, { passive: false });
  doc.addEventListener('contextmenu', onMenu);
  return () => {
    stop();
    if (held) {
      settle(held);
      held.ghost.remove();
      undim(held);
      held = null;
    }
    style.remove();
    doc.removeEventListener('pointerdown', onDown);
    doc.removeEventListener('touchmove', onTouchMove);
    doc.removeEventListener('contextmenu', onMenu);
  };
}
