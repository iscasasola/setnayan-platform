import { firstScreenFitter } from '../_lib/first-screen-fit-dom';
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
const THROUGH = '.hub-scenes, .hub-cell, .hub-stage, .hub-after, .hub-below, .sn-hub-cards, [data-hub-wrap], [data-hub-tab]';
/**
 * 🤝 THE PAGE'S ONE ACTION, AS THE PAGE ITSELF MARKS IT — the reply row under the names (`guest-me-parts.tsx`
 * `ReplyCardRow`) and the row that stands in its place (`arrival-action.tsx` `ArrivalActionRow`) both carry
 * `data-arrival-action`; the stranger's door (`get-inside.tsx`) carries `data-get-inside`. Read as what the block
 * IS, never measured: a block is "the action row" when it is one of these, or is the box that holds one.
 */
const ACTION_ROW = '[data-arrival-action], [data-get-inside]';
/**
 * 🚪 THE STRANGER'S DOOR — "Get inside" (`get-inside.tsx`), or what stands in its place for a signed-in stranger. Owner
 * 2026-10-12, asked whether it should stay on the first screen or arrive after the cover fades: *"Keep it on first
 * screen"*. So a door that is ON the first screen as the page opens (the cover fitted to make room for it) is not
 * handed over: it STAYS where it stands, whole and pressable, for the whole hold; what arrives in the cover's place
 * is the block after it, ending above it. A door that is not on the first screen (a photo cover is taller than the
 * screen, and nothing fits it) still arrives with the block after it, as before.
 */
const DOOR = '[data-get-inside]';
/** `stick`: where the STAGE's top stands while its scene is held — above the scene's own line by whatever the stage holds before it.
 *  `lift`: on a hand-over from the cover, the box the rise of what follows its arrival is SAID on — the page's own first
 *  stage, so every box marked under it reads the one number, whichever of the page's groups it is in. */
