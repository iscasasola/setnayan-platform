'use client';

/**
 * 🎨 THE SCENE'S STYLE — ONE dropdown row, the same on every stage.
 *
 * Owner, 2026-09-29 ("EVERY SCENE ON EVERY STAGE HAS AT LEAST THREE PREMADE
 * STYLES"): *"we want at least 3 choices for each scene that are premade. even
 * the countdown and other scenes"*; approved in `prototypes/every_scene_three_
 * styles_2026-09-29.html` ("The Maker side — Style is one dropdown") and in the
 * Post Event prototype's Maker frames. A scene tapped → its panel → **Style**,
 * the shared PickMenu showing the current choice; a tap lists the styles with
 * one line each. Picking a style is FREE — no ◆ here — and never touches the
 * couple's words or data (any set of choices is a dropdown, owner 2026-09-28).
 *
 * Two doors, one row:
 *   · `SceneStyleRow` — the row itself, given its options and a pick handler
 *     (Post Event's scenes save into the story's `sceneLooks`);
 *   · `SceneStyleCanvasRow` — a section row's Style, saved as the scene's
 *     `canvas.style` through the one draft door (`useSceneCanvas`). It draws
 *     NOTHING until the registry (`lib/scene-styles.ts`) holds two or more
 *     styles this stage draws for this scene — so a builder registering styles
 *     makes the row appear, with no change here.
 */

import { sceneStyleOptions, sceneStyleTypeOfWidget, resolveSceneStyle } from '@/lib/scene-styles';
import type { HubSectionCanvas, HubStage } from '@/lib/hub-canvas';
import { IRow } from './inspector-kit';
import { PickMenu } from './pick-menu';
import { useSceneCanvas } from './scene-inspector';
import type { ElementDraftAction } from './element-sheet';

export type SceneStyleChoice = { id: string; name: string; line: string; isDefault: boolean };

export function SceneStyleRow({
  options,
  value,
  onPick,
  pending = false,
  error = null,
}: {
  options: readonly SceneStyleChoice[];
  /** The style the scene is drawn in now. */
  value: string | null;
  onPick: (id: string) => void;
  pending?: boolean;
  error?: string | null;
}) {
  if (options.length < 2) return null;
  return (
    <>
      <IRow label="Style" data="scene-style">
        <PickMenu
          label="This scene’s style"
          value={value}
          dataAttr="data-scene-style"
          options={options.map((o) => ({
            key: o.id,
            label: o.name,
            hint: o.isDefault ? `${o.line} · Recommended` : o.line,
          }))}
          onPick={(id) => {
            if (!pending && id !== value) onPick(id);
          }}
        />
      </IRow>
      {error ? (
        <p role="alert" className="py-2 text-[12.5px] font-semibold text-terracotta-700">
          {error}
        </p>
      ) : null}
    </>
  );
}

/** A section row's Style — `canvas.style`, drafted. Null when the scene has no choice here. */
export function SceneStyleCanvasRow({
  eventId,
  widgetType,
  canvas,
  stage,
  eventType,
  draftAction,
}: {
  eventId: string;
  widgetType: string;
  canvas: HubSectionCanvas;
  stage: HubStage;
  eventType: string | null;
  draftAction: ElementDraftAction;
}) {
  const { shown, save, pending, error } = useSceneCanvas(eventId, widgetType, canvas, draftAction);
  const type = sceneStyleTypeOfWidget(widgetType);
  const options = sceneStyleOptions(type, stage, eventType);
  if (options.length < 2) return null;
  return (
    <SceneStyleRow
      options={options}
      value={resolveSceneStyle(type, stage, shown.style, eventType)}
      pending={pending}
      error={error}
      /* One row, one value across stages: the pick is stored as chosen. */
      onPick={(id) => save((c) => { c.style = id; })}
    />
  );
}
