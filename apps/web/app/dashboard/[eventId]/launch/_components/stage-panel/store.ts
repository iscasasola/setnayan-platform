/**
 * 🧭 WHAT THE STAGES ROW KNOWS, FOR THE PANEL UNDER IT (the new Maker's redraw,
 * DECISION_LOG 2026-10-07 "THE STAGES PANEL IS REDRAWN FROM THE PROTOTYPE").
 *
 * The row (`stage-tools.tsx`) and the tool under it are two React trees that never
 * pass props to each other — the tool is the work area's (`editor-shell.tsx`,
 * `element-sheet.tsx`), drawn into the lower third. The row knows which PART of the
 * page is picked and where its words come from; the tool needs that for Style ›
 * Look's one quiet bar ("Edit the E-Gifts · Studio ›"). It is said here, once, and
 * read with `useSyncExternalStore`. Nothing here writes a draft.
 *
 * It also keeps which segment each tool was on (Look | Background | Arrange ·
 * Build in | Action | Build out), so the next part opens where the couple was — the
 * prototype's `S.sphase` / `S.aphase`.
 */
import { useSyncExternalStore } from 'react';

export type StageQuiet =
  | { kind: 'info'; words: string; small: string; open: () => void }
  | { kind: 'studio'; words: string; small: string; open: () => void }
  | { kind: 'suppliers'; words: string; small: string; href: string };

export type StagePanelNow = {
  /** The part picked on the page (`lib/maker-parts.ts` key) — null: none. */
  picked: string | null;
  /** Style › Look's quiet bar for it — null: the part's words are its own tools'. */
  quiet: StageQuiet | null;
  /** What the part is and where it comes from, said behind ⓘ (never in a box on the panel). */
  about: string | null;
};

export type StylePhase = 'look' | 'bg' | 'arrange';
export type AnimatePhase = 'in' | 'act' | 'out';

let now: StagePanelNow = { picked: null, quiet: null, about: null };
let stylePhase: StylePhase = 'look';
let animatePhase: AnimatePhase = 'in';
const subs = new Set<() => void>();
const ping = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
};

export function setStagePanelNow(next: StagePanelNow): void {
  if (next.picked === now.picked && next.quiet?.words === now.quiet?.words && next.about === now.about && next.quiet?.kind === now.quiet?.kind) {
    now = next;
    return;
  }
  now = next;
  ping();
}

export function useStagePanelNow(): StagePanelNow {
  return useSyncExternalStore(subscribe, () => now, () => now);
}

export function useStylePhase(): [StylePhase, (p: StylePhase) => void] {
  const p = useSyncExternalStore(subscribe, () => stylePhase, () => stylePhase);
  return [
    p,
    (next) => {
      stylePhase = next;
      ping();
    },
  ];
}

export function useAnimatePhase(): [AnimatePhase, (p: AnimatePhase) => void] {
  const p = useSyncExternalStore(subscribe, () => animatePhase, () => animatePhase);
  return [
    p,
    (next) => {
      animatePhase = next;
      ping();
    },
  ];
}

/* ── 🎭 the Reveal: the opening chosen (said by its picker) and the event's colours (read off the canvas) ── */
export type StageRevealLook = { kind: string; colours: { dominant: string; supporting: string; accent: string; neutral: string } };
let reveal: StageRevealLook = { kind: 'four-flap', colours: { dominant: '#5B4A6B', supporting: '#D9C4CF', accent: '#A9834B', neutral: '#F7F2EC' } };
export function setStageRevealKind(kind: string): void {
  if (kind === reveal.kind) return;
  reveal = { ...reveal, kind };
  ping();
}
export function setStageRevealColours(colours: StageRevealLook['colours']): void {
  if (JSON.stringify(colours) === JSON.stringify(reveal.colours)) return;
  reveal = { ...reveal, colours };
  ping();
}
export function useStageRevealLook(): StageRevealLook {
  return useSyncExternalStore(subscribe, () => reveal, () => reveal);
}
