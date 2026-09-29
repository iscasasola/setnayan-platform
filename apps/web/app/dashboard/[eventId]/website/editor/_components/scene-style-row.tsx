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
import { recommendedStageSceneStyle } from '@/lib/scene-styles-stages';
import type { HubSectionCanvas, HubStage } from '@/lib/hub-canvas';
import { IRow } from './inspector-kit';
import { PickMenu } from './pick-menu';
import { useSceneCanvas } from './scene-inspector';
import type { ElementDraftAction } from './element-sheet';
import { PaletteLookRow } from './palette-look-row';
import { PALETTE_LOOK_DEFAULT, layoutDrawsPaletteLook, resolvePaletteLook } from '@/lib/palette-looks';

export type SceneStyleChoice = { id: string; name: string; line: string; isDefault: boolean };

export function SceneStyleRow({
  options,
  value,
  onPick,
  pending = false,
  error = null,
  recommendedId = null,
}: {
  options: readonly SceneStyleChoice[];
  /**
   * The style the design recommends, when it is NOT the default — the
   * Invitation / Day scenes keep their shipped look as the default (no surprise
   * change to a live page) and carry the recommendation as this hint. Null =
   * the default is the recommendation (Post Event).
   */
  recommendedId?: string | null;
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
            hint: (recommendedId ? o.id === recommendedId : o.isDefault) ? `${o.line} · Recommended` : o.line,
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

/**
 * A section row's Style — `canvas.style`, drafted. Null when the scene has no choice here.
 *
 * 🎨 The Dress code scene also carries its palette's LOOK here (`canvas.palette`,
 * owner 2026-09-29 "FIVE PALETTE STYLES"): a **Palette** row right under Style,
 * saved through the SAME `useSceneCanvas` so the two picks share one copy of the
 * canvas. Drawn only where "Our colours" is drawn in the look — the Colours and
 * roles layout, or a stage with no layouts — and only when there are colours to
 * show, so a pick is never one that changes nothing.
 */
export function SceneStyleCanvasRow({
  eventId,
  widgetType,
  canvas,
  stage,
  eventType,
  draftAction,
  colours = [],
}: {
  eventId: string;
  widgetType: string;
  canvas: HubSectionCanvas;
  stage: HubStage;
  eventType: string | null;
  draftAction: ElementDraftAction;
  /** The couple's Mood Board colours — the Palette dropdown's thumbnails. */
  colours?: readonly string[];
}) {
  const { shown, save, pending, error } = useSceneCanvas(eventId, widgetType, canvas, draftAction);
  const type = sceneStyleTypeOfWidget(widgetType);
  const options = sceneStyleOptions(type, stage, eventType);
  const layout = resolveSceneStyle(type, stage, shown.style, eventType);
  const styleRow =
    options.length < 2 ? null : (
      <SceneStyleRow
        options={options}
        value={layout}
        recommendedId={recommendedStageSceneStyle(type, stage, eventType)}
        pending={pending}
        error={error}
        /* One row, one value across stages: the pick is stored as chosen. */
        onPick={(id) => save((c) => { c.style = id; })}
      />
    );
  const paletteRow =
    type === 'dress_code' && colours.length > 0 && layoutDrawsPaletteLook(layout) ? (
      <PaletteLookRow
        value={resolvePaletteLook(shown.palette)}
        colours={colours}
        pending={pending}
        /* Tags is the default, and "Auto is an absence": picking it clears the key. */
        onPick={(id) => save((c) => { if (id === PALETTE_LOOK_DEFAULT) delete c.palette; else c.palette = id; })}
      />
    ) : null;
  if (!styleRow && !paletteRow) return null;
  return (
    <>
      {styleRow}
      {paletteRow}
      {/* The Style row says its own error; without it, the Palette row's is said here. */}
      {!styleRow && error ? (
        <p role="alert" className="py-2 text-[12.5px] font-semibold text-terracotta-700">
          {error}
        </p>
      ) : null}
    </>
  );
}
