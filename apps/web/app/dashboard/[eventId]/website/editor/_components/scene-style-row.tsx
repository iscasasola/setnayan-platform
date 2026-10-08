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
import { IRow, ISeg, ISegmented } from './inspector-kit';
import { PickMenu } from './pick-menu';
import { useSceneCanvas } from './use-scene-canvas';
import { noteDraftedCanvas } from '@/lib/maker-draft-store';
import type { ElementDraftAction } from './element-sheet';
import { DosLookCards, PaletteLookCards, PaletteLookRow } from './palette-look-row';
import { DOS_LOOK_DEFAULT, resolveDosLook } from '@/lib/dress-code-looks';
import { PALETTE_LOOK_DEFAULT, layoutDrawsPaletteLook, resolvePaletteLook } from '@/lib/palette-looks';
import { useMaker } from '../../../launch/_components/maker-context';
import { StyleCards } from '../../../launch/_components/stage-panel/style-carousel';
import { Dd } from '../../../launch/_components/stage-panel/kit';
import { useStagePanelNow } from '../../../launch/_components/stage-panel/store';
import {
  HUB_ELEMENT_ALIGNS,
  HUB_ELEMENT_ALIGN_LABEL,
  HUB_ELEMENT_FIELDS,
  HUB_SCENE_ELEMENT_KEYS,
  withElementAlign,
  type HubElementAlign,
} from '@/lib/element-style';

export type SceneStyleChoice = { id: string; name: string; line: string; isDefault: boolean };

