/**
 * dock-follows-column.ts — from 701 the Guests dock (Expand all · Select · Search or add · Role) sits UNDER THE
 * READING COLUMN, edge to edge with it.
 *
 * Owner 2026-10-20, a screenshot of the live desktop Guests page: *"is the desktop view done fixing?"* — the list
 * column was centred while the dock ran from the stage's left edge, wider than the list and not under it. The approved
 * design (DECISION_LOG 2026-10-19 "APPROVED — COUPLE DASHBOARD DESKTOP + TABLET", prototype
 * `couple_dashboard_desktop_tablet_2026-10-19.html`) keeps the dock PINNED AT THE BOTTOM EDGE (Q3) and the page in its
 * reading column (48 rem; the Map's wide stage is 64 rem).
 *
 * Two faults, both fixed here:
 *  1. It measured the column's PARENT — the whole stage — so the dock was as wide as the stage, never the column.
 *  2. It measured ONCE (and on a window resize). The column moves without the window resizing — a guest's card column
 *     opens beside the list and closes again, the rail changes width — and the dock stayed where the column used to be.
 *     That is the owner's picture: the dock's left at the stage edge, its right short of the column's right.
 *
 * The dock is `position: fixed` (it pins to the bottom edge while the list scrolls), so CSS alone cannot give it the
 * column's edges; this writes them as `--gs-left` / `--gs-right` on the column, and `guests-screen.module.css` applies
 * them from 701. Below 701 the CSS ignores both (the phone dock is full width, unchanged).
 *
 * Held by `the-dock-sits-under-the-column.test.ts` (behaviour, CSS and wiring).
 *
 * 🖥 SUPPLIERS USES IT TOO (owner 2026-10-23, "bottom search bar is misaligned"): its thumb rows are portaled into
 * <body>, so they cannot read a variable set on the column — `opts.target` writes the same two numbers on another
 * element (the document root) under the caller's names (and, with `opts.width`, the column's width), and the cleanup
 * takes them off again.
 */

/** Pin `column`'s dock to the column's own left/right edges, and keep it there. Returns the cleanup. */
export function followColumn(
  column: HTMLElement,
  opts: { target?: HTMLElement; left?: string; right?: string; width?: string } = {},
): () => void {
  const target = opts.target ?? column;
  const leftVar = opts.left ?? '--gs-left';
  const rightVar = opts.right ?? '--gs-right';
  // A move that ends after the page has left writes nothing (the cleanup has taken the variables off).
  let stopped = false;
  const sync = () => {
    if (stopped) return;
    const r = column.getBoundingClientRect();
    // `right` of a fixed box is measured from the viewport's right edge WITHOUT the scrollbar (clientWidth), not from
    // `innerWidth` — on a desktop with a classic scrollbar the two differ by the bar's width.
    const vw = document.documentElement.clientWidth;
    target.style.setProperty(leftVar, `${Math.max(0, r.left)}px`);
    target.style.setProperty(rightVar, `${Math.max(0, vw - r.right)}px`);
    if (opts.width) target.style.setProperty(opts.width, `${Math.max(0, r.width)}px`);
  };
  // 🎞 A COLUMN THAT IS STILL MOVING. `getBoundingClientRect` reads the box AS DRAWN, so a sync taken while the page
  // slides in (a segment's `translateX(28px) → 0` over 320 ms) writes edges 28 px to the right — and nothing that the
  // observers below watch changes when the slide ends: no size changes, no resize. W1 on live 979ed2c (RW-337): People's
  // "Find or invite" bar at 124→768 under a column at 96→744, touching the right edge at 768 (1280 hid it only because
  // the pane happened to resize). So whatever moves the column — a CSS animation, a CSS transition, `element.animate` —
  // is waited out and the edges are read again when it ends (`document.getAnimations()` finds the ones running on the
  // column or any ancestor; `animationend` / `transitionend` catch the ones that start later).
  const waited = new WeakSet<Animation>();
  const moves = (el: EventTarget | null) => el instanceof Node && el.contains(column);
  const resyncAfterMoves = (_e?: Event) => {
    if (typeof document.getAnimations !== 'function') return;
    for (const a of document.getAnimations()) {
      const target = a.effect instanceof KeyframeEffect ? a.effect.target : null;
      if (waited.has(a) || a.playState === 'finished' || !moves(target)) continue;
      waited.add(a);
      a.finished.then(sync, sync);
    }
  };
  const onMoveEnd = (e: Event) => {
    if (moves(e.target)) sync();
  };
  sync();
  resyncAfterMoves();
  const moveEvents: Array<[string, (e: Event) => void]> = [
    ['animationstart', resyncAfterMoves],
    ['transitionrun', resyncAfterMoves],
    ['animationend', onMoveEnd],
    ['animationcancel', onMoveEnd],
    ['transitionend', onMoveEnd],
    ['transitioncancel', onMoveEnd],
  ];
  const listens = typeof document.addEventListener === 'function';
  if (listens) for (const [type, fn] of moveEvents) document.addEventListener(type, fn, true);
  // The column itself (its own size), its stage (a card column opening beside it, the rail changing width — the column
  // MOVES even when its own width is capped and unchanged) and the page (a scrollbar appearing).
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null;
  ro?.observe(column);
  if (column.parentElement) ro?.observe(column.parentElement);
  ro?.observe(document.documentElement);
  window.addEventListener('resize', sync);
  return () => {
    stopped = true;
    ro?.disconnect();
    window.removeEventListener('resize', sync);
    if (listens) for (const [type, fn] of moveEvents) document.removeEventListener(type, fn, true);
    if (target !== column) {
      target.style.removeProperty(leftVar);
      target.style.removeProperty(rightVar);
      if (opts.width) target.style.removeProperty(opts.width);
    }
  };
}
