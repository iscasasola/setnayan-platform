import type { ReactNode } from 'react';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import type { MakerStageList } from '@/lib/maker-scene-list';
import type { PostEventArrangement } from '@/lib/post-event-draft';
import type { ComponentProps } from 'react';
import type { MakerScene, MakerWork } from '../../website/editor/_components/editor-shell';
import type { ElementDraftAction } from '../../website/editor/_components/element-sheet';

/**
 * ＋ ↕ 🗑 THE WORK AREA'S OWN WRITES, LENT TO THE NEW MAKER'S PART EDITS
 * (`add-part-sheet.tsx`, plan PR 3). The stage's list, its order and every write
 * that changes them live in the work area (`editor-shell.tsx` `MakerWork`): the
 * navigator's eye, its one-save move (`lib/maker-reorder.ts`), the shipped
 * Remove for good, the "+ Add a scene" form. The Stages panel ASKS for them —
 * `window.dispatchEvent(new CustomEvent(MAKER_PART_OPS_EVENT, { detail: (raw) => … }))`
 * — and the work area answers with the current ones (`MakerPartRaw`, read into
 * `MakerPartOps` by the lazy sheet), so a part edit is never a second door to
 * the same fact.
 *
 * Types and one string only: nothing here rides the Maker's first load.
 */
export const MAKER_PART_OPS_EVENT = 'maker:part-ops';

type FormAction = (formData: FormData) => void | Promise<void>;
type WorkProps = ComponentProps<typeof MakerWork>;

/**
 * What the work area hands over, RAW — its own values and writes, nothing
 * computed (the work area is in the Maker's first load; the reading of them,
 * `partOpsOf` in `add-part-sheet.tsx`, is lazy).
 */
export type MakerPartRaw = {
  eventId: string;
  stage: LifecyclePhase;
  list: MakerStageList;
  fullOrder: readonly string[];
  afterLastShown: string | null;
  scenes: readonly MakerScene[];
  move: (id: string, delta: number) => void;
  eyeWrite: (scene: MakerScene) => void;
  sceneRemovers: Readonly<Record<string, ReactNode>>;
  navigator: WorkProps['navigator'];
  elementEditing: WorkProps['elementEditing'];
  addScene: WorkProps['addScene'];
  postEventPresets: WorkProps['postEventPresets'];
  sceneFacts: WorkProps['sceneFacts'];
  onPickTemplate: () => void;
};

export type MakerPartOps = {
  eventId: string;
  stage: LifecyclePhase;
  /** The stage's list as the navigator draws it — shown tiles (scenes, fixed, Post Event) and folded scenes. */
  list: MakerStageList;
  /** The stage's whole order (hidden and guest-only rows included) — what a move swaps in. */
  fullOrder: readonly string[];
  /** The full-order row after the last shown scene (a drop "at the end"). */
  afterLastShown: string | null;
  scenes: readonly MakerScene[];
  /** ↕ The navigator's move: `delta` places in the full order — ONE draft save of the stage's order. */
  move: (id: string, delta: number) => void;
  /** 👁 The navigator's eye on a scene — hides a shown one, brings a hidden one back (drafted). */
  eye: (id: string) => void;
  /** 🗑 A scene of their own's shipped "Remove for good" form, by widget id. */
  removers: Readonly<Record<string, ReactNode>>;
  /** 🎞 Post Event's arrangement as the Maker shows it (live with the draft over it) — null off Post Event. */
  postEvent: PostEventArrangement | null;
  /** The one draft door (`hubDraftAction`). */
  draftAction: ElementDraftAction | null;
  /** ✍ For Edit's typed words (`stage-panel/part-words.ts`): the hero's canvas and each scene of their own's words, as the last render had them. */
  heroCanvas: NonNullable<WorkProps['elementEditing']>['canvases'][string] | null;
  ownWords: NonNullable<WorkProps['elementEditing']>['ownWords'] | null;
  /** "+ Add a scene" — the shipped picker's form, or why a scene cannot be added here; null = not on this stage. */
  addOwn:
    | {
        action: FormAction;
        returnTo: string;
        stageLabel: string;
        heading: string;
        /** 💎 No Event Hub Pro: the scene is tried free and Apply asks — the row wears ◆. */
        tried: boolean;
        tour?: ReactNode;
        facts?: { names?: string | null; monogram?: string | null; days?: number | null } | null;
        /** 🎞 Post Event's twelve presets instead of the 25 templates. */
        presets?: { used: number; ownsPro: boolean; storeShell: boolean } | null;
      }
    | { note: string }
    | null;
  /** A template tile was tapped — the work area waits for the scene and selects it. */
  onPickTemplate: () => void;
};
