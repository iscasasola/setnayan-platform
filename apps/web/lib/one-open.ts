'use client';

/**
 * ONE OPEN AT A TIME — opening a dropdown, ⋯ menu, popover or fold closes any
 * other one open on the screen. Owner, 2026-10-04, verbatim: "when a dropdown
 * opens, the other dropdown collapses" → "auto collapse". DECISION_LOG.md
 * 2026-10-04 "ONE OPEN AT A TIME" · INTERACTION_RULES.md §8.
 *
 * 🔑 THIS IS THE ONE MECHANISM. An opener joins with ONE call:
 *
 *     const [open, setOpen] = useState(false);
 *     const oneOpenId = useOneOpen(open, setOpen);
 *
 * and, if anything that can itself open (a PickMenu, an InfoTip, a fold, a
 * sheet) renders INSIDE its panel, wraps what it renders in
 * `<OneOpenScope id={oneOpenId}>` — so that child opening never closes it.
 * Only peers close peers; a child never closes its parent.
 *
 * How it decides: every opener that is open sits in `live`. When one goes from
 * closed → open (a tap, a keyboard Enter, a programmatic open — all the same,
 * because the announcement is made from the state change, not from a click
 * handler), every OTHER live opener closes unless it is one of the opener's
 * ancestors. Ancestry is React context, so it flows through portals: a PickMenu
 * inside a portaled sheet inside a ⋯ menu still knows the menu is its parent.
 *
 * ⚠ What does NOT join, deliberately:
 *   · modal sheets and dialogs — they are the CONTEXT a dropdown opens in, and
 *     a dropdown opening must never close the sheet it sits in;
 *   · persistent navigation (the bottom-nav accordion, sidebar sections) — the
 *     owner ruled the bottom nav must NOT reset (2026-06-15);
 *   · native `<select>` and `<details>` — the browser owns their open state.
 *
 * Mounting already open (a fold with `defaultOpen`) does NOT announce — only a
 * closed → open change does — so two folds that start open never fight on load.
 * They still listen, and close when somebody else opens. (A panel that is only
 * mounted while open says so with `mountsOpen`.)
 */

import {
  createContext,
  createElement,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

type Live = { id: string; close: () => void };
const live = new Set<Live>();

/** `id` just opened: close every other live opener that is not one of its ancestors (`chain`). */
export function announceOpen(id: string, chain: readonly string[]): void {
  for (const o of [...live]) if (o.id !== id && !chain.includes(o.id)) o.close();
}

/**
 * Join the live set while open. `opening` = this is a closed → open change, so
 * announce it first. Returns the leave function. The hook below is its only
 * production caller; it is exported so the guard can drive it without a DOM.
 */
export function joinOneOpen(id: string, chain: readonly string[], close: () => void, opening: boolean): () => void {
  if (opening) announceOpen(id, chain);
  const me: Live = { id, close };
  live.add(me);
  return () => {
    live.delete(me);
  };
}

const Chain = createContext<readonly string[]>([]);

/**
 * THE ONE WAY TO JOIN. `setOpen(false)` is called when a peer opens. Returns this
 * opener's id for `OneOpenScope`. `mountsOpen`: a panel that exists only while
 * open (mounted by its caller on open, e.g. the guest list's `Popover`) passes
 * `true`, so mounting IS its opening.
 */
export function useOneOpen(open: boolean, setOpen: (open: false) => void, mountsOpen = false): string {
  const id = useId();
  const chain = useContext(Chain);
  const closeRef = useRef(setOpen);
  const was = useRef(mountsOpen ? false : open);
  useLayoutEffect(() => {
    closeRef.current = setOpen;
  });
  // Layout, not passive: the peer closes in the same frame this one paints
  // open, so two panels are never on screen together.
  useLayoutEffect(() => {
    const opening = open && !was.current;
    was.current = open;
    return open ? joinOneOpen(id, chain, () => closeRef.current(false), opening) : undefined;
  }, [open, id, chain]);
  return id;
}

/** Marks everything rendered inside as a CHILD of opener `id` — opening a child never closes it. */
export function OneOpenScope({ id, children }: { id: string; children?: ReactNode }) {
  const parent = useContext(Chain);
  const value = useMemo(() => [...parent, id], [parent, id]);
  return createElement(Chain.Provider, { value }, children);
}
