'use client';

/**
 * ↺ A PANEL FOLLOWS THE DRAFT — after ↺ · Reset · Restore · a merged save, exactly as after an edit.
 *
 * Measured (two-hosts round 3, origin/main e11f5346 and #6632, WebKit 375): Cover › Edit › Date off → ↺ — the cover
 * drew the Date again, and Edit's Date switch still read off (`aria-checked="false"` six seconds later). Two causes:
 *
 *   1. A PANEL'S OWN PICK OUTLIVED THE DRAFT. The switch showed its own copy over the draft for good
 *      (`own[part] ?? l.shown`) — nothing the draft did afterwards (↺, Reset, Restore, another screen) could reach it.
 *      Cover › Animate did the same with a `useState(stored)` seeded once.
 *   2. A DRAWN ↺ RENDERS NOTHING. It puts the BEFORE canvas into the Maker's own copy (`lib/canvas-pick-undo.ts` →
 *      `noteDraftedCanvas`) with no Maker render, and a merged save (`elsewhere`, #6626) redraws only the pages — so a
 *      panel that re-reads on `renderStamp` alone never re-read.
 *
 * THE RULE, for every panel that shows a draft value:
 *   · `usePickUntilDraftMoves(truth)` — the panel's own pick is shown only while the draft still says what it said
 *     when the pick was made; the moment the draft moves (the pick landed, ↺, Reset, Restore, another screen's
 *     change) the draft's value is shown, and the pick is dropped.
 *   · `useDraftMoves()` — every move of the Maker's own copy re-renders the panel: a noted canvas (a pick, its ↺, a
 *     refused put-back) and a merged save, whose canvases are noted into the copy here first (the pages already
 *     redrew from the draft; the copy is what every panel reads, and what the next pick builds on).
 *   Reset · Restore · a slow ↺ are Maker renders: the shell's `renderStamp` moves, and the copy owed the truth is
 *   dropped (`makerRendered`) — the panel's truth moves with it.
 *
 * Held by `follow-draft.test.ts` (sabotaged). Lazy: only the Stages panel's pieces import it — never the first load.
 */
import { useState, useSyncExternalStore } from 'react';
import { canvasFingerprint, hearDraftedCanvas, noteDraftedCanvas } from '@/lib/maker-draft-store';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import { onMakerSave } from '@/lib/maker-save-status';
import { MAKER_PART_OPS_EVENT, type MakerPartRaw } from '../maker-part-ops';

let moves = 0;
const subs = new Set<() => void>();
let unwire: (() => void) | null = null;

function moved(): void {
  moves += 1;
  subs.forEach((f) => f());
}

/** The canvas of `type` as the Maker's last render handed it down (the work area's door) — the base of a copy. */
function renderedCanvas(type: string): HubSectionCanvas | null {
  let got: MakerPartRaw | null = null;
  window.dispatchEvent(new CustomEvent(MAKER_PART_OPS_EVENT, { detail: (raw: MakerPartRaw) => (got = raw) }));
  const raw = got as MakerPartRaw | null;
  return (raw?.elementEditing?.canvases?.[type] ?? null) as HubSectionCanvas | null;
}

/** 👥 A merged save's canvases (`elsewhere.merged.widgets[type].canvas`) into the Maker's own copy. Returns how many. */
export function noteMergedCanvases(merged: unknown, server: (type: string) => HubSectionCanvas | null | undefined): number {
  const widgets = merged && typeof merged === 'object' ? (merged as { widgets?: unknown }).widgets : null;
  if (!widgets || typeof widgets !== 'object') return 0;
  let n = 0;
  for (const [type, w] of Object.entries(widgets as Record<string, unknown>)) {
    const canvas = w && typeof w === 'object' ? (w as { canvas?: unknown }).canvas : null;
    if (!canvas || typeof canvas !== 'object') continue;
    noteDraftedCanvas(type, canvas as HubSectionCanvas, server(type));
    n += 1;
  }
  return n;
}

function subscribe(f: () => void): () => void {
  subs.add(f);
  if (!unwire && typeof window !== 'undefined') {
    const a = hearDraftedCanvas(moved);
    const b = onMakerSave((s) => {
      if (s.state !== 'elsewhere') return;
      /* Noting fires `hearDraftedCanvas` (→ `moved`) per canvas; a save that merged no canvas still moves the draft. */
      if (noteMergedCanvases(s.merged, renderedCanvas) === 0) moved();
    });
    unwire = () => {
      a();
      b();
    };
  }
  return () => {
    subs.delete(f);
    if (subs.size === 0 && unwire) {
      unwire();
      unwire = null;
    }
  };
}

/** Told at every move of the Maker's own copy (a noted canvas, a merged save) — `useDraftMoves`' subscription. */
export const onDraftMoves = subscribe;

/** Moves of the Maker's own copy so far — a dependency for a panel that reads the draft in an effect. */
export function useDraftMoves(): number {
  return useSyncExternalStore(subscribe, () => moves, () => 0);
}

export type HeldPick<T> = { pick: T; at: string };

/**
 * ONE STEP OF THE RULE (pure — the hook's whole decision, and the test's): the draft's value now is `truth`; the pick
 * still stands only while the draft says what it said when the pick was made (`at`). `own` is what to keep — null once
 * the draft moved, so a draft that later comes back to that same value never revives the pick.
 */
export function followDraft<T>(own: HeldPick<T> | null, truth: T): { shown: T; own: HeldPick<T> | null; at: string } {
  const at = canvasFingerprint({ v: truth });
  const held = own !== null && own.at === at ? own : null;
  return { shown: held ? held.pick : truth, own: held, at };
}

/**
 * What a panel shows for one draft value: its own pick while the draft has not moved since, else the draft's.
 * `pick(null)` drops the pick (a refused save: the draft is shown, as it was put back).
 */
export function usePickUntilDraftMoves<T>(truth: T): [T, (pick: T | null) => void] {
  useDraftMoves();
  const [own, setOwn] = useState<HeldPick<T> | null>(null);
  const f = followDraft(own, truth);
  /* The draft moved: the pick is dropped NOW (React re-renders this component at once). */
  if (f.own !== own) setOwn(f.own);
  return [f.shown, (pick) => setOwn(pick === null ? null : { pick, at: f.at })];
}
