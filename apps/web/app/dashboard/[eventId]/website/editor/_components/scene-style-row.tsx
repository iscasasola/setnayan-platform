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
import { PaletteLookRow } from './palette-look-row';
import { PALETTE_LOOK_DEFAULT, layoutDrawsPaletteLook, resolvePaletteLook } from '@/lib/palette-looks';
import { useMaker } from '../../../launch/_components/maker-context';

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
  /* 🧭 The new Maker draws the same styles as a carousel (`StyleCarousel`). */
  const carousel = useMaker()?.stagesStudio === true;
  if (options.length < 2) return null;
  if (carousel) {
    return <StyleCarousel options={options} value={value} recommendedId={recommendedId} onPick={onPick} pending={pending} error={error} />;
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
 * 🎠 THE NEW MAKER'S STYLE — the SAME shipped styles (`sceneStyleOptions`,
 * `lib/scene-styles.ts`), side by side as a carousel (owner 2026-10-06: *"Style
 * are the presets"*; prototype `.lcar`). Never a new family list: these are the
 * scene's own three-or-so styles — `lib/layouts-are-the-shipped-scene-styles.test.ts`.
 * A tap applies at once: the page above IS the preview (the pick is redrawn in
 * place, drafted, counted on ✓). Each card is a button.
 */
function StyleCarousel({
  options,
  value,
  recommendedId,
  onPick,
  pending,
  error,
}: {
  options: readonly SceneStyleChoice[];
  value: string | null;
  recommendedId: string | null;
  onPick: (id: string) => void;
  pending: boolean;
  error: string | null;
}) {
  return (
    <div data-style-carousel="" className="py-2">
      <div role="radiogroup" aria-label="Layout" className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {options.map((o) => {
          const on = o.id === value;
          const recommended = recommendedId ? o.id === recommendedId : o.isDefault;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              data-style-card={o.id}
              onClick={() => {
                if (!pending && !on) onPick(o.id);
              }}
              className={`sn-press flex min-h-[92px] w-[9.75rem] shrink-0 snap-start flex-col rounded-xl bg-white px-3 py-2.5 text-left ring-1 transition-shadow duration-sn-control ease-sn ${
                on ? 'ring-2 ring-mulberry' : 'ring-ink/10'
              }`}
            >
              <span className="font-serif text-[16px] leading-tight text-ink">{o.name}</span>
              <span className="mt-1 line-clamp-3 text-[11.5px] leading-snug text-ink/65">{o.line}</span>
              {recommended ? <span className="mt-auto pt-1 text-[10.5px] font-semibold text-ink/50">Recommended</span> : null}
            </button>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="py-2 text-[12.5px] font-semibold text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
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
  if (colours.length === 0 || !layoutDrawsPaletteLook(layout)) return null;
  return (
    <div data-look-palette="">
      <PaletteLookRow
        value={resolvePaletteLook(shown.palette)}
        colours={colours}
        pending={pending}
        /* Tags is the default, and "Auto is an absence": picking it clears the key. */
        onPick={(id) => save((c) => { if (id === PALETTE_LOOK_DEFAULT) delete c.palette; else c.palette = id; })}
      />
      {error ? (
        <p role="alert" className="py-2 text-[12.5px] font-semibold text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
