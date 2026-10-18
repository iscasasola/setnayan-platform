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
 * It also says which of the toolbar's FOUR tools is on (Edit | Style | Background | Animate — `useStageTool`): the
 * scene's Format is ONE body in the work area, and `StageStyle` shows the tool's part of it. And it keeps which
 * segment Animate was on (Build in | Action | Build out), so the next part opens where the couple was — the
 * prototype's `S.aphase`.
 */
import { useSyncExternalStore, type ComponentType } from 'react';
import type { MakerPartTool } from '@/lib/maker-parts';
import type { StageAnimateProps } from './stage-animate';

export type StageQuiet =
  | { kind: 'info'; words: string; open: () => void }
  | { kind: 'studio'; words: string; open: () => void }
  | { kind: 'suppliers'; words: string; href: string };

export type StagePanelNow = {
  /** The part picked on the page (`lib/maker-parts.ts` key) — null: none. */
  picked: string | null;
  /** Style › Look's quiet bar for it — null: the part's words are its own tools'. */
  quiet: StageQuiet | null;
  /** What the part is and where it comes from, said behind ⓘ (never in a box on the panel). */
  about: string | null;
  /** 🧩 The LINE of the picked part that is picked (the RSVP stage) — null / absent: the part itself (the group). */
  line?: string | null;
};

export type AnimatePhase = 'in' | 'act' | 'out';

let now: StagePanelNow = { picked: null, quiet: null, about: null };
/** The toolbar's tool on show — said by the selector (`stage-tools.tsx`), read by the body under it. */
let stageTool: MakerPartTool = 'edit';
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
  if (next.picked === now.picked && (next.line ?? null) === (now.line ?? null) && next.quiet?.words === now.quiet?.words && next.about === now.about && next.quiet?.kind === now.quiet?.kind) {
    now = next;
    return;
  }
  now = next;
  ping();
}

export function useStagePanelNow(): StagePanelNow {
  return useSyncExternalStore(subscribe, () => now, () => now);
}

export function setStageTool(next: MakerPartTool): void {
  if (next === stageTool) return;
  stageTool = next;
  ping();
}

export function useStageTool(): MakerPartTool {
  return useSyncExternalStore(subscribe, () => stageTool, () => stageTool);
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

/** Put Animate on a segment (the panel's own control does this through `useAnimatePhase`; a guard renders each). */
export function setStageAnimatePhase(p: AnimatePhase): void {
  animatePhase = p;
  ping();
}

/**
 * 🖥 A DESKTOP'S ANIMATE — Build in · Action · Build out STACKED under their bar (owner's "A" for answer 3 on
 * `MAKER_DESKTOP_ADAPTATION_2026-10-07_fable.md`). Handed in by the desktop's lazy code (`stage-panel/desk.tsx`)
 * while its columns are on, and taken back when they go: on a phone (and in either first render) it is null and
 * `StageAnimate` draws the phone's four rows — not a byte of the stack is in the Maker's first load.
 */
let deskAnimate: ComponentType<StageAnimateProps> | null = null;
export function setDeskAnimateStack(next: ComponentType<StageAnimateProps> | null): void {
  if (next === deskAnimate) return;
  deskAnimate = next;
  ping();
}
export function useDeskAnimateStack(): ComponentType<StageAnimateProps> | null {
  return useSyncExternalStore(subscribe, () => deskAnimate, () => null);
}
