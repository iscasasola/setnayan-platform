import { MARK_MIN, fitFirstScreen, layoutFirstScreen, type FitPlan, type FitSnapshot } from './first-screen-fit';

/**
 * app/[slug]/_lib/first-screen-fit-dom.ts — THE FIT'S HANDS: the measuring and writing half of the first-screen fit
 * (`first-screen-fit.ts` is the rule). Moved here from `first-screen-door.tsx` (2026-10-12) so the ONE fit has two
 * callers and no copy:
 *
 *   · `first-screen-door.tsx` — the stranger's door, on every page: the cover makes room for "Get inside";
 *   · `hub-scrub-engine.ts` — 📐 SCRUB'S COVER IS FITTED BEFORE IT FADES (owner 2026-10-12, DECISION_LOG "option 2"):
 *     a cover with no door (the guest's) is fitted ONCE by the hand-over, before it is held, so the couple's names and
 *     the date are on the first screen while it fades — never under the pinned top bar.
 *
 * `door`: the action the cover makes room for, in the cover's flow under it. `null`: a cover with no door — the fit
 * keeps its parts above the limit instead (its "door" is a line of no height under its last part, so the same rule
 * gives way in the same order: the link first, the names never).
 *
 * `offset`: what turns a box on the screen into a place on the page (document pixels, top of the page = 0). The door's
 * page is never held, so it is the scroll; a held page reads it from where the cover is LAID OUT, because a stage that
 * stands still reports where it stands.
 *
 * 📷 A PHOTO COVER (owner 2026-10-13: the photo moves so the names, the date and "Get inside" are on the stranger's
 * first screen) has no card: its parts are the children of the box that holds its names, and its photo plate (a
 * `figure`) is a part too — the first to give way. It has no air or mark the stylesheet can close (`knobs: false`:
 * nothing is written for them, only the blocks that move), and the box that carries the fit's mark is the one that
 * holds both the cover and the door (they stand in two different groups of the page) — so it carries a mark of its
 * own (`data-first-screen-photo`): the card's mark also closes up a first screen's margin, which a photo page has none
 * of to close.
 *
 * Writes only what the stylesheet reads (`globals.css`, "THE FIRST SCREEN MAKES ROOM FOR ITS ONE ACTION"): two custom
 * properties and the fit's mark on the first-screen block, and `--fs-shift` + its mark on each block that moves.
 */
export type FitBlock = { key: string; el: HTMLElement };

export type FirstScreenFitter = {
  /** The cover's parts, named by where they stand around the names and the date, then the link under the cover. */
  blocks: () => FitBlock[];
  /** Take every value back: the page as written. */
  clear: (list: FitBlock[]) => void;
  /** Write a plan's two numbers. */
  set: (air: number, markScale: number) => void;
  /** Draw `gives` below the door, on the page as it now measures: each block that moves, by how far. Returns the door's bottom. */
  lay: (list: FitBlock[], gives: readonly string[]) => number;
  /** Measure three ways, ask the rule, write the plan — and take back whatever would cost the door its place. */
  make: (list: FitBlock[], limit: number) => FitPlan;
  /** The fit's mark on the first-screen block (`data-first-screen-fit`) — what lets the stylesheet's values apply at all. */
  mark: (on: boolean) => void;
};

