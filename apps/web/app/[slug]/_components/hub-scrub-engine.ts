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
const PAGE = '.hub-page-cell';
/** The cover's own boxes (`hub-scenes.tsx` `HubCoverHold`) and the page wrappers an arrival is looked for THROUGH. */
const COVER = '.hub-cover-cell';
const THROUGH = '.hub-scenes, .hub-cell, .hub-stage, .hub-after, .hub-below, .sn-hub-cards, [data-hub-wrap]';
/** `stick`: where the STAGE's top stands while its scene is held — above the scene's own line by whatever the stage holds before it.
 *  `lift`: the cover's rest-of-the-page, on a hand-over from the cover — what follows its arrival rises by a number said there. */
type Held = { cell: HTMLElement; stage: HTMLElement; scene: HTMLElement; after: HTMLElement; below: HTMLElement | null; arrival: HTMLElement | null; pair: ScrubPair; rest: number; stick: number; lift?: HTMLElement };

const px = (n: number) => `${Math.round(n * 100) / 100}px`;
const num = (n: number) => String(Math.round(n * 1000) / 1000);

/**
 * `root`: ONE scenes block (`.hub-scenes`) — or THE PAGE'S OWN HOLD (the outermost `.hub-page-cell`, `HubPageHold`),
 * and then every scenes block inside it is played by this one engine and it is the PAGE that stands still.
 *
 * 🧍 THE WHOLE PAGE STANDS STILL (owner, his first sentence about Scrub: *"the page will not scroll"*). A hand-over's
 * own cell can only hold what is inside the scenes block; the cover, a greeting, whatever the page draws around its
 * scenes went on scrolling at thumb speed while a scene was "held" — which reads as ordinary scrolling. So a page
 * wraps its whole content column in one plain cell › stage pair PER HAND-OVER, nested (`hub-scenes.tsx`
 * `HubPageHold`), and here hand-over k is given page pair k instead of its own cell: that stage — the entire column
 * — sticks when the leaving scene is on its line, for the hand-over's length. Still the browser's own sticky and
 * real page length; back-to-back hand-overs chain natively, with no script at the boundaries. The scenes' own nest
 * keeps what only it can do: the arrival in the same place, and the rise of what follows.
 */
