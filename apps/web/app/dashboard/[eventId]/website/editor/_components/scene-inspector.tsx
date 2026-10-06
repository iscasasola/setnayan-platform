'use client';

import { useSceneCanvas } from './use-scene-canvas';
import { ArrowDown, ArrowUp, Lock } from 'lucide-react';
import { HUB_ARRANGEMENTS, HUB_ARRANGEMENT_LABEL, HUB_DEFAULT_ARRANGEMENT, type HubSectionCanvas } from '@/lib/hub-canvas';
import { HUB_ELEMENT_LABEL, type HubElementKey } from '@/lib/element-style';
import type { ElementDraftAction } from './element-sheet';
import { IButton, IHint, IRow, ISection, ISeg, ISegmented } from './inspector-kit';
import { PickMenu } from './pick-menu';

/**
 * 🎬 THE SCENE INSPECTOR'S TABS — Keynote's slide inspector for one scene
 * (owner 2026-09-27: *"ALL THE MAKER'S TOOLBARS TAKE KEYNOTE AND PAGES AS THEIR
 * MODEL"*; approved prototype frame A): **Format · Animate · Arrange ·
 * Content**. The Transition tab is folded into Animate (answer 4: *"fold it"*
 * — Keynote keeps transitions under Animate too).
 *
 *   FORMAT   Background (`scene-background-row.tsx`) · Layout (a scene of their own)
 *   ANIMATE  How it moves (Auto · Still · Calm · Editorial · Cinematic) · Into
 *            the next scene (Scroll · Scrub · Auto-scroll) · Speed · ▶ Preview,
 *            and — nothing lost — the fine-tune rows that shipped under a
 *            preset: Timing · Comes in / From · Goes out / Toward · Parts
 *   ARRANGE  Show (Shown · Auto · Hidden) · Order (Move up · Move down) ·
 *            Remove… for a scene of their own
 *   CONTENT  the scene's words (their own box) and its parts, each opening the
 *            part's toolbar
 *
 * 💾 THE DRAFT, NEVER LIVE. How a scene moves and lays out is ITS CANVAS, so
 * those rows save the scene's whole canvas through `hubDraftAction` (the one
 * draft door the element sheet uses) — no page reload, the canvas refreshes
 * behind it. Show and Order are not canvas: they go through the navigator's
 * own draft form (the shell's `post` / `move`), exactly as the navigator's ⋯
 * menu does. Remove is the scene's existing confirm-first form.
 *
 * 💎 PRO, TRIED HERE, PAID AT APPLY (owner 2026-09-28, verbatim: *"they can edit
 * it with pro features. but need to upgrade to pro when clicked on apply and
 * point out the effect chosen that caused them to upgrade to pro"*). How a scene
 * moves is still Event Hub Pro, but every row saves to the DRAFT, so a couple
 * without it uses the same controls — marked ◆ PRO, never locked — and the
 * Apply sheet names what they chose ("Animation · Schedule"). In the app-store
 * shell a couple without Pro is shown only "Reset how it moves" (the one motion
 * change that is always free); a Pro control there is hidden, never locked.
 */

export type SceneTab = 'format' | 'animate' | 'arrange' | 'content';
export const SCENE_TABS: ReadonlyArray<{ key: SceneTab; label: string }> = [
  { key: 'format', label: 'Format' },
  { key: 'animate', label: 'Animate' },
  { key: 'arrange', label: 'Arrange' },
  { key: 'content', label: 'Content' },
];

/* `useSceneCanvas` lives in its own small module so a lazy piece (the scene's
   Style row, `maker-details`) can use it without pulling this whole inspector —
   a first-screen module — into that chunk group (train n: that made the
   inspector + the template picker one more async chunk in the runtime every
   page loads, 5 B over the shared-bundle ceiling). */
export { useSceneCanvas } from './use-scene-canvas';

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="py-2 text-[12.5px] font-semibold text-terracotta-700">
      {error}
    </p>
  ) : null;
}

/* ── ANIMATE ── its own module, `scene-animate-tab.tsx`, loaded when a scene's
   Animate first opens (`details-lazy.tsx`) — never in the Maker's first load. */

/* ── FORMAT · LAYOUT (a scene of their own) ─────────────────────────────── */

