import { SCRUB, scrubLens, scrubMoment, scrubNeedsRest, scrubOwnIn, scrubPair, scrubRow, scrubThrough, type ScrubElement, type ScrubPair } from './hub-scrub-math';

/**
 * 🎚 SCRUB ON THE GUEST PAGE — the engine (`hub-scrub.tsx` loads it, after the page is interactive, only on a page that
 * has a scene whose "Leaves" is Scrub out). The numbers are `hub-scrub-math.ts`; the markup is `hub-scenes.tsx`; the
 * drawing is `globals.css` ("SCRUB — A HELD HAND-OVER").
 *
 * 🔒 WHAT THIS SCRIPT MAY DO: MEASURE (heights, the screen, where things are) and SET CUSTOM PROPERTIES AND MARKS on
 * the scenes. Nothing else. It never sets the page's scroll position, never calls `preventDefault`, listens to the
 * scroll passively, and moves nothing itself: a hold is real page length (the hand-over cell's `::after`) and the
 * stand-still is the browser's own `position: sticky`. So iOS momentum, the address bar, find-in-page, anchors and
 * the guests' bar are the browser's as on any page.
 *
 * 🧯 FAIL-VISIBLE: until `data-hub-scrub-on` is set — no script, a blocked chunk, an error in here, "reduce motion" —
 * every rule of the drawing is off and the page is a plain page with everything on it. Any throw disarms.
 *
 * 🗣 …AND THE PAGE SAYS WHY (2026-10-09 — owner, on a page where it was on: *"as a guest nothing scrubbed"*; nobody
 * could tell "off" from "on but not noticeable", and this file's `catch` swallowed its own reason). Whenever the
 * hand-overs are off for a reason this script knows, the scenes block carries it in plain words
 * (`data-hub-scrub-off`): "reduce motion", or "the script stopped: <what was thrown>". Nothing reads it to draw —
 * the plain page IS the right page — it is there for whoever has to find out (the lab's badge reads it;
 * `hub-scrub.tsx` adds the two reasons that are its own).
 */

export const HUB_SCRUB_OFF = 'data-hub-scrub-off';

const CELL = '.hub-cell';
/** `stick`: where the STAGE's top stands while its scene is held — above the scene's own line by whatever the stage holds before it. */
type Held = { cell: HTMLElement; stage: HTMLElement; scene: HTMLElement; after: HTMLElement; below: HTMLElement | null; arrival: HTMLElement | null; pair: ScrubPair; rest: number; stick: number };

const px = (n: number) => `${Math.round(n * 100) / 100}px`;
const num = (n: number) => String(Math.round(n * 1000) / 1000);

