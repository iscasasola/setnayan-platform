/**
 * 🔔 The page's notices, held in ONE place in the browser (owner approved 14 Nov 2026, `lib/notices.ts`).
 *
 * A notice REGISTERS here (`<Notice>`); the page's slots (`<NoticeSlot>`) and the bell read the same arrangement, so
 * a notice is drawn in exactly one place: the top, the end, or behind "N more". Nothing is drawn until this browser
 * knows whether the notice was closed — a closed notice never flashes in.
 */
import type { ReactNode } from 'react';
import { arrange, isClosedNow, type Arranged, type CloseRecord, type NoticeFacts } from '@/lib/notices';
import { loadCloses, saveClose } from '@/lib/notice-memory';

export type NoticeView = {
  /** One short line. Also names the ⓘ. */
  title: string;
  /** The same line with its own emphasis. */
  titleNode?: ReactNode;
  /** Behind the ⓘ — the rest of what used to be the card. */
  detail?: ReactNode;
  /** The notice's own action(s). The close word is added by the kind. */
  actions?: ReactNode;
  /** Replaces the kind's mark (a badge pill, for instance). */
  mark?: ReactNode;
};

export type NoticeEntry = NoticeFacts &
  NoticeView & {
    id: string;
    /** A close kept by an older, hand-written store on this browser — honoured so earlier dismissals hold. */
    legacy?: () => CloseRecord | null;
    onClose?: () => void;
  };

type Snapshot = {
  entries: readonly NoticeEntry[];
  /** undefined = not read yet; null = never closed. */
  closes: ReadonlyMap<string, CloseRecord | null>;
  slots: { top: number; end: number; guest: number };
  bells: number;
  trayOpen: boolean;
};

let state: Snapshot = {
  entries: [],
  closes: new Map(),
  slots: { top: 0, end: 0, guest: 0 },
  bells: 0,
  trayOpen: false,
};
const listeners = new Set<() => void>();

function set(next: Partial<Snapshot>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export const getSnapshot = () => state;
const EMPTY: Snapshot = state;
export const getServerSnapshot = () => EMPTY;

// ── memory ──
let queued = new Set<string>();
let flushing = false;
function queueLoad(e: NoticeEntry) {
  if (state.closes.has(e.key)) return;
  const legacy = e.legacy?.() ?? null;
  if (legacy) {
    const closes = new Map(state.closes);
    closes.set(e.key, legacy);
    set({ closes });
    return;
  }
  queued.add(e.key);
  if (flushing) return;
  flushing = true;
  queueMicrotask(() => {
    const keys = [...queued];
    queued = new Set();
    flushing = false;
    void loadCloses(keys).then((found) => {
      const closes = new Map(state.closes);
      for (const k of keys) if (!closes.has(k)) closes.set(k, found.get(k) ?? null);
      set({ closes });
    });
  });
}

// ── registration ──
export function register(e: NoticeEntry) {
  set({ entries: [...state.entries.filter((x) => x.id !== e.id), e] });
  queueLoad(e);
  return () => set({ entries: state.entries.filter((x) => x.id !== e.id) });
}

export function slotMounted(place: 'top' | 'end', guest: boolean) {
  const bump = (d: number) => {
    const slots = { ...state.slots, [place]: state.slots[place] + d };
    if (guest) slots.guest += d;
    set({ slots });
  };
  bump(1);
  return () => bump(-1);
}

export function bellMounted() {
  set({ bells: state.bells + 1 });
  return () => set({ bells: state.bells - 1 });
}

export function openTray(open: boolean) {
  set({ trayOpen: open });
}

export function closeNotice(e: NoticeEntry) {
  const prev = state.closes.get(e.key) ?? null;
  const closes = new Map(state.closes);
  // Gone at once; the memory is written behind it.
  closes.set(e.key, { closedAt: Date.now(), count: (prev?.count ?? 0) + 1 });
  set({ closes });
  e.onClose?.();
  void saveClose(e.key, prev);
}

// ── the arrangement ──
let memo: { from: Snapshot | null; at: number; out: Arranged<NoticeEntry> } = {
  from: null,
  at: 0,
  out: { top: [], end: [], more: [] },
};

/** Recomputed only when the snapshot changes (stable for `useSyncExternalStore` consumers). */
export function arranged(s: Snapshot): Arranged<NoticeEntry> {
  if (memo.from === s) return memo.out;
  const now = Date.now();
  const open = s.entries.filter((e) => {
    if (!s.closes.has(e.key)) return false; // not read yet — never flash a closed notice
    return !isClosedNow(e, s.closes.get(e.key), now);
  });
  const out = arrange(open, { hasTop: s.slots.top > 0, hasEnd: s.slots.end > 0, guest: s.slots.guest > 0 });
  memo = { from: s, at: now, out };
  return out;
}
