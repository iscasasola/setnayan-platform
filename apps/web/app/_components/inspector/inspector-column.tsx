'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { X, ArrowUpRight } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';

/**
 * Inspector Column — the desktop "Finder-style" master ▸ detail primitive.
 *
 * On desktop (≥xl) clicking a list/catalog item SELECTS it and opens a
 * right-side inspector column instead of navigating: a sticky glass `.sn-tile`
 * panel beside the master list. Selection is reflected in the URL as a
 * `?<paramKey>=<id>` search param (deliberately NOT a pathname change, so the
 * route-entrance template animation does not replay — see [eventId]/template.tsx)
 * so refresh/share restores the selection. Below xl the column is hidden and the
 * triggers fall back to plain navigation (existing sheets / standalone routes).
 *
 * Three pieces:
 *   • useInspector(paramKey)  — selection ↔ URL binding + optimistic open state.
 *   • InspectorLayout         — the 2-column grid, provider, width transition,
 *                               and close-focus-restore.
 *   • InspectorTrigger        — a list row / catalog row: an anchor that
 *                               navigates below xl (and on modified clicks), but
 *                               selects-into-the-inspector on a plain desktop click.
 *   • InspectorColumn         — the sticky glass panel itself (role=complementary,
 *                               `.sn-eye` eyebrow, scaled `.sn-h1` title, ✕ close,
 *                               "Open full page ↗", `.sn-lens-swap` keyed body).
 *
 * The BODY of the inspector is rendered server-side by the page from the
 * `?<paramKey>=` param and handed to <InspectorLayout inspector={…}> — so it is
 * a new PRESENTATION of the same server data/actions, never fabricated content.
 */

// ── Selection ↔ URL hook ────────────────────────────────────────────────────

export function useInspector(paramKey = 'inspect') {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlId = searchParams.get(paramKey);
  const [, startTransition] = useTransition();

  const buildUrl = useCallback(
    (id: string | null) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (id) sp.set(paramKey, id);
      else sp.delete(paramKey);
      const qs = sp.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, searchParams, paramKey],
  );

  const push = useCallback(
    (id: string | null) => {
      // scroll:false — a preview swap must never yank the master list's scroll
      // position. The search-param change does not remount template.tsx, so the
      // route-entrance animation correctly does not replay.
      startTransition(() => router.push(buildUrl(id), { scroll: false }));
    },
    [router, buildUrl],
  );

  return { paramKey, selectedId: urlId, push };
}

// ── Context (shared by triggers + the panel) ────────────────────────────────

type InspectorContextValue = {
  paramKey: string;
  selectedId: string | null;
  open: boolean;
  select: (id: string, trigger?: HTMLElement | null) => void;
  close: () => void;
  /** True once per user-initiated open — the panel uses it to decide whether to
   *  steal focus (it must NOT on a cold refresh/share load). */
  consumePanelFocus: () => boolean;
  /** This layout also presents BELOW xl, as a peek sheet, so its triggers must
   *  select at every width instead of navigating away. Opt-in per surface —
   *  see `mobileSheet` on InspectorLayout. */
  sheet: boolean;
};

const InspectorContext = createContext<InspectorContextValue | null>(null);

export function useInspectorContext() {
  return useContext(InspectorContext);
}

// ── Viewport gate (≥xl is where the inspector lives) ────────────────────────

const XL_QUERY = '(min-width: 1280px)';

/** True at ≥xl — the viewport where the inspector lives. Exported so bespoke
 *  triggers that can't use <InspectorTrigger> (e.g. a row's secondary "quick
 *  view" button whose below-xl action is a sheet, not a navigation) can gate
 *  select-vs-fallback on the SAME breakpoint instead of hardcoding it. */
export function useIsInspectorViewport(): boolean {
  const [isXl, setIsXl] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(XL_QUERY);
    const sync = () => setIsXl(mql.matches);
    sync();
    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  }, []);
  return isXl;
}

// ── Layout: 2-column grid + provider ────────────────────────────────────────

