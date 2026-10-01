import type { ReactNode } from 'react';
import type { WidgetType } from '@/lib/invitation-widgets';
import { makerEmptyPrompt, makerSceneLabel } from '@/lib/maker-scene-list';
import { SpecialMessageWidget } from './special-message-widget';
import { WhatToBringWidget } from './what-to-bring-widget';

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
 * One `<section>`, its parts its direct children (`every-widget-is-one-section`).
 * No card: words on the page, set quiet (house rule, DESIGN_BRIEF §3).
 */
export function MakerEmptyScene({
  type,
  look = null,
  setupLocks = false,
}: {
  type: WidgetType;
  look?: ReactNode;
  /** 🔓 This event draws "Finish your Event Hub" (`hubSetupApplies`): say which step unlocks the scene. */
  setupLocks?: boolean;
}) {
  return (
    <section className="space-y-2 py-4 text-center" data-maker-empty={type}>
      <p className="pahina-eyebrow justify-center" data-maker-empty-prompt="">
        <span>{makerSceneLabel(type)}</span>
      </p>
      <p className="font-pahina text-xl font-light italic text-ink/60" data-maker-empty-prompt="">
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
      <p className="text-xs uppercase tracking-[0.2em] text-ink/40">Only you see this · guests see it once it has content</p>
    </section>
  );
}

/**
 * ✍ The look an empty words scene is previewed in while the couple types
 * (`MakerEmptyScene`'s `look`): the SAME widget guests get, holding a stand-in
 * the canvas replaces with the couple's words (`previewSceneWords`). Null for a
 * scene whose content is not one text.
 */
export function makerWordsLook(type: string): ReactNode {
  if (type === 'special_message') return <SpecialMessageWidget text={'\u2026'} />;
  if (type === 'what_to_bring') return <WhatToBringWidget text={'\u2026'} />;
  return null;
}