type Held = { cell: HTMLElement; stage: HTMLElement; scene: HTMLElement; after: HTMLElement; below: HTMLElement | null; arrival: HTMLElement | null; mates?: HTMLElement[]; pair: ScrubPair; rest: number; stick: number; lift?: HTMLElement; floor?: number };

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
  const boxless = (el: HTMLElement) => el.childElementCount > 0 && getComputedStyle(el).display === 'contents';
  const nextBox = (box: HTMLElement): HTMLElement | null => {
    for (const el of Array.from(box.children) as HTMLElement[]) {
      /* A row that draws NO BOX of its own (`display: contents` — the stranger's door row, `.sn-door-row`) is its
         children, laid out in its place: it has no size to ask, so it is looked through. */
      if (!el.offsetHeight && boxless(el)) {
        const inside = nextBox(el);
        if (inside) return inside;
        continue;
      }
      if (!el.offsetHeight || el.offsetParent === null) continue;
      return el.matches(THROUGH) ? (nextBox(el) ?? el) : el;
    }
    return null;
  };
  /** What arrived after the cover at the last measure (one block, or the action row and the block with it) — a block's
   *  marks are taken off when it is no longer part of it. */
  let zeros: HTMLElement[] = [];
  /** The box OUTSIDE the cover's own rest that was pulled up to the cover at the last measure, if any (`data-hub-zrest`). */
  let zrest: HTMLElement | null = null;
  /**
   * WHAT FOLLOWS THE COVER'S ARRIVAL, as boxes: every later sibling of the arrival and of each wrapper it sits in, up
   * to THE PAGE'S OWN STAGE — each marked (`data-hub-zlift`) so the stylesheet can hold it under the lower of the two.
   * Only a box in the ordinary flow: one the page pins or places itself (`position` anything but static) is left
   * exactly as it is, and the nest's own boxes carry their rise themselves (`--hub-rise`).
   *
   * 🧱 UP TO THE STAGE, NOT ONLY THE COVER'S OWN REST (2026-10-10). On the real invitation the cover is not a sibling
   * of the rest of the page: it sits with the reply card in the page's FIRST GROUP (`site-body.tsx` `group(leadTab, …)`
   * — one tab's box), and everything else is in LATER groups, outside the cover's rest-of-the-page box. A walk that
   * stopped at that box marked nothing there, so the next group stood where the arrival ends — over the cover, in
   * plain sight, while it was still leaving. The walk now goes on through the cover's cell and each box it sits in;
   * a group that is not shown (another tab: no box) is passed over, and marked when its tab is.
   */
  let lifted: HTMLElement[] = [];
  const followers = (from: HTMLElement, upTo: HTMLElement): HTMLElement[] => {
    const out: HTMLElement[] = [];
    for (let el: HTMLElement | null = from; el && el !== upTo; el = el.parentElement) {
      for (let sib = el.nextElementSibling as HTMLElement | null; sib; sib = sib.nextElementSibling as HTMLElement | null) {
        /* (A row with no box of its own stands for its children: they are the boxes that follow.) */
        for (const box of !sib.offsetHeight && boxless(sib) ? (Array.from(sib.children) as HTMLElement[]) : [sib]) {
          if (box.offsetHeight && !box.matches('.hub-after, .hub-below') && getComputedStyle(box).position === 'static') out.push(box);
        }
      }
    }
    return out;
  };
  /**
   * 📐 THE COVER IS FITTED ONCE, BEFORE IT IS HELD (owner 2026-10-12, DECISION_LOG "option 2"). A cover taller than the
   * screen was held by its bottom, and its names stood under the pinned top bar while it faded. So the first time the
   * cover is measured with a size, the page's own first-screen fit (`_lib/first-screen-fit-dom.ts`, the rule
   * `_lib/first-screen-fit.ts`) closes its air up, draws its mark smaller and lets parts go below the line — the names
   * never — so its names and date are on the first screen; then it is held. NEVER AGAIN while it is held: a fit that
   * answered the hand-over's own re-measure fed a loop (the page changed length every ~120 ms at 375 × 560, #6484).
   * The stranger's door has its own fit (`first-screen-door.tsx`), which made this same plan before the hold armed and
   * stands aside while it is on; this makes it again, by the same rule, so it is the hold's to take back. Taken back
   * when the hold is (and the door's own fit then fits the plain page, as it always has).
   */
  let fitted = false;
  let unfit: (() => void) | null = null;
  /**
   * …ONCE — and again only when the SCREEN changes (the window, the fonts, a picture) while the page is still at its
   * very top, before the hold has begun: a one-off event, never the hand-over's own re-measure, so it cannot loop, and
   * nothing is being held to jump. (Seen 2026-10-12: fitted on the first measure, before the page had settled, the plan
   * was 2 px off the door's own — 0.70 of the air for 0.68.)
   */
  let mayRefit = false;
  /** The cover's rest's own top margin, read without the hold — kept on it when nothing is pulled through it (a door that stays). */
  let restMargin: number | null = null;
  /** The door that stayed at the last measure (`data-hub-stay`). */
  let stayed: HTMLElement[] = [];
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

  /**
   * 📐 Fit the cover's first screen once (see `fitted`), ON THE PAGE AS IT LAYS OUT WITHOUT THE HOLD — the hold's own
   * marks are taken off for the measuring and put back before anything is drawn (one task: nothing is painted between).
   * The stranger's door, when it stands under the cover, is what the fit makes room for, by the door's own line (the
   * bottom bar's top, or the cookie banner's) — the plan its own fit (`first-screen-door.tsx`) made before the hold armed,
   * made again by the same rule on the same page. With no door, the names and the date are kept above the bottom bar's
   * top. Only the frameless card is fitted, as on the door's page. Returns how to take it back, or null.
   */
  function fitCover(cover: HTMLElement, cell: HTMLElement, rest: HTMLElement): (() => void) | null {
    const door = rest.querySelector<HTMLElement>('details[data-get-inside]');
    const head = cover.querySelector<HTMLElement>('header[data-pahina-first-screen]');
    const screen = door ? door.closest<HTMLElement>('[data-pahina-first-screen]') : head;
    const card = head?.querySelector<HTMLElement>('[data-cover-frameless]') ?? null;
    const inner = card?.firstElementChild;
    const fits = Boolean(screen && card && inner instanceof HTMLElement && screen.contains(card));
    /* The line, read while the hold is on (the cell says it then); the banner's top, while it is up. */
    const banner = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cookie-banner-top')) || 0;
    const foot = Math.max(door ? 0 : parseFloat(getComputedStyle(cell).scrollPaddingBottom) || 0, banner > 0 ? banner + 8 : 0);
    put(root, 'data-hub-page-on', null);
    try {
      let undo: (() => void) | null = null;
      if (fits) {
        /* (Without the hold nothing stands still: the page's own scroll turns a box on the screen into a place on the page.) */
        const fit = firstScreenFitter(screen!, card!, inner as HTMLElement, door, () => window.scrollY);
        fit.mark(true);
        const list = fit.blocks();
        fit.clear(list);
        fit.make(list, window.innerHeight - Math.max(foot, door ? parseFloat(getComputedStyle(door).scrollMarginBottom) || 0 : 0));
        undo = () => {
          fit.clear(fit.blocks());
          /* (The door's own fit keeps its mark: it was there before the hold, and takes the first screen back.) */
          if (!door) fit.mark(false);
        };
      }
      /* …and, still without the hold, the cover's rest's own top margin as the page now lays it out. */
      restMargin = parseFloat(getComputedStyle(rest).marginTop) || 0;
      return undo;
    } finally {
      put(root, 'data-hub-page-on', '');
    }
  }

  function measure() {
    const refit = mayRefit && fitted && window.scrollY < 1;
    mayRefit = false;
    if (refit) {
      unfit?.();
      unfit = null;
      fitted = false;
    }
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
    /* (A door that stayed is measured as it is laid out too.) */
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
    /* (Everything below is read with last time's marks off: a marked box is no longer `static`.) */
    for (const el of lifted) put(el, 'data-hub-zlift', null);
    lifted = [];
    let arrives: HTMLElement | null = null;
    let mate: HTMLElement | null = null;
    /** What arrives first: one block — or every box of an action row that draws no box of its own. */
    let row: HTMLElement[] = [];
    let outside: HTMLElement | null = null;
    if (pages[0] && coverCell && cover && coverRest && cover.offsetHeight > 0 && !fitted) {
      fitted = true;
      unfit = fitCover(cover, coverCell, coverRest);
    }
    if (pages[0] && coverCell && cover && coverRest && cover.offsetHeight > 0) {
      const page = pages[0].stage;
      const through = (el: HTMLElement) => (el.matches(THROUGH) ? (nextBox(el) ?? el) : el);
      /* (Measured with the rest's own margin on it — where a door in it stands on the page as it opens. A rest that is
         pulled up is given its own number below, read back from what it is pulled to: this costs it nothing.) */
      if (restMargin !== null) put(coverRest, '--hub-up', px(restMargin));
      /* (…and with last time's pull taken off: a door must be read where the page lays it out, never where the last
         measure pulled it — a door drawn up over the cover would read as "on the first screen" and stay there.) */
      if (zrest) put(zrest, 'data-hub-zrest', null);
      /* 🚪 THE COVER NEVER FADES TO NOTHING. What arrives is looked for in the cover's own rest first — and when that
         box holds nothing a guest can see (a reply row that drew nothing; a cover that is the last thing in its
         group, as the stranger's photo cover is), in the next box on the page after the cover's cell. That box,
         not the cover's rest, is then the one pulled up to the cover (`data-hub-zrest`). */
      arrives = nextBox(coverRest);
      if (!arrives) {
        outside = followers(coverCell, page)[0] ?? null;
        arrives = outside ? through(outside) : null;
      }
      let pulled = outside ?? coverRest;
      /* 🤝 TOGETHER (owner 2026-10-10, asked what should stand where the names built out — the RSVP button alone, or
         the button and the countdown: *"Together."*; his own sentence: *"maria jose must build out and until we say i
         do should be where maria jose build out"*). When what arrives is THE PAGE'S ACTION ROW (`ACTION_ROW` — what
         the block is, never how tall it is), the block after it on the page arrives WITH it: one arrival, placed as
         one unit, the page's own distance between the two kept exactly as it is laid out. A long second half makes
         a long unit, and a long unit is the ordinary long arrival — tops at the top of the room, running on below. */
      /* (THE ROW IS THE WHOLE ROW. The stranger's door stands in a row that draws no box of its own — `.sn-door-row`,
         `display: contents`: the button, and the line under it. The engine met them as two boxes and paired the
         button with its own caption, leaving the Countdown behind. A row with no box that holds the page's action
         IS the action row: every box of it arrives, and the block after the LAST of them arrives with them.) */
      const held0 = arrives?.parentElement ?? null;
      row = arrives ? (held0 && boxless(held0) && held0.querySelector(ACTION_ROW) ? (Array.from(held0.children) as HTMLElement[]).filter((el) => el.offsetHeight > 0 && el.offsetParent !== null) : [arrives]) : [];
      const rowEnd = row[row.length - 1] ?? null;
      if (rowEnd && row.some((el) => el.matches(ACTION_ROW) || el.querySelector(ACTION_ROW) !== null)) mate = followers(rowEnd, page).map(through)[0] ?? null;
      /* Where a box of the first screen is drawn on the page — from where the cover is LAID OUT, so a stage standing
         still is never read as layout (and a part the fit draws away from its own place is read where it is drawn). */
      const coverAt = cover.getBoundingClientRect().top;
      /* 📐 …TO THE FRACTION. A fitted cover is laid out on fractions of a pixel (its air is a share of a rem), and
         `docTop` sums whole ones: the cover's line came out a fraction BELOW where it stands, so at scroll 0 the page
         was already that fraction into its hold — the cover 0.1 % built out before a touch (seen in the browser,
         375 × 560). The page's own first cell never moves (only its stage stands still), so it is read exactly, and the
         cover from it. */
      const cellTop = pages[0].cell.getBoundingClientRect().top + window.scrollY;
      const coverTop = cellTop + coverAt - pages[0].stage.getBoundingClientRect().top;
      const onPage = (el: Element, edge: 'top' | 'bottom') => coverTop + el.getBoundingClientRect()[edge] - coverAt;
      /* 📐 What must be seen of the cover from where it stands: its names and its date (what the fit keeps). */
      const must = [cover.querySelector('[data-hub-names]'), cover.querySelector('[data-motion="arrive-date"]')].filter((el): el is HTMLElement => el instanceof HTMLElement && el.offsetHeight > 0);
      const seen = must.length ? Math.max(...must.map((el) => onPage(el, 'bottom'))) - coverTop : cover.offsetHeight;
      /* 🚪 THE DOOR STAYS when it is on the first screen as the page opens: above the bottom bar it docks clear of. */
      const door = row.find((el) => el.matches(DOOR) || el.querySelector(DOOR) !== null) ?? null;
      const dockedBy = door ? parseFloat(getComputedStyle(door.matches(DOOR) ? door : door.querySelector<HTMLElement>(DOOR)!).scrollMarginBottom) || 0 : 0;
      /* (The door itself — the line under it may run on below; the fit made room for the button, as today.) */
      const button = door ? (door.matches(DOOR) ? door : door.querySelector<HTMLElement>(DOOR)!) : null;
      const stays = button !== null && rowEnd !== null && mate !== null && onPage(button, 'bottom') <= V - dockedBy + 0.5;
      const staying = stays ? row : [];
      let keep: { seen: number; stay?: number } = { seen };
      if (stays) {
        /* What arrives is the block after the door, alone; the box it stands in is the one pulled up to the cover —
           through the door, which is not moved — and it ends above the door by the page's own distance to it. */
        const doorTop = Math.min(...row.map((el) => onPage(el, 'top')));
        const doorBottom = Math.max(...row.map((el) => onPage(el, 'bottom')));
        const gap = Math.max(0, docTop(mate!) - doorBottom);
        outside = followers(rowEnd!, page)[0] ?? null;
        arrives = mate;
        row = mate ? [mate] : [];
        mate = null;
        keep = { seen, stay: doorTop - gap };
        if (outside) pulled = outside;
      }
      const unitEnd = mate ?? row[row.length - 1] ?? null;
      const unit: ScrubElement = arrives && unitEnd ? { h: docTop(unitEnd) + unitEnd.offsetHeight - docTop(arrives), oneByOne: oneByOne(unitEnd) } : { h: 0, oneByOne: false };
      const pair = scrubPair({ h: cover.offsetHeight, oneByOne: false }, unit, view, coverTop, keep);
      const stick = pair.top - (coverTop - cellTop);
      put(pages[0].stage, '--hub-top', px(stick));
      put(pages[0].cell, '--hub-len', px(pair.len));
      const up = arrives ? pair.up - (docTop(arrives) - docTop(pulled)) : 0;
      /* (Said outright, as every length here: the door's own rest keeps its own margin; any other is pulled through.) */
      if (outside) put(coverRest, '--hub-up', stays ? px(restMargin ?? 0) : '0px');
      put(pulled, '--hub-up', px(up));
      if (outside) put(outside, 'data-hub-zrest', '');
      put(pages[0].stage, '--hub-zrise', '0px');
      /* …AND READ BACK. The cover is the page's own markup, not a scene's: a bottom margin on its last child runs out
         through its box and is added to this one, and the arrival would stand that much lower than its line. So the
         distance is measured as it was actually laid out, and what is over is taken off — once; it is a sum. (The
         same for a box outside the cover's rest: whatever lies between it and the cover is read, not reasoned.) */
      const over = arrives ? onPage(arrives, 'top') - (coverTop + cover.offsetHeight) - pair.up : 0;
      if (Math.abs(over) > 0.5) put(pulled, '--hub-up', px(up - over));
      const last = unitEnd;
      const next = last?.nextElementSibling ?? null;
      /* 🚪 What follows the arrival goes on under the door that stayed — never over it, during the hold or after. */
      const floor = stays && arrives ? Math.max(0, Math.max(...staying.map((el) => onPage(el, 'bottom'))) - (pair.arrivalTop + unit.h)) : 0;
      for (const el of stayed) if (!staying.includes(el)) put(el, 'data-hub-stay', null);
      for (const el of staying) put(el, 'data-hub-stay', '');
      stayed = staying;
      held.push({ cell: pages[0].cell, stage: pages[0].stage, scene: cover, after: coverRest, below: next?.matches('.hub-below, .hub-after') ? (next as HTMLElement) : null, arrival: arrives, mates: [...row.slice(1), ...(mate ? [mate] : [])], pair, rest: 0, stick, lift: pages[0].stage, floor });
      /* (The one of the two that can be a scene with a hand-over of its own is the second.) */
      arrivedAt = arrives ? (mate ? { scene: mate, top: pair.arrivalTop + (docTop(mate) - docTop(arrives)) } : { scene: arrives, top: pair.arrivalTop }) : null;
      /* Played with the scenes: the cover first, then what arrives (unless it is a scene the list already has). */
      scenes = [cover, ...[...row, mate].filter((el): el is HTMLElement => el !== null && !scenes.includes(el)), ...scenes];
    }
    const arriving = [...row, mate].filter((el): el is HTMLElement => el !== null);
    for (const z of zeros) {
      if (arriving.includes(z)) continue;
      put(z, '--hub-o', '1');
      put(z, 'data-hub-away', null);
      put(z, 'data-hub-zero', null);
    }
    for (const z of arriving) put(z, 'data-hub-zero', '');
    zeros = arriving;
    if (zrest && zrest !== outside) {
      put(zrest, 'data-hub-zrest', null);
      /* (Said outright, never unset: a length left unset while armed is inherited from whatever is around it.) */
      put(zrest, '--hub-up', '0px');
    }
    zrest = outside;
    /* What follows — after the LAST of what arrives. */
    const lastIn = mate ?? row[row.length - 1] ?? null;
    lifted = lastIn && pages[0] ? followers(lastIn, pages[0].stage) : [];
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
      /* 🤝 …and the block that arrives WITH it: the same moment, the same fade. */
      for (const el of h.mates ?? []) Object.assign(of(el), { pin: m.in, gate: m.rows, handed: true });
      /* What follows a pair rises as the hand-over plays. After the COVER it is whatever the page draws next, in
         plain sight — so it stays under the cover until the cover has completely gone, and rises only then (`rows`:
         the same moment an arrival's rows may begin). */
      const lower = h.lift ? 1 - m.rows : m.below;
      if (h.below) put(h.below, '--hub-rise', px(h.pair.rise * lower));
      /* …AND ONCE THE HOLD IS OVER IT STANDS WHERE THE PAGE LAID IT OUT, TO THE PIXEL. The rows' gate is whole
         pixels of a rounded screen: at some heights it ends a rounding short of 1 (770 px: 0.994), and what follows
         the cover then stood that share of its rise too low for the rest of the page — measured on the real
         invitation, 1.5 px under a reply row it should have been 48 px from. */
      if (h.lift) put(h.lift, '--hub-zrise', px(Math.max(h.floor ?? 0, t >= h.pair.len + h.rest ? 0 : h.pair.rise * lower)));
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
  /** The screen itself changed (see `mayRefit`). */
  const fresh = () => {
    mayRefit = true;
    again();
  };
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
    window.removeEventListener('resize', fresh);
    window.removeEventListener('orientationchange', fresh);
    root.removeEventListener('load', fresh, true);
    sizes?.disconnect();
    window.clearInterval(pulse);
    /* Back to the plain page: every mark and property this script set, taken off. */
    for (const [el, keys] of marked) for (const key of keys.keys()) key.startsWith('--') ? el.style.removeProperty(key) : el.removeAttribute(key);
    marked.clear();
    /* …and the cover's fit, taken back with the hold it was made for. */
    unfit?.();
    unfit = null;
  }
  /* A scene that changes height (a font landing, a picture, an open row) is measured again. */
  let sizes: ResizeObserver | null = null;
  try {
    measure();
    frame();
    window.addEventListener('scroll', ask, { passive: true });
    window.addEventListener('resize', fresh);
    window.addEventListener('orientationchange', fresh);
    root.addEventListener('load', fresh, true);
    void document.fonts?.ready.then(fresh);
    if (typeof ResizeObserver !== 'undefined') {
      /* THE OBSERVER'S FIRST DELIVERY IS NOT A CHANGE — it reports each box as it was given it. (This was a flag,
         "skip the first call", which leans on the first call always coming. The specification gives a box with no
         size none; Chromium reports it anyway — probed 2026-10-10 — and no other engine has been tried. With every
         watched box on a tab that is not shown, an engine that kept to the text would have had its one call that
         mattered — the tab being shown — swallowed by the flag.) So each box's height is remembered instead: a box
         with no size as it is watched is known to be 0, any other is learnt from its first report, and only a
         height that DIFFERS is measured again. */
      const was = new Map<Element, number>();
      sizes = new ResizeObserver((entries) => {
        let changed = false;
        for (const e of entries) {
          const h = e.contentRect.height;
          if (was.has(e.target) && was.get(e.target) !== h) changed = true;
          was.set(e.target, h);
        }
        if (changed) again();
      });
      const watch = (el: HTMLElement) => {
        if (!el.offsetHeight) was.set(el, 0);
        sizes?.observe(el);
      };
      for (const s of scenes) watch(s);
      /* …and the cover, even when it has no box as the page is armed (the first tab is not the one shown): the
         moment its tab is, it has a size, and its hand-over is measured. */
      const cover = root.querySelector<HTMLElement>(`${COVER} > .hub-cover`);
      if (cover) watch(cover);
      /* …and a door that stays: opened or closed, what follows it is placed under it again. */
      for (const el of stayed) watch(el);
    }
  } catch (e) {
    fail(e);
  }
  return stop;
}

/** For the guard: the things this file may touch on `window` and `document`. */
export const HUB_SCRUB_ROW_PX = SCRUB.row;
export { scrubThrough };
