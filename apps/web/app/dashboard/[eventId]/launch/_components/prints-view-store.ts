'use client';

import { useEffect, useRef, useSyncExternalStore, type ReactElement } from 'react';

/**
 * 🖨 STUDIO › PRINTS' SHARED PICKS (owner 2026-10-17) — the guest View as ▾ shows (ONE pick for every guest print) and what each
 * row's Download saves (read by the piece bar's ⬇ sheet, so "This piece" is the row's own file). A store, not a context: the rows
 * are separate lazy pieces under a server-drawn form, with no common client parent to hold a provider.
 */

/* ── the shared picks: the guest View as ▾ shows, and each row's Download ─────────────────────────────────────────────────── */

const GUESTS = new Map<string, string>();
const DOWNLOADS = new Map<string, PieceDownload>();
const LISTENERS = new Set<() => void>();
let tick = 0;
const tell = () => {
  tick += 1;
  for (const l of LISTENERS) l();
};
const subscribe = (l: () => void) => {
  LISTENERS.add(l);
  return () => {
    LISTENERS.delete(l);
  };
};

/** The guest every guest print shows — ONE pick per event (pick a guest once and every guest print redraws for them). */
export function usePrintGuest(eventId: string, fallback: string | null): [string | null, (id: string) => void] {
  const id = useSyncExternalStore(subscribe, () => GUESTS.get(eventId) ?? fallback, () => fallback);
  return [id, (next) => {
    GUESTS.set(eventId, next);
    tell();
  }];
}

/** What a row saves — read by the piece bar's ⬇ sheet, so "This piece" is the row's own file. */
export type AllInOneF =
  | { kind: 'save'; href: string; file: string; label: string; icon: ReactElement }
  | { kind: 'door'; href: string; label: string; icon: ReactElement; note: { title: string; body: string } }
  | null;
export type PieceDownload = { name: string; line?: string; one: { href: string; file: string; label: string } | null; all?: AllInOneF };

export function useRegisterDownload(item: string, entry: PieceDownload) {
  const key = JSON.stringify([entry.name, entry.line, entry.one, entry.all ? { k: entry.all.kind, h: entry.all.href } : null]);
  const latest = useRef(entry);
  latest.current = entry;
  useEffect(() => {
    DOWNLOADS.set(item, latest.current);
    tell();
    return () => {
      if (DOWNLOADS.get(item) === latest.current) DOWNLOADS.delete(item);
    };
  }, [item, key]);
}
export function useDownloads(): ReadonlyMap<string, PieceDownload> {
  useSyncExternalStore(subscribe, () => tick, () => 0);
  return DOWNLOADS;
}