export function firstScreenFitter(
  screen: HTMLElement,
  cover: HTMLElement,
  inner: HTMLElement,
  door: HTMLElement | null,
  offset: () => number,
  /** 📷 A photo cover: no air or mark to write, and the photo page's own mark. */
  photo = false,
): FirstScreenFitter {
  const blocks = (): FitBlock[] => {
    const out: FitBlock[] = [];
    let afterNames = false;
    let afterDate = false;
    const add = (key: string, el: HTMLElement) => out.push({ key: out.some((b) => b.key === key) ? `${key}-${out.length}` : key, el });
    for (const el of Array.from(inner.children)) {
      if (!(el instanceof HTMLElement) || el.getBoundingClientRect().height === 0) continue;
      if (el.matches('figure')) add('plate', el);
      else if (el.matches('[data-motion="arrive-mark"]')) add('mark', el);
      else if (el.matches('h1')) {
        add('names', el);
        afterNames = true;
      } else if (el.matches('[data-motion="arrive-date"]')) {
        add('date', el);
        afterDate = true;
      } else add(!afterNames ? 'eyebrow' : !afterDate ? 'line' : 'time', el);
    }
    /* What stands after the box of parts: the link down — and, on a photo cover's other designs, the photo. */
    /* (Only inside the cover's own header: a cover that IS its header has nothing after it that is its own.) */
    for (let next = cover === cover.closest('header') ? null : cover.nextElementSibling; next; next = next.nextElementSibling) {
      if (!(next instanceof HTMLElement) || next.getBoundingClientRect().height === 0) continue;
      if (next.matches('figure')) add('plate', next);
      else if (next.querySelector('a[href]')) add('link', next);
    }
    return out;
  };
  const snapshot = (list: FitBlock[]): FitSnapshot => {
    const at = offset();
    const box = (key: string, el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return { key, top: r.top + at, bottom: r.bottom + at };
    };
    const parts = list.map((b) => box(b.key, b.el));
    /* No door: a line of no height right under the last part — what must stand above the limit is the parts kept. */
    const foot = parts.length ? parts[parts.length - 1]!.bottom : 0;
    return { parts, door: door ? box('door', door) : { key: 'door', top: foot, bottom: foot } };
  };
  const set = (air: number, markScale: number) => {
    if (photo) return; // a photo cover has neither to close
    screen.style.setProperty('--fs-air', String(air));
    screen.style.setProperty('--fs-mark', String(markScale));
  };
  const clear = (list: FitBlock[]) => {
    screen.style.removeProperty('--fs-air');
    screen.style.removeProperty('--fs-mark');
    for (const el of [...list.map((b) => b.el), ...(door ? [door] : [])]) {
      el.style.removeProperty('--fs-shift');
      el.removeAttribute('data-fs-shift');
    }
  };
  const write = (list: FitBlock[], shift: Record<string, number>) => {
    for (const [key, px] of Object.entries(shift)) {
      const el = key === 'door' ? door : list.find((b) => b.key === key)?.el;
      if (!el) continue;
      el.style.setProperty('--fs-shift', `${px}px`);
      el.setAttribute('data-fs-shift', '');
    }
  };
  const lay = (list: FitBlock[], gives: readonly string[]) => {
    const snap = snapshot(list);
    const laid = layoutFirstScreen(snap, gives);
    write(list, Object.fromEntries([...snap.parts, snap.door].map((b) => [b.key, Math.round(laid.tops[b.key]! - b.top)]).filter(([, d]) => d !== 0)));
    return laid.doorBottom;
  };
  const make = (list: FitBlock[], limit: number): FitPlan => {
    const natural = snapshot(list);
    set(0, 1);
    const noAir = snapshot(list);
    set(0, MARK_MIN);
    const smallMark = snapshot(list);
    let plan = fitFirstScreen({ natural, noAir, smallMark }, limit);
    if (plan.air === 1 && plan.mark === 1 && plan.gives.length === 0) {
      clear(list); // it fits as designed: the page as written, to the letter
      return plan;
    }
    set(plan.air, plan.mark);
    // What was given back must not cost the button its place: if it did, take it all back.
    if (lay(list, plan.gives) > limit + 0.5 && plan.fits) {
      clear(list);
      plan = { ...plan, air: 0, mark: plan.gives.includes('mark') ? 1 : MARK_MIN };
      set(plan.air, plan.mark);
      lay(list, plan.gives);
    }
    return plan;
  };
  const name = photo ? 'data-first-screen-photo' : 'data-first-screen-fit';
  const mark = (on: boolean) => (on ? screen.setAttribute(name, '') : screen.removeAttribute(name));
  return { blocks, clear, set, lay, make, mark };
}