export function InspectorLayout({
  paramKey = 'inspect',
  hasSelection,
  master,
  inspector,
  className,
  mobileSheet = false,
}: {
  paramKey?: string;
  /**
   * OPT-IN (2026-09-22, for the guest card). Below xl this layout normally
   * hides the rail and its triggers navigate to a standalone route. With
   * `mobileSheet`, the SAME server-rendered `inspector` node is presented as a
   * sheet that slides in from the right and leaves the master peeking on the
   * left — the geometry of the shipped payment drawer
   * (`_components/inline-checkout-drawer.tsx`), which is the pattern the owner
   * named. Tapping the dimmed strip goes back.
   *
   * ⚠ Default false ON PURPOSE. Studio, Vendors and Overview keep their
   * standalone routes below xl; turning this on for them would replace a real
   * page with a panel nobody designed for it.
   */
  mobileSheet?: boolean;
  /** Server truth: is a VALID inspector body being rendered right now? Drives the
   *  resting open state (so an unknown/stale `?inspect=` id renders closed rather
   *  than a blank rail). */
  hasSelection: boolean;
  master: ReactNode;
  /** Server-rendered inspector body (an <InspectorColumn>…</InspectorColumn>),
   *  present only when `hasSelection`. */
  inspector: ReactNode;
  className?: string;
}) {
  const { selectedId, push } = useInspector(paramKey);
  const isXl = useIsInspectorViewport();

  // Optimistic open so the width transition fires on click, before the server
  // round-trip that renders the body. Cleared once server truth catches up.
  const [optimisticOpen, setOptimisticOpen] = useState<boolean | null>(null);
  useEffect(() => {
    setOptimisticOpen(null);
  }, [hasSelection, selectedId]);
  const open = isXl && (optimisticOpen ?? hasSelection);

  const lastTrigger = useRef<HTMLElement | null>(null);
  const wantPanelFocus = useRef(false);
  const prevOpen = useRef(open);

  const select = useCallback(
    (id: string, trigger?: HTMLElement | null) => {
      lastTrigger.current =
        trigger ?? (document.activeElement as HTMLElement | null);
      wantPanelFocus.current = true;
      setOptimisticOpen(true);
      push(id);
    },
    [push],
  );

  const close = useCallback(() => {
    setOptimisticOpen(false);
    push(null);
  }, [push]);

  const consumePanelFocus = useCallback(() => {
    if (wantPanelFocus.current) {
      wantPanelFocus.current = false;
      return true;
    }
    return false;
  }, []);

  // On close, return focus to the row that opened the inspector.
  useEffect(() => {
    if (prevOpen.current && !open) {
      const el = lastTrigger.current;
      if (el && el.isConnected) el.focus();
    }
    prevOpen.current = open;
  }, [open]);

  // Below xl with `mobileSheet`, the sheet is open whenever the server says a
  // selection resolved — `open` above is gated on isXl, which the rail needs and
  // the sheet must not inherit.
  const sheetOpen = mobileSheet && !isXl && (optimisticOpen ?? hasSelection);

  const ctx = useMemo<InspectorContextValue>(
    () => ({
      paramKey,
      selectedId,
      open,
      select,
      close,
      consumePanelFocus,
      sheet: mobileSheet,
    }),
    [paramKey, selectedId, open, select, close, consumePanelFocus, mobileSheet],
  );

  return (
    <InspectorContext.Provider value={ctx}>
      <div
        className={`sn-inspector-shell${className ? ` ${className}` : ''}`}
        data-open={open ? 'true' : 'false'}
      >
        <div className="sn-inspector-master">{master}</div>
        {/* Persistent rail so the width transition can play on both open AND
            close (the body inside comes/goes with the server render). */}
        <div className="sn-inspector-rail" aria-hidden={open ? undefined : true}>
          {inspector}
        </div>
      </div>
      {sheetOpen ? (
        <InspectorSheet onClose={close}>{inspector}</InspectorSheet>
      ) : null}
    </InspectorContext.Provider>
  );
}

/**
 * The below-xl frame: the panel slides in from the right and stops short of the
 * left edge, so a strip of the list stays visible behind a dimmed, blurred
 * scrim. Tapping that strip is the way back — owner 2026-09-22: *"on mobile it
 * will peek from the left and will leave a small space so when we tap on that
 * space it returns to the guestlist"*, *"similar to our payment page that peeks
 * from the right side of the screen."*
 *
 * Portalled to `document.body` so no ancestor's `overflow`/`transform` can clip
 * a fixed panel, and gated on mount so SSR and first paint agree.
 */