export function SceneStyleRow({
  options,
  value,
  onPick,
  pending = false,
  error = null,
  recommendedId = null,
  preview = null,
}: {
  /** 🧭 The new Maker's miniatures: the part's canvas key and scene type (`StyleCards`). */
  preview?: { canvasKey: string; sceneType: string } | null;
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
  /* 🧭 The new Maker draws the same styles as a carousel of real miniatures (`StyleCarousel` = `stage-panel/style-carousel.tsx`). */
  const carousel = useMaker()?.stagesStudio === true;
  if (options.length < 2) return null;
  if (carousel) {
    return <StyleCarousel options={options} value={value} onPick={onPick} pending={pending} error={error} preview={preview} />;
  }
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
 * 🎠 THE NEW MAKER'S STYLE — the SAME shipped styles (`sceneStyleOptions`, `lib/scene-styles.ts`) as a
 * carousel of REAL miniatures (owner 2026-10-07: *"should be a preview of the style and not text"*; prototype
 * `.lcar`): each card is the part drawn in that style (`stage-panel/style-carousel.tsx` `StyleCards`), with
 * its short name only — no description, no "Recommended". Never a list of its own:
 * `lib/layouts-are-the-shipped-scene-styles.test.ts`. A tap applies at once; the page above is the full preview.
 */
function StyleCarousel({
  options,
  value,
  onPick,
  pending,
  error,
  preview,
}: {
  options: readonly SceneStyleChoice[];
  value: string | null;
  onPick: (id: string) => void;
  pending: boolean;
  error: string | null;
  preview: { canvasKey: string; sceneType: string } | null;
}) {
  return (
    <>
      <StyleCards options={options} value={value} onPick={onPick} pending={pending} canvasKey={preview?.canvasKey ?? null} sceneType={preview?.sceneType ?? ''} />
      {error ? (
        <p role="alert" className="shrink-0 py-1 text-[12.5px] font-semibold text-terracotta-700">
          {error}
        </p>
      ) : null}
    </>
  );
}

/**
 * A section row's Style — `canvas.style`, drafted. Null when the scene has no choice here.
 *
 * 🎨 The Dress code scene's palette LOOK (`canvas.palette`, #6226) is NOT here
 * any more: it moved to Look › Colours (`PaletteLookCanvasRow` below; owner
 * 2026-10-02, tracker f40 — `lib/maker-look-sections.ts`). One control, one home.
 */
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
  /* 🖼 A style is a different component — the bridge cannot draw it, so the
     pick is redrawn on the canvas in place (`redraw`), never by a Maker render. */
  const { shown, save, pending, error } = useSceneCanvas(eventId, widgetType, canvas, draftAction, undefined, { redraw: true });
  const type = sceneStyleTypeOfWidget(widgetType);
  const options = sceneStyleOptions(type, stage, eventType);
  const layout = resolveSceneStyle(type, stage, shown.style, eventType);
  const styleRow =
    options.length < 2 ? null : (
      <SceneStyleRow
        options={options}
        value={layout}
        recommendedId={recommendedStageSceneStyle(type, stage, eventType)}
        preview={{ canvasKey: `w:${widgetType}`, sceneType: type }}
        pending={pending}
        error={error}
        /* One row, one value across stages: the pick is stored as chosen. */
        onPick={(id) => save((c) => { c.style = id; })}
      />
    );
  /* 🏛 The Venue scene's Map switch (owner 2026-09-30, "VENUE STYLES APPROVED"):
     two choices are a switch, never a dropdown. "One map for both" is the
     default and an absence; "No map" stores `canvas.venueMap = 'none'`. */
  const mapRow =
    type === 'venue_map' && styleRow ? (
      <IRow label="Map" data="venue-map">
        <ISegmented label="Map">
          <ISeg on={shown.venueMap !== 'none'} disabled={pending} data="venue-map-one" onClick={() => save((c) => { delete c.venueMap; })}>
            One map for both
          </ISeg>
          <ISeg on={shown.venueMap === 'none'} disabled={pending} data="venue-map-none" onClick={() => save((c) => { c.venueMap = 'none'; })}>
            No map
          </ISeg>
        </ISegmented>
      </IRow>
    ) : null;
  if (!styleRow) return null;
  return (
    <>
      {styleRow}
      {mapRow}
    </>
  );
}

/**
 * 🎨 LOOK › COLOURS › PALETTE — the Dress code scene's palette look
 * (`canvas.palette`, owner 2026-09-29 "FIVE PALETTE STYLES", #6226), MOVED here
 * from under that scene's Style (owner 2026-10-02, tracker f40: *"Theme sets
 * background + fonts + colours"*; `lib/maker-look-sections.ts`).
 *
 * The same `PaletteLookRow`, saved the same way — into the draft, as the Dress
 * code scene's `canvas.palette`, through the one scene-canvas door
 * (`useSceneCanvas`) — and the Maker keeps its own copy of what it wrote
 * (`noteDraftedCanvas`), so a Style pick on that scene right after builds on it.
 * Drawn only where "Our colours" is drawn in the look — the Colours and roles
 * layout on the Invitation — and only when there are colours to show, so a
 * pick is never one that changes nothing. No line under it (owner, live
 * iPhone test 2026-10-05: no captions under controls).
 */
export function PaletteLookCanvasRow({
  eventId,
  canvas,
  eventType,
  draftAction,
  colours,
}: {
  eventId: string;
  /** The Dress code scene's canvas (drafted over live). */
  canvas: HubSectionCanvas;
  eventType: string | null;
  draftAction: ElementDraftAction;
  /** The couple's Mood Board colours — the dropdown's thumbnails. */
  colours: readonly string[];
}) {
  const { shown, save, pending, error } = useSceneCanvas(
    eventId,
    'dress_code',
    canvas,
    draftAction,
    (next) => noteDraftedCanvas('dress_code', next, canvas),
    /* 🖼 The look is redrawn on the page in place — never a Maker render that resets it. */
    { redraw: true },
  );
  const layout = resolveSceneStyle('dress_code', 'rsvp', shown.style, eventType);
  /* 🖼 The Stages panel, on the Dress code part: the looks are PICTURES (owner 08 Oct: *"palette should show the
     actual previews like the other styles"*), drawn by the shared look-card renderer. Studio › Look › Colours
     keeps the dropdown — the page under it may be a stage that draws no Dress code to picture. */
  const cards = useMaker()?.stagesStudio === true;
  const onDressPart = useStagePanelNow().picked === 'dress';
  const drawsPalette = layoutDrawsPaletteLook(layout);
  /* Tags is the default, and "Auto is an absence": picking it clears the key. */
  const pick = (id: string) => save((c) => { if (id === PALETTE_LOOK_DEFAULT) delete c.palette; else c.palette = id; });
  if (cards && onDressPart) {
    /* The cards are the page itself, which draws "Our colours" and the two lists in sample shapes until they
       exist (owner 08 Oct) — so they are offered before a colour or a line is written. The palette's cards
       only where the layout draws the look; the Do's & Don'ts' under every layout. */
    return (
      <>
        {drawsPalette ? <PaletteLookCards value={resolvePaletteLook(shown.palette)} pending={pending} onPick={pick} /> : null}
        {/* 🧾 The shipped notes are the default and an absence, like Tags. */}
        <DosLookCards value={resolveDosLook(shown.dos)} pending={pending} onPick={(id) => save((c) => { if (id === DOS_LOOK_DEFAULT) delete c.dos; else c.dos = id; })} />
        {error ? (
          <p role="alert" className="shrink-0 py-1 text-[12.5px] font-semibold text-terracotta-700">
            {error}
          </p>
        ) : null}
      </>
    );
  }
  /* The dropdown's thumbnails are the couple's colours — with none there is nothing to show in it. */
  if (!drawsPalette || colours.length === 0) return null;
  return (
    <div data-look-palette="">
      <PaletteLookRow
        value={resolvePaletteLook(shown.palette)}
        colours={colours}
        pending={pending}
        onPick={pick}
      />
      {error ? (
        <p role="alert" className="py-2 text-[12.5px] font-semibold text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * ⇔ STYLE › ARRANGE › ALIGNMENT (the new Maker, plan PR 2/3 — "Arrange (Shown/Hidden ·
 * Order · Centre)"). Behind the flag the Text tool is Font · Colour · Size only
 * (DECISION_LOG "TEXT STYLING STAYS THREE CONTROLS"), so the shipped Alignment row
 * (`part-inspector.tsx`) moves here, for the scene's words: ONE dropdown (As the
 * scene · Left · Centre · Right) setting every text part of the scene at once
 * (`withElementAlign`, the same per-part choice the Text row wrote), saved to the
 * draft through the scene's one door (`useSceneCanvas`).
 */
export function SceneAlignRow({
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
  const ss = useMaker()?.stagesStudio === true;
  /* ↕ The new Maker's row also carries Spacing, a class the bridge cannot lay — so there the scene is redrawn
     in place once the save lands (`redraw`), the way a Style pick is. */
  const { shown, save, pending, error } = useSceneCanvas(eventId, widgetType, canvas, draftAction, undefined, { redraw: ss });
  const keys = HUB_SCENE_ELEMENT_KEYS.filter((k) => HUB_ELEMENT_FIELDS[k].includes('align'));
  const now = keys.map((k) => shown.elements?.[k]?.align ?? null);
  const value = now.every((a) => a === now[0]) && now[0] ? now[0] : 'auto';
  const options = [{ key: 'auto', label: 'As the scene' }, ...HUB_ELEMENT_ALIGNS.map((a) => ({ key: a, label: HUB_ELEMENT_ALIGN_LABEL[a] }))];
  const pick = (k: string) => {
    if (pending) return;
    const align = k === 'auto' ? null : (k as HubElementAlign);
    save((c) => {
      let next = c.elements ?? null;
      for (const el of keys) next = withElementAlign(next, el, align);
      if (next) c.elements = next;
      else delete c.elements;
    });
  };
  /* 🧭 The new Maker: the prototype's `.r2` row — ALIGNMENT  Centre ▾ · SPACING  Regular ▾ (`stage-panel/kit.tsx`).
     ↕ Spacing is the scene's room above and below (`HubSectionCanvas.spacing`; Regular is the absence). */
  if (ss) {
    return (
      <>
      <div className="flex h-11 shrink-0 gap-1.5" data-stage-arrange="align">
        <Dd small="Alignment" label="Alignment" data="arrange-align" about="Follows the page, or set it left, centre or right." value={value} options={options} onPick={pick} />
      </div>
      <div className="flex h-11 shrink-0 gap-1.5" data-stage-arrange="spacing">
        <Dd
          small="Spacing"
          label="Spacing"
          data="arrange-spacing"
          about="The room above and below this scene."
          value={shown.spacing ?? 'regular'}
          options={[
            { key: 'tight', label: 'Tight' },
            { key: 'regular', label: 'Regular' },
            { key: 'roomy', label: 'Roomy' },
          ]}
          onPick={(k) => {
            if (pending) return;
            save((c) => {
              if (k === 'tight' || k === 'roomy') c.spacing = k;
              else delete c.spacing;
            });
          }}
        />
      </div>
      </>
    );
  }
  return (
    <>
      <IRow label="Alignment" data="scene-align">
        <PickMenu
          label="Alignment"
          dataAttr="data-scene-align-pick"
          value={value}
          options={[{ key: 'auto', label: 'As the scene' }, ...HUB_ELEMENT_ALIGNS.map((a) => ({ key: a, label: HUB_ELEMENT_ALIGN_LABEL[a] }))]}
          onPick={(k) => {
            if (pending) return;
            const align = k === 'auto' ? null : (k as HubElementAlign);
            save((c) => {
              let next = c.elements ?? null;
              for (const el of keys) next = withElementAlign(next, el, align);
              if (next) c.elements = next;
              else delete c.elements;
            });
          }}
        />
      </IRow>
      {error ? (
        <p role="alert" className="py-1 text-[12.5px] font-semibold text-terracotta-700">
          {error}
        </p>
      ) : null}
    </>
  );
}
