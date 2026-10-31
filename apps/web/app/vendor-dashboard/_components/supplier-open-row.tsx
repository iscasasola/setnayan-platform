'use client';

/**
 * 🗂 A SUPPLIER LIST ROW THAT OPENS — inline on a phone, in the right column from 701 (supplier dashboard v13, APPROVED
 * 2026-10-29; owner on Today › Waiting on you, verbatim: *"where is the expand look of these rows?"* — REVERSES the
 * one-line rule of the round before; controller call 5 of the v13 notes: *"Today rows: phone = expand inline; ≥700 px =
 * open in the right column; the row's button still acts directly"*; Customers › Events: "opened = the fixed lines +
 * For your service; chat docks right").
 *
 * ONE mechanism for every supplier list that opens a row (Today's three lists · Customers › Events), so no page draws its
 * own:
 *
 *   · THE ROW IS THE SHARED `Fold` (its terracotta ▾, its 0.7 s open, one open at a time, the open head pinned slim) —
 *     never a second accordion. Its ONE action (`endPress`: Confirm · Reply · Pay) sits BESIDE the head and acts
 *     directly; the rest of the row opens it.
 *   · BELOW 701 the row opens IN PLACE, under itself.
 *   · FROM 701 the list sits in the left column (`SupplierColumns`) and the opened row is drawn in the RIGHT column
 *     instead — the same body, the same server-drawn answers, PORTALED there (so it exists ONCE: no second form, no
 *     second id). The row itself stays shut and wears the "open" wash (`data-open-current`). 🔒 NEVER AN EMPTY RIGHT
 *     COLUMN: with nothing chosen, the first row on screen is opened there; with no row at all, the scope's `rest`.
 *   · NO REQUEST ON OPEN: every body arrives with the page's ONE batched read; opening a row only moves it.
 *
 * Outside a `SupplierOpenScope` (an event day, a new shop's Today, a test) a row is exactly the plain `Fold`.
 * 🔒 app/vendor-dashboard/_components/a-supplier-row-opens-beside-itself.test.ts
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Fold } from '@/app/_components/fold';
import { SupplierColumns } from './supplier-columns';

/** Where the right column starts — the frame's own line (`supplier-frame.css`, `.sn-cols` from 701). */
export const OPEN_ROW_WIDE_QUERY = '(min-width: 701px)';

type Scope = {
  wide: boolean;
  openId: string | null;
  open: (id: string) => void;
  shut: (id: string) => void;
  pane: HTMLElement | null;
};

const OpenScope = createContext<Scope | null>(null);

/** True from 701 — read after the first paint, so the server's render (one column) and the first client render agree. */
function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(OPEN_ROW_WIDE_QUERY);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

/**
 * The list and its right column. `children` is the page's list as on a phone; every `SupplierOpenRow` inside it opens
 * in the right column from 701.
 */
export function SupplierOpenScope({
  name,
  paneLabel,
  rest,
  watch,
  children,
}: {
  /** Which page — `data-supplier-cols`, the guard's and the walk's handle. */
  name: string;
  /** What the right column is, for a screen reader ("The opened row"). */
  paneLabel: string;
  /** What the right column says when the list has no row that opens — never an empty column. */
  rest: ReactNode;
  /** Something that changes which rows are on screen (Today's count filter) — the column re-seats on the first one. */
  watch?: string | null;
  children: ReactNode;
}) {
  const wide = useWide();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pane, setPane] = useState<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const open = useCallback((id: string) => setOpenId(id), []);
  // A peer closing this row (one open at a time) must not clobber the row that just opened.
  const shut = useCallback((id: string) => setOpenId((cur) => (cur === id ? null : cur)), []);

  // 🔒 From 701 the right column is never empty: the row chosen, else the first row on screen.
  useEffect(() => {
    if (!wide) return;
    const list = listRef.current;
    if (!list) return;
    const shown = [...list.querySelectorAll<HTMLElement>('[data-open-row]')].filter((el) => el.offsetParent !== null);
    // Functional: a row that opened itself on arrival (`defaultOpen`) in this same commit is kept, not overwritten.
    setOpenId((cur) => (cur && shown.some((el) => el.dataset.openRow === cur) ? cur : (shown[0]?.dataset.openRow ?? null)));
  }, [wide, watch, openId]);

  // A newly opened row starts at the top of the right column.
  useEffect(() => {
    if (wide && pane) pane.parentElement?.scrollTo({ top: 0 });
  }, [wide, pane, openId]);

  const value = useMemo<Scope>(() => ({ wide, openId, open, shut, pane }), [wide, openId, open, shut, pane]);
  return (
    <OpenScope.Provider value={value}>
      <SupplierColumns
        name={name}
        paneLabel={paneLabel}
        list={<div ref={listRef}>{children}</div>}
        pane={
          <div ref={setPane} className="min-w-0" data-open-pane="">
            {wide && openId === null ? <div className="px-4 py-6 text-[14px] text-ink/60 sm:px-6">{rest}</div> : null}
          </div>
        }
      />
    </OpenScope.Provider>
  );
}

