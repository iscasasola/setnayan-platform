/**
 * lib/stage-bg-sources.ts — 🖼 WHAT A SCENE'S BACKGROUND ▾ OFFERS (the Stages toolbar's Background tool, row 1 —
 * `stage-panel/stage-background.tsx`, mounted by `scene-background-row.tsx`).
 *
 * The Event Hub's · Colour — always. Scene ◆ · Video ◆ (our theme loops, where the mount handed their stills) ·
 * Upload ◆ — wherever Pro may be used here (`makerProUsable`: an event that owns Event Hub Pro, everywhere; on the web,
 * every event — tried free, named at ✓ Apply). Only the app-store shell's FREE event is not shown them. ◆ marks the
 * sources that are Pro (`makerProMark` — tried here, or owned), exactly as the row drew it before this moved here.
 *
 * 🔑 AN UNLOCK BELONGS TO THE EVENT (owner 2026-10-15): a Pro event is offered every source in every shell. Pure; held
 * by `the-background-tiles-keep-the-toolbar-in-place.test.ts`.
 */
import { BACKGROUND_SOURCE_IS_PRO } from './background-source';
import { makerProMark, makerProUsable } from './paid-mark';

export type StageBgSourceKey = 'hub' | 'colour' | 'scene' | 'video' | 'own';

export function stageBgSourcesOffered(o: { ownsPro: boolean; storeShell: boolean; hasLoops: boolean }): Array<{ key: StageBgSourceKey; pro: boolean }> {
  const media = makerProUsable({ owns: o.ownsPro, storeShell: o.storeShell });
  const mark = Boolean(makerProMark({ owns: o.ownsPro, storeShell: o.storeShell }));
  const kinds: StageBgSourceKey[] = media ? (o.hasLoops ? ['scene', 'video', 'own'] : ['scene', 'own']) : [];
  return [
    { key: 'hub', pro: false },
    { key: 'colour', pro: false },
    ...kinds.map((key) => ({ key, pro: mark && BACKGROUND_SOURCE_IS_PRO[key as 'scene' | 'video' | 'own'] })),
  ];
}