export function armHubScrub(root: HTMLElement): () => void {
  if (typeof window === 'undefined') return () => {};
  const scopes = root.matches('.hub-scenes') ? [root] : Array.from(root.querySelectorAll<HTMLElement>('.hub-scenes'));
  /** Why it is off, said on every scenes block (null: it is on). */
  const say = (why: string | null) => {
    /* (A page whose cover is its only Scrub has no scenes block: it says it on its own hold.) */
    for (const s of scopes.length ? scopes : [root]) why === null ? s.removeAttribute(HUB_SCRUB_OFF) : s.setAttribute(HUB_SCRUB_OFF, why);
  };
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    say('reduce motion');
    return () => say(null);
  }
  say(null);
  /* The page's own pairs, outermost first — none when `root` is a scenes block. */
  const pages: Array<{ cell: HTMLElement; stage: HTMLElement }> = [];
  for (let cell: HTMLElement | null = root.matches(PAGE) ? root : null; cell; ) {
    const stage: HTMLElement | null = cell.querySelector<HTMLElement>(':scope > .hub-page-stage');
    if (!stage) break;
    pages.push({ cell, stage });
    cell = stage.querySelector<HTMLElement>(`:scope > ${PAGE}`);
  }
  const marked = new Map<HTMLElement, Map<string, string>>();
  /**
   * Set a custom property or a mark — only when it changes.
   * 🪤 A LENGTH IS NEVER "UNSET" WHILE ARMED: these boxes are nested inside boxes of their own kind (a cell in a
   * stage in a cell, a rest-of-the-page in a rest-of-the-page), and a custom property INHERITS — a box left with
   * none takes its ancestor's. Measured 2026-10-09: four inner cells each drew the page pair's 537 px as their own
   * hold, 2,148 px of blank page. Every length is said outright (`0px`); `null` is for disarming only.
   */
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
    for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) y += (n.matches('.hub-stage, .hub-page-stage') ? (n.parentElement as HTMLElement) : n).offsetTop;
    return y;
  };
  /**
   * 🎬 WHAT ARRIVES AFTER THE COVER — the next thing on the page a guest would see, whatever it is (owner: *"that
   * element is gone and the next element takes its place"*): a scene, or any block the page draws — the door, a
   * greeting, the ticket. A box with no size (a marker, an anchor) and one that is not in the flow (a pinned pill)
   * are not it; the nest's own boxes and a wrapper the page marks (`data-hub-wrap`) are looked THROUGH.
   */
  const nextBox = (box: HTMLElement): HTMLElement | null => {
    for (const el of Array.from(box.children) as HTMLElement[]) {
      if (!el.offsetHeight || el.offsetParent === null) continue;
      return el.matches(THROUGH) ? (nextBox(el) ?? el) : el;
    }
    return null;
  };
  /** The block that arrived after the cover at the last measure — its marks are taken off when another takes its place. */
  let zero: HTMLElement | null = null;
  /**
   * WHAT FOLLOWS THE COVER'S ARRIVAL, as boxes: every later sibling of the arrival and of each wrapper it sits in, up
   * to the rest of the page — each marked (`data-hub-zlift`) so the stylesheet can hold it under the lower of the two.
   * Only a box in the ordinary flow: one the page pins or places itself (`position` anything but static) is left
   * exactly as it is, and the nest's own boxes carry their rise themselves (`--hub-rise`).
   */
  let lifted: HTMLElement[] = [];
  const followers = (from: HTMLElement, upTo: HTMLElement): HTMLElement[] => {
    const out: HTMLElement[] = [];
    for (let el: HTMLElement | null = from; el && el !== upTo; el = el.parentElement) {
      for (let sib = el.nextElementSibling as HTMLElement | null; sib; sib = sib.nextElementSibling as HTMLElement | null) {
        if (sib.offsetHeight && !sib.matches('.hub-after, .hub-below') && getComputedStyle(sib).position === 'static') out.push(sib);
      }
    }
    return out;
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
    scenes = Array.from(root.querySelectorAll<HTMLElement>('.hub-scene[data-hub-fx]'));
    const was = held;
    held = [];
    let arrivedAt: { scene: HTMLElement; top: number } | null = null;
    /* What follows a pair starts lower and RISES while it is held (`--hub-rise`, a `top`): everything below is measured
       as it is LAID OUT, so those are taken off first — `frame`, which always follows, puts them back. */
    for (const h of was) if (h.below) put(h.below, '--hub-rise', '0px');
    for (const h of was) if (h.lift) put(h.lift, '--hub-zrise', '0px');
    /* Armed FIRST: where a stage must stand depends on the hand-overs before it having drawn their arrivals in place
       (`--hub-up`), and nothing of the drawing applies until the mark is on. */
    for (const s of scopes) put(s, 'data-hub-scrub-on', '');
    if (pages.length) put(root, 'data-hub-page-on', '');
    /* The top of the room: under the page's own bar and its progress mark — THE STYLESHEET'S LINE (`--hub-pin`),
       read back in pixels from the length the armed scenes block carries it as (`globals.css`). This script has no
       number of its own for it: it once had (76 px, or 9 %) while the stylesheet's is 100 px under the invitation's
       pinned bar, and a long arrival began above the line, its top under the progress mark. A page that does not
       say its line is not played at all — never played on a guess. The most that can be held whole: the room, less
       a breath. */
    /* (Read on a scenes block — or, on a page whose cover is its only Scrub, on the cover's own cell.) */
    const coverCell = pages.length ? root.querySelector<HTMLElement>(COVER) : null;
    const topLine = parseFloat(getComputedStyle(scopes[0] ?? coverCell ?? root).scrollPaddingTop);
    if (!(topLine > 0)) throw new Error('the page does not say where its top line is');
    const view = { centre: C, topLine, room: V - topLine - 24, lens };
    /* 🎬 HAND-OVER ZERO — THE COVER (`HubCoverHold`: the cover, then the rest of the page). It is the page's own FIRST
       pair that stands still for it, and it is held WHERE IT STANDS when the page opens (`scrubPair`'s `stands`: its
       laid-out top is its top on the screen at scroll 0) — so at scroll 0 nothing has moved and nothing has begun.
       What arrives is the next box on the page; it is marked (`data-hub-zero`) so the stylesheet can fade a block
       that is not a scene, and find what follows it. Only on a page with its own hold: a cover has no cell. */
    const cover = coverCell?.querySelector<HTMLElement>(':scope > .hub-cover') ?? null;
    const coverRest = coverCell?.querySelector<HTMLElement>(':scope > .hub-cover-after') ?? null;
    let arrives: HTMLElement | null = null;
    if (pages[0] && cover && coverRest && cover.offsetHeight > 0) {
      arrives = nextBox(coverRest);
      const pair = scrubPair({ h: cover.offsetHeight, oneByOne: false }, arrives ? elementOf(arrives) : { h: 0, oneByOne: false }, view, docTop(cover));
      const stick = pair.top - (docTop(cover) - docTop(pages[0].stage));
      put(pages[0].stage, '--hub-top', px(stick));
      put(pages[0].cell, '--hub-len', px(pair.len));
      put(coverRest, '--hub-up', arrives ? px(pair.up - (docTop(arrives) - docTop(coverRest))) : '0px');
      put(coverRest, '--hub-zrise', '0px');
      const next = arrives?.nextElementSibling ?? null;
      held.push({ cell: pages[0].cell, stage: pages[0].stage, scene: cover, after: coverRest, below: next?.matches('.hub-below, .hub-after') ? (next as HTMLElement) : null, arrival: arrives, pair, rest: 0, stick, lift: coverRest });
      arrivedAt = arrives ? { scene: arrives, top: pair.arrivalTop } : null;
      /* Played with the scenes: the cover first, then its arrival (unless that is a scene the list already has). */
      scenes = [cover, ...(arrives && !scenes.includes(arrives) ? [arrives] : []), ...scenes];
    }
    if (zero && zero !== arrives) {
      put(zero, '--hub-o', '1');
      put(zero, 'data-hub-away', null);
      put(zero, 'data-hub-zero', null);
    }
    if (arrives) put(arrives, 'data-hub-zero', '');
    zero = arrives;
    /* (Read with the marks off: a marked box is no longer `static`.) */
    for (const el of lifted) put(el, 'data-hub-zlift', null);
    lifted = arrives && coverRest ? followers(arrives, coverRest) : [];
    for (const el of lifted) put(el, 'data-hub-zlift', '');
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
        put(stage, '--hub-top', '0px');
        put(cell, '--hub-len', '0px');
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
      /* WHAT STANDS STILL: the page's own pair for this hand-over when the page has one (the whole column), else the
         hand-over's own cell (the scenes block from the last hand-over on). */
      const hold = pages[held.length] ?? { cell, stage };
      if (hold.cell !== cell) {
        put(stage, '--hub-top', '0px');
        put(cell, '--hub-len', '0px');
      }
      /* The stage sticks where its SCENE is on its line: higher by what it holds before the scene. */
      const line = pair.top - (docTop(scene) - docTop(hold.stage));
      /* 🔗 …BUT NEVER BEFORE THE HAND-OVER BEFORE IT HAS LET GO. A stage inside the one before it stands, while that
         one is standing, at that one's line plus its own place in it — a line of its own BELOW that is a place the
         page has already scrolled past, and the stage would stick at once: under the hand-over before it, playing its
         scene out before it had arrived. (Seen 2026-10-10 on a cover taller than the screen: the countdown arrives
         with its bottom on the centre line, above its own centred line, and stood the page still 80 px early; and as
         half a pixel of rounding at two window sizes, which moved the whole page at scroll 0.) Then it is held where
         it arrived — the same place. */
      const before = held[held.length - 1];
      const stick = before && before.stage.contains(hold.stage) ? Math.min(line, before.stick + (docTop(hold.stage) - docTop(before.stage))) : line;
      put(hold.stage, '--hub-top', px(stick));
      put(hold.cell, '--hub-len', px(pair.len + rest));
      /* The arrival is drawn in its place whatever sits between it and the top of the rest of the page (a scene with
         no box, a wrapper's gap). */
      put(after, '--hub-up', arrival ? px(pair.up - (docTop(arrival) - docTop(after))) : '1rem');
      held.push({ cell: hold.cell, stage: hold.stage, scene, after, below, arrival, pair, rest, stick });
      arrivedAt = arrival ? { scene: arrival, top: pair.arrivalTop } : null;
    }
    /* A page pair nobody needed (a scene that drew nothing, a scene on a tab that is not shown) holds nothing. */
    for (const spare of pages.slice(held.length)) {
      put(spare.stage, '--hub-top', '0px');
      put(spare.cell, '--hub-len', '0px');
    }
    /* THE PAGE'S END: long enough that the last scene's bottom can reach the centre line — every row can complete
       and every hand-over can finish, at any window height. */
    /* …so the page must scroll at least as far as (a) the last scene's bottom on the centre line and (b) the end of
       the last hand-over; where it stops short, the difference is added after the scenes. */
    const last = scenes[scenes.length - 1];
    const final = held[held.length - 1];
    const tail = scopes[scopes.length - 1] ?? root;
    put(tail, '--hub-end', null);
    const reach = document.documentElement.scrollHeight - V;
    /* Thumb travel to bring a laid-out place to a line on the screen: the distance, plus every hold passed on the way
       (every hand-over whose scene comes BEFORE this one in the page keeps it standing for its own length). */
    const travel = (el: HTMLElement, y: number, line: number) => y - line + held.reduce((n, h) => (h.scene !== el && h.scene.compareDocumentPosition(el) & 4 ? n + h.pair.len + h.rest : n), 0);
    const need = Math.max(
      last ? travel(last, docTop(last) + last.offsetHeight, C) : 0,
      final ? travel(final.scene, docTop(final.cell), final.stick) + final.pair.len + final.rest : 0,
    );
    put(tail, '--hub-end', need > reach ? px(need - reach) : null);
    /* An element already past the centre line when the page opens is simply there. */
    there.clear();
    for (const s of scenes) if (docTop(s) <= C) there.add(s);
    /* …and the cover is there when the page opens, however tall it is. */
    if (held[0]?.lift) there.add(held[0].scene);
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
      /* What follows a pair rises as the hand-over plays. After the COVER it is whatever the page draws next, in
         plain sight — so it stays under the cover until the cover has completely gone, and rises only then (`rows`:
         the same moment an arrival's rows may begin). */
      const lower = h.lift ? 1 - m.rows : m.below;
      if (h.below) put(h.below, '--hub-rise', px(h.pair.rise * lower));
      if (h.lift) put(h.lift, '--hub-zrise', px(h.pair.rise * lower));
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
    say(`the script stopped: ${e instanceof Error ? e.message : String(e)}`.slice(0, 160));
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