export function SceneLayoutRow({
  eventId,
  widgetType,
  canvas,
  draftAction,
}: {
  eventId: string;
  widgetType: string;
  canvas: HubSectionCanvas;
  draftAction: ElementDraftAction;
}) {
  const { shown, save, error } = useSceneCanvas(eventId, widgetType, canvas, draftAction);
  /* 🎬 A scene made from a TEMPLATE lays itself out — the four arrangements
     would move nothing there, so the row is not drawn. */
  if (shown.template) return null;
  const arrangement = shown.arrangement ?? HUB_DEFAULT_ARRANGEMENT;
  return (
    <>
      <IRow label="Layout" wrap data="scene-layout">
        <ISegmented label="Layout">
          {HUB_ARRANGEMENTS.map((a) => (
            <ISeg key={a} on={arrangement === a} onClick={() => save((c) => { c.arrangement = a; })}>
              {HUB_ARRANGEMENT_LABEL[a]}
            </ISeg>
          ))}
        </ISegmented>
      </IRow>
      <ErrorLine error={error} />
    </>
  );
}

/* ── ARRANGE ────────────────────────────────────────────────────────────── */

export function SceneArrangeTab({
  mode,
  isVisible,
  hasContent,
  openBrowse,
  pending,
  onMode,
  onEye,
  canUp,
  canDown,
  onUp,
  onDown,
  removeForm,
}: {
  mode: 'auto' | 'shown' | 'hidden';
  isVisible: boolean;
  hasContent: boolean;
  /** Which ONE visibility control governs this event (`visibility-control-is-singular.test.ts`). */
  openBrowse: boolean;
  pending: boolean;
  onMode: (mode: 'auto' | 'shown' | 'hidden') => void;
  onEye: () => void;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  /** A scene of their own: its confirm-first Remove (a server form). */
  removeForm?: React.ReactNode;
}) {
  return (
    <div data-scene-tab="arrange" aria-busy={pending}>
      <ISection>Show</ISection>
      {openBrowse ? (
        <>
          <IRow data="scene-show">
            <ISegmented label="Show this scene">
              {(['shown', 'auto', 'hidden'] as const).map((m) => {
                const blocked = m === 'shown' && !hasContent;
                return (
                  <ISeg
                    key={m}
                    on={mode === m}
                    disabled={pending || blocked}
                    title={blocked ? 'Add content to this scene first.' : undefined}
                    onClick={() => mode !== m && onMode(m)}
                    data={`mode-${m}`}
                  >
                    {blocked ? <Lock aria-hidden className="h-3 w-3" strokeWidth={2.5} /> : null}
                    {m === 'shown' ? 'Shown' : m === 'auto' ? 'Auto' : 'Hidden'}
                  </ISeg>
                );
              })}
            </ISegmented>
          </IRow>
          <IHint>Auto shows it as soon as it has content. Hidden keeps it back.</IHint>
        </>
      ) : (
        <IRow data="scene-eye">
          <ISegmented label="Show this scene">
            <ISeg on={isVisible} disabled={pending} onClick={() => !isVisible && onEye()} data="visible">
              Shown
            </ISeg>
            <ISeg on={!isVisible} disabled={pending} onClick={() => isVisible && onEye()} data="hidden">
              Hidden
            </ISeg>
          </ISegmented>
        </IRow>
      )}
      <ISection>Order</ISection>
      <IRow data="scene-order">
        <IButton disabled={pending || !canUp} onClick={onUp} data="move-up">
          <ArrowUp aria-hidden className="h-4 w-4" strokeWidth={2} />
          Move up
        </IButton>
        <IButton disabled={pending || !canDown} onClick={onDown} data="move-down">
          <ArrowDown aria-hidden className="h-4 w-4" strokeWidth={2} />
          Move down
        </IButton>
      </IRow>
      <IHint>Or drag a scene in the list. Same thing.</IHint>
      {removeForm ? <div className="py-1">{removeForm}</div> : null}
    </div>
  );
}

/* ── CONTENT · THE SCENE'S PARTS ────────────────────────────────────────── */

/**
 * The scene's parts — ONE dropdown (owner 2026-10-05: a set of choices is a
 * dropdown, and no caption under it). A pick opens the same sheet a tap on the
 * part on the page opens.
 */
export function SceneParts({
  keys,
  onElement,
}: {
  keys: readonly HubElementKey[];
  onElement: (el: HubElementKey) => void;
}) {
  /* 💎 No Pro mark here any more (owner 2026-09-28): styling a part is free —
     colour, size, the Text rows — and only its Font ▾ and Animate wear the
     mark, inside the part's own sheet. */
  return (
    <div data-scene-parts="" className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-2 pt-1">
      <span className="text-[13px] font-semibold text-ink">Part</span>
      <PickMenu
        label="Part"
        dataAttr="data-scene-part-pick"
        value={null}
        buttonText="Pick a part"
        options={keys.map((k) => ({ key: k, label: HUB_ELEMENT_LABEL[k] }))}
        onPick={(k) => onElement(k as HubElementKey)}
      />
    </div>
  );
}