function InspectorSheet({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setPortal(document.body);
  }, []);

  /* The shared hook, not a hand-rolled copy: focus-in on open, Tab trap, Esc to
   * close, body-scroll lock, and focus RESTORED to the trigger on close.
   *
   * 🔑 `aria-modal="true"` is a PROMISE that focus is managed. Making it while
   * leaving focus loose strands a screen-reader user behind the sheet with no
   * way back — which is what `lib/modal-a11y-adoption.test.ts` exists to catch,
   * and did catch, on the first draft of this component. */
  useModalA11y({ open: true, onClose, containerRef: ref });

  if (!portal) return null;
  return createPortal(
    <>
      <button
        type="button"
        aria-label="Back to the list"
        onClick={onClose}
        className="sn-inspector-peek"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="sn-inspector-sheet"
      >
        {children}
      </div>
    </>,
    portal,
  );
}

// ── Trigger: a selectable row / catalog item ────────────────────────────────

type InspectorTriggerProps = {
  /** Selection id written to the URL (`?<paramKey>=<inspectId>`). When null the
   *  element is a plain navigating link (e.g. an owned service → its tool). */
  inspectId: string | null;
  /** Fallback / deep-link destination — used below xl, on modified clicks, and
   *  when there is no surrounding InspectorLayout. Omit for a render-only row
   *  that has no standalone destination (e.g. a Sai-on-watch alert): it renders
   *  as a button that only inspects on desktop and is inert below xl. */
  href?: string;
  className?: string;
  children: ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'className'>;

export function InspectorTrigger({
  inspectId,
  href,
  className,
  children,
  ...rest
}: InspectorTriggerProps) {
  const ctx = useInspectorContext();
  const isXl = useIsInspectorViewport();
  const selected = Boolean(inspectId && ctx?.selectedId === inspectId);
  const selMark = selected ? 'true' : undefined;

  // ── Render-only row (no href): a button that inspects on desktop, inert below. ──
  if (href === undefined) {
    return (
      <button
        type="button"
        className={className}
        data-inspector-selected={selMark}
        aria-current={selMark}
        onClick={(e) => {
          if (!ctx || !inspectId || !(isXl || ctx.sheet)) return;
          ctx.select(inspectId, e.currentTarget as unknown as HTMLElement);
        }}
      >
        {children}
      </button>
    );
  }

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // `ctx.sheet` surfaces present below xl too, so there the row opens the
    // panel at every width rather than leaving the list for a route.
    if (!ctx || !inspectId || !(isXl || ctx.sheet)) return; // navigate normally
    // Preserve open-in-new-tab / download intents and non-primary buttons.
    if (
      e.defaultPrevented ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      e.button !== 0
    ) {
      return;
    }
    e.preventDefault();
    ctx.select(inspectId, e.currentTarget);
  };

  return (
    <Link
      href={href}
      className={className}
      onClick={onClick}
      data-inspector-selected={selMark}
      aria-current={selMark}
      {...rest}
    >
      {children}
    </Link>
  );
}

// ── Panel: the sticky glass inspector column ────────────────────────────────

export function InspectorColumn({
  eyebrow,
  title,
  fullHref,
  fullLabel = 'Open full page',
  /** Changes per selection → remounts the `.sn-lens-swap` body so it re-animates. */
  swapKey,
  ariaLabel,
  children,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  /** Standalone route for this selection. Omit when the item has no distinct
   *  full page (its action button already links to its room). */
  fullHref?: string;
  fullLabel?: string;
  swapKey: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const ctx = useInspectorContext();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the panel heading on a user-initiated open (never on a cold
  // refresh/share load — consumePanelFocus is false there).
  useEffect(() => {
    if (ctx?.consumePanelFocus()) headingRef.current?.focus();
  }, [ctx, swapKey]);

  // Escape closes the inspector. Only one inspector is ever open at a time, so a
  // document-level capture listener is unambiguous. Mirrors the useModalA11y
  // Escape pattern WITHOUT its focus-trap / scroll-lock (this is a complementary
  // region, not a modal — the master list stays live behind it).
  useEffect(() => {
    if (!ctx) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        ctx?.close();
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [ctx]);

  return (
    <aside
      className="sn-inspector-panel sn-tile"
      role="complementary"
      aria-label={ariaLabel ?? 'Details'}
    >
      <header className="sn-inspector-head">
        <div className="min-w-0 flex-1">
          <p className="sn-eye">{eyebrow}</p>
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="sn-inspector-title mt-1 outline-none"
          >
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => ctx?.close()}
          className="sn-inspector-close"
          aria-label="Close details"
        >
          <X className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      </header>

      {fullHref ? (
        <Link href={fullHref} className="sn-inspector-fulllink">
          {fullLabel}
          <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </Link>
      ) : null}

      <div key={swapKey} className="sn-lens-swap sn-inspector-body">
        {children}
      </div>
    </aside>
  );
}
