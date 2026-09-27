import type { WidgetType } from '@/lib/invitation-widgets';
import { makerEmptyPrompt, makerSceneLabel } from '@/lib/maker-scene-list';

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
export function MakerEmptyScene({ type }: { type: WidgetType }) {
  return (
    <section className="space-y-2 py-4 text-center" data-maker-empty={type}>
      <p className="pahina-eyebrow justify-center">
        <span>{makerSceneLabel(type)}</span>
      </p>
      <p className="font-pahina text-xl font-light italic text-ink/60">{makerEmptyPrompt(type)}</p>
      <p className="text-xs uppercase tracking-[0.2em] text-ink/40">Only you see this · guests see it once it has content</p>
    </section>
  );
}
