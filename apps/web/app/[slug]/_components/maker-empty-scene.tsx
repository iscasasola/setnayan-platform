import type { ReactNode } from 'react';
import type { WidgetType } from '@/lib/invitation-widgets';
import { makerEmptyPrompt, makerSceneLabel } from '@/lib/maker-scene-list';
import { sceneStyleTypeOfWidget } from '@/lib/scene-styles';
import { SceneSample } from './maker-scene-samples';
import { SpecialMessageWidget } from './special-message-widget';
import { WhatToBringWidget } from './what-to-bring-widget';
import { renderCustomSection } from './custom-section-widget';
import { NO_SCENE_FACTS } from './scene-template';
import { isCustomSectionType } from '@/lib/custom-sections';

/**
 * 🧩 AN EMPTY SCENE, AS THE MAKER DRAWS IT — never as a guest sees it.
 *
 * Owner, 2026-09-27, on his own page: *"i still cannot edit. the editing body
 * page is not working at all."* Measured: his Love Story, Venue and Message
 * were empty, so the canvas drew nothing for them and they sank into "Not
 * shown" — the scenes he most needed to fill were the ones he could not tap.
 *
 * In the Maker's canvas only (`makerEmpty`, set by `site-body.tsx` from
 * `isMakerCanvas`) an empty scene keeps its place, drawn as its name and one
 * line saying what to add. It sits right after its `data-maker-section`
 * marker, so a tap selects it and opens its panel like any scene. A guest
 * never receives this markup — their page still skips an empty scene.
 *
 * 🔲 ITS LOOK, IN SAMPLE SHAPES (owner 08 Oct: *"still cannot see the gallery style? maybe show what it could look
 * like with boxes?"*): between the scene's name and its prompt, the arrangement of the look it is drawn in
 * (`styleId`, the scene's resolved style) — grey boxes for photos, short grey lines for words
 * (`maker-scene-samples.tsx`). A look card frames this same page per style, so every card of an empty scene is
 * its own picture, and the canvas shows the look picked. Shapes only, `aria-hidden`, Maker canvas only.
 *
 * One `<section>`, its parts its direct children (`every-widget-is-one-section`).
 * No card: words on the page, set quiet (house rule, DESIGN_BRIEF §3).
 */
export function MakerEmptyScene({
  type,
  look = null,
  setupLocks = false,
  styleId = null,
  ownSlots = null,
}: {
  /** 🖼 A template scene of their own: its picture slots, empty, in the template's places (`makerOwnSlots`). */
  ownSlots?: ReactNode;
  type: WidgetType;
  /** 🔲 The style this scene is drawn in on this stage (`sceneStyleOfRow`) — which arrangement the sample draws. */
  styleId?: string | null;
  look?: ReactNode;
  /** 🔓 This event draws "Finish your Event Hub" (`hubSetupApplies`): say which step unlocks the scene. */
  setupLocks?: boolean;
}) {
  return (
    <section className="space-y-2 py-4 text-center" data-maker-empty={type}>
      <p className="pahina-eyebrow justify-center" data-maker-empty-prompt="">
        <span>{makerSceneLabel(type)}</span>
      </p>
      {/* 🖼 A scene of their own made from a template with pictures: the template's own slots, drawn where the
          pictures go (owner 2026-10-18, *"we already have the templates, just make them work"*) — each tap opens that
          slot's picture in Edit. Steps aside with the prompt while the words are typed (the look below has them too). */}
      {ownSlots ? (
        <div data-maker-empty-prompt="" data-maker-own-slots="" className="text-left">
          {ownSlots}
        </div>
      ) : (
        <SceneSample sceneType={sceneStyleTypeOfWidget(type)} styleId={styleId} className="py-2" stepsAside />
      )}
      <p className="font-pahina text-xl font-light italic text-ink/70" data-maker-empty-prompt="">
        {makerEmptyPrompt(type, setupLocks)}
      </p>
      {/* ✍ THE SCENE'S REAL LOOK, HIDDEN (owner 2026-09-27: *"needs to show on
          the scene editor"*). While the couple types in the scene's Content box
          the canvas shows their words HERE, drawn exactly as guests will see
          them (`previewSceneWords`, `editor-bridge.tsx`), and the prompt above
          steps aside. Maker canvas only, like the rest of this scene. */}
      {look ? (
        <div hidden data-maker-look="" className="text-left">
          {look}
        </div>
      ) : null}
      <p className="text-xs uppercase tracking-[0.2em] text-ink/70">Only you see this · guests see it once it has content</p>
    </section>
  );
}

/**
 * ✍ The look an empty words scene is previewed in while the couple types
 * (`MakerEmptyScene`'s `look`): the SAME widget guests get, holding a stand-in
 * the canvas replaces with the couple's words (`previewSceneWords`). Null for a
 * scene whose content is not one text.
 */
export function makerWordsLook(type: string, config?: unknown): ReactNode {
  if (type === 'special_message') return <SpecialMessageWidget text={'\u2026'} />;
  if (type === 'what_to_bring') return <WhatToBringWidget text={'\u2026'} />;
  /* ✍ A scene of their own (owner 2026-10-17, *"i cannot edit this"*): its Heading and Words drawn by the guest's own
     renderer — the template's, when the scene was made from one (`renderCustomSection`) — for Edit's two rows to type
     into before the scene has any (`type-in-place-canvas.ts` `ownLookPart`). */
  if (isCustomSectionType(type)) {
    const canvas = config && typeof config === 'object' ? (config as { canvas?: unknown }).canvas : undefined;
    return renderCustomSection({ config: { canvas, title: '\u2026', body: '\u2026' }, facts: NO_SCENE_FACTS, makerSlots: true });
  }
  return null;
}

/**
 * 🖼 An EMPTY scene of their own made from a template that takes pictures: the template drawn with no words, every
 * picture slot an empty box in its place (`renderScene` `makerSlots`) — what the placeholder shows instead of a sample.
 * Null for a scene with no template, or a template with no pictures.
 */
export function makerOwnSlots(type: string, config?: unknown): ReactNode {
  if (!isCustomSectionType(type)) return null;
  const canvas = config && typeof config === 'object' ? (config as { canvas?: unknown }).canvas : undefined;
  return renderCustomSection({ config: { canvas }, facts: NO_SCENE_FACTS, makerSlots: true });
}