/** The opened row, as the right column draws it — its title, then its body. */
function PaneBody({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div data-open-pane-body="">
      <h2
        className="sticky top-0 z-[2] border-b border-ink/10 px-4 py-3 text-[17px] font-semibold leading-snug text-ink sm:px-6"
        style={{ background: 'var(--sn-canvas)' }}
      >
        {title}
      </h2>
      <div className="px-4 pb-8 sm:px-6">{children}</div>
    </div>
  );
}

/**
 * One row of a supplier list. Without a scope it is the plain `Fold`; inside one it opens beside the list from 701.
 */
export function SupplierOpenRow({
  id,
  title,
  titleNode,
  line,
  lead,
  aside,
  endPress,
  paneTitle,
  data,
  defaultOpen = false,
  lineWrap = false,
  children,
}: {
  /** Unique within the page — the row's handle (`data-open-row`). */
  id: string;
  title: string;
  /** What the title draws when it is marked (a search's matching letters); `title` stays its words. */
  titleNode?: ReactNode;
  /** The row's one line, under the title. */
  line?: string;
  /** The row's mark at the left (its round icon, the couple's initials). */
  lead?: ReactNode;
  /** A state at the right, before the ▾ — a `Badge`. Never pressable. */
  aside?: ReactNode;
  /** The row's ONE action — it acts directly; the rest of the row opens. */
  endPress?: ReactNode;
  /** The right column's heading, when it says more than the row ("Kat Arroyo · Debut · Feb 14, 2027"). */
  paneTitle?: string;
  /** `data-fold`. */
  data?: string;
  /** Opened on arrival (a link that names it). */
  defaultOpen?: boolean;
  /** The row's line takes two lines before it is cut (a line that carries money — Customers › Events). */
  lineWrap?: boolean;
  /** What opening shows — drawn by the page, with its answers. */
  children: ReactNode;
}) {
  const scope = useContext(OpenScope);
  // A row a link names is open from the FIRST paint (the server's too) — not one frame later.
  const [arriving, setArriving] = useState(defaultOpen);
  const seeded = useRef(false);
  useEffect(() => {
    if (!scope || seeded.current) return;
    seeded.current = true;
    if (defaultOpen) scope.open(id);
    setArriving(false);
  }, [scope, defaultOpen, id]);

  if (!scope) {
    return (
      <div data-open-row={id}>
        <Fold title={title} titleNode={titleNode} line={line ?? ''} wrap lineWrap={lineWrap} lead={lead} aside={aside} endPress={endPress} data={data} defaultOpen={defaultOpen}>
          {children}
        </Fold>
      </div>
    );
  }
  const isOpen = scope.openId === id || (arriving && scope.openId === null);
  const beside = scope.wide && isOpen;
  return (
    <div data-open-row={id} data-open-current={beside ? '' : undefined}>
      <Fold
        title={title}
        titleNode={titleNode}
        line={line ?? ''}
        wrap
        lineWrap={lineWrap}
        lead={lead}
        aside={aside}
        endPress={endPress}
        data={data}
        current={beside}
        open={!scope.wide && isOpen}
        onOpenChange={(next) => (next ? scope.open(id) : scope.shut(id))}
      >
        {scope.wide ? null : children}
      </Fold>
      {beside && scope.pane ? createPortal(<PaneBody title={paneTitle ?? title}>{children}</PaneBody>, scope.pane) : null}
    </div>
  );
}
