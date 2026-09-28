'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * A TOOL'S PIECES, IN THE THREE PARTS (owner 2026-09-29, DECISION_LOG "A TOOL
 * MOVED INTO THE MAKER IS REBUILT INTO THE THREE PARTS — NEVER A LINK OUT,
 * NEVER A WHOLE PAGE DROPPED IN"): LEFT the navigator lists the tool's pieces,
 * MIDDLE the visual of the picked piece, RIGHT that piece's controls.
 *
 * An item that has pieces hands `DetailsWorkspace` a `pieces` node; while that
 * item is open the navigator shows it (with "‹ All details" above it). The
 * three parts agree on which piece is picked through this one shared value —
 * `useDetailsPiece('march.line')` — so no part asks another.
 *
 * Picking a piece changes no data.
 */
type Store = { values: Readonly<Record<string, string | null>>; set: (key: string, value: string | null) => void };

const PieceContext = createContext<Store | null>(null);

export function DetailsPieceProvider({ children }: { children: ReactNode }) {
  const [values, setValues] = useState<Record<string, string | null>>({});
  const set = useCallback((key: string, value: string | null) => {
    setValues((v) => (v[key] === value ? v : { ...v, [key]: value }));
  }, []);
  const store = useMemo(() => ({ values, set }), [values, set]);
  return <PieceContext.Provider value={store}>{children}</PieceContext.Provider>;
}

/** The picked piece under `key` (e.g. 'march.line'), and how to pick another. */
export function useDetailsPiece(key: string, fallback: string | null = null): [string | null, (v: string | null) => void] {
  const store = useContext(PieceContext);
  const [own, setOwn] = useState<string | null>(fallback);
  const value = store ? (key in store.values ? (store.values[key] ?? null) : fallback) : own;
  const set = useCallback((v: string | null) => (store ? store.set(key, v) : setOwn(v)), [store, key]);
  return [value, set];
}

/** One row of a tool's navigator — the Details navigator's own look. */
export function DetailsPieceRow({
  on,
  label,
  sub,
  lead,
  onPick,
  dataKey,
  indent = false,
}: {
  on: boolean;
  label: string;
  sub?: string | null;
  lead?: ReactNode;
  onPick: () => void;
  dataKey: string;
  indent?: boolean;
}) {
  return (
    <li className="shrink-0">
      <button
        type="button"
        aria-pressed={on}
        onClick={onPick}
        data-details-piece={dataKey}
        className={`sn-press flex min-h-11 w-[132px] items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors duration-sn-control ease-sn lg:w-full ${
          indent ? 'lg:pl-4' : ''
        } ${on ? 'bg-ink/[0.07] text-ink' : 'text-ink/75 hover:bg-ink/[0.04]'}`}
      >
        {lead ? <span className="w-5 shrink-0 text-right font-mono text-[11px] text-ink/45">{lead}</span> : null}
        <span className="flex min-w-0 flex-col">
          <span className="line-clamp-2 text-[12.5px] font-medium leading-tight lg:truncate lg:text-[13.5px]">{label}</span>
          {sub ? <small className="truncate text-[11px] text-ink/55">{sub}</small> : null}
        </span>
      </button>
    </li>
  );
}

/** A heading between a tool's pieces (a march section, "Parents", "Hosts"). */
export function DetailsPieceHeading({ children }: { children: ReactNode }) {
  return <li className="hidden px-2 pb-1 pt-3 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/50 lg:block">{children}</li>;
}
