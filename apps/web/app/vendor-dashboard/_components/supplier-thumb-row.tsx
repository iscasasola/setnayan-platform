'use client';

/**
 * SupplierThumbRow — THE SUPPLIER'S FLOATING ROW (S-PR0, corpus
 * `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 3 "thumb rows are
 * `sn-glass-row` and slide away on leaving"; BUTTON_RULE_2026-10-07 rules 3, 5
 * and 7).
 *
 * The same row the couple's Guests page floats (`guests-screen.tsx` —
 * `styles.lower` + `sn-glass-row`), lifted to a component so every supplier
 * page that gets a thumb row (People · Dates · Money · a customer · Services ·
 * Page · Event Hub) wears ONE shape:
 *
 *   · frosted — the shared `.sn-glass-row` recipe paints it; nothing here
 *     gives it a fill, a shadow or a blur of its own (`floating-rows-are-glass`);
 *   · it SLIDES UP once the page has rendered, and SLIDES DOWN first when the
 *     supplier leaves (rule 5) — it never pops in or vanishes;
 *   · its buttons are `ActionButton`s and change state AS ONE through
 *     `useFitRow` (rules 3 / 3a); a text field in it keeps ≥ 60 % (rule 3b).
 *
 * 📌 PORTALLED TO `<body>`. `position: fixed` is not fixed under an ancestor
 * that carries a transform or a container type (the couple's dashboard learned
 * this on #5461); the row is mounted at the document root so it sits above the
 * bottom dock on every supplier page, whatever wraps the page.
 *
 * 🚪 LEAVING. The App Router has no "route change started" event, so the row
 * listens for the tap that starts one — a link to another path — and slides
 * down while the next page loads. A tap that stays on the page (a fragment, a
 * search param of the same path) leaves it up.
 *
 * Loaded only by supplier routes: nothing imports it outside
 * `app/vendor-dashboard/**`.
 *
 * 📌 FROM 701 IT MOVES UP INTO THE PINNED ROW (supplier dashboard v13, owner 2026-10-29: "pinned row on top (search +
 * ＋ move up)"; prototype "wide: the thumb row's search + ⇅ + ＋ move UP into the pinned row"). Where the shell has
 * opened the bar's tools box (`[data-pin-tools]`, the `pinnedBar` tree), the SAME controls portal into it instead of
 * floating at the foot — no glass there (it sits on the bar), the field a pill, the rounds 40 px. Below 701, or on a tree
 * without the box, nothing changes. On a phone the floating row gains a soft fade behind it so the rows under it show
 * through instead of being cut by its edge (v13 "soft fade behind the floating thumb row").
 * 🔒 the-supplier-frame-holds.test.ts
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { useFitRow } from '@/components/action-button';
import { leavesThePage } from './supplier-thumb-leave';
import styles from './supplier-thumb-row.module.css';

export function SupplierThumbRow({
  name,
  label,
  children,
  row,
}: {
  /** Which page's row this is — the guard's anchor (`data-supplier-thumb`). */
  name: string;
  /** What the row is, for a screen reader ("Customer actions"). */
  label: string;
  /** `ActionButton`s (and at most one text field) — drawn on the glass band. */
  children?: ReactNode;
  /**
   * 🔁 ONE THUMB ROW (owner 2026-10-22): the shared `<ThumbRow>` — NO band; each control is its own glass. This
   * component keeps only the plumbing (portal, slide up / down, the column's edges on a computer).
   */
  row?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [on, setOn] = useState(false);
  const pathname = usePathname();
  const upTo = usePinTools();

  // Slides up once the page has rendered (two frames: mount, then move).
  useEffect(() => {
    setMounted(true);
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setOn(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [pathname]);

  // Slides down first when the supplier leaves the page (rule 5).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]');
      if (!a) return;
      if (leavesThePage(a.getAttribute('href'), a.getAttribute('target'), window.location.pathname, window.location.origin)) {
        setOn(false);
      }
    };
    const onHide = () => setOn(false);
    document.addEventListener('click', onClick, true);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('pagehide', onHide);
    };
  }, []);

  // On a computer the row spans the content column, so the rail stays clear
  // (the Guests row's `--gs-left` / `--gs-right`, measured off `<main>`).
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mounted) return;
    const sync = () => {
      const row = rowRef.current;
      const col = document.querySelector('main');
      if (!row || !col) return;
      const r = col.getBoundingClientRect();
      row.style.setProperty('--thumb-left', `${Math.max(0, r.left)}px`);
      row.style.setProperty('--thumb-right', `${Math.max(0, window.innerWidth - r.right)}px`);
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [mounted]);

  if (!mounted) return null;
  if (upTo) {
    return createPortal(
      <div className={styles.up} data-supplier-thumb={name} data-thumb-up="" role={row ? undefined : 'toolbar'} aria-label={row ? undefined : label}>
        {row ?? <ThumbFit>{children}</ThumbFit>}
      </div>,
      upTo,
    );
  }
  if (row) {
    return createPortal(
      <div ref={rowRef} className={styles.lower} data-supplier-thumb={name} data-on={on ? 'true' : 'false'}>
        {row}
      </div>,
      document.body,
    );
  }
  return createPortal(
    <div
      ref={rowRef}
      className={`${styles.lower} sn-glass-row`}
      data-glass-row="supplier-thumb"
      data-supplier-thumb={name}
      data-on={on ? 'true' : 'false'}
      role="toolbar"
      aria-label={label}
    >
      <ThumbFit>{children}</ThumbFit>
    </div>,
    document.body,
  );
}

/**
 * The fitted inner row — ITS OWN COMPONENT, ON PURPOSE.
 *
 * 🔴 `useFitRow` measures the node its ref points at, once, when the hook's
 * effect first runs. The row above renders NOTHING until it has mounted (the
 * portal needs `document.body`), so calling the hook up there measured `null`
 * and never ran again: four buttons overflowed the phone and the last one was
 * cut off at "Ca" (caught on the 375 side-by-side, 2026-10-08). Down here the
 * hook's first effect runs when the node already exists.
 */
function ThumbFit({ children }: { children: ReactNode }) {
  const fitRef = useRef<HTMLDivElement>(null);
  useFitRow(fitRef);
  return (
    <div ref={fitRef} className={styles.thumb} data-fit-row="">
      {children}
    </div>
  );
}

/** The width at which the thumb row lives in the pinned row — the shell's 701 line (`boundary="tab"`). */
const UP_QUERY = '(min-width: 701px)';

/**
 * The pinned row's tools box, while the window is wide enough for the row to live there — else null (the row floats).
 * Re-read when the width crosses the line, so turning a tablet moves the row with it.
 */
function usePinTools(): HTMLElement | null {
  const [box, setBox] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(UP_QUERY);
    const read = () => setBox(mq.matches ? document.querySelector<HTMLElement>('[data-pin-tools]') : null);
    read();
    mq.addEventListener('change', read);
    return () => mq.removeEventListener('change', read);
  }, []);
  return box;
}