export function armHubScrub(root: HTMLElement): () => void {
  if (typeof window === 'undefined') return () => {};
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    root.setAttribute(HUB_SCRUB_OFF, 'reduce motion');
    return () => root.removeAttribute(HUB_SCRUB_OFF);
  }
  root.removeAttribute(HUB_SCRUB_OFF);
  const marked = new Map<HTMLElement, Map<string, string>>();
  /** Set a custom property or a mark — only when it changes. */
  const put = (el: HTMLElement, key: string, value: string | null) => {
    let was = marked.get(el);
    if (!was) marked.set(el, (was = new Map()));
    if (was.get(key) === (value ?? '\0')) return;
    was.set(key, value ?? '\0');
    if (key.startsWith('--')) value === null ? el.style.removeProperty(key) : el.style.setProperty(key, value);
    else value === null ? el.removeAttribute(key) : el.setAttribute(key, value);
  };
  const canvasOf = (scene: HTMLElement) => scene.querySelector<HTMLElement>(':scope > .hub-canvas');
  const oneByOne = (scene: HTMLElement) => Boolean(canvasOf(scene)?.classList.contains('hub-seq-parts'));
  const hasIn = (scene: HTMLElement) => !canvasOf(scene)?.classList.contains('hub-in-none');
  const elementOf = (scene: HTMLElement): ScrubElement => ({ h: scene.offsetHeight, oneByOne: oneByOne(scene) });
  /** A scene's rows and parts, in the order a guest reads them: the first is its heading. */
  const piecesOf = (scene: HTMLElement): HTMLElement[] => {
    const body = canvasOf(scene)?.querySelector(':scope > .hub-canvas-body');
    if (!body) return [];
    const out: HTMLElement[] = [];
    for (const part of body.querySelectorAll<HTMLElement>(':scope > * > *')) {
      const rows = part.matches('[data-hub-rows]') ? part : part.querySelector<HTMLElement>('[data-hub-rows]');
      if (rows) out.push(...(Array.from(rows.children) as HTMLElement[]));
      else out.push(part);
    }
    return out;
  };

  /**
   * Where an element is LAID OUT in the document — never where a hold has it standing on the screen. A stage that is
   * standing still reports where it STANDS (`offsetTop` follows `position: sticky`), so for a stage its cell is asked
   * instead: the stage is the cell's first box and the cell never moves. (A re-measure can come in the middle of a
   * hold — a picture loading, a font landing — and must not read the hold as layout.)
   */
  const docTop = (el: HTMLElement): number => {
    let y = 0;
    for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) y += (n.matches('.hub-stage') ? (n.parentElement as HTMLElement) : n).offsetTop;
    return y;
  };
  const there = new Set<HTMLElement>();
  let V = 0;
  let C = 0;
  let lens = scrubLens(0);
  let held: Held[] = [];
  let scenes: HTMLElement[] = [];
  let queued = false;
  let dead = false;
  /** Where the page was when the numbers were last set — see the pulse. */
  let drawnAt = -1;

  function measure() {
    V = window.innerHeight;
    C = V / 2;
    lens = scrubLens(V);
    /* The top of the room: under the page's own bar. The most that can be held whole: the room, less a breath. */
    const topLine = Math.max(76, V * 0.09);
    const view = { centre: C, topLine, room: V - topLine - 24, lens };
    scenes = Array.from(root.querySelectorAll<HTMLElement>('.hub-scene[data-hub-fx]'));
    const was = held;
    held = [];
    let arrivedAt: { scene: HTMLElement; top: number } | null = null;
    /* What follows a pair starts lower and RISES while it is held (`--hub-rise`, a `top`): everything below is measured
       as it is LAID OUT, so those are taken off first — `frame`, which always follows, puts them back. */
    for (const h of was) if (h.below) put(h.below, '--hub-rise', null);
    for (const cell of root.querySelectorAll<HTMLElement>(CELL)) {
      const stage = cell.querySelector<HTMLElement>(':scope > .hub-stage');
      /* THE LEAVING SCENE is the one right before its cell's `.hub-after` — the stage may hold ordinary scenes before
         it (they stand still with it: during a hold the page does not move). */
      const after = stage?.querySelector<HTMLElement>(':scope > .hub-after, :scope > .hub-below > .hub-after') ?? null;
      const scene = after?.previousElementSibling as HTMLElement | null;
      if (!stage || !scene || !after || !scene.matches('.hub-scene')) continue;
      /* A scene that drew nothing (a Countdown with no date: no box at all) holds nothing — the page never stands
         still on a blank. What follows it simply follows. */
      if (scene.offsetHeight === 0) {
        put(stage, '--hub-top', null);
        put(cell, '--hub-len', null);
        put(after, '--hub-up', '0px');
        arrivedAt = null;
        continue;
      }
      /* THE ARRIVAL is the next scene a guest will SEE — a scene with no box is looked through, else this element
         would hand over to nothing and leave the screen blank. What follows the pair is the ONE box right after it. */
      const arrival = Array.from(after.querySelectorAll<HTMLElement>('.hub-scene')).find((el) => el.offsetHeight > 0) ?? null;
      const next = arrival?.nextElementSibling ?? null;
      const below = next?.matches('.hub-below, .hub-after') ? (next as HTMLElement) : null;
      const leaving = elementOf(scene);
      const pair = scrubPair(leaving, arrival ? elementOf(arrival) : { h: 0, oneByOne: false }, view);
      /* Is this element already where it is held when the hand-over INTO it ends? Then a rest comes first. */
      const rest = arrivedAt && arrivedAt.scene === scene && scrubNeedsRest(arrivedAt.top, leaving, view) ? lens.rest : 0;
      /* The stage sticks where its SCENE is on its line: higher by what it holds before the scene. */
      const stick = pair.top - (docTop(scene) - docTop(stage));
      put(stage, '--hub-top', px(stick));
      put(cell, '--hub-len', px(pair.len + rest));
      /* The arrival is drawn in its place whatever sits between it and the top of the rest of the page (a scene with
         no box, a wrapper's gap). */
      put(after, '--hub-up', arrival ? px(pair.up - (docTop(arrival) - docTop(after))) : null);
      held.push({ cell, stage, scene, after, below, arrival, pair, rest, stick });
      arrivedAt = arrival ? { scene: arrival, top: pair.arrivalTop } : null;
    }
    put(root, 'data-hub-scrub-on', '');
    /* THE PAGE'S END: long enough that the last scene's bottom can reach the centre line — every row can complete
       and every hand-over can finish, at any window height. */
    /* …so the page must scroll at least as far as (a) the last scene's bottom on the centre line and (b) the end of
       the last hand-over; where it stops short, the difference is added after the scenes. */
    const last = scenes[scenes.length - 1];
    const final = held[held.length - 1];
    put(root, '--hub-end', null);
    const reach = document.documentElement.scrollHeight - V;
    /* Thumb travel to bring a laid-out place to a line on the screen: the distance, plus every hold passed on the way
       (the holds of the cells it sits inside — each keeps what is in it standing for its own length). */
    const travel = (el: HTMLElement, y: number, line: number) => y - line + held.reduce((n, h) => (h.cell !== el && h.cell.contains(el) ? n + h.pair.len + h.rest : n), 0);
    const need = Math.max(
      last ? travel(last, docTop(last) + last.offsetHeight, C) : 0,
      final ? travel(final.cell, docTop(final.cell), final.stick) + final.pair.len + final.rest : 0,
    );
    put(root, '--hub-end', need > reach ? px(need - reach) : null);
    /* An element already past the centre line when the page opens is simply there. */
    there.clear();
    for (const s of scenes) if (docTop(s) <= C) there.add(s);
  }

  function frame() {
    queued = false;
    if (dead) return;
    drawnAt = window.scrollY;
    const state = new Map<HTMLElement, { pin: number; pout: number; gate: number; handed: boolean }>();
    const of = (scene: HTMLElement) => {
      let s = state.get(scene);
      if (!s) state.set(scene, (s = { pin: 1, pout: 0, gate: 1, handed: false }));
      return s;
    };
    for (const h of held) {
      /* How far the page has travelled since this element was held: the browser's own sticky, read back. */
      const t = Math.max(0, Math.min(h.pair.len + h.rest, h.stick - h.cell.getBoundingClientRect().top));
      const m = scrubMoment(t, h.pair, lens, h.rest);
      of(h.scene).pout = m.out;
      if (h.arrival) Object.assign(of(h.arrival), { pin: m.in, gate: m.rows, handed: true });
      if (h.below) put(h.below, '--hub-rise', h.pair.rise > 0 ? px(h.pair.rise * m.below) : null);
    }
    for (const scene of scenes) {
      const s = of(scene);
      const top = scene.getBoundingClientRect().top;
      if (!s.handed) {
        /* Nobody hands over to it: its Build in runs from its top reaching the centre line (an element already past
           the line when the page opens is simply there), and its rows wait for its own heading. */
        s.pin = !hasIn(scene) || there.has(scene) ? 1 : scrubOwnIn(top, C, Math.min(lens.in, Math.max(40, scene.offsetHeight / 2)));
        s.gate = Math.max(0, Math.min(1, (s.pin - 0.5) * 2));
      }
      /* `--hub-pbin`, never `--hub-pin`: that name is the stylesheet's pin LINE (a length on `.hub-scenes`, read by an Auto run). */
      put(scene, '--hub-pbin', num(s.pin));
      put(scene, '--hub-pout', num(s.pout));
      /* ONE FADE: the hand-over's own. An arrival with no Build in simply appears when its turn comes. */
      const shown = hasIn(scene) ? s.pin : s.pin > 0 || !s.handed ? 1 : 0;
      put(scene, '--hub-o', num(shown * (1 - s.pout)));
      put(scene, 'data-hub-away', shown <= 0 || s.pout >= 1 ? '' : null);
      const bottom = top + scene.offsetHeight;
      if (oneByOne(scene) && top < V && bottom > -V) {
        piecesOf(scene).forEach((piece, i) => {
          /* The heading arrives with the element — by the element's ONE fade, so it plays nothing of its own (its own
             fade under the scene's would be two opacities multiplied); every other row as ITS top reaches the centre
             line — all of them complete by the time the element's bottom is on it. */
          const y = piece.getBoundingClientRect().top;
          put(piece, '--hub-pp', num(i === 0 ? 1 : scrubRow(y, C, s.gate, bottom - y)));
        });
      }
    }
  }
  const draw = () => {
    try {
      frame();
    } catch (e) {
      fail(e);
    }
  };
  const ask = () => {
    if (queued || dead) return;
    queued = true;
    window.requestAnimationFrame(draw);
  };
  /* 🫀 A FRAME THAT NEVER COMES MUST NOT LEAVE THE PAGE BLANK (seen 2026-10-09, in a browser pane that scrolls but
     gives a page no animation frames: armed at the top of the page, every scene not yet arrived was still marked
     "not here" 2,600 px later — a white screen). The numbers are asked for on a frame because that is the right
     moment; a slow pulse answers when no frame did: if the page is somewhere it was not drawn for, draw it. On a
     page that gets its frames this finds nothing to do. */
  const pulse = window.setInterval(() => {
    if (!dead && (queued || window.scrollY !== drawnAt)) draw();
  }, 250);
  const again = () => {
    if (dead) return;
    try {
      measure();
      frame();
    } catch (e) {
      fail(e);
    }
  };
  /** A throw: back to the plain page — and the page says what stopped it. */
  function fail(e: unknown) {
    stop();
    root.setAttribute(HUB_SCRUB_OFF, `the script stopped: ${e instanceof Error ? e.message : String(e)}`.slice(0, 160));
  }
  function stop() {
    if (dead) return;
    dead = true;
    window.removeEventListener('scroll', ask);
    window.removeEventListener('resize', again);
    window.removeEventListener('orientationchange', again);
    root.removeEventListener('load', again, true);
    sizes?.disconnect();
    window.clearInterval(pulse);
    /* Back to the plain page: every mark and property this script set, taken off. */
    for (const [el, keys] of marked) for (const key of keys.keys()) key.startsWith('--') ? el.style.removeProperty(key) : el.removeAttribute(key);
    marked.clear();
  }
  /* A scene that changes height (a font landing, a picture, an open row) is measured again. */
  let sizes: ResizeObserver | null = null;
  try {
    measure();
    frame();
    window.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', again);
    window.addEventListener('orientationchange', again);
    root.addEventListener('load', again, true);
    void document.fonts?.ready.then(again);
    if (typeof ResizeObserver !== 'undefined') {
      let first = true;
      sizes = new ResizeObserver(() => {
        if (first) first = false;
        else again();
      });
      for (const s of scenes) sizes.observe(s);
    }
  } catch (e) {
    fail(e);
  }
  return stop;
}

/** For the guard: the things this file may touch on `window` and `document`. */
export const HUB_SCRUB_ROW_PX = SCRUB.row;
export { scrubThrough };
